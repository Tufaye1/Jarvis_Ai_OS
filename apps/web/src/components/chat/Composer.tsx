"use client";

import { useCallback, useEffect, useRef } from "react";

const MAX_HEIGHT = 148;

export default function Composer({
  value,
  onValueChange,
  onSend,
  sending,
}: {
  value: string;
  onValueChange: (next: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Grow with the content, up to a few lines, then scroll.
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  useEffect(resize, [resize, value]);

  // The first measurement can land before the stylesheet/webfont does, which
  // reads back a bogus scrollHeight. Re-measure once the frame has settled.
  useEffect(() => {
    const frame = requestAnimationFrame(resize);
    document.fonts?.ready.then(resize).catch(() => undefined);
    return () => cancelAnimationFrame(frame);
  }, [resize]);

  useEffect(() => {
    if (!sending) ref.current?.focus();
  }, [sending]);

  const canSend = value.trim().length > 0 && !sending;

  return (
    <div className="flex-none border-t border-border-shell bg-canvas px-6 pt-3 pb-4">
      <div className="mx-auto flex w-full max-w-[820px] items-end gap-[10px] rounded-bar border border-border-card bg-surface py-[7px] pr-2 pl-4 shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={sending}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder="Ask Jervis anything, or type a command"
          aria-label="Message Jervis"
          className="max-h-[148px] min-h-[32px] flex-1 resize-none self-center bg-transparent py-[6px] font-sans text-[14px] leading-[1.45] font-medium text-ink outline-none placeholder:text-ink-faint disabled:text-ink-muted-2"
        />

        <span className="mb-[9px] hidden text-[11px] font-semibold whitespace-nowrap text-ink-eyebrow sm:block">
          {sending
            ? "Sending…"
            : value.trim()
              ? "↵ to send · ⇧↵ newline"
              : "⇧↵ for a newline"}
        </span>

        <button
          type="button"
          onClick={() => canSend && onSend()}
          disabled={!canSend}
          aria-label="Send message"
          className={`mb-[3px] flex h-8 w-8 flex-none items-center justify-center rounded-full text-[14px] text-white ${
            canSend ? "bg-ink" : "cursor-default bg-dot-idle"
          }`}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
