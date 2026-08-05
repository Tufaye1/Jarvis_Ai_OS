"use client";

import type { Conversation } from "@/lib/api";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  busy,
}: {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  busy: boolean;
}) {
  return (
    <div className="rounded-card border border-border-card bg-surface p-[10px]">
      <div className="flex items-center justify-between px-[10px] pt-1 pb-2">
        <span className="text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow">
          CONVERSATIONS
        </span>
        <button
          type="button"
          onClick={onNew}
          disabled={busy}
          className="rounded-chip border border-border-button px-[8px] py-[3px] text-[11px] font-semibold text-ink hover:border-ink disabled:opacity-50"
        >
          New
        </button>
      </div>

      {conversations.length === 0 ? (
        <p className="px-[10px] pt-1 pb-2 text-[12.5px] leading-[1.5] text-ink-faint">
          No conversations yet. Your first message starts one.
        </p>
      ) : (
        <ul className="flex flex-col gap-[2px]">
          {conversations.map((conversation) => {
            const active = conversation.id === activeId;
            return (
              <li key={conversation.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={`flex w-full flex-col items-start gap-[2px] rounded-field px-[10px] py-[8px] pr-7 text-left ${
                    active ? "bg-muted" : "hover:bg-muted"
                  }`}
                >
                  <span
                    className={`line-clamp-2 text-[13px] leading-[1.35] ${
                      active
                        ? "font-bold text-ink"
                        : "font-semibold text-ink"
                    }`}
                  >
                    {conversation.title?.trim() || "New conversation"}
                  </span>
                  <span className="text-[11.5px] font-normal text-ink-faint">
                    {formatDate(conversation.updated_at)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(conversation.id)}
                  aria-label="Delete conversation"
                  title="Delete conversation"
                  className="absolute top-[8px] right-[6px] hidden h-5 w-5 items-center justify-center rounded-[6px] text-[13px] leading-none text-ink-faint group-hover:flex hover:bg-hover hover:text-ink"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
