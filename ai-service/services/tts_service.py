"""HireMind Text-to-Speech (TTS) Service
Synthesizes interviewer speech from question text using Gemini 3.8 Flash-Lite TTS.
"""

import io
import time
import wave
import hashlib
import logging
from typing import Dict, Any, Optional, Tuple
import requests

from config.settings import (
    TTS_MODEL,
    TTS_VOICE,
    OPENROUTER_BASE_URL,
    OPENROUTER_API_KEY,
    is_openrouter_configured,
)

logger = logging.getLogger("HireMindTTSService")


def pcm_to_wav(
    pcm_bytes: bytes,
    sample_rate: int = 24000,
    channels: int = 1,
    sampwidth: int = 2,
) -> bytes:
    """Wrap raw 16-bit PCM audio in a standard 44-byte RIFF WAV header."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(sampwidth)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


class TextToSpeechService:
    """Reusable Text-to-Speech service wrapping Gemini 3.8 Flash-Lite TTS."""

    def __init__(self, model_name: Optional[str] = None, default_voice: Optional[str] = None):
        self.model_name = model_name or TTS_MODEL
        self.default_voice = default_voice or TTS_VOICE
        # In-memory LRU-like cache for generated audio bytes (Rule 30: Cost Control)
        # Key: md5(model + voice + cleaned_text) -> (audio_wav_bytes, timestamp)
        self._cache: Dict[str, Tuple[bytes, float]] = {}
        self._max_cache_entries = 120

    def _cache_key(self, text: str, voice: str) -> str:
        h = hashlib.md5(f"{self.model_name}:{voice}:{text.strip()}".encode("utf-8")).hexdigest()
        return h

    def get_cached_audio(self, text: str, voice: Optional[str] = None) -> Optional[bytes]:
        """Check if audio for this exact text was already synthesized."""
        chosen_voice = voice or self.default_voice
        key = self._cache_key(text, chosen_voice)
        entry = self._cache.get(key)
        if entry:
            return entry[0]
        return None

    def generate_speech(
        self,
        text: str,
        voice: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate interviewer audio using Gemini 3.8 Flash-Lite TTS.

        Returns:
            {
                "success": bool,
                "audio_bytes": bytes (WAV format),
                "media_type": "audio/wav",
                "voice": str,
                "model": str,
                "cached": bool,
                "latencyMs": int,
                "error": Optional[str]
            }
        """
        start_time = time.time()
        cleaned_text = (text or "").strip()

        if not cleaned_text:
            return {
                "success": False,
                "error": "EMPTY_TEXT: Cannot generate speech for empty text.",
                "audio_bytes": b"",
                "media_type": "audio/wav",
                "cached": False,
                "latencyMs": 0,
            }

        chosen_voice = voice or self.default_voice
        cache_key = self._cache_key(cleaned_text, chosen_voice)

        # Check in-memory audio cache
        if cache_key in self._cache:
            audio_bytes, _ = self._cache[cache_key]
            latency_ms = int((time.time() - start_time) * 1000)
            logger.info(f"[TTS_CACHED_HIT] Reusing cached audio for text: '{cleaned_text[:40]}...'")
            return {
                "success": True,
                "audio_bytes": audio_bytes,
                "media_type": "audio/wav",
                "voice": chosen_voice,
                "model": self.model_name,
                "cached": True,
                "latencyMs": latency_ms,
            }

        if not is_openrouter_configured():
            logger.error("[ERROR] OpenRouter credentials not configured for TTS.")
            return {
                "success": False,
                "error": "TTS_CONFIG_ERROR: OpenRouter API key not configured.",
                "audio_bytes": b"",
                "media_type": "audio/wav",
                "cached": False,
                "latencyMs": int((time.time() - start_time) * 1000),
            }

        logger.info(
            f"[TTS_STARTED] model={self.model_name}, voice={chosen_voice}, text_len={len(cleaned_text)}"
        )

        try:
            base_url = OPENROUTER_BASE_URL.rstrip("/")
            speech_url = f"{base_url}/audio/speech"

            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://hiremind.com",
                "X-Title": "HireMind Live Interview TTS",
            }

            payload = {
                "model": self.model_name,
                "input": cleaned_text,
                "voice": chosen_voice,
            }

            response = requests.post(
                speech_url,
                headers=headers,
                json=payload,
                timeout=35,
            )

            latency_ms = int((time.time() - start_time) * 1000)

            if response.status_code != 200:
                logger.error(
                    f"[ERROR] Gemini TTS returned HTTP {response.status_code}: {response.text[:300]}"
                )
                return {
                    "success": False,
                    "error": f"TTS_FAILED: Provider returned error HTTP {response.status_code}.",
                    "audio_bytes": b"",
                    "media_type": "audio/wav",
                    "cached": False,
                    "latencyMs": latency_ms,
                }

            raw_audio = response.content
            content_type = response.headers.get("Content-Type", "")

            # If raw PCM, wrap in standard RIFF WAV header for universal browser compatibility
            if "pcm" in content_type or not raw_audio.startswith(b"RIFF"):
                wav_audio = pcm_to_wav(raw_audio, sample_rate=24000, channels=1, sampwidth=2)
            else:
                wav_audio = raw_audio

            # Store in cache
            if len(self._cache) >= self._max_cache_entries:
                # Evict oldest entry
                oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k][1])
                del self._cache[oldest_key]

            self._cache[cache_key] = (wav_audio, time.time())

            logger.info(
                f"[TTS_COMPLETED] Generated {len(wav_audio)} WAV bytes in {latency_ms}ms"
            )

            return {
                "success": True,
                "audio_bytes": wav_audio,
                "media_type": "audio/wav",
                "voice": chosen_voice,
                "model": self.model_name,
                "cached": False,
                "latencyMs": latency_ms,
            }

        except requests.Timeout:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error("[ERROR] TTS request timed out.")
            return {
                "success": False,
                "error": "TTS_TIMEOUT: Synthesis request timed out.",
                "audio_bytes": b"",
                "media_type": "audio/wav",
                "cached": False,
                "latencyMs": latency_ms,
            }
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"[ERROR] TTS synthesis failed: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"TTS_ERROR: {str(e)}",
                "audio_bytes": b"",
                "media_type": "audio/wav",
                "cached": False,
                "latencyMs": latency_ms,
            }


# Singleton instance
tts_service_instance = TextToSpeechService()
