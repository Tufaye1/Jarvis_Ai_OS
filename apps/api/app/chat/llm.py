"""Thin async LLM client for the Chat volume.

Talks to any OpenAI-compatible endpoint. Defaults to OpenRouter (see
`app.config.settings`); flip provider by changing `LLM_BASE_URL` and
`LLM_MODEL` in `.env` — no code change needed.

The rest of the app must import and start cleanly with no API key present, so
the key is only checked (and the client only constructed) inside `complete`.
"""

from openai import AsyncOpenAI

from app.config import settings

# OpenRouter analytics headers — harmless when hitting other providers.
_OR_HEADERS = {
    "HTTP-Referer": "https://github.com/Tufaye1/Jarvis_Ai_OS",
    "X-Title": "Jarvis AI OS",
}


class LLMNotConfigured(RuntimeError):
    """Raised when no LLM API key is configured. Router maps this to 503."""


async def complete(system: str, messages: list[dict], max_tokens: int = 2048) -> str:
    """Send one non-streaming completion and return the reply text.

    `messages` is the chat history: [{"role": "user"|"assistant",
    "content": str}, ...], oldest first, starting with a user turn.
    `system` is prepended as a role="system" message on the wire.
    """
    api_key = (settings.llm_api_key or "").strip()
    if not api_key:
        raise LLMNotConfigured("LLM_API_KEY is not configured")

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=settings.llm_base_url,
        default_headers=_OR_HEADERS,
    )
    response = await client.chat.completions.create(
        model=settings.llm_model,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, *messages],
    )

    return (response.choices[0].message.content or "").strip()
