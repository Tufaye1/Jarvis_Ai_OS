# Jarvis AI OS

A local-first personal AI that reads your Obsidian vault, remembers your conversations,
and does tasks on your behalf.

## Start here

- New Claude Code session? Read [.ai/SESSION_START.md](.ai/SESSION_START.md) first.
- What's next? Read [NEXT_SESSION.md](NEXT_SESSION.md).

## Stack

- `apps/api` — FastAPI backend (Python, managed with `uv`)
- `apps/web` — Next.js frontend
- `vault/` — your Obsidian vault (gitignored — personal notes never get pushed)
- Postgres + `pgvector` — one database for structured data and vector search (via Docker Compose)

## Run it locally

```bash
docker compose up -d db
cd apps/api && uv run uvicorn app.main:app --reload
cd apps/web && npm run dev
```
