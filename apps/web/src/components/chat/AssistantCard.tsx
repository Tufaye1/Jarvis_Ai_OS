"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  createResearch,
  generateContent,
  isApiError,
  type ContentDraft,
  type ContentKind,
  type ResearchQuery,
  type Source,
} from "@/lib/api";

/** Chars per tick and tick interval — together they give ~200 chars/sec. Fast
 *  enough to not feel slow on a long paragraph, slow enough to read as typing. */
const REVEAL_CHARS_PER_TICK = 4;
const REVEAL_TICK_MS = 20;

/** The four pastel tints, cycled across source chips. */
const TINTS = ["#D8E8F6", "#DCEFD9", "#FBF0C4", "#E9E0F7"];

/** Every action card button. Three shapes, discriminated on `type`:
 *  - `content` routes to `generateContent` (Content Studio volume).
 *  - `research` routes to `createResearch` (Research volume).
 *  - `inert` stays inert with a "Not wired up yet" tooltip.
 */
type Action =
  | { type: "content"; label: string; kind: ContentKind }
  | { type: "research"; label: string }
  | { type: "inert"; label: string };

const ACTIONS: Action[] = [
  { type: "inert", label: "Save to memory" },
  { type: "content", label: "Build the review deck", kind: "deck_outline" },
  { type: "content", label: "Draft the client email", kind: "email" },
  { type: "research", label: "Research this further" },
];

/** Human-readable label for the success pill, per kind. */
const KIND_NOUN: Record<ContentKind, string> = {
  linkedin: "LinkedIn post",
  blog: "Blog post",
  email: "Email draft",
  proposal: "Proposal",
  report: "Report",
  deck_outline: "Deck outline",
  tweet: "Tweet",
};

function errorDetail(error: unknown): string {
  if (isApiError(error)) {
    if (error.isOffline) return "API unreachable";
    if (error.isUnconfigured) return "LLM not configured";
    return error.detail?.trim() || `HTTP ${error.status}`;
  }
  if (error instanceof Error && error.message) return error.message;
  return "unexpected error";
}

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

type ActionResult =
  | { kind: "success"; draft: ContentDraft }
  | { kind: "research-success"; research: ResearchQuery }
  | { kind: "error"; message: string };

export default function AssistantCard({
  content,
  sources,
  animate = false,
  conversationId = null,
  userPrompt = null,
}: {
  content: string;
  sources: Source[] | null;
  /** True only for a reply that just arrived; drives the typewriter reveal.
   *  Old messages from history render fully immediately. */
  animate?: boolean;
  /** Conversation this card belongs to; needed to wire the Content Studio actions. */
  conversationId?: number | null;
  /** The user turn that produced this reply; used as the prompt for generation. */
  userPrompt?: string | null;
}) {
  // Progressive reveal. When animate=false, jump straight to the end.
  const [revealed, setRevealed] = useState(animate ? 0 : content.length);
  const done = revealed >= content.length;
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const wireable =
    typeof conversationId === "number" &&
    typeof userPrompt === "string" &&
    userPrompt.trim().length > 0;

  const runAction = async (kind: ContentKind) => {
    if (pending || !wireable) return;
    setPending(true);
    setResult(null);
    try {
      const draft = await generateContent({
        kind,
        prompt: userPrompt as string,
        source_conversation_id: conversationId as number,
      });
      setResult({ kind: "success", draft });
    } catch (error) {
      setResult({ kind: "error", message: errorDetail(error) });
    } finally {
      setPending(false);
    }
  };

  const runResearch = async () => {
    if (pending || !wireable) return;
    setPending(true);
    setResult(null);
    try {
      const research = await createResearch({
        query: userPrompt as string,
        project_id: null,
      });
      setResult({ kind: "research-success", research });
    } catch (error) {
      setResult({ kind: "error", message: errorDetail(error) });
    } finally {
      setPending(false);
    }
  };

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

          {result?.kind === "success" && (
            <div className="mb-[10px] inline-flex items-center gap-[8px] rounded-nav bg-[#E7F1E5] px-[11px] py-[6px] text-[12px] font-semibold text-ink">
              <span
                aria-hidden
                className="h-[6px] w-[6px] rounded-full bg-[#3F8F45]"
              />
              <span>{KIND_NOUN[result.draft.kind]} created</span>
              <Link
                href="/content"
                className="text-ink-secondary underline underline-offset-2 hover:text-ink"
              >
                → /content/{result.draft.id}
              </Link>
            </div>
          )}

          {result?.kind === "research-success" && (
            <div className="mb-[10px] inline-flex items-center gap-[8px] rounded-nav bg-[#E7F1E5] px-[11px] py-[6px] text-[12px] font-semibold text-ink">
              <span
                aria-hidden
                className="h-[6px] w-[6px] rounded-full bg-[#3F8F45]"
              />
              <span>Research saved</span>
              <Link
                href="/research"
                className="text-ink-secondary underline underline-offset-2 hover:text-ink"
              >
                → /research/{result.research.id}
              </Link>
            </div>
          )}

          {result?.kind === "error" && (
            <div className="mb-[10px] inline-flex items-center gap-[8px] rounded-nav bg-[#FBEDE5] px-[11px] py-[6px] text-[12px] font-semibold text-ink">
              <span
                aria-hidden
                className="h-[6px] w-[6px] rounded-full bg-[#C25A3B]"
              />
              <span>Couldn&rsquo;t generate — {result.message}</span>
            </div>
          )}

          {pending ? (
            <div>
              <span
                aria-live="polite"
                className="inline-flex items-center gap-[8px] rounded-nav border border-border-button bg-muted px-[13px] py-2 text-[12.5px] font-semibold text-ink-secondary"
                style={{ animation: "jvCaret 1400ms ease-in-out infinite" }}
              >
                <span
                  aria-hidden
                  className="h-[6px] w-[6px] rounded-full bg-ink-secondary"
                />
                Generating…
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map((action, i) => {
                const primary = i === 0;
                const cls = primary
                  ? "rounded-nav bg-ink px-[13px] py-2 text-[12.5px] font-semibold text-white"
                  : "rounded-nav border border-border-button px-[13px] py-2 text-[12.5px] font-semibold text-ink hover:border-ink";
                const disabledCls =
                  " disabled:cursor-not-allowed disabled:opacity-60";

                if (action.type === "inert") {
                  return (
                    <button
                      key={action.label}
                      type="button"
                      title="Not wired up yet"
                      className={cls}
                    >
                      {action.label}
                    </button>
                  );
                }

                const disabled = !wireable;
                const onClick =
                  action.type === "research"
                    ? () => void runResearch()
                    : () => void runAction(action.kind);
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={onClick}
                    disabled={disabled}
                    title={
                      disabled
                        ? "Needs a conversation and a preceding message"
                        : undefined
                    }
                    className={cls + disabledCls}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div ref={bottomRef} aria-hidden />
    </article>
  );
}
