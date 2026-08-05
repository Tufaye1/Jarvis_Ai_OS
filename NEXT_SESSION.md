# Next session

## Current state

Day 1 foundation complete and verified end to end:

- Postgres (`pgvector/pgvector:pg16`) running via Docker Compose, `vector` extension enabled.
- FastAPI (`apps/api`, managed with `uv`, Python 3.12) with `/health` — connects to Postgres,
  confirmed `{"status": "ok", "db": "connected"}`.
- Next.js (`apps/web`, TypeScript, Tailwind, App Router) talking to the API in-browser at
  `http://localhost:3000`.
- Git initialized, remote set to `https://github.com/Tufaye1/Jarvis_Ai_OS.git` (not yet pushed).

Day 2 (Knowledge volume) complete and verified end to end, all under `apps/api/app/knowledge/`:

- Vault ingestion — `POST /knowledge/reindex` walks `settings.vault_path` for `*.md` files,
  upserts notes into Postgres (matched by `vault_path`, unchanged content skipped via a
  `content_hash`), and rebuilds `note_links` wikilink edges on every scan.
- Markdown + `[[wikilink]]` parsing (`parser.py`) — pure function, handles both `[[Target]]`
  and `[[Target|Display]]`, and refuses paths that resolve outside the vault root.
- Local embeddings via fastembed (`embeddings.py`) — `BAAI/bge-small-en-v1.5`, 384-dim vectors
  matching the pgvector `Vector(384)` column, filled in by `POST /knowledge/backfill-embeddings`
  (only notes with a NULL embedding are processed).
- Semantic search via pgvector cosine distance (`search.py`) — `GET /knowledge/search?q=...`,
  returns the closest notes with a snippet + similarity score.
- Vault pointed at `vault/Jarvis/` (real Obsidian vault, gitignored).

Day 3 (Chat + Memory + UI volume) complete — the first version of Jarvis you can actually
talk to, and the first real Jarvis interface:

- **Chat with RAG grounding** (`apps/api/app/chat/`) — `POST /chat/conversations/{cid}/messages`
  persists the user turn, runs the question through the Knowledge volume's `semantic_search`,
  recalls relevant memories, builds a system prompt with the retrieved context fenced inside a
  `<retrieved_context>` block, and calls the Anthropic API (`llm.py`, non-streaming). The reply
  is stored with its `sources` — the notes that grounded it — so the UI can cite them. Retrieved
  text is treated as untrusted data in the prompt, and fence tags inside note bodies are stripped
  before they go in. Conversations are listable, readable and deletable
  (`/chat/conversations`, `.../messages`, `DELETE /chat/conversations/{cid}`).
- **3-layer memory with semantic recall** (`apps/api/app/memory/`) — one `memories` table with a
  `scope` of `global` (durable facts about you), `project` (facts scoped to one project) or
  `session` (short-lived working context). Memories are embedded into the same 384-dim space as
  notes, so `recall()` is a cosine-distance search — the chat service calls it on every turn.
  `POST /memory` stores one by hand, `GET /memory` lists/filters them, `DELETE /memory/{mid}`
  forgets one, and `POST /memory/extract` mines a conversation for durable facts via the LLM
  (re-running it is safe — facts already extracted from that conversation are skipped).
- **The real Jarvis UI shell** (`apps/web/src/`) — `TopBar` (logo lockup, ⌘K search field,
  voice button) + `Sidebar` (Home, Knowledge, Projects, Chat, Planner, Research, Content Studio,
  Browser, Voice, Settings) wrapping every route from `layout.tsx`. Design tokens live in
  `globals.css` and `docs/DESIGN_SYSTEM.md`. Nav items with no volume behind them yet are
  present but inert.
- **Home screen** (`/`) — greeting, four quick-action cards, Today, Recent activity, Suggestions
  and Projects. Only "Ask" is wired (to `/chat`); the rest is still hardcoded placeholder data
  waiting on the volumes that will feed it.
- **Knowledge control panel** (`/knowledge`) — runs `reindex` and `backfill-embeddings` against
  the API and renders the real result payloads (notes scanned/created/updated, links created,
  skipped files with reasons, embedded count).
- **Chat screen** (`/chat`) — conversation list, message thread, composer, and an assistant card
  that renders the reply with its source chips. `apps/web/src/lib/api.ts` is the typed client for
  both volumes; its `ApiError` distinguishes 503 (not configured yet) from 404 and from status 0
  (API not running), so the UI can say "add your API key" instead of "something broke".

## Decisions log

