"use client";

import Link from "next/link";
import { useState } from "react";

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
    href: undefined,
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
    href: undefined,
    icon: (
      <>
        <rect x="2.6" y="3.6" width="10.8" height="9.8" rx="1.6" />
        <path d="M2.6 6.6h10.8" />
      </>
    ),
  },
] as const;

const ACTIVITY = [
  { kind: "PDF", title: "NetBet July DSP report added", when: "8m" },
  { kind: "REC", title: "Aurora Media call transcribed — 42 min", when: "1h" },
  { kind: "IMG", title: "3 screenshots captured from TikTok Ads", when: "Yesterday" },
  { kind: "WEB", title: "7 pages read for display benchmarks", when: "Yesterday" },
];

const SUGGESTIONS = [
  "Finish the TikTok report",
  "Research competitor CPA",
  "Draft the July LinkedIn post",
  "Follow up with Aurora Media",
];

const PROJECTS = [
  { name: "NetBet", meta: "4 open · active" },
  { name: "DSP", meta: "2 open" },
  { name: "Agency", meta: "6 open" },
  { name: "AI OS", meta: "1 open" },
];

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

export default function HomePage() {
  const [done, setDone] = useState<boolean[]>(SUGGESTIONS.map(() => false));

  const toggle = (i: number) =>
    setDone((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

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
        {/* Left column */}
        <div className="flex flex-col gap-3">
          {/* Today */}
          <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <div className="mb-3 flex items-baseline gap-[10px]">
              <h2 className="text-[15px] font-bold tracking-[-0.2px] text-ink">
                Today
              </h2>
              <span className="text-[12px] text-ink-faint">
                Thursday, 30 July
              </span>
            </div>

            <div className="flex gap-3 border-t border-divider py-[10px]">
              <span className="w-[46px] flex-none text-[12px] font-bold text-ink-muted">
                10:30
              </span>
              <span className="text-[13.5px] font-semibold text-ink">
                NetBet campaign review
              </span>
              <span className="ml-auto flex-none rounded-[6px] bg-muted-2 px-[7px] py-[3px] text-[11px] font-semibold text-ink-muted">
                Jervis has a brief ready
              </span>
            </div>

            <div className="flex gap-3 border-t border-divider py-[10px]">
              <span className="w-[46px] flex-none text-[12px] font-bold text-ink-muted">
                14:00
              </span>
              <span className="text-[13.5px] font-semibold text-ink">
                DSP onboarding call — Aurora Media
              </span>
              <span className="ml-auto flex-none rounded-[6px] bg-muted-2 px-[7px] py-[3px] text-[11px] font-semibold text-ink-muted">
                2 open questions
              </span>
            </div>

            <div className="flex gap-3 border-t border-divider py-[10px]">
              <span className="w-[46px] flex-none text-[12px] font-bold text-ink-muted">
                —
              </span>
              <span className="text-[13.5px] font-semibold text-ink">
                5 tasks due · 3 documents added yesterday
              </span>
              <span className="ml-auto flex-none cursor-pointer text-[11.5px] font-bold text-accent">
                Open planner
              </span>
            </div>
          </section>

          {/* Recent activity */}
          <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <h2 className="mb-1 text-[15px] font-bold tracking-[-0.2px] text-ink">
              Recent activity
            </h2>
            {ACTIVITY.map((a) => (
              <div
                key={a.title}
                className="flex items-center gap-3 border-t border-divider py-[10px]"
              >
                <span className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-chip bg-muted-2 text-[10.5px] font-bold text-ink-muted">
                  {a.kind}
                </span>
                <span className="text-[13px] font-semibold text-ink">
                  {a.title}
                </span>
                <span className="ml-auto flex-none text-[11.5px] text-ink-faint">
                  {a.when}
                </span>
              </div>
            ))}
          </section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3">
          {/* Suggestions */}
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
                onClick={() => toggle(i)}
                className="flex w-full cursor-pointer items-center gap-[10px] border-t border-divider py-[9px] text-left"
              >
                <span
                  className="flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] border-[1.5px] border-checkbox"
                  style={{ background: done[i] ? "#101010" : "transparent" }}
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    style={{ opacity: done[i] ? 1 : 0 }}
                    aria-hidden="true"
                  >
                    <path d="m3.4 8.4 3 3 6.2-6.6" />
                  </svg>
                </span>
                <span
                  className="text-[13px] font-semibold"
                  style={{
                    color: done[i] ? "#A8A8A3" : "#101010",
                    textDecoration: done[i] ? "line-through" : "none",
                  }}
                >
                  {label}
                </span>
              </button>
            ))}
          </section>

          {/* Projects */}
          <section className="rounded-card border border-border-card bg-surface px-5 py-[18px]">
            <h2 className="mb-3 text-[15px] font-bold text-ink">Projects</h2>
            <div className="grid grid-cols-2 gap-2">
              {PROJECTS.map((p) => (
                <div
                  key={p.name}
                  className="cursor-pointer rounded-tile border border-border-tile px-3 py-[11px] hover:border-ink"
                >
                  <div className="text-[13.5px] font-bold text-ink">
                    {p.name}
                  </div>
                  <div className="text-[11.5px] text-ink-faint">{p.meta}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
