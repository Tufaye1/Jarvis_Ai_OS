"""Thin async Anthropic client for the Chat volume.

The rest of the app must import and start cleanly with no API key present, so
the key is only checked (and the client only constructed) inside `complete`.
"""

import anthropic

from app.config import settings

MODEL = "claude-sonnet-5"


class LLMNotConfigured(RuntimeError):
    """Raised when no Anthropic API key is configured. Router maps this to 503."""


async def complete(system: str, messages: list[dict], max_tokens: int = 2048) -> str:
    """Send one non-streaming completion and return the concatenated text.

    `messages` is the Anthropic chat history: [{"role": "user"|"assistant",
    "content": str}, ...], oldest first, starting with a user turn.
    """
    api_key = (settings.anthropic_api_key or "").strip()
    if not api_key:
        raise LLMNotConfigured("ANTHROPIC_API_KEY is not configured")

    client = anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
        # Chat replies here are grounded in retrieved context rather than
        # multi-step reasoning; thinking would eat the max_tokens budget.
        thinking={"type": "disabled"},
    )

    return "".join(
        block.text for block in response.content if block.type == "text"
    ).strip()
