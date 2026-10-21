"use client";

import { useApp } from "@/stores/use-app";
import type { AIConversationSummary, AIMessage, AISendResult, AITemplate, User } from "@/types";
import { cn } from "@/utils/cn";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  History,
  LayoutGrid,
  LoaderCircle,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  MicOff,
  PenLine,
  Plus,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  Sparkles,
  Trash2,
  User as UserIcon,
  Volume2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export function AIAssistant() {
  const { me, services, users } = useApp();
  const router = useRouter();

  // State
  const [conversations, setConversations] = useState<AIConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [templates, setTemplates] = useState<AITemplate[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);

  // Composer
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Active Draft being edited
  const [activeDrafts, setActiveDrafts] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Send Authorization Card State
  const [authorizingMsgId, setAuthorizingMsgId] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<"syora" | "whatsapp" | "email">("syora");
  const [targetRecipientId, setTargetRecipientId] = useState<string>("");
  const [targetRecipientName, setTargetRecipientName] = useState<string>("");
  const [targetPhoneOrEmail, setTargetPhoneOrEmail] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<Record<string, AISendResult>>({});

  // UI Panels
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  // Speech Recognition
  const [isRecording, setIsRecording] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load Initial Data
  const loadInitialData = useCallback(async () => {
    try {
      const [tplRes, contRes, convs] = await Promise.all([
        services.getAITemplates(),
        services.getAIContacts(),
        services.getAIConversations(),
      ]);
      setTemplates(tplRes.templates || []);
      setContacts(contRes.contacts || []);
      setConversations(convs || []);

      if (convs && convs.length > 0) {
        setActiveConversationId(convs[0].id);
      } else {
        // Create initial conversation
        const created = await services.createAIConversation("Professional Messaging");
        setConversations([created]);
        setActiveConversationId(created.id);
      }
    } catch (err: any) {
      console.error("Failed to load AI initial data", err);
    }
  }, [services]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Load Messages for Active Conversation
  const loadMessages = useCallback(async (convId: string) => {
    try {
      const data = await services.getAIConversation(convId);
      setMessages(data.messages || []);
      // Initialize active drafts
      const drafts: Record<string, string> = {};
      data.messages.forEach((m) => {
        if (m.draft_message) drafts[m.id] = m.draft_message;
      });
      setActiveDrafts(drafts);
    } catch {
      setMessages([]);
    }
  }, [services]);

  useEffect(() => {
    if (activeConversationId) {
      void loadMessages(activeConversationId);
    }
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating, authorizingMsgId]);

  // Speech Recognition Setup
  const toggleSpeechRecognition = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice("Speech recognition is not supported in this browser. Please type your message.");
      setTimeout(() => setVoiceNotice(null), 4000);
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
        setVoiceNotice("Listening... speak naturally.");
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((res: any) => res[0].transcript)
          .join("");
        setInputPrompt(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error", event.error);
        setIsRecording(false);
        if (event.error === "not-allowed") {
          setVoiceNotice("Microphone permission was denied. Please allow microphone access.");
        } else if (event.error === "no-speech") {
          setVoiceNotice("No speech detected. Please try speaking again.");
        } else {
          setVoiceNotice(`Voice recognition error: ${event.error}`);
        }
        setTimeout(() => setVoiceNotice(null), 4000);
      };

      recognition.onend = () => {
        setIsRecording(false);
        setVoiceNotice(null);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  };

  // Create New Chat
  const handleNewChat = async () => {
    try {
      const created = await services.createAIConversation("New Assistant Chat");
      setConversations((prev) => [created, ...prev]);
      setActiveConversationId(created.id);
      setMessages([]);
      setInputPrompt("");
      setAuthorizingMsgId(null);
    } catch (err: any) {
      setErrorNotice("Could not start a new chat. Please try again.");
    }
  };

  // Delete Chat
  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await services.deleteAIConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConversationId === id) {
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          void handleNewChat();
        }
      }
    } catch (err: any) {
      console.error("Failed to delete AI conversation", err);
    }
  };

  // Send Prompt to AI
  const handleSendPrompt = async (
    promptToSend?: string,
    refinementRule?: string,
    targetDraftId?: string
  ) => {
    const text = promptToSend || inputPrompt;
    if (!text.trim() || isGenerating) return;

    if (!activeConversationId) {
      await handleNewChat();
      return;
    }

    const previousDraft = targetDraftId ? activeDrafts[targetDraftId] : undefined;

    // Optimistically add user message
    const tempUserMsg: AIMessage = {
      id: "temp-user-" + Date.now(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInputPrompt("");
    setIsGenerating(true);
    setErrorNotice(null);

    try {
      const res = await services.sendAIChat(activeConversationId, {
        prompt: text,
        previous_draft: previousDraft,
        refinement: refinementRule,
      });

      const asstMsg: AIMessage = {
        id: res.message_id || "asst-" + Date.now(),
        role: "assistant",
        content: res.content,
        draft_message: res.draft_message,
        recipient_name: res.recipient?.name,
        recipient_id: res.recipient?.id,
        channel: res.channel,
        send_status: res.requires_authorization ? "pending_approval" : "draft",
        metadata: {
          recipient: res.recipient,
          channel: res.channel,
          suggested_actions: res.suggested_actions,
          requires_authorization: res.requires_authorization,
        },
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, asstMsg]);

      if (res.draft_message) {
        setActiveDrafts((prev) => ({ ...prev, [asstMsg.id]: res.draft_message }));
      }

      // If prompt was a direct send command or requires authorization
      if (res.is_send_command || res.requires_authorization) {
        setAuthorizingMsgId(asstMsg.id);
        if (res.channel) setSelectedChannel(res.channel);
        if (res.recipient) {
          setTargetRecipientName(res.recipient.name || "");
          if (res.recipient.id) setTargetRecipientId(res.recipient.id);
        }
      }

      // Refresh conversations list for title update
      const updatedConvs = await services.getAIConversations();
      setConversations(updatedConvs);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to generate AI response. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy Draft to Clipboard
  const handleCopy = (msgId: string) => {
    const text = activeDrafts[msgId];
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2200);
  };

  // Open Send Authorization for a message
  const handleStartAuthorization = (msg: AIMessage) => {
    setAuthorizingMsgId(msg.id);
    setSelectedChannel(msg.channel || "syora");
    setTargetRecipientName(msg.recipient_name || "");
    setTargetRecipientId(msg.recipient_id || "");
    setTargetPhoneOrEmail("");
  };

  // Perform Authorized Send
  const handleConfirmSend = async (msgId: string) => {
    const draftText = activeDrafts[msgId];
    if (!draftText?.trim()) {
      setErrorNotice("Cannot send an empty message.");
      return;
    }

    if (!targetRecipientName.trim() && !targetRecipientId) {
      setErrorNotice("Please specify a recipient name or select a contact.");
      return;
    }

    setIsSending(true);
    setErrorNotice(null);

    try {
      const result = await services.sendAIAuthorizedMessage({
        conversation_id: activeConversationId || undefined,
        recipient_id: targetRecipientId || undefined,
        recipient_name: targetRecipientName.trim(),
        channel: selectedChannel,
        message: draftText.trim(),
        authorized: true,
        phone_or_email: targetPhoneOrEmail.trim() || undefined,
      });

      setSendResult((prev) => ({ ...prev, [msgId]: result }));
      setAuthorizingMsgId(null);

      // If external URL (WhatsApp or Email), execute launch
      if (result.external_url) {
        window.open(result.external_url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setErrorNotice(err.message || "Message delivery failed. Please check recipient and try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Template categories
  const categories = ["All", ...Array.from(new Set(templates.map((t) => t.category)))];
  const filteredTemplates =
    selectedCategory === "All"
      ? templates
      : templates.filter((t) => t.category === selectedCategory);

  return (
    <div className="ai-layout">
      {/* Session History Sidebar (Desktop) */}
      <aside className="ai-sidebar">
        <div className="ai-sidebar__header">
          <h3>
            <Bot size={18} className="text-accent" />
            <span>AI Chats</span>
          </h3>
          <button
            type="button"
            className="button secondary small"
            onClick={handleNewChat}
            title="Start new assistant chat"
          >
            <Plus size={14} /> New
          </button>
        </div>

        <div className="ai-sidebar__list">
          {conversations.length === 0 ? (
            <div className="p-[20px] text-center text-muted text-[13px]">
              No previous chats found.
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={cn("ai-sidebar__item", c.id === activeConversationId && "is-active")}
                onClick={() => {
                  setActiveConversationId(c.id);
                  setAuthorizingMsgId(null);
                }}
              >
                <MessageSquare size={14} className="shrink-0 text-accent/80" />
                <span className="ai-sidebar__item-title">{c.title || "Untitled Session"}</span>
                <button
                  type="button"
                  className="ai-sidebar__item-delete"
                  onClick={(e) => void handleDeleteChat(c.id, e)}
                  title="Delete chat"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-[12px] border-t border-border/80">
          <button
            type="button"
            className="button secondary small w-full justify-center"
            onClick={() => setShowTemplatesModal(true)}
          >
            <LayoutGrid size={14} /> Scenario Templates
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="ai-main">
        {/* Top Header */}
        <header className="ai-header">
          <div className="ai-header__brand">
            <button
              type="button"
              className="icon-button lg:hidden"
              onClick={() => setShowHistorySidebar(true)}
              title="View past chats"
            >
              <History size={18} />
            </button>
            <div className="flex items-center gap-[9px]">
              <span className="flex size-[32px] items-center justify-center rounded-[9px] bg-accent/20 text-accent">
                <Sparkles size={18} />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight leading-tight flex items-center gap-[8px]">
                  <span>Syora AI</span>
                  <span className="ai-header__badge">Assistant</span>
                </h2>
                <small className="text-[12px] text-muted">
                  Professional Message Generator & Dispatcher
                </small>
              </div>
            </div>
          </div>

          <div className="ai-header__actions">
            <button
              type="button"
              className="button secondary small"
              onClick={() => setShowTemplatesModal(true)}
            >
              <LayoutGrid size={14} /> Templates
            </button>
            <button
              type="button"
              className="button primary small"
              onClick={handleNewChat}
            >
              <Plus size={14} /> New Chat
            </button>
          </div>
        </header>

        {/* Chat Stream */}
        <div className="ai-chat-scroll">
          <div className="ai-chat-inner">
            {/* Hero / Empty State */}
            {messages.length === 0 && (
              <div className="ai-hero">
                <span className="ai-hero__badge">
                  <Sparkles size={14} /> Professional Messaging Copilot
                </span>
                <h1>What do you need to communicate today?</h1>
                <p>
                  Explain your situation naturally through voice or text. Syora AI will craft a
                  refined message, let you review and edit, and dispatch it upon your explicit authorization.
                </p>

                <div className="ai-templates-grid">
                  {templates.slice(0, 6).map((tpl) => (
                    <div
                      key={tpl.id}
                      className="ai-template-card"
                      onClick={() => void handleSendPrompt(tpl.prompt_starter)}
                    >
                      <div>
                        <div className="ai-template-card__header">
                          <span className="ai-template-card__category">{tpl.category}</span>
                          <ArrowRight size={14} className="text-muted" />
                        </div>
                        <strong>{tpl.title}</strong>
                        <p>{tpl.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Message Stream */}
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const currentDraft = activeDrafts[msg.id] ?? msg.draft_message;
              const isAuthorizing = authorizingMsgId === msg.id;
              const result = sendResult[msg.id];

              return (
                <div
                  key={msg.id}
                  className={cn("ai-msg", isUser ? "ai-msg--user" : "ai-msg--assistant")}
                >
                  {!isUser && (
                    <div className="ai-msg__avatar">
                      <Bot size={18} />
                    </div>
                  )}

                  <div className="ai-msg__bubble">
                    {/* User Prompt / Assistant Explanation */}
                    <div className={cn(!isUser && "ai-msg__reasoning")}>{msg.content}</div>

                    {/* Generated Message Preview Card */}
                    {!isUser && currentDraft && (
                      <div className="ai-preview-card">
                        <div className="ai-preview-card__header">
                          <div className="ai-preview-card__label">
                            <PenLine size={14} />
                            <span>Message Preview (Editable)</span>
                          </div>
                          <div className="ai-preview-card__meta">
                            <span>{currentDraft.split(/\s+/).filter(Boolean).length} words</span>
                            <button
                              type="button"
                              className="button secondary small"
                              onClick={() => handleCopy(msg.id)}
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check size={13} className="text-success" /> Copied!
                                </>
                              ) : (
                                <>
                                  <Copy size={13} /> Copy
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Inline Editable Textarea */}
                        <textarea
                          className="ai-preview-card__editor"
                          value={currentDraft}
                          rows={Math.max(4, currentDraft.split("\n").length + 1)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setActiveDrafts((prev) => ({ ...prev, [msg.id]: val }));
                          }}
                          placeholder="Refine message text directly..."
                        />

                        {/* Quick Tone Refine Chips */}
                        <div className="ai-preview-card__chips">
                          <span className="text-[11px] font-medium text-muted mr-[4px]">
                            Refine:
                          </span>
                          <button
                            type="button"
                            className="ai-chip"
                            onClick={() =>
                              void handleSendPrompt("Make it more concise and brief", "concise", msg.id)
                            }
                          >
                            ⚡ Concise
                          </button>
                          <button
                            type="button"
                            className="ai-chip"
                            onClick={() =>
                              void handleSendPrompt("Make it formal and corporate", "formal", msg.id)
                            }
                          >
                            👔 Formal
                          </button>
                          <button
                            type="button"
                            className="ai-chip"
                            onClick={() =>
                              void handleSendPrompt("Make it friendlier and warmer", "friendly", msg.id)
                            }
                          >
                            😊 Friendly
                          </button>
                          <button
                            type="button"
                            className="ai-chip"
                            onClick={() =>
                              void handleSendPrompt(
                                "Add a clear call to action and next steps",
                                "cta",
                                msg.id
                              )
                            }
                          >
                            🎯 Add CTA
                          </button>
                        </div>

                        {/* Card Actions */}
                        <div className="ai-preview-card__footer">
                          <button
                            type="button"
                            className="button secondary small"
                            onClick={() =>
                              void handleSendPrompt("Regenerate this message with an alternative wording", undefined, msg.id)
                            }
                          >
                            <RefreshCw size={13} /> Regenerate
                          </button>

                          <button
                            type="button"
                            className="button primary small"
                            onClick={() => handleStartAuthorization(msg)}
                          >
                            <Send size={13} /> Approve & Send
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Send Authorization Card (Mandatory Explicit User Authorization) */}
                    {!isUser && isAuthorizing && (
                      <div className="ai-auth-card">
                        <div className="ai-auth-card__header">
                          <div className="ai-auth-card__icon">
                            <Shield size={18} />
                          </div>
                          <div className="ai-auth-card__title">
                            <strong>Outbound Send Authorization Required</strong>
                            <small>
                              Syora will transmit this message only after your explicit confirmation.
                            </small>
                          </div>
                        </div>

                        {/* Destination Channel Selector */}
                        <div className="ai-auth-card__field">
                          <label>Delivery Channel</label>
                          <div className="ai-auth-channel-tabs">
                            <button
                              type="button"
                              className={cn(
                                "ai-channel-tab",
                                selectedChannel === "syora" && "is-active"
                              )}
                              onClick={() => setSelectedChannel("syora")}
                            >
                              Syora Chat
                            </button>
                            <button
                              type="button"
                              className={cn(
                                "ai-channel-tab",
                                selectedChannel === "whatsapp" && "is-active"
                              )}
                              onClick={() => setSelectedChannel("whatsapp")}
                            >
                              WhatsApp
                            </button>
                            <button
                              type="button"
                              className={cn(
                                "ai-channel-tab",
                                selectedChannel === "email" && "is-active"
                              )}
                              onClick={() => setSelectedChannel("email")}
                            >
                              Email
                            </button>
                          </div>
                        </div>

                        {/* Recipient Selection */}
                        <div className="ai-auth-card__field">
                          <label>Recipient</label>
                          {selectedChannel === "syora" ? (
                            <select
                              className="input"
                              value={targetRecipientId}
                              onChange={(e) => {
                                const id = e.target.value;
                                setTargetRecipientId(id);
                                const found = contacts.find((c) => c.id === id);
                                if (found) setTargetRecipientName(found.name);
                              }}
                            >
                              <option value="">Select a contact...</option>
                              {contacts.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} (@{c.username})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              className="input"
                              placeholder={
                                selectedChannel === "whatsapp"
                                  ? "Recipient name or phone number"
                                  : "Recipient email address"
                              }
                              value={targetRecipientName}
                              onChange={(e) => setTargetRecipientName(e.target.value)}
                            />
                          )}
                        </div>

                        {/* Additional Phone or Email if needed */}
                        {selectedChannel !== "syora" && (
                          <div className="ai-auth-card__field">
                            <label>
                              {selectedChannel === "whatsapp"
                                ? "Phone Number (with country code)"
                                : "Recipient Email"}
                            </label>
                            <input
                              type="text"
                              className="input"
                              placeholder={
                                selectedChannel === "whatsapp" ? "+1 555 123 4567" : "name@example.com"
                              }
                              value={targetPhoneOrEmail}
                              onChange={(e) => setTargetPhoneOrEmail(e.target.value)}
                            />
                          </div>
                        )}

                        {/* Verified Message Payload */}
                        <div className="ai-auth-card__field">
                          <label>Verified Message Text</label>
                          <div className="rounded-[8px] border border-border/80 bg-surface/60 p-[10px_12px] text-[13px] text-text-primary whitespace-pre-wrap max-h-[120px] overflow-y-auto">
                            {currentDraft}
                          </div>
                        </div>

                        {/* Explicit Authorization Action Buttons */}
                        <div className="ai-auth-card__actions">
                          <button
                            type="button"
                            className="button secondary small"
                            onClick={() => setAuthorizingMsgId(null)}
                            disabled={isSending}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="button primary small"
                            onClick={() => void handleConfirmSend(msg.id)}
                            disabled={isSending}
                          >
                            {isSending ? (
                              <>
                                <LoaderCircle size={14} className="spin" /> Transmitting...
                              </>
                            ) : (
                              <>
                                <CheckCheck size={14} /> Authorize & Send Now
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Delivery Confirmation Card */}
                    {!isUser && result && (
                      <div className="ai-confirm-card">
                        <div className="ai-confirm-card__icon">
                          <CheckCircle2 size={18} />
                        </div>
                        <div className="ai-confirm-card__body">
                          <strong>Delivery Confirmed</strong>
                          <p>{result.confirmation}</p>
                          <div className="flex items-center gap-[10px]">
                            {result.conversation_id && (
                              <Link
                                href={`/chats?conversation=${result.conversation_id}`}
                                className="button primary small"
                              >
                                <MessageCircle size={13} /> View in Syora Chat
                              </Link>
                            )}
                            {result.external_url && (
                              <a
                                href={result.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="button secondary small"
                              >
                                <ExternalLink size={13} /> Open External App
                              </a>
                            )}
                            <small className="text-muted">
                              {new Date(result.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Generating Indicator */}
            {isGenerating && (
              <div className="ai-msg ai-msg--assistant">
                <div className="ai-msg__avatar">
                  <Bot size={18} />
                </div>
                <div className="ai-msg__bubble flex items-center gap-[10px] text-muted">
                  <LoaderCircle size={16} className="spin text-accent" />
                  <span>Understanding context and synthesizing message...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Voice Active Listening Bar */}
        {isRecording && (
          <div className="px-[16px] lg:px-[24px]">
            <div className="ai-voice-active">
              <div className="ai-voice-active__pulse">
                <span className="ai-voice-dot" />
                <div className="ai-voice-waves">
                  <span className="ai-voice-bar" style={{ animationDelay: "0ms" }} />
                  <span className="ai-voice-bar" style={{ animationDelay: "150ms" }} />
                  <span className="ai-voice-bar" style={{ animationDelay: "300ms" }} />
                  <span className="ai-voice-bar" style={{ animationDelay: "450ms" }} />
                  <span className="ai-voice-bar" style={{ animationDelay: "600ms" }} />
                </div>
                <span className="text-[13px] font-medium text-text-primary">
                  Listening... speak naturally (e.g. &ldquo;Ask Rahul for status on project&rdquo;)
                </span>
              </div>
              <button
                type="button"
                className="button secondary small"
                onClick={toggleSpeechRecognition}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Voice Notice Toast */}
        {voiceNotice && !isRecording && (
          <div className="px-[16px] lg:px-[24px] mb-[8px]">
            <div className="rounded-[8px] bg-accent/15 border border-accent/30 p-[8px_14px] text-[12.5px] text-accent flex items-center gap-[8px]">
              <Volume2 size={15} />
              <span>{voiceNotice}</span>
            </div>
          </div>
        )}

        {/* Error Notice */}
        {errorNotice && (
          <div className="px-[16px] lg:px-[24px] mb-[8px]">
            <div className="rounded-[8px] bg-danger/15 border border-danger/30 p-[8px_14px] text-[12.5px] text-danger flex items-center gap-[8px]">
              <ShieldAlert size={15} />
              <span>{errorNotice}</span>
            </div>
          </div>
        )}

        {/* Bottom Composer */}
        <div className="ai-composer">
          <div className="ai-composer__inner">
            <div className="ai-composer__bar">
              <textarea
                className="ai-composer__textarea"
                rows={1}
                placeholder="Explain what you need to say, or say 'Send to Rahul on WhatsApp'..."
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSendPrompt();
                  }
                }}
              />

              <div className="ai-composer__buttons">
                {/* Voice Input Button */}
                <button
                  type="button"
                  className={cn("ai-mic-btn", isRecording && "is-recording")}
                  onClick={toggleSpeechRecognition}
                  title={isRecording ? "Stop voice listening" : "Speak your message scenario"}
                  aria-label="Voice input"
                >
                  {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {/* Send Prompt Button */}
                <button
                  type="button"
                  className="ai-send-btn"
                  onClick={() => void handleSendPrompt()}
                  disabled={!inputPrompt.trim() || isGenerating}
                  title="Generate or refine message"
                  aria-label="Send prompt"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Templates Modal */}
      {showTemplatesModal && (
        <div className="modal-backdrop" onClick={() => setShowTemplatesModal(false)}>
          <div
            className="modal-card max-w-[680px] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="flex items-center gap-[8px]">
                <LayoutGrid size={18} className="text-accent" />
                <h3 className="text-[16px] font-semibold">Scenario Templates</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowTemplatesModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-[14px_18px] border-b border-border/70 flex flex-wrap gap-[6px]">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={cn("ai-chip", selectedCategory === cat && "border-accent text-accent")}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="p-[16px_18px] max-h-[460px] overflow-y-auto grid gap-[10px]">
              {filteredTemplates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="p-[12px] rounded-[10px] border border-border bg-surface/50 hover:border-accent/40 transition-colors flex items-center justify-between gap-[12px] cursor-pointer"
                  onClick={() => {
                    setShowTemplatesModal(false);
                    void handleSendPrompt(tpl.prompt_starter);
                  }}
                >
                  <div>
                    <div className="flex items-center gap-[8px] mb-[3px]">
                      <span className="text-[10px] uppercase font-bold text-accent bg-accent/15 px-[6px] py-[1px] rounded">
                        {tpl.category}
                      </span>
                      <strong className="text-[13.5px] text-text-primary">{tpl.title}</strong>
                    </div>
                    <p className="text-[12px] text-muted">{tpl.description}</p>
                  </div>
                  <button type="button" className="button secondary small shrink-0">
                    Use
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile History Sidebar Drawer */}
      {showHistorySidebar && (
        <div className="ai-sidebar--mobile">
          <div className="ai-sidebar__header">
            <h3>
              <Bot size={18} className="text-accent" />
              <span>AI Chat History</span>
            </h3>
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowHistorySidebar(false)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="ai-sidebar__list">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn("ai-sidebar__item", c.id === activeConversationId && "is-active")}
                onClick={() => {
                  setActiveConversationId(c.id);
                  setShowHistorySidebar(false);
                }}
              >
                <MessageSquare size={14} className="shrink-0 text-accent/80" />
                <span className="ai-sidebar__item-title">{c.title || "Untitled Session"}</span>
              </div>
            ))}
          </div>

          <div className="p-[12px] border-t border-border">
            <button
              type="button"
              className="button primary small w-full justify-center"
              onClick={() => {
                setShowHistorySidebar(false);
                void handleNewChat();
              }}
            >
              <Plus size={14} /> New Chat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
