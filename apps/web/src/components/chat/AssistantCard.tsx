"use client";

import { useEffect, useRef, useState } from "react";

import type { Source } from "@/lib/api";

/** Chars per tick and tick interval — together they give ~200 chars/sec. Fast
 *  enough to not feel slow on a long paragraph, slow enough to read as typing. */
const REVEAL_CHARS_PER_TICK = 4;
const REVEAL_TICK_MS = 20;

/** The four pastel tints, cycled across source chips. */
const TINTS = ["#D8E8F6", "#DCEFD9", "#FBF0C4", "#E9E0F7"];

/** Buttons the design calls for. No endpoint backs them yet, so they do nothing. */
const ACTIONS = [
  "Save to memory",
  "Build the review deck",
  "Draft the client email",
  "Research this further",
];

const EYEBROW =
  "text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow mb-[9px]";

function sourceLabel(source: Source): string {
  if (source.title) return source.title;
  if (source.vault_path) {
    const leaf = source.vault_path.split("/").pop() ?? source.vault_path;
    return leaf.replace(/\.mdx?$/i, "");
  }
  return `Note ${source.note_id}`;
}

/**
 * Minimal inline formatting for the answer body: **bold** and `code`.
 * Deliberately not a markdown engine — no dependency, no dangerouslySetInnerHTML.
 */
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={key}
          className="rounded-[5px] bg-muted px-[5px] py-[1px] font-mono text-[13px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export function JarvisMark() {
  return (
    <span className="flex h-5 w-5 flex-none items-center justify-center rounded-[7px] bg-ink">
      <span className="h-[7px] w-[7px] rounded-full bg-accent" />
    </span>
  );
}

export default function AssistantCard({
  content,
  sources,
  animate = false,
}: {
  content: string;
  sources: Source[] | null;
  /** True only for a reply that just arrived; drives the typewriter reveal.
   *  Old messages from history render fully immediately. */
  animate?: boolean;
}) {
  // Progressive reveal. When animate=false, jump straight to the end.
  const [revealed, setRevealed] = useState(animate ? 0 : content.length);
  const done = revealed >= content.length;
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => {
      setRevealed((r) => Math.min(r + REVEAL_CHARS_PER_TICK, content.length));
      // scrollIntoView walks up to the nearest scrollable ancestor, so this
      // keeps the reply pinned to the bottom of the chat scroll region as it
      // grows — no prop-drilling of a scroll ref needed.
      bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    }, REVEAL_TICK_MS);
    return () => window.clearInterval(timer);
  }, [content.length, done]);

  const shownContent = done ? content : content.slice(0, revealed);
  const paragraphs = shownContent
    .split(/\n{2,}/)
    .filter((p) => p.trim().length > 0);
  const shown = paragraphs.length > 0 ? paragraphs : [shownContent];
  const hasSources = !!sources && sources.length > 0;

  return (
    <article className="rounded-card border border-border-card bg-surface px-6 py-[22px]">
      <header className="mb-3 flex items-center gap-[9px]">
        <JarvisMark />
        <span className="text-[12px] font-bold tracking-[0.2px] text-ink">
          Jervis
        </span>
      </header>

      <div className="text-[15px] leading-[1.62] text-ink-body [text-wrap:pretty]">
        {shown.map((paragraph, i) => {
          const isLast = i === shown.length - 1;
          // While animating, skip inline **bold**/`code` parsing so it doesn't
          // flash between broken and parsed states at each character. Parse the
          // final content once the reveal completes.
          const body = done
            ? renderInline(paragraph.replace(/\n/g, " "), `p${i}`)
            : paragraph.replace(/\n/g, " ");
          return (
            <p key={i} className={i > 0 ? "mt-3" : undefined}>
              {body}
              {!done && isLast && (
                <span
                  aria-hidden
                  className="ml-[2px] inline-block h-[1em] w-[6px] translate-y-[2px] rounded-[1px] bg-ink align-baseline"
                  style={{ animation: "jvCaret 900ms steps(1, end) infinite" }}
                />
              )}
            </p>
          );
        })}
      </div>

      {done && hasSources && (
        <section className="mt-5 border-t border-divider pt-4">
          <div className={EYEBROW}>SOURCES</div>
          <div className="flex flex-wrap gap-[7px]">
            {sources.map((source, i) => (
              <span
                key={`${source.note_id}-${i}`}
                title={source.vault_path ?? undefined}
                className="flex items-center gap-[7px] rounded-nav bg-muted px-[10px] py-[6px] text-[12px] font-semibold text-ink hover:bg-hover"
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
        </section>
      )}

      {done && (
        <section className="mt-[18px] border-t border-divider pt-4">
          <div className={EYEBROW}>ACTIONS</div>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.map((label, i) => (
              <button
                key={label}
                type="button"
                title="Not wired up yet"
                className={
                  i === 0
                    ? "rounded-nav bg-ink px-[13px] py-2 text-[12.5px] font-semibold text-white"
                    : "rounded-nav border border-border-button px-[13px] py-2 text-[12.5px] font-semibold text-ink hover:border-ink"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      <div ref={bottomRef} aria-hidden />
    </article>
  );
}
