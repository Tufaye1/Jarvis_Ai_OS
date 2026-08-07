"use client";

/**
 * Home — the first screen. Two data reads on mount:
 *   - GET /planner/today  → drives the "Today" card (priorities + due_today)
 *   - GET /projects?status=active → drives the "Projects" tile grid
 * Recent activity is derived from GET /chat/conversations (newest 4 titles).
 * Everything else (greeting, quick-action pastels, Suggestions) is static.
 *
 * Empty and error states are per-card, not page-wide: a broken planner
 * must not blank out the projects grid, and vice versa.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getPlannerToday,
  isApiError,
  listConversations,
  listProjects,
  type Conversation,
  type PlannerToday,
  type Project,
  type Task,
} from "@/lib/api";

/* --------------------------------------------------------------- constants */

const USER_NAME = "Hossain";

const QUICK_ACTIONS = [
  {
    title: "Ask",
    subtitle: "Anything across your knowledge",
    bg: "#D8E8F6",
    fg: "#4A5560",
    href: "/chat",
    icon: <path d="M2.8 4.2h10.4v6.4H7l-3 2.4v-2.4H2.8z" />,
  },
  {
    title: "Research",
    subtitle: "Web + your files, with sources",
    bg: "#DCEFD9",
    fg: "#4A5A48",
    href: "/research",
    icon: (
      <>
        <circle cx="8" cy="8" r="5.4" />
        <path d="M2.6 8h10.8" />
      </>
    ),
  },
  {
    title: "Create",
    subtitle: "Post, report, deck, email",
    bg: "#FBF0C4",
    fg: "#5A5330",
    href: undefined,
    icon: <path d="M3 13h10M4.4 10.6l6.4-6.4 1.8 1.8-6.4 6.4H4.4z" />,
  },
  {
    title: "Plan",
    subtitle: "Today, in three moves",
    bg: "#E9E0F7",
    fg: "#504563",
    href: "/planner",
    icon: (
      <>
        <rect x="2.6" y="3.6" width="10.8" height="9.8" rx="1.6" />
        <path d="M2.6 6.6h10.8" />
      </>
    ),
  },
] as const;

const SUGGESTIONS = [
  "Finish the TikTok report",
  "Research competitor CPA",
  "Draft the July LinkedIn post",
  "Follow up with Aurora Media",
];

/* ------------------------------------------------------------ helpers ---- */