- Multi-agent build pipeline designed for per-volume work (build → review/vuln/security →
  test/docs/integration → human approval before push). See `.ai/AGENT_PIPELINE.md`. Fired for
  the Knowledge volume (Day 2) and the Chat + Memory + UI volume (Day 3).
- No Qdrant — pgvector inside Postgres does structured + vector data in one DB.
- No queue (Celery/etc.) — single user, synchronous processing is fine for now.
- No auth — local, single-user app.
- No desktop app (Tauri) yet — web app first.
- No LLM gateway abstraction — `app/chat/llm.py` calls the Anthropic API directly.
- Obsidian is the knowledge editor — the API reads/parses the vault, never builds its own
  notes UI. Vault lives at `vault/Jarvis/`.
- `vault/` is gitignored — personal notes never get pushed to GitHub.
- Local embeddings (in-process) via fastembed — `BAAI/bge-small-en-v1.5`, 384-dim vectors,
  no per-embedding API cost. Memories reuse the same space as notes, so one embedding model
  serves both.
- Needed `greenlet` alongside SQLAlchemy's async engine + asyncpg (easy to miss — add it
  whenever adding async SQLAlchemy to a new service).
- Vault scanning is scan-on-demand via `POST /knowledge/reindex` for MVP, not a live
  file-watcher daemon. Embedding generation is decoupled from ingestion: `reindex` only upserts
  note text; `POST /knowledge/backfill-embeddings` fills in `embedding` as a separate step.
- Wikilink resolution is title-based (case-insensitive) and rebuilt in full on every scan;
  unresolved targets are kept with `target_note_id = NULL` in case the target shows up later.
- Security patch from the Day 2 review (applied directly, not via another agent run): a
  symlink inside the vault pointing outside it got its target's content ingested and made
  searchable, and note reads had no size cap. `parse_note` now rejects any path resolving
  outside the vault root and any file over 5 MB (`UnsafeNotePath`); `scan_vault` skips such
  files (reported under `skipped`) instead of aborting the scan, and the same path catches
  non-UTF-8 files.
- **One shared `Base`** — `apps/api/app/base.py` owns the single SQLAlchemy `DeclarativeBase`
  and `init_models()`. Every volume's models inherit from it, so one call at app startup creates
  all tables. **When you add a new model package, add its module to `_MODEL_MODULES` in
  `base.py`** — otherwise its classes never register on `Base.metadata` and its tables are
  silently never created. This is the easiest thing in the codebase to forget.
- **Non-streaming JSON chat for the MVP** — one request in, one complete reply out. Streaming
  (SSE/tokens) is deferred: it complicates the client, the persistence path and error handling,
  and buys nothing until responses get long.
- **Chat and memory cross-import lazily** — `chat/service.py` imports `app.memory.service.recall`
  inside the function and falls back to no memories on any failure; `memory/service.py` imports
  `app.chat.llm.complete` the same way and raises `LLMUnavailable` (→ 503) if it's missing.
  Both volumes were built in parallel by separate agents, so each has to degrade gracefully when
  the other is absent or half-built. `recall()`'s name and signature are a hard contract.
- **The chat volume requires an `ANTHROPIC_API_KEY`, and it is not set yet.** `.env.example`
  has the empty slot; the real `.env` has no value in it. Until you add one, `POST /chat/.../messages`
  and `POST /memory/extract` return **503** — deliberately, not as a bug. Everything else
  (knowledge, search, memory storage/recall, the whole UI shell) works without a key, and the
  chat screen shows a "add your key" notice rather than an error.
- The API is imported and started with no key present — the key is only read inside `complete()`,
  never at module load, so a missing key can never break startup.
- Assistant-card actions ("Save to memory", "Build the review deck", "Draft the client email",
  "Research this further") are rendered but inert — no endpoint backs them yet.
- Deferred, not yet decided: what happens to a note's DB row when its file is deleted from the
  vault (currently orphaned forever); wikilink title collisions across folders (resolves to
  whichever is found first); and automatic memory extraction (today `/memory/extract` is only
  ever called on demand, never at the end of a conversation).

## Next step

**First, add your `ANTHROPIC_API_KEY` to `.env` and restart the API** — Day 3 is built and
wired but chat stays at 503 until that lands. Then take a real conversation end to end and
run `POST /memory/extract` on it to see the memory loop close.

Day 4: the Projects + Planner volume. The Home screen's Today, Suggestions and Projects panels
are currently hardcoded — this is the volume that makes them real: projects and tasks in
Postgres, endpoints to create/list/complete them, project-scoped memories tied to a project
(the `scope="project"` layer already exists and is unused), and the `/knowledge` search wired
into the ⌘K field so the whole shell stops being a mockup.
