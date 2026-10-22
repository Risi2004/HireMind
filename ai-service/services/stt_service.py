"""HireMind Speech-to-Text (STT) Service
Handles candidate voice transcription using Whisper, either locally (faster-whisper)
or through OpenRouter's hosted Whisper (STT_PROVIDER=remote).
"""

import io
import os
import time
import logging
import re
import threading
from typing import Dict, Any, Optional

import numpy as np
import requests
from config.settings import (
    STT_MODEL,
    STT_DEVICE,
    STT_PROVIDER,
    OPENROUTER_BASE_URL,
    OPENROUTER_API_KEY,
    is_openrouter_configured,
)

# Local-model libraries are imported only when STT_PROVIDER=local, so the remote
# provider does not spend memory on them (matters on 512 MB hosts).
WhisperModel = available_models = decode_audio = None
VadOptions = get_speech_timestamps = ctranslate2 = None
_local_backend_loaded = False


def _import_local_backend() -> None:
    global WhisperModel, available_models, decode_audio, VadOptions, get_speech_timestamps, ctranslate2
    global _local_backend_loaded
    if _local_backend_loaded:
        return
    _local_backend_loaded = True

    import av

    # Compatibility patch for PyAV >= 14/15 where metadata_errors was removed
    orig_av_open = av.open

    def _compat_av_open(*args, **kwargs):
        kwargs.pop("metadata_errors", None)
        return orig_av_open(*args, **kwargs)

    av.open = _compat_av_open

    try:
        from faster_whisper import WhisperModel, available_models, decode_audio
        from faster_whisper.vad import VadOptions, get_speech_timestamps
    except ImportError:
        pass

    try:
        import ctranslate2
    except ImportError:
        pass


SAMPLE_RATE = 16000

logger = logging.getLogger("HireMindSTTService")


class RemoteSTTError(Exception):
    """Hosted STT failure; the message is the client-facing error code + text."""


