"use client";

import { useApp } from "@/stores/use-app";
import type { AIConversationSummary, AIDiagnostics, AIMessage, AISendResult, AITemplate, User } from "@/types";
import { cn } from "@/utils/cn";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCheck,
  CheckCircle2,
  Copy,
  Cpu,
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
  Search,
  Send,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  User as UserIcon,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function AIAssistant() {
  const { me, services, users } = useApp();
  const router = useRouter();

  // State
  const [conversations, setConversations] = useState<AIConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [templates, setTemplates] = useState<AITemplate[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);

  // Diagnostics & Provider state
  const [diagnostics, setDiagnostics] = useState<AIDiagnostics | null>(null);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [isCheckingDiagnostics, setIsCheckingDiagnostics] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState<string>("");
  const [apiKeyStatus, setApiKeyStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");

  // Search & Rename for conversation history
  const [searchQuery, setSearchQuery] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

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
      const [tplRes, contRes, convs, diag] = await Promise.all([
        services.getAITemplates().catch(() => ({ templates: [] })),
        services.getAIContacts().catch(() => ({ contacts: [] })),
        services.getAIConversations().catch(() => []),
        services.getAIDiagnostics().catch(() => null),
      ]);
      setTemplates(tplRes.templates || []);
      setContacts(contRes.contacts || []);
      setConversations(convs || []);
      if (diag) setDiagnostics(diag);

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

  const handleRefreshDiagnostics = async () => {
    setIsCheckingDiagnostics(true);
    try {
      const diag = await services.getAIDiagnostics();
      setDiagnostics(diag);
    } catch (err) {
      console.warn("Diagnostics refresh failed", err);
    } finally {
      setIsCheckingDiagnostics(false);
    }
  };

  const handleCopySnippet = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(key);
    setTimeout(() => setCopiedSnippet(null), 2200);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("syora:gemini-api-key") || "";
      setGeminiApiKeyInput(stored);
    }
  }, []);

  const handleSaveAndTestApiKey = async () => {
    const key = geminiApiKeyInput.trim();
    setApiKeyStatus("testing");
    try {
      if (typeof window !== "undefined") {
        if (key) {
          localStorage.setItem("syora:gemini-api-key", key);
        } else {
          localStorage.removeItem("syora:gemini-api-key");
        }
      }
      if (key) {
        const { callGeminiAPI } = await import("@/services/ai-engine");
        const res = await callGeminiAPI("You are Syora AI.", "Say hello", key, "gemini-3.8-flash");
        if (res) {
          setApiKeyStatus("valid");
        } else {
          setApiKeyStatus("invalid");
        }
      } else {
        setApiKeyStatus("idle");
      }
      await handleRefreshDiagnostics();
    } catch {
      setApiKeyStatus("invalid");
    }
  };

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

  // Rename Chat
  const handleStartRename = (conv: AIConversationSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title || "Untitled Session");
  };

  const handleSaveRename = async (convId: string, e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingConvId(null);
      return;
    }
    try {
      await services.renameAIConversation(convId, trimmed);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: trimmed } : c))
      );
    } catch (err: any) {
      console.error("Failed to rename conversation", err);
    } finally {
      setEditingConvId(null);
    }
  };

  // Filtered Conversations for Search
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.last_message && c.last_message.toLowerCase().includes(q)) ||
      (c.last_draft && c.last_draft.toLowerCase().includes(q)) ||
      (c.last_recipient && c.last_recipient.toLowerCase().includes(q))
    );
  });

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

      // Refresh conversations list for title and snippet update
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

  // Helper renderer for session item
  const renderSessionItem = (c: AIConversationSummary, isMobile = false) => {
    const isActive = c.id === activeConversationId;
    const isEditing = editingConvId === c.id;

    return (
      <div
        key={c.id}
        className={cn("ai-sidebar__item", isActive && "is-active")}
        onClick={() => {
          setActiveConversationId(c.id);
          setAuthorizingMsgId(null);
          if (isMobile) setShowHistorySidebar(false);
        }}
      >
        <div className="ai-sidebar__item-header">
          <MessageSquare size={13} className="shrink-0 text-accent/80" />
          {isEditing ? (
            <div className="flex items-center gap-[4px] flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                className="ai-sidebar__rename-input"
                value={editingTitle}
                autoFocus
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveRename(c.id, e);
                  if (e.key === "Escape") setEditingConvId(null);
                }}
              />
              <button
                type="button"
                className="ai-sidebar__item-action-btn text-accent"
                onClick={(e) => void handleSaveRename(c.id, e)}
                title="Save title"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                className="ai-sidebar__item-action-btn text-muted"
                onClick={() => setEditingConvId(null)}
                title="Cancel"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              <span className="ai-sidebar__item-title">{c.title || "Untitled Session"}</span>
              <div className="ai-sidebar__item-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="ai-sidebar__item-action-btn"
                  onClick={(e) => handleStartRename(c, e)}
                  title="Rename session"
                >
                  <PenLine size={12} />
                </button>
                <button
                  type="button"
                  className="ai-sidebar__item-action-btn text-danger/80 hover:text-danger"
                  onClick={(e) => void handleDeleteChat(c.id, e)}
                  title="Delete chat"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Snippet Preview */}
        {(c.last_draft || c.last_message) && (
          <div className="ai-sidebar__item-snippet">
            {c.last_draft || c.last_message}
          </div>
        )}

        {/* Metadata Footer */}
        <div className="ai-sidebar__item-meta">
          <div className="flex items-center gap-[4px]">
            <span className="ai-sidebar__item-pill">
              {c.message_count ? `${c.message_count} msg${c.message_count > 1 ? "s" : ""}` : "1 msg"}
            </span>
            {c.last_recipient && (
              <span className="ai-sidebar__item-pill text-accent font-medium">
                {c.last_recipient}
              </span>
            )}
          </div>
          <span>{formatRelativeTime(c.updated_at || c.created_at)}</span>
        </div>
      </div>
    );
  };

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

        {/* Search Bar for Past Conversations */}
        <div className="ai-sidebar__search">
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-[9px] text-muted pointer-events-none" />
            <input
              type="text"
              className="ai-sidebar__search-input pl-[28px]"
              placeholder="Search chat history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-[8px] text-muted hover:text-text-primary"
                onClick={() => setSearchQuery("")}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Rich Conversation History Cards */}
        <div className="ai-sidebar__list">
          {conversations.length === 0 ? (
            <div className="p-[20px] text-center text-muted text-[13px]">
              No previous chats found.
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-[20px] text-center text-muted text-[12.5px]">
              No chats matching &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            filteredConversations.map((c) => renderSessionItem(c))
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
            <div className="flex items-center gap-[6px] sm:gap-[9px] min-w-0">
              <span className="flex size-[28px] sm:size-[32px] items-center justify-center rounded-[8px] sm:rounded-[9px] bg-accent/20 text-accent shrink-0">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0">
                <h2 className="text-[14px] sm:text-[15px] font-semibold tracking-tight leading-tight flex items-center gap-[6px] sm:gap-[8px]">
                  <span>Syora AI</span>
                  <span className="ai-header__badge">Assistant</span>
                </h2>
                <small className="text-[11.5px] sm:text-[12px] text-muted hidden sm:block truncate">
                  Professional Message Generator & Dispatcher
                </small>
              </div>
            </div>
          </div>

          <div className="ai-header__actions">
            {/* AI Provider Status Pill */}
            <button
              type="button"
              className="ai-provider-badge"
              onClick={() => setShowDiagnosticsModal(true)}
              title="AI Engine Diagnostics & Provider Setup"
            >
              <span
                className={cn(
                  "ai-provider-badge__dot",
                  diagnostics?.is_external_configured
                    ? "ai-provider-badge__dot--active"
                    : "ai-provider-badge__dot--fallback"
                )}
              />
              <span className="flex items-center gap-[4px] truncate max-w-[80px] xs:max-w-[120px] sm:max-w-none">
                {diagnostics?.active_provider === "gemini" && <Zap size={13} className="text-amber-400 shrink-0" />}
                {diagnostics?.active_provider === "ollama" && <Cpu size={13} className="text-emerald-400 shrink-0" />}
                {diagnostics?.active_provider === "builtin" && <Sparkles size={13} className="text-accent shrink-0" />}
                <span className="truncate">
                  {diagnostics?.active_provider === "gemini"
                    ? "Gemini 3.8 Flash"
                    : diagnostics?.active_provider === "ollama"
                    ? `Ollama (${diagnostics.ollama?.model || "llama3.2"})`
                    : "Syora Engine"}
                </span>
              </span>
            </button>

            <button
              type="button"
              className="button secondary small hidden md:inline-flex"
              onClick={() => setShowTemplatesModal(true)}
            >
              <LayoutGrid size={14} /> Templates
            </button>
            <button
              type="button"
              className="button primary small shrink-0 px-[8px] sm:px-[12px]"
              onClick={handleNewChat}
              title="Start a new chat"
            >
              <Plus size={15} />
              <span className="hidden xs:inline sm:inline">New Chat</span>
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
                  {templates.slice(0, 6).map((tpl, idx) => (
                    <div
                      key={tpl.id}
                      className={cn("ai-template-card", idx >= 3 && "hidden sm:flex")}
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
                {templates.length > 3 && (
                  <div className="mt-[10px] sm:hidden">
                    <button
                      type="button"
                      className="button secondary small w-full justify-center text-[12px]"
                      onClick={() => setShowTemplatesModal(true)}
                    >
                      <LayoutGrid size={13} /> View All {templates.length} Scenario Templates
                    </button>
                  </div>
                )}
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
                    {/* Author & Timestamp Header */}
                    <div className="ai-msg__header">
                      <div className="ai-msg__author">
                        {isUser ? (
                          <>
                            <UserIcon size={12} className="text-accent" />
                            <span>{me?.name || "You"}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} className="text-accent" />
                            <span>Syora AI</span>
                            <span className="ai-msg__tag">
                              {msg.metadata?.action === "send_authorization_prompt"
                                ? "Authorization Check"
                                : diagnostics?.active_provider === "gemini"
                                ? "Gemini 1.5 Flash"
                                : diagnostics?.active_provider === "ollama"
                                ? "Local Ollama"
                                : "Syora Engine"}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px]">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

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
                            <ShieldCheck size={18} />
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
          <div className="px-[10px] sm:px-[16px] lg:px-[24px] mb-[8px]">
            <div className="rounded-[8px] bg-danger/15 border border-danger/30 p-[8px_12px] text-[12px] sm:text-[12.5px] text-danger flex items-center justify-between gap-[8px]">
              <div className="flex items-center gap-[8px] min-w-0">
                <ShieldAlert size={15} className="shrink-0" />
                <span className="truncate">{errorNotice}</span>
              </div>
              <button
                type="button"
                className="p-[2px] rounded hover:bg-danger/20 text-danger shrink-0"
                onClick={() => setErrorNotice(null)}
                title="Dismiss notice"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Composer */}
        <div className="ai-composer">
          <div className="ai-composer__inner">
            {/* Tone Selector Toolbar */}
            <div className="ai-tone-bar">
              <span className="text-[11px] font-medium text-muted mr-[4px]">Tone:</span>
              {[
                { label: "⚡ Concise", rule: "concise" },
                { label: "👔 Formal", rule: "formal" },
                { label: "🤝 Friendly", rule: "friendly" },
                { label: "🎯 Action", rule: "action" },
                { label: "🕊️ Diplomatic", rule: "diplomatic" },
                { label: "🚨 Urgent", rule: "urgent" },
              ].map((t) => (
                <button
                  key={t.rule}
                  type="button"
                  className="ai-tone-pill"
                  onClick={() => {
                    const latestDraftMsg = [...messages].reverse().find((m) => m.draft_message);
                    if (latestDraftMsg) {
                      void handleSendPrompt(`Make this message ${t.rule}`, t.rule, latestDraftMsg.id);
                    } else {
                      setInputPrompt((prev) => (prev ? `${prev} (in a ${t.rule} tone)` : `Draft a ${t.rule} message for `));
                    }
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

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

      {/* AI Provider & Diagnostics Modal */}
      {showDiagnosticsModal && (
        <div className="modal-backdrop" onClick={() => setShowDiagnosticsModal(false)}>
          <div
            className="modal-card max-w-[620px] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="flex items-center gap-[8px]">
                <Cpu size={18} className="text-accent" />
                <h3 className="text-[16px] font-semibold">AI Assistant Engine & Diagnostics</h3>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowDiagnosticsModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-[16px_20px] space-y-[14px] max-h-[520px] overflow-y-auto">
              {/* Active Engine Card */}
              <div className="p-[12px_14px] rounded-[10px] bg-surface/70 border border-border flex items-center justify-between">
                <div>
                  <small className="text-[11px] font-semibold uppercase text-muted tracking-wider">
                    Current Active Engine
                  </small>
                  <div className="text-[15px] font-semibold text-text-primary flex items-center gap-[6px] mt-[2px]">
                    {diagnostics?.active_provider === "gemini" && <Zap size={16} className="text-amber-400" />}
                    {diagnostics?.active_provider === "ollama" && <Cpu size={16} className="text-emerald-400" />}
                    {diagnostics?.active_provider === "builtin" && <Sparkles size={16} className="text-accent" />}
                    <span>{diagnostics?.provider_name || "Syora Built-in Engine"}</span>
                  </div>
                  <p className="text-[11.5px] text-muted mt-[2px]">{diagnostics?.notes}</p>
                </div>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={handleRefreshDiagnostics}
                  disabled={isCheckingDiagnostics}
                  title="Re-test engine connection"
                >
                  {isCheckingDiagnostics ? (
                    <LoaderCircle size={13} className="spin" />
                  ) : (
                    <RefreshCw size={13} />
                  )}
                  <span>Refresh</span>
                </button>
              </div>

              {/* Provider Options Guidance */}
              <div className="text-[12.5px] text-text-secondary leading-relaxed">
                Syora AI supports three modes depending on your deployment:
              </div>

              {/* Option 1: Google Gemini */}
              <div className={cn("ai-diag-card", diagnostics?.active_provider === "gemini" && "is-active")}>
                <div className="flex items-center justify-between mb-[6px]">
                  <div className="flex items-center gap-[6px]">
                    <Zap size={15} className="text-amber-400" />
                    <strong className="text-[13.5px] text-text-primary">Google Gemini</strong>
                    <span className="text-[10px] uppercase font-bold text-accent bg-accent/15 px-[6px] py-[1px] rounded">
                      Live Cloud AI
                    </span>
                  </div>
                  <span className={cn("text-[11px] font-medium", diagnostics?.gemini.configured ? "text-success" : "text-muted")}>
                    {diagnostics?.gemini.configured ? "Active & Ready" : "Not configured"}
                  </span>
                </div>
                <p className="text-[12px] text-muted mb-[10px] leading-relaxed">
                  Powered by <strong>Gemini 3.8 Flash</strong>. You can paste any Gemini API key below to activate instantly:
                </p>

                {/* API Key Input and Test Bar */}
                <div className="space-y-[8px] mb-[10px]">
                  <div className="flex items-center gap-[8px]">
                    <input
                      type="password"
                      className="ai-key-input"
                      placeholder="Paste Gemini API Key (e.g. AQ... or AIza...)"
                      value={geminiApiKeyInput}
                      onChange={(e) => {
                        setGeminiApiKeyInput(e.target.value);
                        setApiKeyStatus("idle");
                      }}
                    />
                    <button
                      type="button"
                      className="button primary small shrink-0"
                      onClick={handleSaveAndTestApiKey}
                      disabled={apiKeyStatus === "testing"}
                    >
                      {apiKeyStatus === "testing" ? (
                        <>
                          <LoaderCircle size={13} className="spin" /> Testing...
                        </>
                      ) : (
                        "Save & Test"
                      )}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-[4px] text-[11px]">
                    <div className="flex items-center gap-[5px]">
                      {apiKeyStatus === "valid" && (
                        <span className="text-success flex items-center gap-[4px] font-medium">
                          <CheckCircle2 size={13} /> Gemini 3.8 Flash verified & active!
                        </span>
                      )}
                      {apiKeyStatus === "invalid" && (
                        <span className="text-danger flex items-center gap-[4px] font-medium">
                          <ShieldAlert size={13} /> Key test failed. Fallback to built-in synthesizer.
                        </span>
                      )}
                      {apiKeyStatus === "idle" && (
                        <span className="text-muted">
                          Key is securely saved in your browser storage.
                        </span>
                      )}
                    </div>
                    {geminiApiKeyInput && (
                      <button
                        type="button"
                        className="text-accent hover:underline text-[11px]"
                        onClick={() => {
                          setGeminiApiKeyInput("");
                          if (typeof window !== "undefined") {
                            localStorage.removeItem("syora:gemini-api-key");
                          }
                          setApiKeyStatus("idle");
                          void handleRefreshDiagnostics();
                        }}
                      >
                        Clear Saved Key
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-[6px]">
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-accent hover:underline inline-flex items-center gap-[4px]"
                  >
                    Get free Gemini API Key from Google AI Studio <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              {/* Option 2: Local Ollama */}
              <div className={cn("ai-diag-card", diagnostics?.active_provider === "ollama" && "is-active")}>
                <div className="flex items-center justify-between mb-[6px]">
                  <div className="flex items-center gap-[6px]">
                    <Cpu size={15} className="text-emerald-400" />
                    <strong className="text-[13.5px] text-text-primary">Local Ollama</strong>
                    <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/15 px-[6px] py-[1px] rounded">
                      100% Free & Private
                    </span>
                  </div>
                  <span className={cn("text-[11px] font-medium", diagnostics?.ollama.healthy ? "text-success" : "text-muted")}>
                    {diagnostics?.ollama.healthy ? "Connected & Healthy" : "Offline / Not Running"}
                  </span>
                </div>
                <p className="text-[12px] text-muted mb-[8px] leading-relaxed">
                  Best for local developers or self-hosted servers. Runs directly on your device with zero API keys or external calls.
                </p>
                <div className="ai-diag-code mb-[6px]">
                  <code>ollama run llama3.2</code>
                  <button
                    type="button"
                    className="text-accent hover:underline text-[11px] shrink-0"
                    onClick={() => handleCopySnippet("ollama run llama3.2", "ollama_cmd")}
                  >
                    {copiedSnippet === "ollama_cmd" ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="ai-diag-code">
                  <code>OLLAMA_ENABLED=true</code>
                  <button
                    type="button"
                    className="text-accent hover:underline text-[11px] shrink-0"
                    onClick={() => handleCopySnippet("OLLAMA_ENABLED=true", "ollama_env")}
                  >
                    {copiedSnippet === "ollama_env" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Option 3: Built-in Offline Fallback */}
              <div className={cn("ai-diag-card", diagnostics?.active_provider === "builtin" && "is-active")}>
                <div className="flex items-center justify-between mb-[6px]">
                  <div className="flex items-center gap-[6px]">
                    <Sparkles size={15} className="text-accent" />
                    <strong className="text-[13.5px] text-text-primary">Syora Neural Engine</strong>
                  </div>
                  <span className="text-[11px] font-medium text-success">
                    Always Ready
                  </span>
                </div>
                <p className="text-[12px] text-muted leading-relaxed">
                  Deterministic built-in message synthesizer. Ensures the assistant never throws errors or stops working even without internet or API keys.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="button primary small"
                onClick={() => setShowDiagnosticsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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

          <div className="ai-sidebar__search">
            <div className="relative flex items-center">
              <Search size={13} className="absolute left-[9px] text-muted pointer-events-none" />
              <input
                type="text"
                className="ai-sidebar__search-input pl-[28px]"
                placeholder="Search chat history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="ai-sidebar__list">
            {filteredConversations.map((c) => renderSessionItem(c, true))}
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
