# Multi-agent build pipeline

This runs once per **volume** (a whole feature module — e.g. "Knowledge," "Memory," "Chat" —
not per individual task). For a single small task, a normal one-task Claude Code session is enough;
don't invoke this pipeline for a one-line fix.

## Why

Running 8+ agents per volume costs meaningfully more tokens than one session doing the work solo.
It's worth it here because most volumes in this project touch security-sensitive surface (auth,
secrets, browser automation, user data) where an independent adversarial check is worth the cost.

## Phase 1 — Build (parallel)

2-4 build agents, each assigned a disjoint slice of the volume by **module ownership**, not
arbitrary file splitting — e.g. for the Knowledge volume: one agent owns the vault watcher +
markdown parser, another owns embeddings + the search endpoint. Disjoint ownership means no file
conflicts, so no worktree isolation is needed for this phase.

## Phase 2 — Review & harden (parallel, 3 independent lenses on the merged result)

- **Cleanliness agent** — simplification, dead code, duplication, file-size/context discipline
  (300 line soft / 500 hard limit per `.ai/SESSION_START.md`).
- **Vulnerability agent** — scans `pyproject.toml` / `package.json` for known CVEs, unpinned or
  outdated packages.
- **Security agent** — secrets handling, injection risks, auth boundaries, and the data-separation
  rules (Postgres = structured data only, pgvector = embeddings only, vault = files only).

## Phase 3 — Pre-push finalization

- **Test agent** — writes/runs tests for the new code, fixes failures in scope, confirms green.
- **Docs/memory agent** — updates the relevant README(s), `NEXT_SESSION.md`, `MEMORY.md`, and an
  ADR if architecture was touched.
- **Integration agent** — boots the actual stack (Docker + API + web) and re-runs the end-to-end
  smoke check, confirming nothing is broken.

## Phase 4 — Human approval gate (not an agent)

Claude summarizes what changed plus every finding from phases 2-3, and asks for explicit
confirmation before `git push`. Nothing gets pushed automatically.

## Status

Designed 2026-08-04. Not yet run — no volume has been task-broken-down yet. Will be invoked for
real the first time a volume (starting with Knowledge, Day 2+) has concrete tasks with assigned
files.
