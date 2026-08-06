"""HTTP endpoints for the Chat volume.

Non-streaming JSON only. Missing conversations map to 404; an unconfigured LLM
maps to 503 so the frontend can tell "broken" from "not set up yet".
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.chat.llm import AllProvidersFailed, LLMNotConfigured
from app.chat.models import Conversation, Message
from app.chat.schemas import ChatTurnOut, ConversationOut, MessageCreate, MessageOut
from app.chat.service import ConversationNotFound, send_message
from app.db import async_session

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_conversation_or_404(session, conversation_id: int) -> Conversation:
    conversation = await session.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation {conversation_id} not found",
        )
    return conversation


@router.post(
    "/conversations",
    response_model=ConversationOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation() -> Conversation:
    """Start an empty conversation. Its title is derived from the first message."""
    async with async_session() as session:
        conversation = Conversation()
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
    return conversation


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations() -> list[Conversation]:
    """All conversations, newest first."""
    async with async_session() as session:
        stmt = select(Conversation).order_by(Conversation.id.desc())
        return list((await session.execute(stmt)).scalars().all())


@router.get("/conversations/{cid}/messages", response_model=list[MessageOut])
async def list_messages(cid: int) -> list[Message]:
    """Full transcript of one conversation, oldest first."""
    async with async_session() as session:
        await _get_conversation_or_404(session, cid)
        stmt = (
            select(Message)
            .where(Message.conversation_id == cid)
            .order_by(Message.id.asc())
        )
        return list((await session.execute(stmt)).scalars().all())


@router.post("/conversations/{cid}/messages", response_model=ChatTurnOut)
async def post_message(cid: int, payload: MessageCreate) -> dict:
    """Send a user message and get the grounded assistant reply back."""
    try:
        return await send_message(cid, payload.content)
    except ConversationNotFound as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except LLMNotConfigured as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM_API_KEY is not configured",
        ) from exc
    except AllProvidersFailed as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"All LLM providers failed. Last errors: {exc}",
        ) from exc


@router.delete("/conversations/{cid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(cid: int) -> None:
    """Delete a conversation; its messages cascade at the DB level."""
    async with async_session() as session:
        conversation = await _get_conversation_or_404(session, cid)
        await session.delete(conversation)
        await session.commit()
