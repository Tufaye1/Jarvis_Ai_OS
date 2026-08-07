"use client";

/**
 * Research — the "SUMMARY / Your knowledge" screen from DESIGN_SYSTEM 5.6.
 *
 * Flow:
 *   - Ask a question in a big search bar. Enter or click "Research".
 *   - createResearch() runs the RAG loop synchronously (backend returns 201
 *     with status=ready|failed). We render the summary with typewriter
 *     reveal, but only for freshly-generated research — picking a past
 *     research from history skips the animation.
 *   - "Save to vault" is idempotent (server-side); we hide the button once
 *     saved_as_note_id is set.
 *   - "Generate blog" / "Generate report" close the loop into Content Studio
 *     via generateContent(kind, summary as prompt).
 *
 * Empty and error states are per-section so a broken history list can't
 * blank out the active summary panel.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import RevealText from "@/components/ui/RevealText";
import {
  createResearch,
  deleteResearch,
  generateContent,
  isApiError,
  listProjects,
  listResearch,
  saveResearchToVault,
  type ContentKind,
  type Project,
  type ResearchQuery,
  type Source,
} from "@/lib/api";

/* -------------------------------------------------------------- constants */

/** Same four pastel tints as Content Studio / AssistantCard, cycled per source. */
const TINTS = ["#D8E8F6", "#DCEFD9", "#FBF0C4", "#E9E0F7"];

const EYEBROW =
  "text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow mb-[9px]";

/* --------------------------------------------------------------- helpers */

