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

Day 5 (Content Studio volume) complete — the assistant can now turn a project + its notes +
the conversation history into an actual draft, not just chat about one:

- **Content Studio backend** (`apps/api/app/content/`) — one `content` table (id, kind, title,
  body, tone, length, `project_id`, `conversation_id`, `sources` JSONB, status, timestamps) and
  a `POST /content/generate` endpoint that supports 7 kinds: **LinkedIn post**, **Blog post**,
  **Email**, **Proposal**, **Report**, **Deck outline**, **Tweet**. Each generate call runs the
  brief through the Knowledge volume's `semantic_search`, recalls memories via
  `memory.recall()`, and calls the same multi-provider failover LLM (`app/chat/llm.py`) chat
  uses — so a Groq rate-limit doesn't break Content Studio either.
- **Same fencing pattern as chat** — retrieved notes and recalled memories go into the system
  prompt inside a `<retrieved_context>` block, with fence tags stripped from body text before
  they're inlined, so a malicious note can't jailbreak the drafter. `sources` are stored on the
  row in the same JSONB shape chat uses for `Message.sources`, so the frontend renders the same
  citation chip UI in both places.
- **Prompt library per kind** (`prompts.py`) — one system prompt per kind, and `tone` and
  `length` are appended as hints (free-text tone, enum-ish length: short/medium/long). No
  fine-tuning, no per-kind model — the prompts do the differentiation.
- **CRUD** — `GET /content` (filter by `project_id` / `kind`), `GET /content/{id}`,
  `PATCH /content/{id}` (edit title/body/tone/length/kind), `DELETE /content/{id}`.
- **`/content` page** (`apps/web/src/app/content/`) — kind picker (7 kinds), project source
  picker (pulls `/projects`), optional conversation picker, tone + length controls, a
  generation preview with the sources it grounded on, and a saved-drafts list. Uses the same
  typed `api.ts` client, extended with a `content` namespace.
- **Wired assistant-card actions** — the two inert Day-3 actions "Build the review deck" and
  "Draft the client email" now call `POST /content/generate` (with kind `deck_outline` and
  `email` respectively) and take you to the resulting draft.

Day 6 (Research volume) complete — the "Research this further" assistant action and the
Research sidebar entry are now real, and research output feeds back into the vault:

- **Research backend** (`apps/api/app/research/`) — `POST /research` runs a query through the
  Knowledge volume's `semantic_search` (limit **12** — Research needs breadth over focus),
  recalls memories, and calls the same multi-provider failover LLM (`app/chat/llm.py`) with
  a research-oriented system prompt. Returns a synthesized answer plus `sources` in the same
  JSONB shape chat/content use, so the citation-chip UI works unchanged. Vault-only for the
  MVP; the internal `Retriever` interface is designed pluggable so a web adapter is a
  one-file add.
- **Save-to-vault** — `POST /research/{id}/save-to-vault` writes a real markdown note under
  `vault/Research/` (title + query + rendered answer + a `## Sources` section with wikilinks
  back to cited notes). The next `POST /knowledge/reindex` picks it up, embeds it, and it
  becomes semantically retrievable — closing the loop where past research feeds future
  research.
- **Generate content from research** — `POST /research/{id}/to-content` hands the research
  answer + its sources straight to `POST /content/generate` as the brief, so a research run
  can turn into a LinkedIn post / blog / email / deck outline without retyping.
- **CRUD** — `GET /research` (newest first), `GET /research/{id}`, `DELETE /research/{id}`.
- **`/research` page** (`apps/web/src/app/research/`) — query box, source-chip reveal on the
  answer (same component as chat/content), buttons for "Save to vault" and "Generate
  content from this", and a saved-research list. Typed client extended with a `research`
  namespace in `apps/web/src/lib/api.ts`.
- **Wired entry points** — Home quick-action "Research", the Sidebar "Research" nav item,
  and the previously-inert assistant-card "Research this further" action all route to
  `/research` (the assistant-card action pre-fills the query from the surrounding message).

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
- **Content drafts persist even when the LLM fails.** `POST /content/generate` writes the
  `content` row first (with the brief, kind, tone, length and gathered `sources`) and only
  then calls the LLM; if the provider chain fails, the row is kept with a `status="failed"`
  and the error stashed on it, and the endpoint returns the row with an empty `body`. Failed
  attempts are therefore auditable (you can see what was tried and why it failed) instead of
  silently vanishing, and a follow-up retry can reuse the same row.
