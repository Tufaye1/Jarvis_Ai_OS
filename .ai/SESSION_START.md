# Session rules

Read this + NEXT_SESSION.md. Do not scan the rest of the repo until told which files
are relevant to the task at hand.

## Rules

1. One task per session. When given a task, implement only that task.
2. Do not add dependencies, change folder structure, or change architecture without
   explicit approval in chat first.
3. Do not build ahead — no speculative features, no extra abstraction "for later."
4. At the end of a session: update tests if relevant, update `NEXT_SESSION.md`
   (current state + decisions + what's next), stop.
5. `vault/` is the user's personal Obsidian vault — never commit its contents.
6. Keep files under ~300 lines soft limit, ~500 hard limit. Split before it's unmanageable.

## Multi-agent pipeline

Before starting a whole volume (feature module, not a single task), read
`.ai/AGENT_PIPELINE.md` — build/review/security/pre-push agents run per volume, not per task.

## Architecture (single source of truth)

- `apps/api` — FastAPI, Python, managed with `uv`. Talks to Postgres.
- `apps/web` — Next.js frontend.
- Postgres + `pgvector` extension — the only database. No separate vector DB, no queue,
  no auth, no desktop app until an actual need forces it.
- LLM: Claude via the Anthropic API, called directly — no gateway abstraction until a
  second provider is actually needed.
- Embeddings: local, in-process (no per-embedding API cost).