function friendlyError(err: unknown): string {
  if (isApiError(err)) {
    if (err.isOffline) return "Can't reach the API. Is it running?";
    if (err.isUnconfigured)
      return "API is up but no LLM provider is configured.";
    return err.detail ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

function sourceLabel(source: Source): string {
  if (source.title) return source.title;
  if (source.vault_path) {
    const leaf = source.vault_path.split("/").pop() ?? source.vault_path;
    return leaf.replace(/\.mdx?$/i, "");
  }
  return `Note ${source.note_id}`;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Normalize scores to a 0..1 fill for the "your knowledge" bars. */
function scoreFill(score: number | null): number {
  if (score === null || !Number.isFinite(score)) return 0;
  // Scores from semantic_search are usually 0..1; clamp for safety.
  return Math.max(0, Math.min(1, score));
}

/* ----------------------------------------------------------------- page */

export default function ResearchPage() {
  /* ---- form ---- */
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState<number | "">("");

  /* ---- data ---- */
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [history, setHistory] = useState<ResearchQuery[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [animateId, setAnimateId] = useState<number | null>(null);

  /* ---- action state ---- */
  const [researching, setResearching] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedChip, setSavedChip] = useState(false);

  /* ---- initial loads ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await listProjects({ status: "active" });
        if (!cancelled) setProjects(data);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadHistory = useCallback(async () => {
    setListError(null);
    try {
      const data = await listResearch({ limit: 8 });
      setHistory(data);
    } catch (err) {
      setListError(friendlyError(err));
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const selected = useMemo<ResearchQuery | null>(() => {
    if (selectedId === null || !history) return null;
    return history.find((r) => r.id === selectedId) ?? null;
  }, [selectedId, history]);

  /* ---- actions ---- */
  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setAskError("Give me at least a few words to research.");
      return;
    }
    setResearching(true);
    setAskError(null);
    setActionError(null);
    setSavedChip(false);
    try {
      const result = await createResearch({
        query: trimmed,
        project_id: projectId === "" ? null : projectId,
      });
      setHistory((prev) => {
        const rest = (prev ?? []).filter((r) => r.id !== result.id);
        return [result, ...rest].slice(0, 8);
      });
      setSelectedId(result.id);
      // Only animate freshly-generated ready summaries — a failed row has no
      // body to reveal, and picking an old row shows immediately.
      setAnimateId(result.status === "ready" ? result.id : null);
      setQuery("");
    } catch (err) {
      setAskError(friendlyError(err));
    } finally {
      setResearching(false);
    }
  }

  async function onSaveToVault() {
    if (!selected) return;
    if (selected.status !== "ready") {
      setActionError("Can't save a failed research to the vault.");
      return;
    }
    if (selected.saved_as_note_id !== null) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await saveResearchToVault(selected.id);
      setHistory((prev) =>
        (prev ?? []).map((r) => (r.id === updated.id ? updated : r)),
      );
      setSavedChip(true);
      window.setTimeout(() => setSavedChip(false), 2000);
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate(kind: ContentKind) {
    if (!selected || !selected.summary) return;
    setBusy(true);
    setActionError(null);
    try {
      const draft = await generateContent({
        kind,
        prompt: selected.summary,
        project_id: selected.project_id,
      });
      // Nudge the user over to /content where the fresh draft is waiting.
      if (typeof window !== "undefined") {
        window.location.href = `/content?draft=${draft.id}`;
      }
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selected) return;
    if (!window.confirm("Delete this research? This can't be undone.")) return;
    setBusy(true);
    setActionError(null);
    try {
      await deleteResearch(selected.id);
      setHistory((prev) => (prev ?? []).filter((r) => r.id !== selected.id));
      setSelectedId(null);
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const showEmpty = history !== null && history.length === 0 && !selected;

  return (
    <div className="max-w-[1180px] px-11 pt-10 pb-7">
      {/* ---------------------------------------------------- Header + Ask */}
      <div className="mb-6">
        <div className="mb-[6px] text-[12px] font-semibold text-ink-faint">
          Research
        </div>
        <h1 className="max-w-[720px] text-[30px] font-bold leading-[1.14] tracking-[-1px] text-ink">
          {selected && selected.status === "ready"
            ? selected.query
            : "What do you want to know?"}
        </h1>
      </div>

      {/* Ask bar */}
      <form
        onSubmit={onAsk}
        className="mb-6 rounded-card border border-border-card bg-surface px-5 py-[16px]"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What CPA are competitors hitting on TikTok in regulated iGaming markets?"
            disabled={researching}
            maxLength={4000}
            className="min-w-0 flex-1 rounded-field bg-sunken px-3 py-[11px] text-[14.5px] text-ink placeholder:text-ink-placeholder focus:outline-none focus:ring-1 focus:ring-ink"
          />
          <select
            value={projectId === "" ? "" : String(projectId)}
            onChange={(e) =>
              setProjectId(e.target.value === "" ? "" : Number(e.target.value))
            }
            disabled={researching}
            className="cursor-pointer rounded-field border border-border-card bg-surface px-3 py-[10px] text-[13px] font-semibold text-ink focus:border-ink focus:outline-none md:w-[180px]"
          >
            <option value="">No project</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={researching || query.trim().length < 3}
            className="cursor-pointer rounded-field bg-ink px-[18px] py-[11px] text-[13px] font-semibold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {researching ? "Researching…" : "Research"}
          </button>
        </div>
        {askError && (
          <div className="mt-[12px] rounded-field border border-border-card bg-muted px-3 py-2 text-[12.5px] font-semibold text-accent-deep">
            {askError}
          </div>
        )}
        <div className="mt-[10px] text-[11.5px] text-ink-faint">
          Research pulls from your vault today; web results coming soon.
        </div>
      </form>

      {/* ---------------------------------------------------- Main grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_1fr]">
        {/* --- Summary panel + actions --- */}
        <section className="rounded-card border border-border-card bg-surface px-6 py-[22px]">
          {researching && (
            <div className="flex min-h-[240px] flex-col items-start justify-center">
              <div className={EYEBROW}>SUMMARY</div>
              <div className="mb-2 h-[14px] w-[70%] animate-pulse rounded-[7px] bg-muted-2" />
              <div className="mb-2 h-[14px] w-[92%] animate-pulse rounded-[7px] bg-muted-2" />
              <div className="mb-2 h-[14px] w-[83%] animate-pulse rounded-[7px] bg-muted-2" />
              <div className="h-[14px] w-[46%] animate-pulse rounded-[7px] bg-muted-2" />
              <div className="mt-4 text-[12.5px] font-semibold text-ink-muted-2">
                Researching your knowledge…
              </div>
            </div>
          )}

          {!researching && !selected && showEmpty && (
            <div className="flex min-h-[240px] items-center justify-center text-center">
              <div>
                <div className="mb-1 text-[15px] font-bold tracking-[-0.2px] text-ink">
                  Nothing here yet
                </div>
                <div className="max-w-[360px] text-[13px] text-ink-muted-2">
                  Research pulls from your vault today; web results coming soon.
                  Ask something above to get started.
                </div>
              </div>
            </div>
          )}

          {!researching && !selected && !showEmpty && (
            <div className="flex min-h-[240px] items-center justify-center text-center">
              <div>
                <div className="mb-1 text-[15px] font-bold tracking-[-0.2px] text-ink">
                  Nothing selected
                </div>
                <div className="text-[13px] text-ink-muted-2">
                  Pick a past research on the right or ask a new question.
                </div>
              </div>
            </div>
          )}

          {!researching && selected && (
            <>
              <div className="mb-[10px] flex items-center gap-2">
                <div className={EYEBROW + " mb-0"}>SUMMARY</div>
                <span
                  className={
                    selected.status === "ready"
                      ? "rounded-[7px] bg-success-bg px-2 py-[2px] text-[10.5px] font-semibold text-success"
                      : selected.status === "failed"
                        ? "rounded-[7px] bg-muted px-2 py-[2px] text-[10.5px] font-semibold text-accent-deep"
                        : "rounded-[7px] bg-muted-2 px-2 py-[2px] text-[10.5px] font-semibold text-ink-muted"
                  }
                >
                  {selected.status === "ready"
                    ? "Ready"
                    : selected.status === "failed"
                      ? "Failed"
                      : "Pending"}
                </span>
                {selected.saved_as_note_id !== null && (
                  <span className="rounded-[7px] bg-muted px-2 py-[2px] text-[10.5px] font-semibold text-ink-secondary">
                    Saved to vault
                  </span>
                )}
                <span className="ml-auto text-[11px] text-ink-faint">
                  {formatRelative(selected.updated_at)}
                </span>
              </div>

              {selected.summary ? (
                <RevealText
                  // `key` remounts RevealText when the selection changes so
                  // its internal `revealed` state (a mount-time initializer)
                  // is re-seeded from the new `animate` value — otherwise
                  // switching selections can freeze partway through the last
                  // reveal.
                  key={selected.id}
                  text={selected.summary}
                  animate={selected.id === animateId}
                  className="max-w-[640px] whitespace-pre-wrap text-[15px] leading-[1.62] text-ink-body"
                />
              ) : (
                <div className="max-w-[620px] text-[14.5px] leading-[1.68]">
                  <span className="italic text-ink-muted-2">
                    Research failed — no summary was produced. Sources (if any)
                    are still listed on the right.
                  </span>
                </div>
              )}

              {selected.sources && selected.sources.length > 0 && (
                <div className="mt-5 border-t border-divider pt-4">
                  <div className={EYEBROW}>SOURCES</div>
                  <div className="flex flex-wrap gap-[7px]">
                    {selected.sources.map((source, i) => (
                      <span
                        key={`${source.note_id}-${i}`}
                        title={source.vault_path ?? undefined}
                        className="flex items-center gap-[7px] rounded-nav bg-muted px-[10px] py-[6px] text-[12px] font-semibold text-ink"
                      >
                        <span
                          aria-hidden
                          className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[4px] text-[9px] font-bold text-accent"
                          style={{ background: TINTS[i % TINTS.length] }}
                        >
                          {i + 1}
                        </span>
                        {sourceLabel(source)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {actionError && (
                <div className="mt-4 rounded-field border border-border-card bg-muted px-3 py-2 text-[12.5px] font-semibold text-accent-deep">
                  {actionError}
                </div>
              )}

              <div className="mt-[18px] flex flex-wrap gap-2 border-t border-divider pt-4">
                {selected.saved_as_note_id !== null ? (
                  <span className="rounded-nav bg-success-bg px-[13px] py-2 text-[12.5px] font-semibold text-success">
                    {savedChip ? "Saved" : "Saved to vault"}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onSaveToVault}
                    disabled={busy || selected.status !== "ready"}
                    className="cursor-pointer rounded-nav bg-ink px-[13px] py-2 text-[12.5px] font-semibold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Save to vault
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onGenerate("blog")}
                  disabled={busy || !selected.summary}
                  className="cursor-pointer rounded-nav border border-border-button px-[13px] py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Generate blog
                </button>
                <button
                  type="button"
                  onClick={() => onGenerate("report")}
                  disabled={busy || !selected.summary}
                  className="cursor-pointer rounded-nav border border-border-button px-[13px] py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Generate report
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  className="ml-auto cursor-pointer rounded-nav border border-border-button px-[13px] py-2 text-[12.5px] font-semibold text-accent-deep hover:border-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </section>

        {/* --- Right column: your knowledge + history --- */}
        <div className="flex min-w-0 flex-col gap-3">
          {/* Your knowledge — sources with score bars */}
          <section
            className="rounded-card border px-5 py-[18px]"
            style={{ background: "#F1EFFA", borderColor: "#E3DEF6" }}
          >
            <h2 className="mb-1 text-[15px] font-bold tracking-[-0.2px] text-ink">
              Your knowledge
            </h2>
            <div className="mb-2 text-[11.5px] text-ink-faint">
              Notes that grounded this answer.
            </div>

            {(!selected || !selected.sources || selected.sources.length === 0) && (
              <div
                className="border-t py-[10px] text-[12.5px] text-ink-muted-2"
                style={{ borderColor: "rgba(0,0,0,.06)" }}
              >
                {selected
                  ? "No matching notes for this one."
                  : "Ask a question — matching notes will appear here."}
              </div>
            )}

            {selected &&
              selected.sources &&
              selected.sources.map((source, i) => {
                const fill = scoreFill(source.score);
                return (
                  <div
                    key={`${source.note_id}-${i}`}
                    className="flex flex-col gap-[6px] border-t py-[10px]"
                    style={{ borderColor: "rgba(0,0,0,.06)" }}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="w-[14px] flex-none text-[10px] font-bold text-accent">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">
                        {sourceLabel(source)}
                      </span>
                      {source.score !== null && (
                        <span className="flex-none text-[10.5px] font-semibold text-ink-faint">
                          {Math.round(fill * 100)}%
                        </span>
                      )}
                    </div>
                    {source.vault_path && (
                      <div className="pl-[18px] text-[11px] text-ink-faint truncate">
                        {source.vault_path}
                      </div>
                    )}
                    <div
                      className="ml-[18px] h-[3px] rounded-[2px]"
                      style={{ background: "rgba(0,0,0,.06)" }}
                    >
                      <div
                        className="h-full rounded-[2px] bg-accent"
                        style={{ width: `${Math.round(fill * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </section>

          {/* Recent research history */}
          <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <div className="mb-[10px] flex items-center">
              <h2 className="text-[15px] font-bold tracking-[-0.2px] text-ink">
                Recent research
              </h2>
              {history && history.length > 0 && (
                <span className="ml-auto text-[11.5px] text-ink-faint">
                  {history.length} shown
                </span>
              )}
            </div>

            {listError && (
              <div className="rounded-field border border-border-card bg-muted px-3 py-2 text-[12.5px] font-semibold text-accent-deep">
                {listError}
              </div>
            )}

            {history === null && !listError && (
              <div className="text-[13px] text-ink-muted-2">Loading…</div>
            )}

            {history && history.length === 0 && !listError && (
              <div className="text-[13px] text-ink-muted-2">
                Nothing yet — your questions land here.
              </div>
            )}

            {history &&
              history.map((r) => {
                const active = r.id === selectedId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(r.id);
                      // Only fresh generations animate — history clicks show immediately.
                      setAnimateId(null);
                      setActionError(null);
                      setSavedChip(false);
                    }}
                    className={
                      active
                        ? "flex w-full flex-col items-start gap-1 border-t border-divider py-[9px] text-left"
                        : "flex w-full cursor-pointer flex-col items-start gap-1 border-t border-divider py-[9px] text-left hover:bg-hover-2/40"
                    }
                  >
                    <div className="flex w-full items-center gap-2">
                      <span
                        className={
                          r.status === "ready"
                            ? "flex-none rounded-[6px] bg-success-bg px-[7px] py-[2px] text-[10px] font-semibold text-success"
                            : r.status === "failed"
                              ? "flex-none rounded-[6px] bg-muted px-[7px] py-[2px] text-[10px] font-semibold text-accent-deep"
                              : "flex-none rounded-[6px] bg-muted-2 px-[7px] py-[2px] text-[10px] font-semibold text-ink-muted"
                        }
                      >
                        {r.status === "ready"
                          ? "Ready"
                          : r.status === "failed"
                            ? "Failed"
                            : "Pending"}
                      </span>
                      <span className="ml-auto flex-none text-[10.5px] text-ink-faint">
                        {formatRelative(r.created_at)}
                      </span>
                    </div>
                    <span
                      className={`line-clamp-2 text-[12.5px] font-semibold ${
                        active ? "text-ink" : "text-ink-secondary"
                      }`}
                    >
                      {r.query}
                    </span>
                  </button>
                );
              })}
          </section>

          <div className="text-[11.5px] text-ink-faint">
            <Link href="/knowledge" className="font-semibold text-accent">
              Open your knowledge vault →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