- **Tone and length are prompt hints, not per-kind models.** Each of the 7 kinds has one
  system prompt in `content/prompts.py`; `tone` (free-text: "warm", "matter-of-fact", …) and
  `length` (short/medium/long enum-ish) are appended as guidance. No fine-tuning, no per-kind
  routing — the same LLM handles all of them. Keeps the model surface small; if a kind's
  output quality slips we can swap its prompt without touching the rest of the pipeline.
- **`content.sources` reuses the chat sources shape.** Stored as JSONB with the same
  `{title, snippet, similarity, vault_path, ...}` shape chat writes to `Message.sources`, so
  the frontend's existing citation-chip component renders both without a translation layer.
  Grounding is done via the same `semantic_search` + `memory.recall()` pair chat uses — one
  code path for "get context for the LLM", not two.
- **Research is deliberately synchronous, not queued.** `POST /research` runs the retriever
  + LLM in-band and returns the finished row, matching how chat and Content Studio work.
  Introducing a queue (Celery / Arq / etc.) buys nothing for the current single-user,
  seconds-long round trips, and it would add a worker process, a broker, and a whole
  status/polling surface on the frontend. Deferred until we actually have long-running
  background work (multi-source web crawls, batch content generation, or scheduled
  research runs) — at which point the same queue will serve all three volumes, not
  Research alone.
- **Save-to-vault writes a real markdown note under `vault/Research/`.** The alternative was
  storing research answers only in the `research` table, but then a research run couldn't
  ever surface in Obsidian, in `semantic_search`, or as chat/content grounding. Writing an
  actual note keeps Obsidian the source of truth (per the Day 2 rule) and makes the
  research corpus itself semantically retrievable after the next reindex — so past research
  automatically feeds future research and future content drafts.
- **Retrieval limit is 12 for Research (vs 5 for chat).** Chat needs a tight, on-topic
  context window so the reply stays focused and stays inside the token budget of a
  free-tier provider. Research is the opposite job: it should look widely across the vault
  and cite more sources, even at the cost of some noise, so it can synthesize instead of
  paraphrase. The number lives next to the Research service (not in a shared config) so
  future volumes can pick their own breadth without stepping on chat.
- **Web search adapter (Tavily / Brave / DuckDuckGo) deferred to a follow-up commit.**
  Research is vault-only for the MVP. The service takes an internal `Retriever` interface
  (`retrieve(query, limit) -> list[Source]`), and today's only implementation wraps
  `semantic_search`. Adding a web backend is a one-file drop: a new `WebRetriever` that
  calls the chosen API, normalizes results into the same `Source` shape (title, snippet,
  url/vault_path, score), and gets composed with the vault retriever. No API contract or
  frontend change needed when it lands.

## Next step

Day 7, pick one:

- **Web search adapter for Research** — plug a `WebRetriever` (Tavily / Brave /
  DuckDuckGo) into the existing `Retriever` interface, so `/research` can cite the open
  web alongside the vault. Smallest, most obviously-useful next volume because the
  interface is already there.
- **Voice** — the top-bar voice button becomes real: mic capture, STT into the chat,
  content and research pipelines, TTS on the reply. Same chat/memory/knowledge/content/
  research loop, new I/O surface.
- **Browser Agent** — the sidebar's inert "Browser" entry becomes real: a Playwright-
  driven agent that can open pages, extract structured data, and file the results into a
  research row (which can then be saved to the vault). Biggest scope of the three; also
  the biggest reach — unblocks "go find X and summarize it" without a search API.
- **Deferred vault-cleanup bug fix** — when a note's file is deleted from the vault its
  DB row is still orphaned forever (and still surfaced by semantic search + still cited
  by chat, content and now research). `POST /knowledge/reindex` should tombstone or
  delete missing notes and cascade to `note_links` / stale embeddings. Small,
  self-contained, higher value now that research writes new notes into the vault.
