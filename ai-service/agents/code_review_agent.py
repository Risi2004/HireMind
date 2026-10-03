"""HireMind Code Review Agent
Reviews a candidate's live-coding submission and transitions to the next interview stage.
Returns None when the model is unavailable, so callers never present invented feedback.
"""

import logging
from typing import Optional

import requests

from config.settings import (
    MODEL_PROVIDER,
    AI_MODEL,
    OPENROUTER_BASE_URL,
    is_openrouter_configured,
)
from config import settings

logger = logging.getLogger("CodeReviewAgent")

MAX_CODE_CHARS = 6000


class CodeReviewAgent:
    SYSTEM_INSTRUCTION = (
        "You are the HireMind Lead Technical Interviewer. Review the candidate's code submission "
        "honestly and concisely (1-3 sentences): state whether it appears correct for the problem, "
        "give its time and space complexity in Big-O, and mention any missed edge cases or bugs. "
        "Base every claim strictly on the code and execution output provided; never assume behaviour "
        "you cannot see. Then smoothly introduce the next interview section and ask exactly ONE question."
    )

    def review(
        self,
        code: str,
        language: str,
        run_output: str,
        explanation: str,
        next_stage_name: str,
        next_stage_topics: Optional[list] = None,
    ) -> Optional[str]:
        if MODEL_PROVIDER != "openrouter" or not is_openrouter_configured():
            logger.warning("Code review skipped: OpenRouter is not configured.")
            return None

        topics = ", ".join(next_stage_topics or []) or "the next topic"
        prompt = (
            f"Language: {language or 'unspecified'}\n"
            f"Candidate code:\n```{language or ''}\n{(code or '')[:MAX_CODE_CHARS]}\n```\n"
            f"Execution output: {run_output or 'Not run by the candidate.'}\n"
            f"Candidate's explanation: {explanation or 'None provided.'}\n\n"
            f"Next interview section: {next_stage_name or 'the next phase'} (topics: {topics})."
        )

        try:
            response = requests.post(
                f"{OPENROUTER_BASE_URL.rstrip('/')}/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                    "X-Title": "HireMind Code Review Agent",
                },
                json={
                    "model": AI_MODEL,
                    "messages": [
                        {"role": "system", "content": self.SYSTEM_INSTRUCTION},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.2,
                    "max_tokens": 400,
                },
                timeout=40,
            )
            if response.status_code != 200:
                logger.warning(f"Code review model returned HTTP {response.status_code}")
                return None
            choices = response.json().get("choices", [])
            content = (choices[0].get("message", {}).get("content") or "").strip() if choices else ""
            return content or None
        except Exception as e:
            logger.warning(f"Code review call failed: {e}")
            return None


code_review_agent_instance = CodeReviewAgent()
