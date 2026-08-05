from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.base import init_models
from app.chat.router import router as chat_router
from app.db import engine
from app.knowledge.router import router as knowledge_router
from app.knowledge.search_router import router as knowledge_search_router
from app.memory.router import router as memory_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_models(engine)
    yield


app = FastAPI(title="Jarvis AI OS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(knowledge_router)
app.include_router(knowledge_search_router)
app.include_router(chat_router)
app.include_router(memory_router)


@app.get("/health")
async def health() -> dict:
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok", "db": "connected"}
