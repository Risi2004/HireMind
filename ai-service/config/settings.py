import os
import logging
from pathlib import Path
from typing import Any, Union
from dotenv import load_dotenv

logger = logging.getLogger("HireMindSettings")

# Base directory for the AI service
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env file from ai-service directory
load_dotenv(BASE_DIR / ".env")

# -------------------------------------------------------------
# Model & Provider Configuration
# -------------------------------------------------------------
# Options: "runpod" (OpenAI-compatible vLLM/Ollama on RunPod), "gemini"
MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "runpod").lower()

# RunPod Configuration for local/remote model (e.g. Qwen 14B)
RUNPOD_MODEL_NAME = os.getenv("RUNPOD_MODEL_NAME", "qwen3:14b")
RUNPOD_ENDPOINT_URL = os.getenv("RUNPOD_ENDPOINT_URL", "http://localhost:8000/v1")
RUNPOD_API_KEY = os.getenv("RUNPOD_API_KEY", "runpod")

# Google Gemini Fallback Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.0-flash")

# Service Configuration
AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))
AI_SERVICE_HOST = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")


def is_runpod_configured() -> bool:
    """Check if RunPod endpoint is provided."""
    return bool(RUNPOD_ENDPOINT_URL and RUNPOD_ENDPOINT_URL.strip())


def is_gemini_configured() -> bool:
    """Check if a valid Gemini API key is configured."""
    return bool(GEMINI_API_KEY and GEMINI_API_KEY.strip() and GEMINI_API_KEY != "your_gemini_api_key_here")


def get_orchestrator_model() -> Union[str, Any]:
    """Resolves and configures the LLM for Google ADK.

    For RunPod (e.g., Qwen 14B), returns a Google ADK LiteLlm instance
    pointed to the RunPod OpenAI-compatible endpoint.
    For Gemini, returns the Gemini model string.
    """
    if MODEL_PROVIDER == "runpod":
        try:
            from google.adk.models.lite_llm import LiteLlm
            # LiteLLM format for OpenAI-compatible endpoints is "openai/<model_name>"
            lite_model_id = f"openai/{RUNPOD_MODEL_NAME}"
            logger.info(
                f"Configuring Google ADK with RunPod model '{RUNPOD_MODEL_NAME}' "
                f"at endpoint '{RUNPOD_ENDPOINT_URL}'"
            )
            return LiteLlm(
                model=lite_model_id,
                api_base=RUNPOD_ENDPOINT_URL,
                api_key=RUNPOD_API_KEY
            )
        except Exception as e:
            logger.error(f"Error initializing LiteLlm for RunPod: {e}. Falling back to default string.")
            return RUNPOD_MODEL_NAME

    # Default to Gemini
    return GEMINI_MODEL_NAME
