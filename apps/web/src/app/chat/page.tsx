"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createConversation,
  deleteConversation,
  isApiError,
  listConversations,
  listMessages,
  sendMessage,
  type Conversation,
  type Message,
} from "@/lib/api";
import Composer from "@/components/chat/Composer";
import ConversationList from "@/components/chat/ConversationList";
import MessageThread, { type ChatNotice } from "@/components/chat/MessageThread";

function toNotice(error: unknown): ChatNotice {
  if (isApiError(error)) {
    if (error.isUnconfigured) return { kind: "unconfigured" };
    if (error.isOffline) return { kind: "offline", detail: error.detail };
    return { kind: "error", detail: `${error.status} — ${error.detail ?? ""}` };
  }
  return { kind: "error", detail: null };
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [booting, setBooting] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<ChatNotice | null>(null);
  const [draft, setDraft] = useState("");
  const [lastAttempt, setLastAttempt] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);

  /* On mount: list conversations, open the most recent one. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listConversations();
        if (cancelled) return;
        setConversations(list);
        const newest = list[0];
        if (newest) {
          setActiveId(newest.id);
          const thread = await listMessages(newest.id);
          if (!cancelled) setMessages(thread);
        }
      } catch (error) {
        if (!cancelled) setNotice(toNotice(error));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Keep the newest turn in view. */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, notice]);

  const openConversation = useCallback(async (id: number) => {
    setActiveId(id);
    setNotice(null);
    setLoadingThread(true);
    try {
      setMessages(await listMessages(id));
    } catch (error) {
      setMessages([]);
      setNotice(toNotice(error));
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const startNewConversation = useCallback(async () => {
    setNotice(null);
    try {
      const conversation = await createConversation();
      setConversations((prev) => [conversation, ...prev]);
      setActiveId(conversation.id);
      setMessages([]);
    } catch (error) {
      setNotice(toNotice(error));
    }
  }, []);

  const removeConversation = useCallback(
    async (id: number) => {
      if (!window.confirm("Delete this conversation? This can't be undone.")) {
        return;
      }
      try {
        await deleteConversation(id);
      } catch (error) {
        setNotice(toNotice(error));
        return;
      }
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeId === id) {
        setMessages([]);
        const next = remaining[0];
        if (next) {
          await openConversation(next.id);
        } else {
          setActiveId(null);
        }
      }
    },
    [activeId, conversations, openConversation],
  );

  const submit = useCallback(
    async (content: string) => {
      const text = content.trim();
      if (!text || sending) return;

      setSending(true);
      setNotice(null);
      setLastAttempt(text);
      setDraft("");

      // Optimistic user turn; negative id can never collide with a real one.
      const optimisticId = -Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: optimisticId,
          role: "user",
          content: text,
          sources: null,
          created_at: new Date().toISOString(),
        },
      ]);

      let cid = activeId;
      try {
        if (cid === null) {
          const conversation = await createConversation();
          cid = conversation.id;
          setConversations((prev) => [conversation, ...prev]);
          setActiveId(conversation.id);
        }

        const turn = await sendMessage(cid, text);
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== optimisticId),
          turn.user_message,
          turn.assistant_message,
        ]);
        // The first message derives the conversation title server-side.
        listConversations()
          .then(setConversations)
          .catch(() => undefined);
      } catch (error) {
        setNotice(toNotice(error));
        // The API commits the user turn before calling the model, so on a 503
        // the message really is saved — re-read the thread instead of guessing.
        if (cid !== null) {
          try {
            setMessages(await listMessages(cid));
          } catch {
            /* keep the optimistic turn */
          }
        }
      } finally {
        setSending(false);
      }
    },
    [activeId, sending],
  );

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-[1180px] gap-6 px-[44px] pt-8 pb-7">
          <aside className="hidden w-[236px] flex-none xl:block">
            <div className="sticky top-0">
              <ConversationList
                conversations={conversations}
                activeId={activeId}
                onSelect={openConversation}
                onNew={startNewConversation}
                onDelete={removeConversation}
                busy={sending}
              />
            </div>
          </aside>

          {/* Not a <main>: the root layout already renders one around children. */}
          <section className="min-w-0 flex-1 xl:max-w-[900px]">
            <header className="mb-[22px] flex items-center gap-[10px]">
              <h1 className="text-[22px] leading-none font-bold tracking-[-0.6px] text-ink">
                Chat
              </h1>
              <span className="max-w-[320px] truncate rounded-[7px] bg-muted-2 px-2 py-1 text-[11.5px] font-semibold text-ink-muted">
                {activeConversation?.title?.trim() || "New conversation"}
              </span>
              <button
                type="button"
                onClick={startNewConversation}
                disabled={sending}
                className="ml-auto rounded-nav border border-border-button bg-surface px-[13px] py-2 text-[12.5px] font-semibold text-ink hover:border-ink disabled:opacity-50 xl:hidden"
              >
                New chat
              </button>
            </header>

            <MessageThread
              messages={messages}
              isSending={sending}
              notice={notice}
              loading={booting || loadingThread}
              onRetry={
                notice?.kind === "offline" && lastAttempt
                  ? () => void submit(lastAttempt)
                  : undefined
              }
            />
          </section>
        </div>
      </div>

      <Composer
        value={draft}
        onValueChange={setDraft}
        onSend={() => void submit(draft)}
        sending={sending}
      />
    </div>
  );
}
