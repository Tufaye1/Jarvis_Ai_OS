"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import RevealText from "@/components/ui/RevealText";
import {
  deleteContent,
  generateContent,
  isApiError,
  listContent,
  listProjects,
  updateContent,
  type ContentDraft,
  type ContentKind,
  type ContentLength,
  type Project,
  type Source,
} from "@/lib/api";

/** The seven output kinds the backend accepts. */
const KINDS: { value: ContentKind; label: string }[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "blog", label: "Blog" },
  { value: "email", label: "Email" },
  { value: "proposal", label: "Proposal" },
  { value: "report", label: "Report" },
  { value: "deck_outline", label: "Deck outline" },
  { value: "tweet", label: "Tweet" },
];

const LENGTHS: { value: "" | ContentLength; label: string }[] = [
  { value: "", label: "Default" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

/** Same four pastel tints the assistant card cycles through on source chips. */
const TINTS = ["#D8E8F6", "#DCEFD9", "#FBF0C4", "#E9E0F7"];

const EYEBROW =
  "text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow mb-[9px]";

function friendlyError(err: unknown): string {
  if (isApiError(err)) {
    if (err.isOffline) return "Can't reach the API. Is it running?";
    if (err.isUnconfigured)
      return "API is up but no LLM provider is configured.";
    return err.detail ?? err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

function kindLabel(kind: ContentKind): string {
  return KINDS.find((k) => k.value === kind)?.label ?? kind;
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

export default function ContentStudioPage() {
  /* ---- form state ---- */
  const [kind, setKind] = useState<ContentKind>("linkedin");
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState<"" | ContentLength>("");
  const [projectId, setProjectId] = useState<number | "">("");

  /* ---- data ---- */
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [drafts, setDrafts] = useState<ContentDraft[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Which draft id should typewriter-reveal (only set on fresh generation;
  // opening an existing draft skips the animation).
  const [animateId, setAnimateId] = useState<number | null>(null);

  /* ---- action state ---- */
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const loadDrafts = useCallback(async () => {
    setListError(null);
    try {
      const data = await listContent({ limit: 8 });
      setDrafts(data);
    } catch (err) {
      setListError(friendlyError(err));
      setDrafts([]);
    }
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  const selected = useMemo<ContentDraft | null>(() => {
    if (selectedId === null || !drafts) return null;
    return drafts.find((d) => d.id === selectedId) ?? null;
  }, [selectedId, drafts]);

  /* ---- actions ---- */
  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (trimmed.length < 3) {
      setGenError("Give me at least a sentence of brief.");
      return;
    }
    setGenerating(true);
    setGenError(null);
    setActionError(null);
    setCopyOk(false);
    try {
      const toneVal = tone.trim();
      const draft = await generateContent({
        kind,
        prompt: trimmed,
        project_id: projectId === "" ? null : projectId,
        tone: toneVal.length > 0 ? toneVal : null,
        length: length === "" ? null : length,
      });
      setDrafts((prev) => {
        const rest = (prev ?? []).filter((d) => d.id !== draft.id);
        return [draft, ...rest].slice(0, 8);
      });
      setSelectedId(draft.id);
      setAnimateId(draft.id);
    } catch (err) {
      setGenError(friendlyError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function onCopy() {
    if (!selected) return;
    // Guard: body is null when the LLM call failed but the row was persisted.
    if (!selected.body) {
      setActionError("This draft has no body — the generation failed.");
      return;
    }
    try {
      const heading = selected.title ? `${selected.title}\n\n` : "";
      await navigator.clipboard.writeText(`${heading}${selected.body}`);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1600);
    } catch (err) {
      setActionError(friendlyError(err));
    }
  }

  async function onMarkFinal() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await updateContent(selected.id, { status: "final" });
      setDrafts((prev) =>
        (prev ?? []).map((d) => (d.id === updated.id ? updated : d)),
      );
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!selected) return;
    if (
      !window.confirm(
        `Delete this ${kindLabel(selected.kind)} draft? This can't be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await deleteContent(selected.id);
      setDrafts((prev) => (prev ?? []).filter((d) => d.id !== selected.id));
      setSelectedId(null);
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[1180px] px-11 pt-10 pb-7">
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-1 text-[30px] font-bold tracking-[-1px] text-ink">
          Content Studio
        </h1>
        <p className="text-[13.5px] text-ink-muted-2">
          Draft posts, emails, and reports from your notes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* --------------------------------- Left: input form ------------- */}
        <form
          onSubmit={onGenerate}
          className="rounded-card border border-border-card bg-surface px-5 py-[18px]"
        >
          <div className={EYEBROW}>OUTPUT KIND</div>
          <div className="mb-[18px] flex flex-wrap gap-[6px]">
            {KINDS.map((k) => {
              const active = k.value === kind;
              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={
                    active
                      ? "cursor-pointer rounded-chip bg-ink px-[11px] py-[6px] text-[12px] font-semibold text-white"
                      : "cursor-pointer rounded-chip border border-border-chip px-[11px] py-[6px] text-[12px] font-semibold text-ink-secondary hover:border-ink"
                  }
                >
                  {k.label}
                </button>
              );
            })}
          </div>

          <div className={EYEBROW}>PROJECT</div>
          <select
            value={projectId === "" ? "" : String(projectId)}
            onChange={(e) =>
              setProjectId(e.target.value === "" ? "" : Number(e.target.value))
            }
            disabled={generating}
            className="mb-[18px] w-full cursor-pointer rounded-field border border-border-card bg-surface px-3 py-[9px] text-[13px] font-semibold text-ink focus:border-ink focus:outline-none"
          >
            <option value="">No project</option>
            {(projects ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className={EYEBROW}>PROMPT</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Write the July recap for the NetBet client. Lead with registrations, be honest about display."
            rows={6}
            maxLength={4000}
            disabled={generating}
            className="mb-[18px] w-full resize-none rounded-tile bg-sunken px-3 py-[10px] text-[13px] leading-[1.5] text-ink placeholder:text-ink-placeholder focus:outline-none focus:ring-1 focus:ring-ink"
          />

          <div className="mb-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <div className={EYEBROW}>TONE</div>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="professional, concise, playful..."
                disabled={generating}
                className="w-full rounded-field border border-border-card bg-surface px-3 py-[9px] text-[13px] font-semibold text-ink placeholder:text-ink-placeholder focus:border-ink focus:outline-none"
              />
            </div>
            <div>
              <div className={EYEBROW}>LENGTH</div>
              <select
                value={length}
                onChange={(e) =>
                  setLength(e.target.value as "" | ContentLength)
                }
                disabled={generating}
                className="w-full cursor-pointer rounded-field border border-border-card bg-surface px-3 py-[9px] text-[13px] font-semibold text-ink focus:border-ink focus:outline-none"
              >
                {LENGTHS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {genError && (
            <div className="mb-[14px] rounded-field border border-border-card bg-muted px-3 py-2 text-[12.5px] font-semibold text-accent-deep">
              {genError}
            </div>
          )}

          <button
            type="submit"
            disabled={generating || prompt.trim().length < 3}
            className="w-full cursor-pointer rounded-field bg-ink px-[15px] py-[11px] text-[13px] font-semibold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate"}
          </button>
        </form>

        {/* --------------------------------- Right: drafts + preview ------ */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* Recent drafts */}
          <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <div className="mb-[12px] flex items-center">
              <div className="text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow">
                RECENT DRAFTS
              </div>
              {drafts && drafts.length > 0 && (
                <div className="ml-auto text-[11.5px] text-ink-faint">
                  {drafts.length} shown
                </div>
              )}
            </div>

            {listError && (
              <div className="rounded-field border border-border-card bg-muted px-3 py-2 text-[12.5px] font-semibold text-accent-deep">
                {listError}
              </div>
            )}

            {drafts === null && !listError && (
              <div className="text-[13px] text-ink-muted-2">
                Loading drafts…
              </div>
            )}

            {drafts && drafts.length === 0 && !listError && (
              <div className="text-[13px] text-ink-muted-2">
                Nothing yet — write a brief on the left and hit Generate.
              </div>
            )}

            {drafts && drafts.length > 0 && (
              <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                {drafts.map((d) => {
                  const active = d.id === selectedId;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(d.id);
                        // Old drafts render fully — only fresh generations animate.
                        setAnimateId(null);
                        setActionError(null);
                        setCopyOk(false);
                      }}
                      className={
                        active
                          ? "flex cursor-pointer flex-col rounded-grid-card border border-ink bg-surface p-[12px] text-left"
                          : "flex cursor-pointer flex-col rounded-grid-card border border-border-tile bg-surface p-[12px] text-left hover:border-border-hover"
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            d.status === "final"
                              ? "flex-none rounded-[7px] bg-success-bg px-2 py-[2px] text-[10.5px] font-semibold text-success"
                              : "flex-none rounded-[7px] bg-muted-2 px-2 py-[2px] text-[10.5px] font-semibold text-ink-muted"
                          }
                        >
                          {kindLabel(d.kind)}
                        </span>
                        {d.status === "final" && (
                          <span className="text-[10.5px] font-semibold text-success">
                            Final
                          </span>
                        )}
                      </div>
                      <div className="mt-[8px] line-clamp-2 text-[13px] font-bold tracking-[-0.1px] text-ink">
                        {d.title ?? d.prompt}
                      </div>
                      <div className="mt-[8px] text-[11px] text-ink-faint">
                        {formatRelative(d.created_at)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Preview */}
          <section className="min-h-[240px] rounded-card border border-border-card bg-surface px-6 py-[22px]">
            {!selected && (
              <div className="flex h-full min-h-[200px] items-center justify-center text-center">
                <div>
                  <div className="mb-1 text-[15px] font-bold tracking-[-0.2px] text-ink">
                    Nothing selected
                  </div>
                  <div className="text-[13px] text-ink-muted-2">
                    Pick a draft above or generate a new one.
                  </div>
                </div>
              </div>
            )}

            {selected && (
              <>
                <div className="mb-[10px] flex items-center gap-2">
                  <div className={EYEBROW + " mb-0"}>PREVIEW</div>
                  <span
                    className={
                      selected.status === "final"
                        ? "rounded-[7px] bg-success-bg px-2 py-[2px] text-[10.5px] font-semibold text-success"
                        : "rounded-[7px] bg-muted-2 px-2 py-[2px] text-[10.5px] font-semibold text-ink-muted"
                    }
                  >
                    {selected.status === "final" ? "Final" : "Draft"}
                  </span>
                  <span className="rounded-[7px] bg-muted px-2 py-[2px] text-[10.5px] font-semibold text-ink-secondary">
                    {kindLabel(selected.kind)}
                  </span>
                  <span className="ml-auto text-[11px] text-ink-faint">
                    {formatRelative(selected.updated_at)}
                  </span>
                </div>

                {selected.title && (
                  <h2 className="mb-3 max-w-[560px] text-[19px] font-bold leading-[1.3] tracking-[-0.4px] text-ink">
                    {selected.title}
                  </h2>
                )}

                {selected.body ? (
                  <RevealText
                    text={selected.body}
                    animate={selected.id === animateId}
                    className="max-w-[620px] whitespace-pre-wrap text-[14.5px] leading-[1.68] text-ink-hover"
                  />
                ) : (
                  <div className="max-w-[620px] text-[14.5px] leading-[1.68]">
                    <span className="italic text-ink-muted-2">
                      Generation failed for this draft — no body was saved.
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
                            className="h-[15px] w-[15px] flex-none rounded-[4px]"
                            style={{ background: TINTS[i % TINTS.length] }}
                          />
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
                  <button
                    type="button"
                    onClick={onCopy}
                    disabled={busy}
                    className="cursor-pointer rounded-nav border border-border-button px-[13px] py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {copyOk ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={onMarkFinal}
                    disabled={busy || selected.status === "final"}
                    className="cursor-pointer rounded-nav bg-ink px-[13px] py-2 text-[12.5px] font-semibold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selected.status === "final" ? "Marked final" : "Mark final"}
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
        </div>
      </div>
    </div>
  );
}