/** Long-form date shown next to the "Today" title, e.g. "Thursday, 30 July". */
function formatToday(isoDate: string | null): string {
  const d = isoDate ? new Date(isoDate) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Compact "when" cell for a task. Prefers due time if present. */
function taskWhen(t: Task): string {
  if (t.due_at) {
    const d = new Date(t.due_at);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
  }
  return "—";
}

/** Trailing chip label per task. Small, informational, never a control. */
function taskChipLabel(t: Task): string {
  if (t.status === "doing") return "In progress";
  if (t.status === "done") return "Done";
  if (t.due_at) return "Due";
  return "To do";
}

/** Loose "N minutes ago" — good enough for a home dashboard.
 *  Anything beyond a week collapses to a short date. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return day === 1 ? "Yesterday" : `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Human-readable API error, or generic fallback. */
function errorText(err: unknown): string {
  if (isApiError(err)) {
    if (err.isOffline) return "API unreachable";
    return `${err.status} — ${err.detail ?? "Request failed"}`;
  }
  return "Something went wrong";
}

/* ------------------------------------------------- quick-action card ---- */

function QuickActionCard({
  action,
}: {
  action: (typeof QUICK_ACTIONS)[number];
}) {
  const body = (
    <>
      <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white">
        <svg
          width="17"
          height="17"
          viewBox="0 0 16 16"
          fill="none"
          stroke="#101010"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          {action.icon}
        </svg>
      </div>
      <div>
        <div className="text-[16px] font-bold tracking-[-0.3px] text-ink">
          {action.title}
        </div>
        <div className="mt-[2px] text-[12.5px]" style={{ color: action.fg }}>
          {action.subtitle}
        </div>
      </div>
    </>
  );

  const className =
    "flex min-h-[118px] cursor-pointer flex-col justify-between rounded-card p-4 transition-[filter] hover:brightness-[0.98]";

  if (action.href) {
    return (
      <Link
        href={action.href}
        className={className}
        style={{ background: action.bg }}
      >
        {body}
      </Link>
    );
  }

  return (
    <div className={className} style={{ background: action.bg }}>
      {body}
    </div>
  );
}

/* ------------------------------------------------------------ page ------ */

type AsyncState<T> =
  | { kind: "loading" }
  | { kind: "error"; detail: string }
  | { kind: "ok"; data: T };

export default function HomePage() {
  const [planner, setPlanner] = useState<AsyncState<PlannerToday>>({
    kind: "loading",
  });
  const [projects, setProjects] = useState<AsyncState<Project[]>>({
    kind: "loading",
  });
  const [conversations, setConversations] = useState<AsyncState<Conversation[]>>(
    { kind: "loading" },
  );

  const [doneSuggestions, setDoneSuggestions] = useState<boolean[]>(
    SUGGESTIONS.map(() => false),
  );

  useEffect(() => {
    let cancelled = false;

    // Fire all three in parallel — a slow projects fetch shouldn't hold up the
    // planner card, and any one failing shouldn't blank the others.
    getPlannerToday()
      .then((d) => {
        if (!cancelled) setPlanner({ kind: "ok", data: d });
      })
      .catch((err) => {
        if (!cancelled) setPlanner({ kind: "error", detail: errorText(err) });
      });

    listProjects({ status: "active" })
      .then((d) => {
        if (!cancelled) setProjects({ kind: "ok", data: d });
      })
      .catch((err) => {
        if (!cancelled) setProjects({ kind: "error", detail: errorText(err) });
      });

    listConversations()
      .then((d) => {
        if (!cancelled) setConversations({ kind: "ok", data: d });
      })
      .catch((err) => {
        if (!cancelled)
          setConversations({ kind: "error", detail: errorText(err) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSuggestion = (i: number) =>
    setDoneSuggestions((prev) =>
      prev.map((v, idx) => (idx === i ? !v : v)),
    );

  // Merge priorities + due_today; keep priority order, drop dupes.
  const todayTasks: Task[] = (() => {
    if (planner.kind !== "ok") return [];
    const seen = new Set<number>();
    const merged: Task[] = [];
    for (const t of [...planner.data.priorities, ...planner.data.due_today]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      merged.push(t);
    }
    return merged.slice(0, 4);
  })();

  const openCount =
    planner.kind === "ok"
      ? planner.data.overdue.length +
        planner.data.due_today.length +
        planner.data.in_progress.length
      : 0;
  const doneToday =
    planner.kind === "ok" ? planner.data.completed_today.length : 0;

  return (
    <div className="max-w-[1180px] px-11 pt-10 pb-7">
      {/* Greeting */}
      <div className="text-[40px] leading-[1.06] font-bold tracking-[-1.4px] text-ink-ghost">
        Good morning {USER_NAME},
      </div>
      <div className="mb-[26px] text-[40px] leading-[1.06] font-bold tracking-[-1.4px] text-ink">
        what should we move forward?
      </div>

      {/* Quick actions */}
      <div className="mb-[26px] grid grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((a) => (
          <QuickActionCard key={a.title} action={a} />
        ))}
      </div>

      {/* Lower grid */}
      <div className="grid grid-cols-[1.35fr_1fr] items-start gap-3">
        {/* -------- Left column -------- */}
        <div className="flex flex-col gap-3">
          {/* Today */}
          <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <div className="mb-3 flex items-baseline gap-[10px]">
              <h2 className="text-[15px] font-bold tracking-[-0.2px] text-ink">
                Today
              </h2>
              <span className="text-[12px] text-ink-faint">
                {formatToday(planner.kind === "ok" ? planner.data.date : null)}
              </span>
            </div>

            {planner.kind === "loading" && (
              <div className="border-t border-divider py-[14px] text-[13px] text-ink-faint">
                Loading planner…
              </div>
            )}

            {planner.kind === "error" && (
              <div className="border-t border-divider py-[14px] text-[13px] text-ink-faint">
                {planner.detail}
              </div>
            )}

            {planner.kind === "ok" && todayTasks.length === 0 && (
              <div className="border-t border-divider py-[14px] text-[13px] text-ink-faint">
                Nothing on the board yet. Open the planner to add your first
                task.
              </div>
            )}

            {planner.kind === "ok" &&
              todayTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex gap-3 border-t border-divider py-[10px]"
                >
                  <span className="w-[46px] flex-none text-[12px] font-bold text-ink-muted">
                    {taskWhen(t)}
                  </span>
                  <span className="text-[13.5px] font-semibold text-ink">
                    {t.title}
                  </span>
                  <span className="ml-auto flex-none rounded-[6px] bg-muted-2 px-[7px] py-[3px] text-[11px] font-semibold text-ink-muted">
                    {taskChipLabel(t)}
                  </span>
                </div>
              ))}

            {/* Footer summary row — always present so the card doesn't look
                like it's missing its close. */}
            <div className="flex gap-3 border-t border-divider py-[10px]">
              <span className="w-[46px] flex-none text-[12px] font-bold text-ink-muted">
                —
              </span>
              <span className="text-[13.5px] font-semibold text-ink">
                {planner.kind === "ok"
                  ? `${openCount} open · ${doneToday} done today`
                  : "Planner"}
              </span>
              <Link
                href="/planner"
                className="ml-auto flex-none text-[11.5px] font-bold text-accent"
              >
                Open planner
              </Link>
            </div>
          </section>

          {/* Recent activity — derived from conversations */}
          <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <h2 className="mb-1 text-[15px] font-bold tracking-[-0.2px] text-ink">
              Recent activity
            </h2>

            {conversations.kind === "loading" && (
              <div className="border-t border-divider py-[10px] text-[13px] text-ink-faint">
                Loading…
              </div>
            )}
            {conversations.kind === "error" && (
              <div className="border-t border-divider py-[10px] text-[13px] text-ink-faint">
                {conversations.detail}
              </div>
            )}
            {conversations.kind === "ok" &&
              conversations.data.length === 0 && (
                <div className="border-t border-divider py-[10px] text-[13px] text-ink-faint">
                  Nothing yet. Start a chat to see it here.
                </div>
              )}
            {conversations.kind === "ok" &&
              conversations.data.slice(0, 4).map((c) => (
                <Link
                  key={c.id}
                  href="/chat"
                  className="flex items-center gap-3 border-t border-divider py-[10px]"
                >
                  <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-chip bg-muted-2 text-[10.5px] font-bold text-ink-muted">
                    CHAT
                  </span>
                  <span className="truncate text-[13px] font-semibold text-ink">
                    {c.title ?? "Untitled conversation"}
                  </span>
                  <span className="ml-auto flex-none text-[11.5px] text-ink-faint">
                    {relativeTime(c.updated_at)}
                  </span>
                </Link>
              ))}
          </section>
        </div>

        {/* -------- Right column -------- */}
        <div className="flex flex-col gap-3">
          {/* Suggestions — static for now, wired to local toggle. */}
          <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <div className="mb-[6px] flex items-center gap-[10px]">
              <h2 className="text-[15px] font-bold tracking-[-0.2px] text-ink">
                Suggestions
              </h2>
              <span className="h-[5px] w-[5px] rounded-full bg-accent" />
            </div>
            {SUGGESTIONS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleSuggestion(i)}
                className="flex w-full cursor-pointer items-center gap-[10px] border-t border-divider py-[9px] text-left"
              >
                <span
                  className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] border-[1.5px] border-checkbox"
                  style={{
                    background: doneSuggestions[i] ? "#101010" : "transparent",
                  }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    style={{ opacity: doneSuggestions[i] ? 1 : 0 }}
                    aria-hidden="true"
                  >
                    <path d="m3.4 8.4 3 3 6.2-6.6" />
                  </svg>
                </span>
                <span
                  className="text-[13px] font-semibold"
                  style={{
                    color: doneSuggestions[i] ? "#A8A8A3" : "#101010",
                    textDecoration: doneSuggestions[i]
                      ? "line-through"
                      : "none",
                  }}
                >
                  {label}
                </span>
              </button>
            ))}
          </section>

          {/* Projects — real, from /projects?status=active */}
          <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <h2 className="mb-3 text-[15px] font-bold text-ink">Projects</h2>

            {projects.kind === "loading" && (
              <div className="text-[13px] text-ink-faint">Loading…</div>
            )}
            {projects.kind === "error" && (
              <div className="text-[13px] text-ink-faint">
                {projects.detail}
              </div>
            )}
            {projects.kind === "ok" && projects.data.length === 0 && (
              <div className="rounded-tile border border-border-tile px-3 py-[11px] text-[13px] text-ink-faint">
                No active projects yet.
              </div>
            )}
            {projects.kind === "ok" && projects.data.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {projects.data.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="cursor-pointer rounded-tile border border-border-tile px-3 py-[11px] hover:border-ink"
                  >
                    <div className="truncate text-[13.5px] font-bold text-ink">
                      {p.name}
                    </div>
                    <div className="truncate text-[11.5px] text-ink-faint">
                      {p.description ?? "active"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
