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

Day 4 (Projects + Planner volume) complete — the Home screen's Today, Projects and Suggestions
panels are now backed by real data instead of hardcoded mockups:

- **Projects CRUD** (`apps/api/app/projects/`) — `projects` table (id, name, description, status,
  timestamps). `POST /projects` creates one, `GET /projects` lists them with an optional
  `status` filter, `GET /projects/{pid}` reads one, `PATCH /projects/{pid}` updates name /
  description / status, `DELETE /projects/{pid}` removes it. Statuses are `active`, `paused`,
  `done`, `archived`.
- **Tasks CRUD** (`apps/api/app/tasks/`) — `tasks` table with optional `project_id` FK
  (nullable, ON DELETE SET NULL — deleting a project doesn't delete its tasks), plus title,
  notes, status (`todo`/`doing`/`done`), priority (0..3), `due_at`, `completed_at` and
  timestamps. Full CRUD under `/tasks`, with `GET /tasks` filterable by `project_id`, `status`,
  `due_before` and a `limit`.
- **Planner** (`apps/api/app/planner/`) — `GET /planner/today` returns the ranked "what to do
  next" list: overdue + due-today tasks first, then priority, then oldest-created; capped at
  `limit` (default 10). Pure SQL, no LLM. `GET /planner/upcoming` extends the horizon by
  `days` (default 7) for planning ahead.
- **Real `/projects` page** (`apps/web/src/app/projects/`) — lists projects with status chips,
  a create form, inline status transitions and delete. Talks to the API through
  `apps/web/src/lib/api.ts` (the typed client is extended with `projects` and `tasks`
  namespaces).
- **Real `/planner` page** (`apps/web/src/app/planner/`) — renders the ranked Today list with
  due-date badges (overdue in red, due-today amber), a "mark done" action that flips the task
  to `status=done` (which stamps `completed_at`), and a project-name label per task.
- **Home screen wired to real data** — Today, Projects and Suggestions now fetch from the
  Planner and Projects endpoints on mount; the placeholder arrays are gone. Quick-action cards
  still route to `/chat`, `/projects` and `/planner`.

## Decisions log

- Multi-agent build pipeline designed for per-volume work (build → review/vuln/security →
  test/docs/integration → human approval before push). See `.ai/AGENT_PIPELINE.md`. Fired for
  the Knowledge volume (Day 2) and the Chat + Memory + UI volume (Day 3).
- No Qdrant — pgvector inside Postgres does structured + vector data in one DB.
- No queue (Celery/etc.) — single user, synchronous processing is fine for now.
- No auth — local, single-user app.
- No desktop app (Tauri) yet — web app first.
- **LLM is provider-agnostic with automatic multi-provider failover.** `app/chat/llm.py`
  uses the `openai` SDK against any OpenAI-compatible endpoint. Primary provider is
  `LLM_API_KEY/BASE_URL/MODEL`; `LLM_FALLBACKS` is an ordered JSON list of extra
  providers that get tried in order on retriable errors (429, 401, 402, 5xx, timeouts).
  Non-retriable errors (400, 404) fail fast without cycling. Current setup: Groq
  (llama-3.3-70b-versatile) primary → Gemini (flash-latest) → OpenRouter free-tier.
  Regression covered by `test_failover_moves_to_next_provider_on_retriable_error`.
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
- **Chat requires an `LLM_API_KEY` (OpenRouter by default).** `.env.example` and `.env`
  have the empty slot plus the OpenRouter base URL and default model. Until you add a key,
  `POST /chat/.../messages` and `POST /memory/extract` return **503** — deliberately, not
  as a bug. Everything else (knowledge, search, memory storage/recall, the whole UI shell)
  works without a key, and the chat screen shows a "add your key" notice rather than an error.
- The API is imported and started with no key present — the key is only read inside `complete()`,
  never at module load, so a missing key can never break startup.
- Assistant-card actions ("Save to memory", "Build the review deck", "Draft the client email",
  "Research this further") are rendered but inert — no endpoint backs them yet.
- Deferred, not yet decided: what happens to a note's DB row when its file is deleted from the
  vault (currently orphaned forever); wikilink title collisions across folders (resolves to
  whichever is found first); and automatic memory extraction (today `/memory/extract` is only
  ever called on demand, never at the end of a conversation).
- **Project attribution to notes stays weak for now** — a note is considered "in project X"
  when a `scope="project"` memory with `project=X` matches it by name, not via a real FK on
  `notes`. This keeps ingestion cheap (no schema change on every project rename) and lets
  Obsidian stay the source of truth. Real `Note.project_id` (or a `note_projects` join table)
  is deferred to a later day, likely when Content Studio needs firm attribution.
- **`Task.completed_at` is stamped on `status=done` and cleared when the task moves away.**
  The DB row itself is the audit trail — no separate `task_events` table for the MVP. If we
  later need reopen counts or per-transition timing, we add the event log then.
- **Planner ranking is deterministic and pure-DB** — one SQL query orders by (overdue/today
  first, then priority DESC, then created_at ASC), no LLM call in the hot path. Works offline,
  doesn't burn provider budget, and stays fast enough that the Home screen can refetch it on
  every mount. An LLM-scored "what should I actually do next" pass can layer on top later
  without touching the base ranking.
- **Post-pipeline security hardening (Day 4)**: capped every list endpoint's `limit` at ≤500 and
  added a default cap on `/projects` (it had none), plus `max_length` on every user-supplied
  string field (Project.name/description, Task.title/description). No functional change; just
  bounds the blast radius of a bad client. Deferred: the security review flagged that asyncpg
  silently strips timezone info off `Task.due_at`/`completed_at` because the Postgres columns
  are `TIMESTAMP WITHOUT TIME ZONE` — the code writes naive UTC everywhere on the write path
  (fixed during Day 4 for `completed_at`), but if we ever expose a public API where clients
  send arbitrary tz-aware datetimes we should either switch the columns to `TIMESTAMPTZ` or
  document the coercion. Not a bug for MVP; note for later.

## Next step

**First, add your `LLM_API_KEY` to `.env` and restart the API** — Day 3 is built and wired
but chat stays at 503 until that lands. Then take a real conversation end to end and run
`POST /memory/extract` on it to see the memory loop close.

Day 5, pick one:

- **Content Studio** — turn a project + its notes + the conversation history into drafts
  (docs, emails, review decks). The assistant-card actions ("Build the review deck",
  "Draft the client email") get real endpoints behind them, and note→project attribution
  finally gets promoted to a real FK.
- **Voice** — the top-bar voice button becomes real: mic capture, STT into the chat pipeline,
  TTS on the reply. Same chat/memory/knowledge loop, new I/O surface.
- **Add real notes to the vault and dogfood** — no new volume; instead, live in Jarvis for a
  few days, capture actual friction, and let the next volume choice fall out of what breaks.
