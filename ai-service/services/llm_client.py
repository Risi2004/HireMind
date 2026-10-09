"""Shared OpenRouter chat client for latency-sensitive agent calls.

Why this exists:
- The configured model (e.g. qwen3.x) is a *reasoning* model. Left unconstrained it can
  spend the entire max_tokens budget "thinking" and return EMPTY content
  (finish_reason=length). Callers then silently used canned fallback text, which is
  why per-answer feedback looked identical every time, and each call still took 10-15s.
- Reasoning is therefore disabled by default (LLM_REASONING=off). It can be re-enabled
  per deployment with LLM_REASONING=low|medium|high.
- Every call logs latency, token usage and finish reason, so empty or truncated
  responses are visible instead of hidden.
"""

import logging
import os
import threading
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from concurrent.futures import TimeoutError as FuturesTimeout
from dataclasses import dataclass, field
from typing import Any, Dict, Optional

import requests

from config.settings import AI_MODEL, OPENROUTER_BASE_URL, OPENROUTER_API_KEY, is_openrouter_configured

logger = logging.getLogger("LLMClient")

_REASONING_MODE = os.getenv("LLM_REASONING", "off").strip().lower()

# OpenRouter provider routing for the same model. Measured on the per-answer feedback call:
# default routing ~10-12s (58-73 tok/s) vs "throughput" ~1.7s (420-490 tok/s).
# Set LLM_PROVIDER_SORT to "latency", "price" or "" (OpenRouter default) to change it.
_PROVIDER_SORT = os.getenv("LLM_PROVIDER_SORT", "throughput").strip().lower()

# Pooled HTTP sessions (one per worker thread; requests.Session is not guaranteed thread-safe)
_local = threading.local()
_executor = ThreadPoolExecutor(max_workers=32, thread_name_prefix="llm")


def _thread_session() -> requests.Session:
    session = getattr(_local, "session", None)
    if session is None:
        session = requests.Session()
        _local.session = session
    return session


@dataclass
class LLMResult:
    content: Optional[str]
    latency_ms: int = 0
    finish_reason: Optional[str] = None
    usage: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None

    @property
    def ok(self) -> bool:
        return bool(self.content and self.content.strip())


def _reasoning_param() -> Dict[str, Any]:
    if _REASONING_MODE in ("", "off", "none", "false", "0"):
        return {"enabled": False}
    if _REASONING_MODE in ("low", "medium", "high"):
        return {"effort": _REASONING_MODE}
    return {"enabled": False}


def _post_once(payload: Dict[str, Any], label: str, timeout: float) -> LLMResult:
    """One HTTP attempt. Never raises."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://hiremind.com",
        "X-Title": f"HireMind {label}",
    }
    started = time.monotonic()
    try:
        response = _thread_session().post(
            f"{OPENROUTER_BASE_URL.rstrip('/')}/chat/completions",
            headers=headers,
            json=payload,
            timeout=(5, timeout),
        )
    except requests.Timeout:
        ms = int((time.monotonic() - started) * 1000)
        logger.warning(f"[{label}] timed out after {ms}ms")
        return LLMResult(content=None, latency_ms=ms, error="timeout")
    except Exception as e:  # network errors
        ms = int((time.monotonic() - started) * 1000)
        logger.warning(f"[{label}] request failed after {ms}ms: {e}")
        return LLMResult(content=None, latency_ms=ms, error=str(e))

    ms = int((time.monotonic() - started) * 1000)
    if response.status_code != 200:
        logger.warning(f"[{label}] HTTP {response.status_code} after {ms}ms: {response.text[:200]}")
        return LLMResult(content=None, latency_ms=ms, error=f"HTTP {response.status_code}")

    try:
        data = response.json()
    except ValueError:
        return LLMResult(content=None, latency_ms=ms, error="invalid JSON from provider")

    choice = (data.get("choices") or [{}])[0]
    content = (choice.get("message") or {}).get("content") or ""
    usage = data.get("usage") or {}
    finish = choice.get("finish_reason")
    reasoning_tokens = (usage.get("completion_tokens_details") or {}).get("reasoning_tokens")

    logger.info(
        f"[{label}] {ms}ms provider={data.get('provider')} finish={finish} completion_tokens={usage.get('completion_tokens')} "
        f"reasoning_tokens={reasoning_tokens} chars={len(content)}"
    )
    if not content.strip():
        logger.warning(f"[{label}] empty content (finish={finish}, reasoning_tokens={reasoning_tokens})")
        return LLMResult(content=None, latency_ms=ms, finish_reason=finish, usage=usage, error="empty content")

    return LLMResult(content=content, latency_ms=ms, finish_reason=finish, usage=usage)


def chat_completion(
    system: str,
    prompt: str,
    *,
    max_tokens: int,
    temperature: float = 0.3,
    timeout: float = 30.0,
    hedge_after: Optional[float] = None,
    label: str = "llm",
) -> LLMResult:
    """Chat completion with a hedged retry and a hard overall deadline. Never raises.

    Providers occasionally stall (observed: 48s for a 115-token reply). If the first
    attempt has not finished after `hedge_after` seconds, a second attempt routed by
    latency is started and whichever succeeds first is used. `timeout` bounds the total
    wall time, which a plain requests timeout does not (it only limits idle gaps).
    """
    if not is_openrouter_configured():
        return LLMResult(content=None, error="OPENROUTER_API_KEY is not configured")

    payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
        "reasoning": _reasoning_param(),
    }
    if _PROVIDER_SORT in ("throughput", "latency", "price"):
        # Fallbacks stay enabled: if the fastest provider is down, OpenRouter tries the next one
        payload["provider"] = {"sort": _PROVIDER_SORT}

    started = time.monotonic()
    hedge_delay = hedge_after if hedge_after is not None else min(8.0, timeout / 2)
    attempts = [_executor.submit(_post_once, payload, label, timeout)]

    try:
        result = attempts[0].result(timeout=hedge_delay)
        if result.ok:
            return result
    except FuturesTimeout:
        logger.warning(f"[{label}] no reply after {hedge_delay:.0f}s; starting hedged attempt")
    else:
        # First attempt failed fast (error/empty): one immediate retry
        attempts = []

    hedged_payload = dict(payload)
    hedged_payload["provider"] = {"sort": "latency"}
    attempts.append(_executor.submit(_post_once, hedged_payload, f"{label}:hedge", timeout))

    while attempts:
        remaining = timeout - (time.monotonic() - started)
        if remaining <= 0:
            break
        done, pending = wait(attempts, timeout=remaining, return_when=FIRST_COMPLETED)
        if not done:
            break
        for future in done:
            result = future.result()
            if result.ok:
                return result
        attempts = list(pending)

    ms = int((time.monotonic() - started) * 1000)
    logger.warning(f"[{label}] no usable reply within {ms}ms")
    return LLMResult(content=None, latency_ms=ms, error="deadline exceeded")
