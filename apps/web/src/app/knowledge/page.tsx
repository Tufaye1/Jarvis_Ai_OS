"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SkippedNote = { path: string; reason: string };

type ReindexResult = {
  notes_scanned: number;
  notes_created: number;
  notes_updated: number;
  links_created: number;
  skipped: SkippedNote[];
};

type BackfillResult = {
  embedded_count: number;
};

type RunKind = "reindex" | "backfill";

type RunState = {
  kind: RunKind;
  ok: boolean;
  data: ReindexResult | BackfillResult | null;
  error: string | null;
  raw: string;
};

const FILTERS = [
  "Everything",
  "Documents",
  "Videos",
  "Audio",
  "Screenshots",
  "Transcripts",
  "Browser captures",
  "Bookmarks",
];

const DROPZONE_CHIPS = [
  "Browse files",
  "Paste a link",
  "Record audio",
  "Import from Drive",
];

const UploadArrow = ({ size, color }: { size: number; color: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke={color}
    strokeWidth="1.6"
    aria-hidden="true"
  >
    <path d="M8 11.4V3.2M4.8 6.4 8 3.2l3.2 3.2M2.8 12.4h10.4" />
  </svg>
);

function isReindex(
  kind: RunKind,
  data: ReindexResult | BackfillResult | null,
): data is ReindexResult {
  return kind === "reindex" && data !== null;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-tile border border-border-tile px-3 py-[11px]">
      <div className="text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow uppercase">
        {label}
      </div>
      <div className="mt-[2px] text-[19px] font-bold tracking-[-0.4px] text-ink">
        {value}
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  const [pending, setPending] = useState<RunKind | null>(null);
  const [run, setRun] = useState<RunState | null>(null);

  async function trigger(kind: RunKind) {
    const path = kind === "reindex" ? "/knowledge/reindex" : "/knowledge/backfill-embeddings";
    setPending(kind);
    setRun(null);
    try {
      const res = await fetch(`${API_URL}${path}`, { method: "POST" });
      const text = await res.text();
      if (!res.ok) {
        setRun({
          kind,
          ok: false,
          data: null,
          error: `HTTP ${res.status} ${res.statusText}`,
          raw: text,
        });
        return;
      }
      const data = JSON.parse(text) as ReindexResult | BackfillResult;
      setRun({ kind, ok: true, data, error: null, raw: text });
    } catch (err) {
      setRun({
        kind,
        ok: false,
        data: null,
        error: err instanceof Error ? err.message : String(err),
        raw: "",
      });
    } finally {
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="max-w-[1180px] px-11 pt-8 pb-7">
      {/* Header */}
      <div className="mb-5 flex items-end gap-[14px]">
        <div>
          <h1 className="mb-1 text-[30px] font-bold tracking-[-1px] text-ink">
            Knowledge
          </h1>
          <p className="text-[13.5px] text-ink-muted-2">
            Vault-backed index · nothing filed by hand
          </p>
        </div>

        <button
          type="button"
          onClick={() => trigger("reindex")}
          disabled={busy}
          className="ml-auto flex cursor-pointer items-center gap-2 rounded-field bg-ink px-[15px] py-[10px] text-[13px] font-semibold text-white hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <UploadArrow size={15} color="#FFFFFF" />
          <span>{pending === "reindex" ? "Reindexing…" : "Reindex vault"}</span>
        </button>

        <button
          type="button"
          onClick={() => trigger("backfill")}
          disabled={busy}
          className="cursor-pointer rounded-field border border-border-button px-[15px] py-[10px] text-[13px] font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending === "backfill" ? "Embedding…" : "Backfill embeddings"}
        </button>
      </div>

      {/* Dropzone (visual) */}
      <div className="mb-[18px] flex cursor-pointer items-center gap-[18px] rounded-card border-[1.5px] border-dashed border-border-button bg-sunken px-6 py-[22px]">
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-bar border border-border-card bg-surface">
          <UploadArrow size={19} color="#101010" />
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-[-0.2px] text-ink">
            Drop anything here
          </div>
        </div>
        <div className="ml-auto flex max-w-[250px] flex-wrap justify-end gap-[6px]">
          {DROPZONE_CHIPS.map((c) => (
            <span
              key={c}
              className="rounded-[6px] border border-border-tile bg-surface px-2 py-1 text-[11px] font-semibold text-ink-muted"
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Live result card */}
      {(busy || run) && (
        <section className="mb-[18px] rounded-card border border-border-card bg-surface px-[18px] py-4">
          <div className="mb-[10px] flex items-center gap-[10px]">
            <span className="text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow">
              {(run?.kind ?? pending) === "reindex"
                ? "VAULT REINDEX"
                : "EMBEDDING BACKFILL"}
            </span>
            {busy && (
              <span className="rounded-[7px] bg-muted-2 px-2 py-1 text-[11px] font-semibold text-ink-muted">
                Running…
              </span>
            )}
            {run?.ok && (
              <span className="rounded-[7px] bg-success-bg px-2 py-1 text-[11px] font-semibold text-success">
                Done
              </span>
            )}
            {run && !run.ok && (
              <span className="rounded-[7px] bg-muted-2 px-2 py-1 text-[11px] font-semibold text-accent-deep">
                Failed
              </span>
            )}
          </div>

          {busy && (
            <p className="text-[13px] text-ink-muted-2">
              Talking to {API_URL} — first embedding run downloads the local
              model, so it can take a minute.
            </p>
          )}

          {run && !run.ok && (
            <div>
              <p className="text-[13px] font-semibold text-ink">{run.error}</p>
              {run.raw && (
                <pre className="mt-2 overflow-x-auto rounded-tile bg-muted px-3 py-2 text-[12px] text-ink-muted">
                  {run.raw}
                </pre>
              )}
            </div>
          )}

          {run?.ok && isReindex(run.kind, run.data) && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <Stat label="Scanned" value={run.data.notes_scanned} />
                <Stat label="Created" value={run.data.notes_created} />
                <Stat label="Updated" value={run.data.notes_updated} />
                <Stat label="Links" value={run.data.links_created} />
                <Stat label="Skipped" value={run.data.skipped.length} />
              </div>
              {run.data.skipped.length > 0 && (
                <div className="mt-3 border-t border-divider pt-3">
                  <div className="mb-[6px] text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow">
                    SKIPPED
                  </div>
                  {run.data.skipped.map((s) => (
                    <div
                      key={s.path}
                      className="flex gap-3 border-t border-divider py-2 text-[12.5px]"
                    >
                      <span className="min-w-0 truncate font-semibold text-ink">
                        {s.path}
                      </span>
                      <span className="ml-auto flex-none text-ink-muted-2">
                        {s.reason}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {run?.ok && run.kind === "backfill" && run.data && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat
                label="Embedded"
                value={(run.data as BackfillResult).embedded_count}
              />
            </div>
          )}

          {run?.ok && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11.5px] font-bold text-accent">
                Raw response
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-tile bg-muted px-3 py-2 text-[12px] text-ink-muted">
                {JSON.stringify(run.data, null, 2)}
              </pre>
            </details>
          )}
        </section>
      )}

      {/* Filter chips (visual) */}
      <div className="mb-[18px] flex flex-wrap gap-[7px]">
        {FILTERS.map((f, i) => (
          <span
            key={f}
            className={
              i === 0
                ? "rounded-chip bg-ink px-[11px] py-[6px] text-[12px] font-semibold text-white"
                : "rounded-chip border border-border-chip px-[11px] py-[6px] text-[12px] font-semibold text-ink-secondary"
            }
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  );
}
