"""Multi-provider async LLM client for the Chat volume.

Provider-agnostic: talks to any OpenAI-compatible endpoint. The primary
provider is defined by `settings.llm_api_key/base_url/model`; optional
fallbacks live in `settings.llm_fallbacks` and are tried in order when
the current provider fails with a retriable error.

The rest of the app must import and start cleanly with no API key present,
so keys are only checked (and clients only constructed) inside `complete`.
"""

from dataclasses import dataclass
from typing import Any

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    RateLimitError,
)

from app.config import settings

# OpenRouter analytics headers — harmless on other providers.
_HEADERS = {
    "HTTP-Referer": "https://github.com/Tufaye1/Jarvis_Ai_OS",
    "X-Title": "Jarvis AI OS",
}

# HTTP status codes that mean "this provider can't serve — try the next."
# 400/404 are NOT retriable: they usually mean the request itself is malformed
# or the model doesn't exist, and other providers won't fix that.
_RETRIABLE_STATUSES = {401, 402, 408, 409, 429, 500, 502, 503, 504}


class LLMNotConfigured(RuntimeError):
    """Raised when no LLM providers have an API key configured."""


class AllProvidersFailed(RuntimeError):
    """All providers were tried and all failed. Wraps the last exception."""

    def __init__(self, attempts: list[tuple[str, Exception]]):
        self.attempts = attempts
        detail = "; ".join(f"{model}: {type(exc).__name__}" for model, exc in attempts)
        super().__init__(f"all LLM providers failed: {detail}")


@dataclass(frozen=True)
class _Provider:
    api_key: str
    base_url: str
    model: str


def _resolve_providers() -> list[_Provider]:
    """Ordered list of configured providers: primary first, then fallbacks.

    Skips slots with a blank api_key. Empty result means nothing is configured.
    """
    result: list[_Provider] = []
    if (settings.llm_api_key or "").strip():
        result.append(
            _Provider(
                api_key=settings.llm_api_key.strip(),
                base_url=settings.llm_base_url,
                model=settings.llm_model,
            )
        )
    for entry in settings.llm_fallbacks or []:
        key = str(entry.get("api_key", "")).strip()
        if not key:
            continue
        result.append(
            _Provider(
                api_key=key,
                base_url=str(entry["base_url"]),
                model=str(entry["model"]),
            )
        )
    return result


def _is_retriable(exc: Exception) -> bool:
    """Move to the next provider if this error could be transient or
    provider-specific (rate limit, bad key, out of credits, upstream 5xx)."""
    if isinstance(exc, (RateLimitError, APIConnectionError, APITimeoutError)):
        return True
    if isinstance(exc, APIStatusError):
        return exc.status_code in _RETRIABLE_STATUSES
    return False


async def _call_provider(
    provider: _Provider, system: str, messages: list[dict], max_tokens: int
) -> str:
    client = AsyncOpenAI(
        api_key=provider.api_key,
        base_url=provider.base_url,
        default_headers=_HEADERS,
    )
    response = await client.chat.completions.create(
        model=provider.model,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, *messages],
    )
    return (response.choices[0].message.content or "").strip()


async def complete(system: str, messages: list[dict], max_tokens: int = 2048) -> str:
    """Send one non-streaming completion; try providers in order on retriable errors.

    Raises LLMNotConfigured when no providers are configured. Raises
    AllProvidersFailed when every configured provider errored.
    """
    providers = _resolve_providers()
    if not providers:
        raise LLMNotConfigured("LLM_API_KEY is not configured")

    attempts: list[tuple[str, Exception]] = []
    for provider in providers:
        try:
            return await _call_provider(provider, system, messages, max_tokens)
        except Exception as exc:  # noqa: BLE001 — deliberate: classify then decide
            attempts.append((provider.model, exc))
            if not _is_retriable(exc):
                raise
            continue

    raise AllProvidersFailed(attempts)


# Public accessor for tests / diagnostics.
def _configured_provider_models() -> list[str]:
    return [p.model for p in _resolve_providers()]


__all__ = [
    "LLMNotConfigured",
    "AllProvidersFailed",
    "complete",
    "_configured_provider_models",
]