class SpeechToTextService:
    """Speech-to-Text service powered by Whisper."""

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

    DEFAULT_MODEL = "large-v3-turbo"

    def __init__(self, model_name: Optional[str] = None, provider: Optional[str] = None):
        self.provider = "remote" if (provider or STT_PROVIDER) == "remote" else "local"
        if self.provider == "remote":
            self.model_name = (model_name or STT_MODEL or "openai/whisper-large-v3-turbo").strip()
        else:
            _import_local_backend()
            self.model_name = self._resolve_model_name(model_name or STT_MODEL)
        logger.info(f"[STT_PROVIDER] {self.provider} (model={self.model_name})")
        self._whisper_model = None
        self.device = None
        self._model_lock = threading.Lock()
        self._streams: Dict[str, Dict[str, Any]] = {}
        self._streams_lock = threading.Lock()

    @classmethod
    def _resolve_model_name(cls, raw_name: Optional[str]) -> str:
        """Map a configured name (e.g. "openai/whisper-large-v3-turbo") to a faster-whisper model size."""
        name = (raw_name or "").strip()
        if not name:
            return cls.DEFAULT_MODEL
        size_part = name.split("/")[-1].replace("whisper-", "").strip().lower()
        known = set(available_models()) if available_models else set()
        if size_part in known:
            return size_part
        logger.warning(
            f"[STT_MODEL_UNKNOWN] '{name}' is not a faster-whisper model; using '{cls.DEFAULT_MODEL}'."
        )
        return cls.DEFAULT_MODEL

    @staticmethod
    def _register_cuda_libraries() -> None:
        """Make pip-installed NVIDIA runtime DLLs (nvidia-cublas-cu12, nvidia-cudnn-cu12) loadable on Windows."""
        if os.name != "nt":
            return
        try:
            import nvidia  # namespace package created by the nvidia-*-cu12 wheels
        except ImportError:
            return
        for root in getattr(nvidia, "__path__", []):
            for lib in ("cublas", "cudnn"):
                bin_dir = os.path.join(root, lib, "bin")
                if os.path.isdir(bin_dir) and bin_dir not in os.environ.get("PATH", ""):
                    os.add_dll_directory(bin_dir)
                    os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")

    def _load_on_gpu(self):
        """Load on an NVIDIA GPU when one is usable; None means use the CPU."""
        if STT_DEVICE not in ("auto", "cuda") or ctranslate2 is None or ctranslate2.get_cuda_device_count() == 0:
            return None
        try:
            self._register_cuda_libraries()
            logger.info(f"[STT_MODEL_INIT] Loading Whisper model '{self.model_name}' on GPU (float16)...")
            model = WhisperModel(self.model_name, device="cuda", compute_type="float16")
            # CUDA libraries are only loaded on first inference, so prove the GPU path works now
            segments, _ = model.transcribe(np.zeros(SAMPLE_RATE, dtype=np.float32), language="en", beam_size=1)
            list(segments)
            return model
        except Exception as e:
            logger.warning(f"[STT_MODEL_INIT] GPU unavailable ({e}); falling back to CPU.")
            return None

    def _get_model(self):
        """Load the Whisper model once (thread-safe; also used by the startup warm-up)."""
        if self._whisper_model is None:
            with self._model_lock:
                if self._whisper_model is None:
                    if WhisperModel is None:
                        raise RuntimeError("faster-whisper is not installed. Please install faster-whisper.")
                    model = self._load_on_gpu()
                    if model is not None:
                        self.device = "cuda"
                    else:
                        # Measured on a 20-core dev machine: 16 threads ~25% faster than 8
                        cpu_threads = min(16, os.cpu_count() or 4)
                        logger.info(
                            f"[STT_MODEL_INIT] Loading Whisper model '{self.model_name}' on CPU (int8, {cpu_threads} threads)..."
                        )
                        model = WhisperModel(
                            self.model_name, device="cpu", compute_type="int8", cpu_threads=cpu_threads
                        )
                        self.device = "cpu"
                    self._whisper_model = model
                    logger.info(f"[STT_MODEL_READY] Whisper model '{self.model_name}' initialized on {self.device}.")
        return self._whisper_model

    def warm_up(self) -> None:
        """Download/load the model in the background so the first answer is not delayed."""
        if self.provider != "local":
            return

        def _load():
            try:
                model = self._get_model()
                # The first inference is much slower (measured 14.8s vs 8.3s); pay it here
                segments, _ = model.transcribe(np.zeros(SAMPLE_RATE, dtype=np.float32), language="en", beam_size=1)
                list(segments)
                logger.info("[STT_MODEL_READY] Warm-up inference done.")
            except Exception as e:
                logger.error(f"[STT_MODEL_INIT] Warm-up failed, will retry on first request: {e}")

        threading.Thread(target=_load, name="whisper-warmup", daemon=True).start()

    def validate_audio(self, audio_bytes: bytes, filename: str, mime_type: str) -> Optional[str]:
        """Validate audio recording size, presence, and MIME type."""
        if not audio_bytes or len(audio_bytes) == 0:
            return "EMPTY_AUDIO: Audio payload contains 0 bytes."

        # Minimum realistic recording threshold (~0.2 seconds)
        if len(audio_bytes) < 256:
            return "EMPTY_AUDIO: Audio recording is too small to contain valid speech."

        # Maximum file size: 25 MB
        max_bytes = 25 * 1024 * 1024
        if len(audio_bytes) > max_bytes:
            return f"FILE_TOO_LARGE: Audio file size ({len(audio_bytes)} bytes) exceeds 25 MB limit."

        return None

    def _remote_text(self, audio_bytes: bytes, filename: str, mime_type: str, prompt: Optional[str], lang: str):
        """Transcribe with OpenRouter's hosted Whisper; returns (text, duration, language)."""
        if not is_openrouter_configured():
            logger.error("[ERROR] OpenRouter API key is not configured for Whisper STT.")
            raise RemoteSTTError("STT_CONFIG_ERROR: Provider credentials are not configured.")

        data = {
            "model": self.model_name,
            # Fixing the language stops Whisper mis-detecting accented English, and the
            # prompt (question + role vocabulary) helps it spell technical terms correctly.
            "language": lang,
            "temperature": "0",
        }
        if prompt:
            data["prompt"] = prompt
        try:
            response = requests.post(
                f"{OPENROUTER_BASE_URL.rstrip('/')}/audio/transcriptions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "HTTP-Referer": "https://hiremind.com",
                    "X-Title": "HireMind STT Service",
                },
                files={"file": (filename, io.BytesIO(audio_bytes), mime_type)},
                data=data,
                timeout=30,
            )
        except requests.Timeout:
            logger.error("[ERROR] STT request timed out.")
            raise RemoteSTTError("STT_TIMEOUT: Transcription request timed out.")

        if response.status_code != 200:
            logger.error(f"[ERROR] Whisper STT returned HTTP {response.status_code}: {response.text[:300]}")
            raise RemoteSTTError(f"STT_FAILED: Provider returned error HTTP {response.status_code}.")

        result_json = response.json()
        raw_text = (result_json.get("text") or "").strip()
        if raw_text and self._is_hallucination(raw_text):
            logger.warning(f"[STT_HALLUCINATION_FILTERED] Discarded hallucination loop: '{raw_text[:60]}...'")
            raw_text = ""
        duration = result_json.get("duration") or (result_json.get("usage") or {}).get("seconds") or 0.0
        return raw_text, float(duration), result_json.get("language", lang)

    def _whisper_text(self, audio, prompt: Optional[str], lang: str):
        """Run Whisper on a file-like object or 16 kHz float32 array; returns (text, info)."""
        model = self._get_model()
        segments, info = model.transcribe(
            audio,
            initial_prompt=prompt or None,
            language=lang if lang != "auto" else None,
            beam_size=5,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=True,
            # Generous padding so VAD does not clip the first/last syllable of words
            vad_parameters=dict(min_silence_duration_ms=500, speech_pad_ms=400),
            no_speech_threshold=0.6,
            repetition_penalty=1.2,
        )

        collected_segments = []
        for segment in segments:
            # Discard segments with high silence probability
            if getattr(segment, "no_speech_prob", 0.0) > 0.65:
                continue
            text_part = segment.text.strip()
            if text_part:
                collected_segments.append(text_part)

        raw_text = " ".join(collected_segments).strip()
        if raw_text and self._is_hallucination(raw_text):
            logger.warning(f"[STT_HALLUCINATION_FILTERED] Discarded hallucination loop: '{raw_text[:60]}...'")
            raw_text = ""
        return raw_text, info

    @staticmethod
    def _is_hallucination(raw_text: str) -> bool:
        """Detect autoregressive hallucination loops (e.g. repeated phrases)."""
        if re.search(r"(take a little bit of water|thanks? for watching|subtitles? by|closed captioning)", raw_text, re.IGNORECASE):
            return True
        words = raw_text.split()
        if len(words) >= 6:
            for n in range(2, 10):
                for i in range(len(words) - n):
                    phrase = " ".join(words[i:i+n]).lower()
                    count = raw_text.lower().count(phrase)
                    if count >= 3 and len(phrase) >= 8 and (count * len(phrase)) > (len(raw_text) * 0.45):
                        return True
        return False

    # ---- Incremental (streaming) transcription -------------------------------------------
    # While the candidate is still talking the browser re-sends the recording so far. Audio up
    # to a clear pause is transcribed and committed, so when they stop only the last few
    # seconds remain to transcribe instead of the whole answer.
    STREAM_TTL_S = 15 * 60
    MIN_CHUNK_S = 4.0          # do not commit tiny chunks (less context = lower accuracy)
    MIN_CUT_SILENCE_S = 0.6    # only cut inside a real pause, never mid-word
    SHORT_CUT_SILENCE_S = 0.3  # a gap between words; used once a long stretch has no real pause
    LONG_UNCOMMITTED_S = 10.0
    TAIL_GUARD_S = 0.8         # keep the most recent audio uncommitted; the speaker may continue

    def _get_stream(self, stream_id: str) -> Dict[str, Any]:
        now = time.time()
        with self._streams_lock:
            for key in [k for k, v in self._streams.items() if now - v["updated"] > self.STREAM_TTL_S]:
                del self._streams[key]
            stream = self._streams.get(stream_id)
            if stream is None:
                stream = {"committed_samples": 0, "texts": [], "lock": threading.Lock(), "updated": now}
                self._streams[stream_id] = stream
            stream["updated"] = now
            return stream

    def _find_commit_cut(self, region) -> int:
        """Sample index inside the newest clear pause that is safe to cut at (0 = none)."""
        rate = SAMPLE_RATE
        limit = len(region) - int(self.TAIL_GUARD_S * rate)
        if limit < int(self.MIN_CHUNK_S * rate):
            return 0
        silences = [self.MIN_CUT_SILENCE_S]
        if len(region) >= int(self.LONG_UNCOMMITTED_S * rate):
            silences.append(self.SHORT_CUT_SILENCE_S)
        for min_silence in silences:
            speech = get_speech_timestamps(
                region, VadOptions(min_silence_duration_ms=int(min_silence * 1000), speech_pad_ms=0)
            )
            if not speech:
                return 0
            # Pauses between speech regions, plus the trailing pause after the last one
            gaps = [(a["end"], b["start"]) for a, b in zip(speech, speech[1:])]
            gaps.append((speech[-1]["end"], len(region)))
            cut = 0
            for gap_start, gap_end in gaps:
                if gap_end - gap_start < int(min_silence * rate):
                    continue
                # Just after the speech ends, inside the pause
                point = gap_start + min(int(0.3 * rate), (gap_end - gap_start) // 2)
                if int(self.MIN_CHUNK_S * rate) <= point <= limit:
                    cut = point
            if cut:
                return cut
        return 0

    @staticmethod
    def _chunk_prompt(prompt: Optional[str], texts) -> Optional[str]:
        """Interview context plus the end of what was already said, so chunks read as one answer."""
        context = (prompt or "").strip()[:500]
        previous = " ".join(texts)[-300:]
        combined = f"{context} {previous}".strip()
        return combined[:800] or None

    def _transcribe_stream(self, audio_bytes: bytes, stream_id: str, final: bool, prompt: Optional[str], lang: str):
        stream = self._get_stream(stream_id)
        with stream["lock"]:
            audio = decode_audio(io.BytesIO(audio_bytes), sampling_rate=SAMPLE_RATE)
            committed = stream["committed_samples"]
            if committed > len(audio):
                # Not the same recording any more; start over
                committed, stream["committed_samples"], stream["texts"] = 0, 0, []
            region = audio[committed:]

            if not final:
                cut = self._find_commit_cut(region)
                if cut:
                    text, _ = self._whisper_text(region[:cut], self._chunk_prompt(prompt, stream["texts"]), lang)
                    if text:
                        stream["texts"].append(text)
                    stream["committed_samples"] = committed + cut
                    logger.info(
                        f"[STT_STREAM_COMMIT] {stream_id[:12]} +{cut / SAMPLE_RATE:.1f}s "
                        f"(committed {stream['committed_samples'] / SAMPLE_RATE:.1f}s of {len(audio) / SAMPLE_RATE:.1f}s)"
                    )
                return " ".join(stream["texts"]).strip(), len(audio) / SAMPLE_RATE

            # Final: committed text + the uncommitted tail. The tail is not committed, so a
            # speculative final followed by more speech still produces the right result.
            tail = ""
            if len(region) >= int(0.3 * SAMPLE_RATE):
                tail, _ = self._whisper_text(region, self._chunk_prompt(prompt, stream["texts"]), lang)
            logger.info(
                f"[STT_STREAM_FINAL] {stream_id[:12]} reused {committed / SAMPLE_RATE:.1f}s, "
                f"transcribed tail {len(region) / SAMPLE_RATE:.1f}s"
            )
            return " ".join(stream["texts"] + ([tail] if tail else [])).strip(), len(audio) / SAMPLE_RATE

    def transcribe_audio(
        self,
        audio_bytes: bytes,
        filename: str = "recording.webm",
        mime_type: str = "audio/webm",
        prompt: Optional[str] = None,
        language: Optional[str] = None,
        stream_id: Optional[str] = None,
        final: bool = True,
    ) -> Dict[str, Any]:
        """Transcribe candidate speech using Whisper.

        Preserves verbatim candidate response with high technical precision. With a
        `stream_id`, partial uploads (final=False) pre-transcribe the answer while it is
        still being spoken and the final upload only transcribes what is left.
        """
        start_time = time.time()
        logger.info(
            f"[VOICE_RECORDING_RECEIVED] size={len(audio_bytes)} bytes, filename={filename}, mime={mime_type}, "
            f"stream={stream_id[:12] if stream_id else '-'}, final={final}"
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

        incremental = self.provider == "local"
        if not final and not incremental:
            # The hosted provider cannot reuse partial work; acknowledge without a paid call
            # and tell the client to stop sending mid-answer uploads.
            return {"success": True, "partial": True, "incremental": False, "text": "", "latencyMs": 0}

        logger.info(f"[STT_STARTED] provider={self.provider}, model={self.model_name}, prompt_len={len(prompt or '')}")

        try:
            # Technical context prompt helps Whisper transcribe programming libraries,
            # frameworks, and technical jargon with extreme fidelity
            initial_prompt = (prompt or "").strip()[:800] if prompt else None
            lang = (language or "en").strip()[:5]

            if self.provider == "remote":
                raw_text, duration, detected_language = self._remote_text(
                    audio_bytes, filename, mime_type, initial_prompt, lang
                )
            elif stream_id:
                raw_text, duration = self._transcribe_stream(audio_bytes, stream_id, final, prompt, lang)
                detected_language = lang
            else:
                raw_text, info = self._whisper_text(io.BytesIO(audio_bytes), initial_prompt, lang)
                duration = getattr(info, "duration", 0.0)
                detected_language = getattr(info, "language", lang)
            latency_ms = int((time.time() - start_time) * 1000)

            if not final:
                # Partial uploads only warm the stream; an empty result is not an error
                return {
                    "success": True,
                    "partial": True,
                    "incremental": True,
                    "text": raw_text,
                    "language": detected_language,
                    "duration": round(duration, 2),
                    "latencyMs": latency_ms,
                }

            if not raw_text:
                logger.info("[STT_COMPLETED] Transcription returned empty text.")
                return {
                    "success": False,
                    "error": "EMPTY_TRANSCRIPT: No audible speech detected in the recording.",
                    "text": "",
                    "latencyMs": latency_ms,
                }

            logger.info(
                f"[STT_COMPLETED] Transcribed {len(raw_text)} chars in {latency_ms}ms: '{raw_text[:60]}...'"
            )

            return {
                "success": True,
                "text": raw_text,
                "language": detected_language,
                "duration": round(duration, 2),
                "latencyMs": latency_ms,
            }

        except RemoteSTTError as e:
            return {
                "success": False,
                "error": str(e),
                "text": "",
                "latencyMs": int((time.time() - start_time) * 1000),
            }
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error(f"[ERROR] Whisper STT transcription failed: {str(e)}", exc_info=True)
            return {
                "success": False,
                "error": f"STT_ERROR: {str(e)}",
                "text": "",
                "latencyMs": latency_ms,
            }


# Singleton instance
stt_service_instance = SpeechToTextService()
