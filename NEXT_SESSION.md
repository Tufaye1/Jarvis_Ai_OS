# Next session

## Current state

Day 1 foundation complete and verified end to end:

- Postgres (`pgvector/pgvector:pg16`) running via Docker Compose, `vector` extension enabled.
- FastAPI (`apps/api`, managed with `uv`, Python 3.12) with `/health` — connects to Postgres,
  confirmed `{"status": "ok", "db": "connected"}`.
- Next.js (`apps/web`, TypeScript, Tailwind, App Router) home page fetches `/health` from the
  API and renders it — confirmed working in-browser at `http://localhost:3000`.
- Git initialized, remote set to `https://github.com/Tufaye1/Jarvis_Ai_OS.git` (not yet pushed).

## Decisions log

- Multi-agent build pipeline designed for per-volume work (build → review/vuln/security →
  test/docs/integration → human approval before push). See `.ai/AGENT_PIPELINE.md`. Not yet
  run — will fire for real once Day 2 (Knowledge volume) has concrete tasks assigned to files.


- No Qdrant — pgvector inside Postgres does structured + vector data in one DB.
- No queue (Celery/etc.) — single user, synchronous processing is fine for now.
- No auth — local, single-user app.
- No desktop app (Tauri) yet — web app first.
- No LLM gateway abstraction yet — direct Anthropic API calls, once chat is built.
- Obsidian is the knowledge editor — the API reads/parses the vault, never builds its
  own notes UI. User just installed Obsidian; vault not yet created/pointed to.
- `vault/` is gitignored — personal notes never get pushed to GitHub.
- Local embeddings (in-process, e.g. fastembed) — no per-embedding API cost. Not yet installed.
- Needed `greenlet` alongside SQLAlchemy's async engine + asyncpg (easy to miss — add it
  whenever adding async SQLAlchemy to a new service).

## Next step

Day 2: point the API at an actual Obsidian vault path, add a vault watcher, parse
markdown + `[[wikilinks]]` into a simple notes/edges table (pgvector), add local embeddings
+ a semantic search endpoint.
