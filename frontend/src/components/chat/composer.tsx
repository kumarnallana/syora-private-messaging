"use client";
import { AttachmentContent, FilePicker } from "@/components/media/attachment";
import { IconButton, Modal, pickAttachment } from "@/components/shared/ui";
import { useApp } from "@/stores/use-app";
import type { Attachment, Message } from "@/types";
import {
  ArrowRight,
  Reply,
  RotateCcw,
  Send,
  Smile,
  Sparkles,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const emojis = [
  "😊",
  "❤️",
  "😂",
  "✨",
  "🙌",
  "👍",
  "☕",
  "🎉",
  "🌿",
  "👋",
  "🔥",
  "💜",
  "🥰",
  "🤔",
  "😎",
  "🌅",
  "🙏",
  "💯",
  "🎧",
  "🌻",
  "🤍",
  "👀",
  "🚀",
  "☀️",
];

const fastStarters = [
  {
    label: "⚡ Running 10m Late",
    text: "Hi! Running about 10 minutes behind schedule. Apologies for the brief delay—will be with you shortly!",
  },
  {
    label: "💼 Status Update",
    text: "Hi! Quick update: deliverables are on track with key milestones progressing smoothly. No current blockers.",
  },
  {
    label: "📅 Reschedule Meeting",
    text: "Hi! Due to an unexpected conflict, could we please reschedule our meeting? Let me know what alternative time suits you best.",
  },
  {
    label: "🤝 Gentle Follow-Up",
    text: "Hi! Just following up on our previous note when you have a moment. Looking forward to your thoughts!",
  },
];

export function Composer({
  conversationId,
  blocked,
  reply,
  clearReply,
}: {
  conversationId: string;
  blocked: boolean;
  reply?: Message;
  clearReply: () => void;
}) {
  const { services, users } = useApp();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAction, setAiAction] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [undoText, setUndoText] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment>();
  const pending = useRef<Attachment | undefined>(undefined);
  const input = useRef<HTMLTextAreaElement>(null);
  const submitting = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(
    () => () => {
      if (pending.current) URL.revokeObjectURL(pending.current.url);
    },
    [],
  );
  useEffect(
    () => () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      services.typing(conversationId, false);
    },
    [conversationId, services],
  );
  useEffect(() => {
    if (reply && !blocked) input.current?.focus();
  }, [reply, blocked]);

  function choose(file?: Attachment) {
    if (pending.current) URL.revokeObjectURL(pending.current.url);
    pending.current = file;
    setAttachment(file);
  }

  async function send() {
    if ((!text.trim() && !attachment) || blocked || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    const outgoingText = text;
    const outgoingAttachment = attachment;
    const outgoingReply = reply?.id;
    services.typing(conversationId, false);
    setAttachment(undefined);
    setText("");
    clearReply();
    setEmoji(false);
    setAiOpen(false);
    setCustomMode(false);
    setUndoText(null);
    const request = services.send(
      conversationId,
      outgoingText,
      outgoingAttachment,
      outgoingReply,
    );
    if (!outgoingAttachment) {
      submitting.current = false;
      setBusy(false);
      input.current?.focus();
    }
    try {
      await request;
      if (pending.current?.url.startsWith("blob:"))
        URL.revokeObjectURL(pending.current.url);
      pending.current = undefined;
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Message could not be sent. Please try again.",
      );
    } finally {
      if (outgoingAttachment) {
        submitting.current = false;
        setBusy(false);
        input.current?.focus();
      }
    }
  }

  async function handleAITransform(
    tone:
      | "polish"
      | "professional"
      | "concise"
      | "friendly"
      | "action"
      | "custom",
    customQuery?: string,
  ) {
    if (aiBusy) return;
    setAiBusy(true);
    setAiAction(tone);
    const original = text;
    setUndoText(original);

    try {
      const { callGeminiAPI } = await import("@/services/ai-engine");
      let prompt = "";
      if (tone === "custom" && customQuery?.trim()) {
        prompt = original.trim()
          ? `Transform the following message according to this instruction: "${customQuery.trim()}". Original message: "${original.trim()}". Return ONLY the converted message.`
          : `Draft a ready-to-send message based on this prompt: "${customQuery.trim()}". Return ONLY the message text.`;
      } else {
        const promptMap: Record<string, string> = {
          polish: `Polish this draft for maximum clarity, natural flow, perfect grammar, and elegant phrasing: "${original}"`,
          professional: `Rewrite this message in an articulate, highly professional, respectful executive workplace tone: "${original}"`,
          concise: `Make this message ultra-concise, crisp, and direct with zero filler words so it can be read in seconds: "${original}"`,
          friendly: `Rewrite this message in a warm, friendly, collaborative, polite tone: "${original}"`,
          action: `Refine this message to have a clear, direct call-to-action with explicit next steps: "${original}"`,
        };
        prompt = promptMap[tone] || `Polish this draft: "${original}"`;
      }

      const system =
        "You are the Syora Confidential AI fast writing copilot. Return ONLY the rewritten message text. Do NOT include conversational preamble, explanations, quotation marks, or markdown wrappers.";
      const refined = await callGeminiAPI(system, prompt);
      if (refined && refined.trim()) {
        setText(refined.trim());
        setCustomMode(false);
        setCustomInstruction("");
      } else {
        // High quality deterministic instant local fallback
        let localRefined = original.trim();
        if (tone === "concise") {
          localRefined = localRefined.replace(
            /^(I was just wondering if maybe|Could you possibly please|Just wanted to reach out and say|Hope you are doing well\.?)\s+/i,
            "",
          );
          if (localRefined.length > 120 && localRefined.includes(".")) {
            localRefined = localRefined.split(".")[0] + ".";
          }
        } else if (tone === "professional") {
          localRefined = localRefined[0].toUpperCase() + localRefined.slice(1);
          if (!/[.!?]$/.test(localRefined)) localRefined += ".";
        } else if (tone === "friendly") {
          if (!/^hi\b|^hello\b|^hey\b/i.test(localRefined)) {
            localRefined = `Hi! ${localRefined}`;
          }
        } else if (tone === "action") {
          if (
            !/please\s+let\s+me\s+know|looking\s+forward/i.test(localRefined)
          ) {
            localRefined = `${localRefined} Please let me know your thoughts when convenient.`;
          }
        } else if (tone === "custom" && customQuery) {
          localRefined = `${customQuery}: ${localRefined}`;
        }
        setText(localRefined);
        setCustomMode(false);
        setCustomInstruction("");
      }
    } catch {
      // Keep original on error
    } finally {
      setAiBusy(false);
      setAiAction("");
      input.current?.focus();
    }
  }

  function handleUndo() {
    if (undoText !== null) {
      setText(undoText);
      setUndoText(null);
      input.current?.focus();
    }
  }

  return (
    <div
      className="composer-wrap"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (blocked || busy) return;
        try {
          const file = e.dataTransfer.files[0];
          if (file) choose(pickAttachment(file));
        } catch (error) {
          setError((error as Error).message);
        }
      }}
    >
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {reply && (
        <div className="composer-reply" role="status" aria-live="polite">
          <Reply size={18} />
          <span>
            <strong>
              Replying to {users.find((u) => u.id === reply.senderId)?.name}
            </strong>
            <small>
              {reply.deleted
                ? "Message deleted"
                : reply.text || reply.attachment?.name}
            </small>
          </span>
          <IconButton label="Cancel reply" onClick={clearReply}>
            <X size={18} />
          </IconButton>
        </div>
      )}
      {emoji && (
        <div className="emoji-picker" role="group" aria-label="Emoji picker">
          <header>
            Choose an emoji
            <IconButton
              label="Close emoji picker"
              onClick={() => setEmoji(false)}
            >
              <X size={17} />
            </IconButton>
          </header>
          <div>
            {emojis.map((e) => (
              <button
                type="button"
                key={e}
                aria-label={`Insert ${e}`}
                onClick={() => {
                  setText((t) => (t + e).slice(0, 10000));
                  input.current?.focus();
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {aiOpen && (
        <div
          className="composer-ai-tray"
          role="group"
          aria-label="Syora Fast AI Assistant"
        >
          <div className="composer-ai-tray__header">
            <div className="composer-ai-tray__badge">
              <Sparkles size={14} className="text-accent" />
              <span>Syora Fast AI</span>
              {aiBusy && (
                <span className="composer-ai-status">Converting…</span>
              )}
            </div>
            <div className="composer-ai-tray__actions">
              {undoText !== null && (
                <button
                  type="button"
                  className="composer-ai-undo-btn"
                  title="Undo AI transformation"
                  onClick={handleUndo}
                >
                  <RotateCcw size={12} />
                  <span>Undo</span>
                </button>
              )}
              <IconButton
                label="Close AI tools"
                onClick={() => {
                  setAiOpen(false);
                  setCustomMode(false);
                }}
              >
                <X size={15} />
              </IconButton>
            </div>
          </div>

          {customMode ? (
            <form
              className="composer-ai-custom-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (customInstruction.trim()) {
                  void handleAITransform("custom", customInstruction.trim());
                }
              }}
            >
              <input
                autoFocus
                className="composer-ai-custom-input"
                placeholder={
                  text.trim()
                    ? "Convert this message… (e.g. into 3 bullet points, translate, urgent)"
                    : "What message should I draft? (e.g. tell boss I finished report)..."
                }
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                disabled={aiBusy}
              />
              <button
                type="submit"
                className="button primary small"
                disabled={aiBusy || !customInstruction.trim()}
              >
                {aiBusy ? "Converting…" : "Apply"}
              </button>
              <button
                type="button"
                className="button secondary small"
                disabled={aiBusy}
                onClick={() => setCustomMode(false)}
              >
                Cancel
              </button>
            </form>
          ) : text.trim() ? (
            <div className="composer-ai-chips">
              <button
                type="button"
                className={`composer-ai-chip ${aiAction === "polish" ? "is-loading" : ""}`}
                disabled={aiBusy}
                onClick={() => void handleAITransform("polish")}
              >
                <Sparkles size={13} />
                <span>Auto-Polish</span>
              </button>
              <button
                type="button"
                className={`composer-ai-chip ${aiAction === "professional" ? "is-loading" : ""}`}
                disabled={aiBusy}
                onClick={() => void handleAITransform("professional")}
              >
                <Wand2 size={13} />
                <span>Professional</span>
              </button>
              <button
                type="button"
                className={`composer-ai-chip ${aiAction === "concise" ? "is-loading" : ""}`}
                disabled={aiBusy}
                onClick={() => void handleAITransform("concise")}
              >
                <Zap size={13} />
                <span>Make Concise</span>
              </button>
              <button
                type="button"
                className={`composer-ai-chip ${aiAction === "friendly" ? "is-loading" : ""}`}
                disabled={aiBusy}
                onClick={() => void handleAITransform("friendly")}
              >
                <Smile size={13} />
                <span>Friendly</span>
              </button>
              <button
                type="button"
                className={`composer-ai-chip ${aiAction === "action" ? "is-loading" : ""}`}
                disabled={aiBusy}
                onClick={() => void handleAITransform("action")}
              >
                <ArrowRight size={13} />
                <span>Action / CTA</span>
              </button>
              <button
                type="button"
                className="composer-ai-chip composer-ai-chip--custom"
                disabled={aiBusy}
                onClick={() => setCustomMode(true)}
              >
                <span>🪄 Custom Convert…</span>
              </button>
            </div>
          ) : (
            <div className="composer-ai-chips">
              {fastStarters.map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  className="composer-ai-chip"
                  onClick={() => {
                    setText(starter.text);
                    setUndoText(null);
                    setAiOpen(false);
                    input.current?.focus();
                  }}
                >
                  <span>{starter.label}</span>
                </button>
              ))}
              <button
                type="button"
                className="composer-ai-chip composer-ai-chip--custom"
                onClick={() => setCustomMode(true)}
              >
                <span>🪄 Custom Prompt…</span>
              </button>
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="composer">
          <FilePicker
            onSelect={choose}
            onError={setError}
            disabled={blocked || busy}
          />
          <textarea
            ref={input}
            rows={1}
            aria-label="Message"
            placeholder={
              blocked ? "This contact is blocked" : "Write a message…"
            }
            value={text}
            readOnly={busy}
            disabled={blocked}
            maxLength={10000}
            onChange={(e) => {
              setText(e.target.value);
              services.typing(conversationId, true);
              if (typingTimer.current) clearTimeout(typingTimer.current);
              typingTimer.current = setTimeout(
                () => services.typing(conversationId, false),
                1200,
              );
            }}
            onBlur={() => services.typing(conversationId, false)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
              if (e.key === "Escape") {
                setEmoji(false);
                setAiOpen(false);
                setCustomMode(false);
              }
            }}
          />
          <IconButton
            label="Syora Fast AI"
            disabled={blocked || busy}
            onClick={() => {
              setAiOpen(!aiOpen);
              setEmoji(false);
            }}
          >
            <Sparkles size={20} className={text.trim() ? "text-accent" : ""} />
          </IconButton>
          <IconButton
            label="Choose emoji"
            disabled={blocked || busy}
            onClick={() => {
              setEmoji(!emoji);
              setAiOpen(false);
            }}
          >
            <Smile size={21} />
          </IconButton>
          <button
            type="submit"
            className="icon-button send-button"
            aria-label="Send message"
            disabled={blocked || busy || (!text.trim() && !attachment)}
          >
            <Send size={20} />
          </button>
        </div>
      </form>
      {attachment && (
        <Modal
          title="Ready to share?"
          className="mobile-sheet"
          onClose={() => {
            if (!busy) choose(undefined);
          }}
        >
          <AttachmentContent attachment={attachment} preview />
          <label className="field">
            Caption
            <textarea
              aria-label="Attachment caption"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={10000}
              readOnly={busy}
            />
          </label>
          <p className="demo-disclosure">
            The file will be shared privately in this conversation.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => choose(undefined)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={busy || blocked}
              onClick={() => void send()}
            >
              {busy ? "Sending…" : "Send attachment"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
