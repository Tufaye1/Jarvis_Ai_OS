"""Pydantic v2 request/response models for the Chat volume.

These mirror the fixed HTTP contract the frontend builds against. ORM objects
are serialized directly (``from_attributes``), so routers can return
``Conversation`` / ``Message`` instances without manual dict building.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConversationOut(BaseModel):
    """GET/POST /chat/conversations item."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    # Null until the first user message lands and derives one.
    title: str | None = None
    created_at: datetime
    updated_at: datetime


class MessageOut(BaseModel):
    """A single turn in a conversation.

    `sources` holds the retrieved notes that grounded an assistant reply:
    [{"note_id": int, "title": str, "vault_path": str, "score": float}, ...].
    Null for user messages and for ungrounded replies.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    content: str
    sources: list[dict] | None = None
    created_at: datetime


class MessageCreate(BaseModel):
    """POST /chat/conversations/{cid}/messages body."""

    content: str


class ChatTurnOut(BaseModel):
    """One full round trip: what the user said and what the assistant replied."""

    model_config = ConfigDict(from_attributes=True)

    user_message: MessageOut
    assistant_message: MessageOut
