# Jarvis AI OS

A local-first personal AI that reads your Obsidian vault, remembers your conversations,
and does tasks on your behalf.

## Start here

- New Claude Code session? Read [.ai/SESSION_START.md](.ai/SESSION_START.md) first.
- What's next? Read [NEXT_SESSION.md](NEXT_SESSION.md).

## Stack

- `apps/api` — FastAPI backend (Python, managed with `uv`). Exposes `/health` plus the
  Knowledge, Chat and Memory volumes (see Endpoints below).
- `apps/web` — Next.js frontend. The Jarvis shell (top bar + sidebar) with a Home screen,
  a Knowledge control panel, and a Chat screen.
- `vault/` — your Obsidian vault (gitignored — personal notes never get pushed)
- Postgres + `pgvector` — one database for structured data and vector search (via Docker Compose)

## Endpoints

Knowledge — vault ingestion, local embeddings, semantic search:

- `POST /knowledge/reindex` — scan the vault, upsert notes, rebuild wikilink edges
- `POST /knowledge/backfill-embeddings` — embed notes that don't have a vector yet
- `GET /knowledge/search?q=...` — semantic search over your notes

Chat — conversations grounded in your vault and your memories:

- `POST /chat/conversations` — start a conversation
- `GET /chat/conversations` — list conversations, newest first
- `GET /chat/conversations/{id}/messages` — full transcript, oldest first
- `POST /chat/conversations/{id}/messages` — send a message, get the grounded reply
  (with the notes that grounded it under `sources`)
- `DELETE /chat/conversations/{id}` — delete a conversation and its messages

Memory — global / project / session facts, semantically recalled on every chat turn:

- `GET /memory?scope=&project=` — list memories, newest first
- `POST /memory` — store a memory by hand
- `DELETE /memory/{id}` — forget one
- `POST /memory/extract` — mine a conversation for durable facts and store them

## Configure your API key

Chat talks to any OpenAI-compatible endpoint. Defaults to **OpenRouter**, which routes to
Claude / GPT / Gemini / Llama / others through one key —
[get one here](https://openrouter.ai/settings/keys).

Copy [.env.example](.env.example) to `.env` and set `LLM_API_KEY`. To change provider,
change `LLM_BASE_URL` and `LLM_MODEL` — no code change needed. Restart the API to pick
up new values.

Without a key everything else still works — vault ingestion, embeddings, search, memory
storage and recall, and the whole UI — but `POST /chat/conversations/{id}/messages` and
`POST /memory/extract` return `503`, and the chat screen tells you the key is missing.

`.env` (and typo variants like `.enecho`) are gitignored. Never commit a real key.

## Run it locally

```bash
docker compose up -d db
cd apps/api && uv run uvicorn app.main:app --reload
cd apps/web && npm run dev
```
