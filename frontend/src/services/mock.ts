import { createSeed } from "@/data/seed";
import type {
  AdminMetrics,
  AdminNotificationEvent,
  AdminNotificationSettings,
  AIConversationSummary,
  AIDiagnostics,
  AIMessage,
  AISendResult,
  AITemplate,
  AppState,
  Attachment,
  Preferences,
  User,
} from "@/types";
import { normalizeUsername } from "@/utils/presentation";
import type { Services } from "./contracts";
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 350));
export class MockServices implements Services {
  private state: AppState = createSeed();
  private settings = new Map<string, Preferences>();
  private adminNotificationSettings = new Map<
    string,
    AdminNotificationSettings
  >();
  private hidden = new Map<string, Set<string>>();
  private deletedConversations = new Map<string, Set<string>>();
  private read = new Map<string, Set<string>>();
  private unread = new Map<string, Map<string, number>>();
  private conversationSettings = new Map<
    string,
    Map<string, { muted?: boolean; pinned?: boolean }>
  >();
  private snapshot: AppState = this.project();
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snapshot;
  private project(): AppState {
    const me = this.state.currentUserId;
    if (!me)
      return {
        ...this.state,
        users: [],
        conversations: [],
        messages: [],
        friendships: [],
        statuses: [],
        preferences: createSeed().preferences,
      };
    const friendships = this.state.friendships.filter(
      (f) => f.from === me || f.to === me,
    );
    const friends = new Set(
      friendships
        .filter((f) => f.status === "accepted")
        .map((f) => (f.from === me ? f.to : f.from)),
    );
    const conversations = this.state.conversations
      .filter(
        (c) =>
          c.participants.includes(me) &&
          !this.deletedConversations.get(me)?.has(c.id),
      )
      .map((c) => ({
        ...c,
        pinned: me === "demo" ? c.pinned : false,
        muted: me === "demo" ? c.muted : false,
        ...this.conversationSettings.get(me)?.get(c.id),
        unread:
          this.unread.get(me)?.get(c.id) ??
          (this.read.get(me)?.has(c.id) ? 0 : me === "demo" ? c.unread : 0),
      }));
    const ids = new Set(conversations.map((c) => c.id));
    return {
      ...this.state,
      conversations,
      friendships,
      messages: this.state.messages.filter(
        (m) => ids.has(m.conversationId) && !this.hidden.get(me)?.has(m.id),
      ),
      statuses: this.state.statuses.filter(
        (s) =>
          new Date(s.expiresAt).getTime() > Date.now() &&
          (s.userId === me ||
            (friends.has(s.userId) &&
              !this.state.preferences.blocked.includes(s.userId))),
      ),
    };
  }
  private update(values: Partial<AppState>) {
    this.state = { ...this.state, ...values };
    this.snapshot = this.project();
    this.listeners.forEach((fn) => fn());
  }
  private identity() {
    const id = this.state.currentUserId;
    if (!id) throw new Error("Please sign in to continue.");
    return id;
  }
  private user(id: string) {
    const user = this.state.users.find((u) => u.id === id);
    if (!user) throw new Error("Profile unavailable.");
    return user;
  }
  private conversation(id: string) {
    const me = this.identity();
    const c = this.state.conversations.find(
      (c) => c.id === id && c.participants.includes(me),
    );
    if (!c) throw new Error("Conversation unavailable.");
    return c;
  }
  private ownedMessage(id: string) {
    const m = this.state.messages.find((m) => m.id === id);
    if (!m || m.senderId !== this.identity())
      throw new Error("Message unavailable.");
    this.conversation(m.conversationId);
    return m;
  }
  private signIn(id: string) {
    const preferences = this.settings.get(id) || createSeed().preferences;
    this.settings.set(id, preferences);
    this.update({ currentUserId: id, preferences });
    return this.user(id);
  }
  async forgotPassword(email: string) {
    await pause();
  }
  async resetPassword(token: string, password: string) {
    await pause();
  }
  async enterDemo() {
    await pause();
    return this.signIn("demo");
  }
  async login(email: string, password: string) {
    await pause();
    if (password.length < 8)
      throw new Error("Use at least 8 characters for the demo password.");
    const user = this.state.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!user)
      throw new Error(
        "No profile found in this preview. Create a profile or explore the demo.",
      );
    return this.signIn(user.id);
  }
  async register(
    name: string,
    username: string,
    email: string,
    password: string,
  ) {
    await pause();
    name = name.trim();
    username = normalizeUsername(username);
    email = email.trim().toLowerCase();
    if (
      !name ||
      name.length > 80 ||
      password.length < 8 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      !/^[a-z0-9_]{3,32}$/.test(username)
    )
      throw new Error("Check your profile details.");
    if (this.state.users.some((u) => u.email.toLowerCase() === email))
      throw new Error("This email already has a preview profile.");
    if (this.state.users.some((u) => u.username === username))
      throw new Error("That username is already taken.");
    const user: User = {
      id: crypto.randomUUID(),
      name,
      username,
      email,
      about: "",
      color: "iris",
    };
    this.update({ users: [...this.state.users, user] });
    return this.signIn(user.id);
  }
  logout() {
    this.update({ currentUserId: null });
  }
  async retryBootstrap() {
    this.update({ sessionReady: true, sessionError: undefined });
  }
  async updateProfile(
    values: Partial<Pick<User, "name" | "username" | "about" | "avatar">>,
    onProgress?: (percent: number) => void,
  ) {
    const id = this.identity();
    onProgress?.(15);
    if (
      values.name !== undefined &&
      (!values.name.trim() || values.name.trim().length > 80)
    )
      throw new Error("Use a display name between 1 and 80 characters.");
    if (
      values.username !== undefined &&
      !/^[a-z0-9_]{3,32}$/.test(values.username.trim().replace(/^@/, ""))
    )
      throw new Error("Use 3–32 lowercase letters, numbers, or underscores.");
    const next = {
      ...values,
      ...(values.name !== undefined ? { name: values.name.trim() } : {}),
      ...(values.username !== undefined
        ? { username: values.username.trim().replace(/^@/, "").toLowerCase() }
        : {}),
    };
    this.update({
      users: this.state.users.map((u) => (u.id === id ? { ...u, ...next } : u)),
    });
    onProgress?.(100);
  }
  async send(
    conversationId: string,
    text: string,
    attachment?: Attachment,
    replyTo?: string,
  ) {
    const c = this.conversation(conversationId);
    if (
      c.participants.some((id) => this.state.preferences.blocked.includes(id))
    )
      throw new Error("Unblock this contact before sending a message.");
    if (!text.trim() && !attachment) return;
    if (text.length > 10000)
      throw new Error("Keep messages under 10,000 characters.");
    if (
      replyTo &&
      !this.snapshot.messages.some(
        (m) => m.id === replyTo && m.conversationId === conversationId,
      )
    )
      throw new Error("Reply message unavailable.");
    const id = crypto.randomUUID();
    const me = this.identity();
    for (const participant of c.participants) {
      this.deletedConversations.get(participant)?.delete(c.id);
      if (participant === me) continue;
      const counts = this.unread.get(participant) || new Map<string, number>();
      const previous =
        counts.get(c.id) ??
        (this.read.get(participant)?.has(c.id)
          ? 0
          : participant === "demo"
            ? c.unread
            : 0);
      counts.set(c.id, previous + 1);
      this.unread.set(participant, counts);
    }
    this.update({
      messages: [
        ...this.state.messages,
        {
          id,
          conversationId,
          senderId: me,
          text: text.trim(),
          attachment,
          replyTo,
          createdAt: new Date().toISOString(),
          receipt: "sending",
        },
      ],
    });
    await pause();
    this.update({
      messages: this.state.messages.map((m) =>
        m.id === id && !m.deleted && m.receipt === "sending"
          ? { ...m, receipt: "sent" }
          : m,
      ),
    });
    await pause();
    this.update({
      messages: this.state.messages.map((m) =>
        m.id === id && !m.deleted && m.receipt !== "read"
          ? { ...m, receipt: "delivered" }
          : m,
      ),
    });
  }
  typing(_conversationId: string, _active: boolean) {}
  async retry(id: string) {
    const message = this.ownedMessage(id);
    const c = this.conversation(message.conversationId);
    if (message.deleted || message.receipt !== "failed") return;
    if (
      c.participants.some((id) => this.state.preferences.blocked.includes(id))
    )
      throw new Error("Unblock this contact before retrying.");
    this.update({
      messages: this.state.messages.map((m) =>
        m.id === id ? { ...m, receipt: "sending" } : m,
      ),
    });
    await pause();
    this.update({
      messages: this.state.messages.map((m) =>
        m.id === id && !m.deleted && m.receipt !== "read"
          ? { ...m, receipt: "delivered" }
          : m,
      ),
    });
  }
  async deleteMessage(id: string, everyone: boolean) {
    const me = this.identity();
    const message = this.snapshot.messages.find((m) => m.id === id);
    if (!message) throw new Error("Message unavailable.");
    this.conversation(message.conversationId);
    if (everyone) {
      this.ownedMessage(id);
      const isAdmin =
        this.snapshot.users.find((u) => u.id === me)?.role === "admin";
      this.update({
        messages: this.state.messages.map((m) =>
          m.id === id
            ? {
                ...m,
                text: isAdmin ? m.deletedText || m.text : "",
                deletedText: isAdmin ? m.deletedText || m.text : undefined,
                attachment: undefined,
                replyTo: undefined,
                deleted: true,
              }
            : m,
        ),
      });
    } else {
      const hidden = this.hidden.get(me) || new Set<string>();
      hidden.add(id);
      this.hidden.set(me, hidden);
      this.update({});
    }
  }
  async clearConversation(id: string) {
    const me = this.identity();
    this.conversation(id);
    const hidden = this.hidden.get(me) || new Set<string>();
    this.state.messages
      .filter((message) => message.conversationId === id)
      .forEach((message) => hidden.add(message.id));
    this.hidden.set(me, hidden);
    const counts = this.unread.get(me) || new Map<string, number>();
    counts.set(id, 0);
    this.unread.set(me, counts);
    this.update({});
  }
  async deleteConversation(id: string) {
    const me = this.identity();
    await this.clearConversation(id);
    const deleted = this.deletedConversations.get(me) || new Set<string>();
    deleted.add(id);
    this.deletedConversations.set(me, deleted);
    this.update({});
  }
  markRead(id: string) {
    this.conversation(id);
    const me = this.identity();
    const read = this.read.get(me) || new Set<string>();
    read.add(id);
    this.read.set(me, read);
    const counts = this.unread.get(me) || new Map<string, number>();
    counts.set(id, 0);
    this.unread.set(me, counts);
    this.update({
      messages: this.state.messages.map((m) =>
        m.conversationId === id &&
        m.senderId !== me &&
        !m.deleted &&
        m.receipt !== "failed" &&
        this.state.preferences.receipts
          ? { ...m, receipt: "read" }
          : m,
      ),
    });
  }
  async toggleConversation(id: string, key: "muted" | "pinned") {
    this.conversation(id);
    const me = this.identity();
    const settings =
      this.conversationSettings.get(me) ||
      new Map<string, { muted?: boolean; pinned?: boolean }>();
    const current = this.snapshot.conversations.find((c) => c.id === id)!;
    settings.set(id, { ...settings.get(id), [key]: !current[key] });
    this.conversationSettings.set(me, settings);
    this.update({});
  }
  async request(id: string) {
    const me = this.identity();
    this.user(id);
    if (id === me || this.state.preferences.blocked.includes(id)) return;
    const exists = this.state.friendships.some(
      (f) =>
        [f.from, f.to].includes(me) &&
        [f.from, f.to].includes(id) &&
        f.status !== "declined",
    );
    if (!exists)
      this.update({
        friendships: [
          ...this.state.friendships,
          { id: crypto.randomUUID(), from: me, to: id, status: "pending" },
        ],
      });
  }
  async respond(id: string, accept: boolean) {
    const me = this.identity();
    const request = this.state.friendships.find(
      (f) => f.id === id && f.to === me && f.status === "pending",
    );
    if (!request) throw new Error("Friend request unavailable.");
    if (accept && this.state.preferences.blocked.includes(request.from))
      throw new Error("Unblock this profile before accepting.");
    this.update({
      friendships: this.state.friendships.map((f) =>
        f.id === id ? { ...f, status: accept ? "accepted" : "declined" } : f,
      ),
    });
  }
  async remove(id: string) {
    const me = this.identity();
    this.update({
      friendships: this.state.friendships.filter(
        (f) => !([f.from, f.to].includes(id) && [f.from, f.to].includes(me)),
      ),
    });
  }
  async openConversation(id: string) {
    const me = this.identity();
    this.user(id);
    if (this.state.preferences.blocked.includes(id))
      throw new Error("Unblock this contact first.");
    const accepted = this.state.friendships.some(
      (f) =>
        f.status === "accepted" &&
        [f.from, f.to].includes(me) &&
        [f.from, f.to].includes(id),
    );
    if (!accepted || me === id)
      throw new Error(
        "An accepted friend request is needed to start a conversation.",
      );
    const existing = this.state.conversations.find(
      (c) => c.participants.includes(me) && c.participants.includes(id),
    );
    if (existing) {
      this.deletedConversations.get(me)?.delete(existing.id);
      this.update({});
      return existing.id;
    }
    const conversation = {
      id: crypto.randomUUID(),
      participants: [me, id],
      unread: 0,
    };
    this.update({ conversations: [conversation, ...this.state.conversations] });
    return conversation.id;
  }
  async block(id: string) {
    const me = this.identity();
    this.user(id);
    if (id === me) throw new Error("You cannot block your own profile.");
    const blocked = this.state.preferences.blocked;
    this.updatePreferences({
      blocked: blocked.includes(id)
        ? blocked.filter((x) => x !== id)
        : [...blocked, id],
    });
  }
  async publish(
    text: string,
    color: string,
    attachment?: Attachment,
    onProgress?: (percent: number) => void,
  ) {
    const me = this.identity();
    onProgress?.(20);
    if (!text.trim() && !attachment)
      throw new Error("Add a thought or a photo first.");
    const now = Date.now();
    this.update({
      statuses: [
        {
          id: crypto.randomUUID(),
          userId: me,
          text: text.trim(),
          color,
          attachment,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + 86400000).toISOString(),
          viewedBy: [],
        },
        ...this.state.statuses,
      ],
    });
    onProgress?.(100);
  }
  async view(id: string) {
    const me = this.identity();
    if (
      !this.snapshot.statuses.some(
        (s) => s.id === id && new Date(s.expiresAt).getTime() > Date.now(),
      )
    )
      throw new Error("Status unavailable.");
    this.update({
      statuses: this.state.statuses.map((s) =>
        s.id === id && !s.viewedBy.includes(me)
          ? { ...s, viewedBy: [...s.viewedBy, me] }
          : s,
      ),
    });
  }
  async removeStatus(id: string) {
    const me = this.identity();
    if (!this.state.statuses.some((s) => s.id === id && s.userId === me))
      throw new Error("Status unavailable.");
    this.update({ statuses: this.state.statuses.filter((s) => s.id !== id) });
  }
  async loadMessages(_conversationId: string) {
    return false;
  }
  async loadOlderMessages(_conversationId: string) {
    return false;
  }
  async searchUsers(query: string, signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const value = normalizeUsername(query);
    return this.state.users
      .filter(
        (user) =>
          user.id !== this.state.currentUserId &&
          (normalizeUsername(user.username).startsWith(value) ||
            user.name.toLowerCase().includes(value)),
      )
      .slice(0, 20);
  }
  async getAccessUrl(_attachmentId: string) {
    return "";
  }
  async getAdminMetrics(): Promise<AdminMetrics> {
    const me = this.user(this.identity());
    if (me.role !== "admin")
      throw new Error("Administrator access is required.");
    const timestamp = new Date().toISOString();
    return {
      signedInUsers: 1,
      previouslySignedInUsers: 0,
      people: [
        {
          userId: me.id,
          displayName: me.name,
          username: me.username,
          totalSessionCount: 1,
          activeSessionCount: 1,
          lastSignedInAt: timestamp,
          lastActiveAt: timestamp,
          isCurrentUser: true,
          canRevoke: false,
        },
      ],
    };
  }
  async revokeAdminSessions(_userId: string): Promise<void> {
    await pause();
  }
  private playMockAdminNotificationSound(type?: string) {
    if (typeof window === "undefined") return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      if (context.state === "suspended") {
        void context.resume();
      }
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      if (type === "ADMIN_LOGIN_FAILED") {
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.setValueAtTime(311.13, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.28);
      } else if (type === "ADMIN_USER_LOGIN") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.setValueAtTime(554.37, now + 0.08);
        oscillator.frequency.setValueAtTime(659.25, now + 0.16);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
      } else {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(587.33, now);
        oscillator.frequency.setValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.25);
      }
      oscillator.addEventListener("ended", () => void context.close());
    } catch {}
  }
  async getAdminNotificationSettings(): Promise<AdminNotificationSettings> {
    const me = this.user(this.identity());
    if (me.role !== "admin")
      throw new Error("Administrator access is required.");
    const existing = this.adminNotificationSettings.get(me.id);
    if (existing) return existing;
    const initial: AdminNotificationSettings = {
      loginAlerts: true,
      messageAlerts: true,
      messagePreview: true,
      pushEnabled: false,
      pushSupported: true,
    };
    this.adminNotificationSettings.set(me.id, initial);
    return initial;
  }
  async updateAdminNotificationSettings(
    values: Partial<
      Pick<
        AdminNotificationSettings,
        "loginAlerts" | "messageAlerts" | "messagePreview"
      >
    >,
  ) {
    const current = await this.getAdminNotificationSettings();
    const updated = { ...current, ...values };
    const me = this.identity();
    this.adminNotificationSettings.set(me, updated);
    return updated;
  }
  async enableAdminPush(): Promise<AdminNotificationSettings> {
    await pause();
    const current = await this.getAdminNotificationSettings();
    const updated = { ...current, pushEnabled: true };
    const me = this.identity();
    this.adminNotificationSettings.set(me, updated);
    return updated;
  }
  async disableAdminPush() {
    await pause();
    const current = await this.getAdminNotificationSettings();
    const updated = { ...current, pushEnabled: false };
    const me = this.identity();
    this.adminNotificationSettings.set(me, updated);
    return updated;
  }
  async sendTestAdminNotification(
    type: AdminNotificationEvent["type"] = "ADMIN_TEST_ALERT",
  ): Promise<AdminNotificationEvent> {
    const me = this.user(this.identity());
    if (me.role !== "admin")
      throw new Error("Administrator access is required.");
    await pause();
    let notification: AdminNotificationEvent;
    const nowIso = new Date().toISOString();
    if (type === "ADMIN_USER_LOGIN") {
      notification = {
        id: `mock-login-${Date.now()}`,
        type: "ADMIN_USER_LOGIN",
        title: "User logged in",
        body: "Elena Rostov (@elena) just signed in.",
        url: "/contacts",
        timestamp: nowIso,
        senderName: "Elena Rostov",
      };
    } else if (type === "ADMIN_LOGIN_FAILED") {
      notification = {
        id: `mock-failed-${Date.now()}`,
        type: "ADMIN_LOGIN_FAILED",
        title: "Failed sign-in attempt",
        body: "A sign-in attempt for an unknown account was rejected.",
        url: "/settings",
        timestamp: nowIso,
      };
    } else if (type === "ADMIN_DIRECT_MESSAGE") {
      notification = {
        id: `mock-msg-${Date.now()}`,
        type: "ADMIN_DIRECT_MESSAGE",
        title: "SYORA message",
        body: "Alex Rivera: Hello admin, this is a test direct message notification.",
        url: "/chats",
        timestamp: nowIso,
        senderName: "Alex Rivera",
      };
    } else {
      notification = {
        id: `mock-test-${Date.now()}`,
        type: "ADMIN_TEST_ALERT",
        title: "Admin Notification Test",
        body: "Admin notification channel is active and receiving alerts on this device.",
        url: "/settings?section=notifications",
        timestamp: nowIso,
      };
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("syora:admin-notification", { detail: notification }),
      );
      this.playMockAdminNotificationSound(notification.type);
    }
    return notification;
  }
  async getAdminNotificationHistory(): Promise<{ items: AdminNotificationEvent[]; unreadCount: number }> {
    if (typeof window === "undefined") return { items: [], unreadCount: 0 };
    try {
      const stored: AdminNotificationEvent[] = JSON.parse(localStorage.getItem("syora:admin-notifications-history") || "[]");
      const unreadCount = stored.filter(i => !i.read).length;
      return { items: stored, unreadCount };
    } catch {
      return { items: [], unreadCount: 0 };
    }
  }
  async markAdminNotificationsRead(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      const stored: AdminNotificationEvent[] = JSON.parse(localStorage.getItem("syora:admin-notifications-history") || "[]");
      localStorage.setItem("syora:admin-notifications-history", JSON.stringify(stored.map(i => ({ ...i, read: true }))));
      window.dispatchEvent(new CustomEvent("syora:admin-history-updated"));
    } catch {}
  }
  async clearAdminNotificationHistory(): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem("syora:admin-notifications-history");
      window.dispatchEvent(new CustomEvent("syora:admin-history-updated"));
    } catch {}
  }
  async updatePreferences(values: Partial<Preferences>) {
    const me = this.identity();
    const preferences = { ...this.state.preferences, ...values };
    this.settings.set(me, preferences);
    this.update({ preferences });
  }
  private mockAITemplates: AITemplate[] = [
    {
      id: "status-update",
      category: "Updates",
      title: "Project Status Update",
      description: "Share progress, milestones achieved, and current blockers clearly.",
      template: "Hi {name},\n\nHere is a quick update on the project:\n- Completed: Core modules and review\n- Next steps: Testing and deployment by end of week.\n- Blockers: None at this time.\n\nLet me know your thoughts!",
      prompt_starter: "Give my manager a concise status update on our project",
    },
    {
      id: "meeting-reschedule",
      category: "Meetings",
      title: "Reschedule Meeting",
      description: "Politely propose a new time slot without inconveniencing the attendee.",
      template: "Hi {name},\n\nDue to an unexpected conflict, I will need to reschedule our upcoming meeting. Would tomorrow afternoon work instead? Apologies for the inconvenience!",
      prompt_starter: "Ask to reschedule our meeting to tomorrow afternoon politely",
    },
    {
      id: "gentle-followup",
      category: "Follow-ups",
      title: "Gentle Follow-up",
      description: "Polite reminder on a pending review or unanswered message.",
      template: "Hi {name},\n\nJust following up on my previous note. When you have a moment, please let me know your thoughts. Thanks!",
      prompt_starter: "Follow up gently on the proposal I sent last week",
    },
  ];
  private mockAIConversations: AIConversationSummary[] = [];
  private mockAIMessages = new Map<string, AIMessage[]>();

  async getAIDiagnostics(): Promise<AIDiagnostics> {
    await pause();
    return {
      active_provider: "builtin",
      provider_name: "Mock / Syora Built-in Engine",
      is_external_configured: false,
      gemini: { configured: false, model: "gemini-1.5-flash" },
      ollama: { configured: false, base_url: "http://localhost:11434", model: "llama3.2" },
      openai: { configured: false, model: "gpt-4o-mini" },
      preferred_provider: "auto",
      notes: "Mock mode is active. In live mode, Gemini or local Ollama can be used.",
    };
  }
  async getAITemplates(): Promise<{ templates: AITemplate[] }> {
    await pause();
    return { templates: this.mockAITemplates };
  }
  async getAIContacts(): Promise<{ contacts: User[] }> {
    await pause();
    return { contacts: this.state.users.filter(u => u.id !== this.state.currentUserId) };
  }
  async getAIConversations(): Promise<AIConversationSummary[]> {
    await pause();
    return this.mockAIConversations;
  }
  async createAIConversation(title?: string): Promise<AIConversationSummary> {
    await pause();
    const id = "mock-ai-" + Date.now();
    const item: AIConversationSummary = {
      id,
      title: title || "New Assistant Chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.mockAIConversations.unshift(item);
    this.mockAIMessages.set(id, []);
    return item;
  }
  async renameAIConversation(id: string, title: string): Promise<AIConversationSummary> {
    await pause();
    const conv = this.mockAIConversations.find(c => c.id === id);
    if (conv) {
      conv.title = title;
      conv.updated_at = new Date().toISOString();
      return conv;
    }
    return {
      id,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  async getAIConversation(id: string): Promise<{ id: string; title: string; messages: AIMessage[] }> {
    await pause();
    const conv = this.mockAIConversations.find(c => c.id === id) || {
      id,
      title: "Assistant Chat",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return { id, title: conv.title, messages: this.mockAIMessages.get(id) || [] };
  }
  async deleteAIConversation(id: string): Promise<void> {
    await pause();
    this.mockAIConversations = this.mockAIConversations.filter(c => c.id !== id);
    this.mockAIMessages.delete(id);
  }
  async clearAllAIConversations(): Promise<void> {
    await pause();
    this.mockAIConversations = [];
    this.mockAIMessages.clear();
  }
  async polishMessage(
    draft: string,
    mode: "polish" | "professional" | "concise" | "friendly" | "action" | "custom",
    customInstruction?: string,
  ): Promise<{ polished_text: string; provider?: string }> {
    await pause();
    let text = draft.trim();
    if (mode === "polish") {
      text = text ? text[0].toUpperCase() + text.slice(1) : "Hello, hope everything is going well.";
      if (!/[.!?]$/.test(text)) text += ".";
    } else if (mode === "professional") {
      text = text ? `Good day. ${text}` : "Good day. I am writing to provide an update regarding our discussion.";
      if (!/[.!?]$/.test(text)) text += ".";
    } else if (mode === "friendly") {
      text = `Hi! ${text || "Hope you're having a wonderful day!"}`;
      if (!/[.!?]$/.test(text)) text += ".";
    } else if (mode === "custom" && customInstruction) {
      if (customInstruction.toLowerCase().includes("love") && customInstruction.toLowerCase().includes("friend")) {
        text = "Hey! Just wanted to take a moment to say how much I truly appreciate our friendship. You mean the world to me!";
      } else {
        text = text ? `${text} Please let me know your thoughts regarding ${customInstruction}.` : `Hi! Reaching out regarding: ${customInstruction}.`;
      }
    }
    return {
      polished_text: text || "Hi there!",
      provider: "Mock Neural Engine",
    };
  }
  async sendAIChat(
    conversationId: string,
    payload: { prompt: string; previous_draft?: string; refinement?: string; recipient_name?: string; channel?: string },
  ): Promise<any> {
    await pause();
    const targetName = payload.recipient_name || "there";
    const draft = `Hi ${targetName},\n\nI am reaching out regarding ${payload.prompt}.\n\nPlease let me know your thoughts.\n\nBest regards,`;
    const asstMessage: AIMessage = {
      id: "msg-" + Date.now(),
      role: "assistant",
      content: `I've prepared a professional message for ${targetName}. You can review, refine, or approve it below.`,
      draft_message: draft,
      recipient_name: payload.recipient_name,
      channel: (payload.channel as any) || "syora",
      send_status: "draft",
      created_at: new Date().toISOString(),
    };
    const list = this.mockAIMessages.get(conversationId) || [];
    list.push(
      {
        id: "usr-" + Date.now(),
        role: "user",
        content: payload.prompt,
        created_at: new Date().toISOString(),
      },
      asstMessage,
    );
    this.mockAIMessages.set(conversationId, list);
    return {
      message_id: asstMessage.id,
      role: "assistant",
      content: asstMessage.content,
      draft_message: draft,
      recipient: payload.recipient_name ? { name: payload.recipient_name } : null,
      channel: payload.channel || "syora",
      is_send_command: false,
      requires_authorization: false,
      suggested_actions: ["Make more concise", "More formal", "Friendlier", "Add clear CTA"],
    };
  }
  async sendAIAuthorizedMessage(payload: {
    conversation_id?: string;
    recipient_id?: string;
    recipient_name: string;
    channel: "syora" | "whatsapp" | "email";
    message: string;
    authorized: boolean;
    phone_or_email?: string;
  }): Promise<AISendResult> {
    await pause();
    return {
      success: true,
      status: payload.channel === "syora" ? "delivered" : "authorized",
      channel: payload.channel,
      recipient_name: payload.recipient_name,
      timestamp: new Date().toISOString(),
      confirmation: `Message successfully processed for ${payload.recipient_name} via ${payload.channel}.`,
    };
  }
}
export const services: Services = new MockServices();
