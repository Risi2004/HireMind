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
# Options: "openrouter", "gemini"
MODEL_PROVIDER = os.getenv("MODEL_PROVIDER", "openrouter").lower()

# OpenRouter Configuration
# The model identifier to use with OpenRouter, configured via the 'aimodel' environment variable
AI_MODEL = os.getenv("aimodel", os.getenv("AIMODEL", "qwen/qwen-2.5-72b-instruct"))
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

# Google Gemini Fallback Configuration
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.0-flash")

# Service Configuration
AI_SERVICE_PORT = int(os.getenv("AI_SERVICE_PORT", "8000"))
AI_SERVICE_HOST = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")


def is_openrouter_configured() -> bool:
    """Check if OpenRouter API key is provided."""
    return bool(OPENROUTER_API_KEY and OPENROUTER_API_KEY.strip() and OPENROUTER_API_KEY != "your_openrouter_api_key_here")


def is_gemini_configured() -> bool:
    """Check if a valid Gemini API key is configured."""
    return bool(GEMINI_API_KEY and GEMINI_API_KEY.strip() and GEMINI_API_KEY != "your_gemini_api_key_here")


def get_orchestrator_model() -> Union[str, Any]:
    """Resolves and configures the LLM for Google ADK.

    For OpenRouter, returns a Google ADK LiteLlm instance pointed
    to OpenRouter with the model specified in the 'aimodel' env variable.
    For Gemini, returns the Gemini model string.
    """
    if MODEL_PROVIDER == "openrouter":
        try:
            from google.adk.models.lite_llm import LiteLlm
            lite_model_id = f"openrouter/{AI_MODEL}"
            logger.info(
                f"Configuring Google ADK with OpenRouter model '{AI_MODEL}' "
                f"at endpoint '{OPENROUTER_BASE_URL}'"
            )
            return LiteLlm(
                model=lite_model_id,
                api_base=OPENROUTER_BASE_URL,
                api_key=OPENROUTER_API_KEY
            )
        except Exception as e:
            logger.error(f"Error initializing LiteLlm for OpenRouter: {e}. Falling back to model name.")
            return AI_MODEL

    # Default to Gemini
    return GEMINI_MODEL_NAME
