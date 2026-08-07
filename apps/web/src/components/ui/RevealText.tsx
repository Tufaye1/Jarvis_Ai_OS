"use client";

/**
 * Typewriter reveal for freshly-generated text.
 *
 * Two callsites so far — chat's AssistantCard, content studio's preview —
 * so the reveal + caret + tick cadence live here in one place. Keep the
 * cadence identical to AssistantCard so the two screens feel like one app.
 */

import { useEffect, useState } from "react";

/** Together: ~200 chars/sec. Fast enough on a long paragraph, slow enough to read as typing. */
const REVEAL_CHARS_PER_TICK = 4;
const REVEAL_TICK_MS = 20;

export default function RevealText({
  text,
  animate,
  className,
  onTick,
}: {
  text: string;
  /** True only for freshly-generated content. Old content shows immediately. */
  animate: boolean;
  className?: string;
  /** Called on every tick while animating — hook for scroll-follow etc. */
  onTick?: () => void;
}) {
  const [revealed, setRevealed] = useState(animate ? 0 : text.length);
  const done = revealed >= text.length;

  useEffect(() => {
    if (done) return;
    const timer = window.setInterval(() => {
      setRevealed((r) => Math.min(r + REVEAL_CHARS_PER_TICK, text.length));
      onTick?.();
    }, REVEAL_TICK_MS);
    return () => window.clearInterval(timer);
  }, [text.length, done, onTick]);

  return (
    <div className={className}>
      {done ? text : text.slice(0, revealed)}
      {!done && (
        <span
          aria-hidden
          className="ml-[2px] inline-block h-[1em] w-[6px] translate-y-[2px] rounded-[1px] bg-ink align-baseline"
          style={{ animation: "jvCaret 900ms steps(1, end) infinite" }}
        />
      )}
    </div>
  );
}
