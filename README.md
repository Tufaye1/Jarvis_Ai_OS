# Jarvis AI OS

A local-first personal AI that reads your Obsidian vault, remembers your conversations,
and does tasks on your behalf.

## Start here

- New Claude Code session? Read [.ai/SESSION_START.md](.ai/SESSION_START.md) first.
- What's next? Read [NEXT_SESSION.md](NEXT_SESSION.md).

## Stack

- `apps/api` — FastAPI backend (Python, managed with `uv`). Exposes `/health` plus the
  Knowledge, Chat, Memory, Projects, Tasks, Planner and Content volumes (see Endpoints
  below).
- `apps/web` — Next.js frontend. The Jarvis shell (top bar + sidebar) with a Home screen
  (wired to real Planner + Projects data), a Knowledge control panel, a Chat screen,
  Projects and Planner pages, and a Content Studio (`/content`) page.
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

Projects — the things you're working on:

- `POST /projects` — create a project
- `GET /projects?status=` — list projects, optionally filtered by status
- `GET /projects/{id}` — read one
- `PATCH /projects/{id}` — update name / description / status
- `DELETE /projects/{id}` — delete (tasks are kept, their `project_id` is nulled)

Tasks — the things you actually do, optionally attached to a project:

- `POST /tasks` — create a task
- `GET /tasks?project_id=&status=&due_before=&limit=` — list / filter tasks
- `GET /tasks/{id}` — read one
- `PATCH /tasks/{id}` — update fields; moving `status` to `done` stamps `completed_at`,
  moving it away clears `completed_at`
- `DELETE /tasks/{id}` — delete

Planner — the ranked "what to do next" list, deterministic and pure-SQL (no LLM):

- `GET /planner/today?limit=` — overdue + due-today first, then by priority, then oldest first
- `GET /planner/upcoming?days=&limit=` — same ranking over the next N days (default 7)

Content Studio — draft LinkedIn posts, blog posts, emails, proposals, reports, deck
outlines and tweets from a project, notes and conversation history, grounded via the
same semantic search + memory recall as chat:

- `POST /content/generate` — generate a draft; body picks `kind`, tone and length hints,
  and an optional `project_id` / `conversation_id` to seed grounding. The draft row is
  persisted even if the LLM call fails, so failed attempts stay auditable.
- `GET /content?project_id=&kind=` — list drafts, newest first
- `GET /content/{id}` — read one
- `PATCH /content/{id}` — edit the draft (title, body, tone, length, kind)
- `DELETE /content/{id}` — delete a draft

## Configure your API key(s)

Chat talks to any OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, Google Gemini's
OpenAI-compat endpoint, local Ollama, …). Copy [.env.example](.env.example) to `.env`
and set at least `LLM_API_KEY`, then restart the API.

**Multi-provider failover.** Add more providers in `LLM_FALLBACKS` as a JSON list of
`{"api_key","base_url","model"}`. On rate limits, bad keys, out-of-credits, upstream 5xx
or timeouts, chat automatically tries the next provider — so you can keep building
without any single quota blocking you.

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
