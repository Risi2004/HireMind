"""HireMind Speech-to-Text (STT) Service
Handles candidate voice transcription using Whisper Large V3 Turbo.
"""

import io
import time
import logging
from typing import Dict, Any, Optional
import requests

from config.settings import (
    STT_MODEL,
    OPENROUTER_BASE_URL,
    OPENROUTER_API_KEY,
    is_openrouter_configured,
)

logger = logging.getLogger("HireMindSTTService")


class SpeechToTextService:
    """Reusable Speech-to-Text service wrapping Whisper Large V3 Turbo."""

    SUPPORTED_MIME_TYPES = {
        "audio/webm",
        "audio/webm;codecs=opus",
        "audio/ogg",
        "audio/ogg;codecs=opus",
        "audio/wav",
        "audio/x-wav",
        "audio/mp4",
        "audio/m4a",
        "audio/mpeg",
        "audio/mp3",
    }

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or STT_MODEL

    def validate_audio(self, audio_bytes: bytes, filename: str, mime_type: str) -> Optional[str]:
        """Validate audio recording size, presence, and MIME type."""
        if not audio_bytes or len(audio_bytes) == 0:
            return "EMPTY_AUDIO: Audio payload contains 0 bytes."

        # Minimum realistic recording threshold (~0.3 seconds of header + data)
        if len(audio_bytes) < 256:
            return "EMPTY_AUDIO: Audio recording is too small to contain valid speech."

        # Maximum file size: 25 MB
        max_bytes = 25 * 1024 * 1024
        if len(audio_bytes) > max_bytes:
            return f"FILE_TOO_LARGE: Audio file size ({len(audio_bytes)} bytes) exceeds 25 MB limit."

        # Normalize MIME type string (strip parameters like codecs for checking)
        base_mime = mime_type.split(";")[0].strip().lower() if mime_type else ""
        if base_mime and base_mime not in [m.split(";")[0] for m in self.SUPPORTED_MIME_TYPES]:
            # Still allow if extension is known audio extension
            ext = filename.split(".")[-1].lower() if "." in filename else ""
            if ext not in ["webm", "ogg", "wav", "mp4", "m4a", "mp3"]:
                return f"UNSUPPORTED_FORMAT: Content-Type '{mime_type}' or extension '{ext}' is not supported."

        return None

    def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str = "recording.webm",
        mime_type: str = "audio/webm",
        prompt: Optional[str] = None,
        language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Transcribe candidate speech using Whisper Large V3 Turbo.

        Preserves verbatim candidate response without rewriting or LLM polishing.
        """
        start_time = time.time()
        logger.info(
            f"[VOICE_RECORDING_RECEIVED] size={len(audio_bytes)} bytes, filename={filename}, mime={mime_type}"
        )

        validation_err = self.validate_audio(audio_bytes, filename, mime_type)
        if validation_err:
            logger.warning(f"[STT_VALIDATION_FAILED] {validation_err}")
            return {
                "success": False,
                "error": validation_err,
                "text": "",
                "latencyMs": int((time.time() - start_time) * 1000),
            }

        if not is_openrouter_configured():
            logger.error("[ERROR] OpenRouter API key is not configured for Whisper STT.")
            return {
                "success": False,
                "error": "STT_CONFIG_ERROR: Provider credentials are not configured.",
                "text": "",
                "latencyMs": int((time.time() - start_time) * 1000),
            }

        logger.info(f"[STT_STARTED] model={self.model_name}")

        try:
            base_url = OPENROUTER_BASE_URL.rstrip("/")
            transcription_url = f"{base_url}/audio/transcriptions"

            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "HTTP-Referer": "https://hiremind.com",
                "X-Title": "HireMind STT Service",
            }

            # Prepare multipart upload
            file_tuple = (filename, io.BytesIO(audio_bytes), mime_type)
            files = {"file": file_tuple}
            data = {"model": self.model_name}
            # Fixing the language stops Whisper mis-detecting accented English, and the
            # prompt (question + role vocabulary) helps it spell technical terms correctly.
            data["language"] = (language or "en").strip()[:5]
            if prompt and prompt.strip():
                data["prompt"] = prompt.strip()[:800]
            data["temperature"] = "0"

            response = requests.post(
                transcription_url,
                headers=headers,
                files=files,
                data=data,
                timeout=30,
            )

            latency_ms = int((time.time() - start_time) * 1000)

            if response.status_code != 200:
                logger.error(
                    f"[ERROR] Whisper STT returned HTTP {response.status_code}: {response.text[:300]}"
                )
                return {
                    "success": False,
                    "error": f"STT_FAILED: Provider returned error HTTP {response.status_code}.",
                    "text": "",
                    "latencyMs": latency_ms,
                }

            result_json = response.json()
            raw_text = (result_json.get("text") or "").strip()

            # Rule 11: Empty / Bad Transcription check
            if not raw_text:
                logger.info("[STT_COMPLETED] Transcription returned empty text.")
                return {
                    "success": False,
                    "error": "EMPTY_TRANSCRIPT: No audible speech detected in the recording.",
                    "text": "",
                    "latencyMs": latency_ms,
                }

            logger.info(
                f"[STT_COMPLETED] Transcribed {len(raw_text)} chars in {latency_ms}ms"
            )

            return {
                "success": True,
                "text": raw_text,
                "language": result_json.get("language", "en"),
                "duration": result_json.get("duration") or result_json.get("usage", {}).get("seconds"),
                "latencyMs": latency_ms,
            }

        except requests.Timeout:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error("[ERROR] STT request timed out.")
            return {
                "success": False,
                "error": "STT_TIMEOUT: Transcription request timed out.",
                "text": "",
                "latencyMs": latency_ms,
            }
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"[ERROR] STT transcription failed: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"STT_ERROR: {str(e)}",
                "text": "",
                "latencyMs": latency_ms,
            }


# Singleton instance
stt_service_instance = SpeechToTextService()
