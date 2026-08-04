# Next session

## Current state

Day 1 foundation complete and verified end to end:

- Postgres (`pgvector/pgvector:pg16`) running via Docker Compose, `vector` extension enabled.
- FastAPI (`apps/api`, managed with `uv`, Python 3.12) with `/health` — connects to Postgres,
  confirmed `{"status": "ok", "db": "connected"}`.
- Next.js (`apps/web`, TypeScript, Tailwind, App Router) home page fetches `/health` from the
  API and renders it — confirmed working in-browser at `http://localhost:3000`.
- Git initialized, remote set to `https://github.com/Tufaye1/Jarvis_Ai_OS.git` (not yet pushed).

Day 2 (Knowledge volume) complete and verified end to end, all under `apps/api/app/knowledge/`:

- Vault ingestion — `POST /knowledge/reindex` walks `settings.vault_path` for `*.md` files,
  upserts notes into Postgres (matched by `vault_path`, unchanged content skipped via a
  `content_hash`), and rebuilds `note_links` wikilink edges on every scan.
- Markdown + `[[wikilink]]` parsing (`parser.py`) — pure function, no I/O beyond reading the
  file; handles both `[[Target]]` and `[[Target|Display]]` forms.
- Local embeddings via fastembed (`embeddings.py`) — `BAAI/bge-small-en-v1.5`, 384-dim vectors
  matching the pgvector `Vector(384)` column, computed via `POST /knowledge/backfill-embeddings`
  (only notes with a NULL embedding are processed).
- Semantic search via pgvector cosine distance (`search.py`) — `GET /knowledge/search?q=...`,
  returns the closest notes with a snippet + similarity score.
- Vault now pointed at `vault/Jarvis/` (real Obsidian vault, gitignored).

## Decisions log

- Multi-agent build pipeline designed for per-volume work (build → review/vuln/security →
  test/docs/integration → human approval before push). See `.ai/AGENT_PIPELINE.md`. Fired for
  the Knowledge volume (Day 2).
- No Qdrant — pgvector inside Postgres does structured + vector data in one DB.
- No queue (Celery/etc.) — single user, synchronous processing is fine for now.
- No auth — local, single-user app.
- No desktop app (Tauri) yet — web app first.
- No LLM gateway abstraction yet — direct Anthropic API calls, once chat is built.
- Obsidian is the knowledge editor — the API reads/parses the vault, never builds its own
  notes UI. Vault lives at `vault/Jarvis/`.
- `vault/` is gitignored — personal notes never get pushed to GitHub.
- Local embeddings (in-process) via fastembed — `BAAI/bge-small-en-v1.5`, 384-dim vectors,
  no per-embedding API cost.
- Needed `greenlet` alongside SQLAlchemy's async engine + asyncpg (easy to miss — add it
  whenever adding async SQLAlchemy to a new service).
- Vault scanning is scan-on-demand via `POST /knowledge/reindex` for MVP, not a live
  file-watcher daemon — simpler, no background worker needed yet.
- Embedding generation is decoupled from ingestion: `reindex` only upserts note text and
  leaves `embedding` untouched; `POST /knowledge/backfill-embeddings` fills it in as a
  separate, on-demand step.
- Wikilink resolution is title-based (case-insensitive) and rebuilt in full on every scan
  (a note's `note_links` rows are deleted and replaced) — simplest correct approach for the
  MVP link graph; unresolved targets are kept with `target_note_id = NULL` in case the target
  note shows up later.
- Post-pipeline security patch (applied directly, not via another full agent run): the
  security-review agent found a real symlink-based path-traversal bug (a symlink inside the
  vault pointing outside it got its target's content ingested and made searchable) and no
  file-size cap on note reads. Fixed in `parser.py`/`ingest.py` — `parse_note` now rejects any
  path resolving outside the vault root and any file over 5 MB (`UnsafeNotePath`), and
  `scan_vault` skips such files (reported under a new `skipped` field) instead of aborting the
  whole scan; the same skip path also now catches non-UTF-8 files. Verified with a real
  symlink-escape repro (blocked) and two new regression tests (11/11 passing).
- Deferred from review, not yet decided: what happens to a note's DB row when its file is
  deleted from the vault (currently orphaned forever, not cleaned up), and wikilink title
  collisions across notes with the same filename in different folders (currently resolves to
  whichever is found first). Both are edge cases, not urgent for a single-user MVP.

## Next step

Day 3: chat + memory. Wire up a chat endpoint that calls the Anthropic API directly (no
gateway abstraction, per the decisions log), grounds answers using the Knowledge volume's
`/knowledge/search`, and persists conversation history in Postgres so context survives across
sessions.
