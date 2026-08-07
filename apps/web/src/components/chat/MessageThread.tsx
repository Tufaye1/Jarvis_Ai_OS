"use client";

import type { Message } from "@/lib/api";
import AssistantCard, { JarvisMark } from "./AssistantCard";

export type NoticeKind = "unconfigured" | "offline" | "error";

export interface ChatNotice {
  kind: NoticeKind;
  detail?: string | null;
}

const NOTICE_COPY: Record<
  NoticeKind,
  { eyebrow: string; title: string; body: string }
> = {
  unconfigured: {
    eyebrow: "CHAT NOT CONFIGURED",
    title: "Chat needs an LLM_API_KEY in .env to answer",
    body: "Your message was saved to the conversation. Add LLM_API_KEY (and optionally LLM_FALLBACKS for automatic multi-provider failover) to the API's .env file and restart it — the rest of Jarvis (knowledge, search, memory) works without it.",
  },
  offline: {
    eyebrow: "API UNREACHABLE",
    title: "Can't reach the Jarvis API",
    body: "Nothing answered at the API URL. Start the backend (uvicorn on port 8000) and try again.",
  },
  error: {
    eyebrow: "SOMETHING WENT WRONG",
    title: "That message didn't go through",
    body: "The API returned an error. Try sending it again.",
  },
};

function Notice({
  notice,
  onRetry,
}: {
  notice: ChatNotice;
  onRetry?: () => void;
}) {
  const copy = NOTICE_COPY[notice.kind];
  return (
    <div className="rounded-card border border-[#F5E0C7] bg-[#FFF6EC] px-5 py-[18px]">
      <div className="mb-[9px] text-[10.5px] font-bold tracking-[0.7px] text-ink-eyebrow">
        {copy.eyebrow}
      </div>
      <div className="text-[13.5px] font-bold text-ink">{copy.title}</div>
      <p className="mt-[6px] text-[13px] leading-[1.55] text-ink-secondary">
        {copy.body}
      </p>
      {notice.detail && (
        <p className="mt-2 font-mono text-[11.5px] text-ink-muted-2">
          {notice.detail}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-nav border border-border-button bg-surface px-[13px] py-2 text-[12.5px] font-semibold text-ink hover:border-ink"
        >
          Try again
        </button>
      )}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="mb-5 flex justify-end">
      <div className="max-w-[70%] rounded-[16px_16px_4px_16px] bg-ink px-4 py-3 text-[14px] font-medium whitespace-pre-wrap text-white">
        {content}
      </div>
    </div>
  );
}

function ThinkingCard() {
  return (
    <div className="flex items-center gap-[9px] rounded-card border border-border-card bg-surface px-6 py-[18px]">
      <JarvisMark />
      <span className="text-[12px] font-bold tracking-[0.2px] text-ink">
        Jervis
      </span>
      <span className="ml-1 flex items-center gap-[5px]" aria-label="Thinking">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-[5px] w-[5px] animate-pulse rounded-full bg-dot-idle"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-card border border-border-card bg-surface px-6 py-[22px]">
      <div className="mb-3 flex items-center gap-[9px]">
        <JarvisMark />
        <span className="text-[12px] font-bold tracking-[0.2px] text-ink">
          Jervis
        </span>
      </div>
      <p className="text-[15px] leading-[1.62] text-ink-body [text-wrap:pretty]">
        Ask anything. Answers are grounded in your own notes, and the notes used
        are listed under every reply.
      </p>
    </div>
  );
}

export default function MessageThread({
  messages,
  isSending,
  notice,
  onRetry,
  loading,
  animateId,
  conversationId = null,
}: {
  messages: Message[];
  isSending: boolean;
  notice: ChatNotice | null;
  onRetry?: () => void;
  loading: boolean;
  /** Id of the assistant message that just arrived this session — animates once. */
  animateId?: number | null;
  /** Conversation these messages belong to — threaded to AssistantCard actions. */
  conversationId?: number | null;
}) {
  if (loading) {
    return (
      <div className="text-[13px] font-semibold text-ink-faint">
        Loading conversation…
      </div>
    );
  }

  const isEmpty = messages.length === 0 && !isSending && !notice;

  return (
    <div>
      {isEmpty && <EmptyState />}

      {messages.map((message, i) => {
        if (message.role === "user") {
          return <UserBubble key={message.id} content={message.content} />;
        }
        // Actions need the user turn that produced this reply as their prompt.
        // Look at the immediately-preceding message and use it only if it's a
        // user turn — an assistant-first orphan (rare, but possible) stays inert.
        const prev = i > 0 ? messages[i - 1] : null;
        const userPrompt =
          prev && prev.role === "user" ? prev.content : null;
        return (
          <div key={message.id} className="mb-5">
            <AssistantCard
              content={message.content}
              sources={message.sources}
              animate={message.id === animateId}
              conversationId={conversationId}
              userPrompt={userPrompt}
            />
          </div>
        );
      })}

      {isSending && <ThinkingCard />}

      {notice && !isSending && <Notice notice={notice} onRetry={onRetry} />}
    </div>
  );
}
