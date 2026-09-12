import type {
  AppState,
  Attachment,
  Conversation,
  Message,
  Preferences,
  User,
} from "@/types";
import { io, type Socket } from "socket.io-client";
import type { Services } from "./contracts";
import { normalizeUsername } from "@/utils/presentation";
const API = process.env.NEXT_PUBLIC_API_URL || "";
const SOCKET = process.env.NEXT_PUBLIC_SOCKET_URL || API;
class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}
const defaults: Preferences = {
  lastSeen: "Friends",
  photo: "Friends",
  status: "Friends",
  receipts: true,
  notifications: true,
  sound: true,
  appearance: "dark",
  compact: false,
  blocked: [],
};
const empty = (): AppState => ({
  sessionReady: false,
  connection: "connecting",
  currentUserId: null,
  users: [],
  conversations: [],
  messages: [],
  friendships: [],
  statuses: [],
  preferences: { ...defaults },
});
type Retry = {
  conversationId: string;
  text: string;
  attachment?: Attachment;
  replyTo?: string;
};
export class ApiServices implements Services {
  private state = empty();
  private snapshot = this.state;
  private listeners = new Set<() => void>();
  private token: string | null = null;
  private socket?: Socket;
  private started = false;
  private retries = new Map<string, Retry>();
  private loadedMessages = new Set<string>();
  private messageCursors = new Map<string, string | null>();
  private refreshTask?: Promise<boolean>;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    if (!this.started && typeof window !== "undefined") {
      this.started = true;
      this.loadLocalPreferences();
      window.addEventListener("online", this.handleOnline);
      window.addEventListener("offline", this.handleOffline);
      void this.bootstrap();
    }
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snapshot;
  private handleOnline = () => { this.update({ connection: "connecting" }); this.socket?.connect(); };
  private handleOffline = () => this.update({ connection: "offline" });
  private update(values: Partial<AppState>) {
    this.state = { ...this.state, ...values };
    this.snapshot = this.state;
    this.listeners.forEach((fn) => fn());
  }
  private users(...groups: (User | undefined)[][]) {
    const map = new Map(this.state.users.map((x) => [x.id, x]));
    groups.flat().forEach((x) => {
      if (x) map.set(x.id, { ...x, username: normalizeUsername(x.username) });
    });
    return [...map.values()];
  }
  private loadLocalPreferences() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("syora:preferences") || "{}",
      );
      this.update({ preferences: { ...this.state.preferences, ...saved } });
    } catch {}
  }
  private error(data: any, status: number) {
    return new ApiError(data?.error?.message || `Request failed (${status}).`, status, data?.error?.code);
  }
  private async fetch<T>(
    path: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const headers = new Headers(init.headers);
    if (this.token) headers.set("Authorization", `Bearer ${this.token}`);
    if (init.body && !headers.has("Content-Type"))
      headers.set("Content-Type", "application/json");
    let response: Response;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
    const abort = () => controller.abort();
    if (init.signal?.aborted) controller.abort();
    else init.signal?.addEventListener("abort", abort, { once: true });
    try {
      response = await fetch(`${API}${path}`, {
        ...init,
        headers,
        credentials: "include",
        signal: controller.signal,
      });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      throw new ApiError(timedOut ? "The request took too long. Try again." : "SYORA could not reach the server. Check your connection and try again.", 0, timedOut ? "REQUEST_TIMEOUT" : "NETWORK_UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener("abort", abort);
    }
    if (response.status === 401 && retry && path !== "/api/auth/refresh") {
      const ok = await this.refresh();
      if (ok) return this.fetch<T>(path, init, false);
    }
    if (!response.ok) {
      let data;
      try {
        data = await response.json();
      } catch {}
      throw this.error(data, response.status);
    }
    return response.status === 204 ? (undefined as T) : response.json();
  }
  private refresh() {
    if (!this.refreshTask)
      this.refreshTask = this.performRefresh().finally(() => {
        this.refreshTask = undefined;
      });
    return this.refreshTask;
  }
  private async performRefresh() {
    try {
      const result = await this.fetch<{ user: User; accessToken: string }>(
        "/api/auth/refresh",
        { method: "POST" },
        false,
      );
      this.token = result.accessToken;
      if (this.socket) this.socket.auth = { token: this.token };
      this.update({
        currentUserId: result.user.id,
        users: this.users([result.user]),
      });
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status !== 401) throw error;
      this.token = null;
      return false;
    }
  }
  private async bootstrap() {
    this.update({ sessionReady: false, sessionError: undefined });
    try {
      const authenticated = await this.refresh();
      if (authenticated) await this.loadAll();
    } catch (error) {
      this.update({ sessionError: error instanceof Error ? error.message : "Your session could not be restored." });
    } finally {
      this.update({ sessionReady: true });
    }
  }
  async retryBootstrap() {
    await this.bootstrap();
  }
  private async loadAll() {
    const [conversations, contacts, requests, statuses, preferences] =
      await Promise.all([
        this.fetch<any[]>("/api/conversations"),
        this.fetch<any>("/api/contacts"),
        this.fetch<any>("/api/friend-requests"),
        this.fetch<any>("/api/status"),
        this.fetch<any>("/api/preferences"),
      ]);
    const conversationUsers = conversations
      .map((x) => x.participant)
      .filter(Boolean);
    const latestMessages = conversations
      .map((x) => x.latestMessage)
      .filter(Boolean);
    const local = {
      appearance: this.state.preferences.appearance,
      compact: this.state.preferences.compact,
      notifications: this.state.preferences.notifications,
      sound: this.state.preferences.sound,
    };
    this.update({
      users: this.users(
        conversationUsers,
        contacts.users,
        requests.users,
        statuses.users,
        preferences.blockedUsers || [],
      ),
      conversations: conversations.map(
        ({ participant, latestMessage, ...x }) => x,
      ),
      messages: latestMessages,
      friendships: [...contacts.friendships, ...requests.friendships],
      statuses: statuses.statuses,
      preferences: { ...defaults, ...local, ...preferences },
      sessionError: undefined,
    });
    this.connectSocket();
  }
  private connectSocket() {
    if (!this.token || this.socket?.connected) return;
    this.socket?.disconnect();
    const socket = (this.socket = io(SOCKET, {
      path: "/socket.io",
      auth: { token: this.token },
      transports: ["websocket", "polling"],
      withCredentials: true,
    }));
    socket.on("connect", () => {
      this.update({ connection: "online" });
      this.state.conversations.forEach((c) =>
        socket.emit("conversation:join", { conversationId: c.id }),
      );
      this.state.messages.forEach((m) => {
        if (
          m.senderId !== this.state.currentUserId &&
          m.receipt !== "read" &&
          m.receipt !== "delivered"
        ) {
          socket.emit("message:delivered", { messageId: m.id });
          this.patchMessage(m.id, { receipt: "delivered" });
        }
      });
    });
    socket.on("connect_error", (error) => {
      this.update({ connection: "offline" });
      if (error.message === "Authentication required")
        void this.refresh().then((ok) => {
          if (ok) socket.connect();
        }).catch(() => this.update({ connection: "offline" }));
    });
    socket.on("message:new", (message: Message) => {
      if (!this.state.messages.some((x) => x.id === message.id))
        this.update({ messages: [...this.state.messages, message] });
      if (message.senderId !== this.state.currentUserId) {
        const conversation = this.state.conversations.find(
          (x) => x.id === message.conversationId,
        );
        if (conversation)
          this.patchConversation(conversation.id, {
            unread: conversation.unread + 1,
          });
        socket.emit("message:delivered", { messageId: message.id });
      }
    });
    socket.on("message:delivered", ({ messageId }: { messageId: string }) =>
      this.patchMessage(messageId, { receipt: "delivered" }),
    );
    socket.on(
      "message:read",
      ({
        messageId,
        messageIds,
      }: {
        messageId?: string;
        messageIds?: string[];
      }) =>
        (messageIds || [messageId!]).forEach((id) =>
          this.patchMessage(id, { receipt: "read" }),
        ),
    );
    socket.on("message:deleted", ({ messageId }: { messageId: string }) =>
      this.patchMessage(messageId, {
        text: "",
        attachment: undefined,
        replyTo: undefined,
        deleted: true,
      }),
    );
    socket.on(
      "typing:start",
      ({
        conversationId,
        userId,
      }: {
        conversationId: string;
        userId: string;
      }) => {
        if (userId !== this.state.currentUserId)
          this.patchConversation(conversationId, { typing: true });
      },
    );
    socket.on("typing:stop", ({ conversationId }: { conversationId: string }) =>
      this.patchConversation(conversationId, { typing: false }),
    );
    socket.on(
      "presence:update",
      (value: { userId: string; online: boolean; lastSeen?: string }) =>
        this.update({
          users: this.state.users.map((x) =>
            x.id === value.userId
              ? {
                  ...x,
                  online: value.online,
                  lastSeen: value.lastSeen || x.lastSeen,
                }
              : x,
          ),
        }),
    );
    socket.on("conversation:update", () => void this.reloadConversations());
    socket.on("status:new", () => void this.reloadStatus());
    socket.on("status:deleted", () => void this.reloadStatus());
    socket.on("disconnect", () => this.update({ connection: "offline" }));
  }
  private patchMessage(id: string, values: Partial<Message>) {
    this.update({
      messages: this.state.messages.map((x) =>
        x.id === id ? { ...x, ...values } : x,
      ),
    });
  }
  private patchConversation(id: string, values: Partial<Conversation>) {
    this.update({
      conversations: this.state.conversations.map((x) =>
        x.id === id ? { ...x, ...values } : x,
      ),
    });
  }
  private mergeMessages(incoming: Message[]) {
    const map = new Map(this.state.messages.map((message) => [message.id, message]));
    incoming.forEach((message) => map.set(message.id, { ...map.get(message.id), ...message }));
    return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  private async reloadConversations() {
    const rows = await this.fetch<any[]>("/api/conversations");
    const latest = rows.map((x) => x.latestMessage).filter(Boolean) as Message[];
    this.update({
      users: this.users(rows.map((x) => x.participant)),
      conversations: rows.map(({ participant, latestMessage, ...x }) => x),
      messages: this.mergeMessages(latest),
    });
    if (this.socket?.connected) {
      rows.forEach((c) =>
        this.socket?.emit("conversation:join", { conversationId: c.id }),
      );
      latest.forEach((message) => {
        if (message.senderId !== this.state.currentUserId && message.receipt !== "read") {
          this.socket?.emit("message:delivered", { messageId: message.id });
          this.patchMessage(message.id, { receipt: "delivered" });
        }
      });
    }
  }
  private async reloadContacts() {
    const [contacts, requests, preferences] = await Promise.all([
      this.fetch<any>("/api/contacts"),
      this.fetch<any>("/api/friend-requests"),
      this.fetch<any>("/api/preferences"),
    ]);
    this.update({
      users: this.users(
        contacts.users,
        requests.users,
        preferences.blockedUsers || [],
      ),
      friendships: [...contacts.friendships, ...requests.friendships],
      preferences: { ...this.state.preferences, ...preferences },
    });
  }
  private async reloadStatus() {
    const value = await this.fetch<any>("/api/status");
    this.update({ users: this.users(value.users), statuses: value.statuses });
  }
  private async upload(attachment: Attachment, kind?: "avatar" | "status", onProgress?: (percent: number) => void) {
    onProgress?.(0);
    const mediaKind = kind || attachment.type;
    const signed = await this.fetch<any>("/api/media/upload-url", {
      method: "POST",
      body: JSON.stringify({
        kind: mediaKind,
        file_name: attachment.name,
        mime_type: attachment.mime,
        file_size: attachment.size,
      }),
    });
    const blob = await fetch(attachment.url).then((x) => x.blob());
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("PUT", signed.uploadUrl);
      Object.entries(signed.headers || {}).forEach(([name, value]) => request.setRequestHeader(name, String(value)));
      request.timeout = 45_000;
      request.upload.onprogress = event => {
        if (event.lengthComputable) onProgress?.(Math.max(1, Math.min(99, Math.round(event.loaded / event.total * 100))));
      };
      request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("The file upload failed."));
      request.onerror = () => reject(new Error("The file upload failed. Check your connection and retry."));
      request.ontimeout = () => reject(new Error("The file upload took too long. Retry when your connection is stable."));
      request.send(blob);
    });
    onProgress?.(100);
    return {
      object_key: signed.objectKey,
      file_name: attachment.name,
      mime_type: attachment.mime,
      file_size: attachment.size,
    };
  }
  async login(email: string, password: string) {
    this.started = true;
    if (this.refreshTask) await this.refreshTask;
    const result = await this.fetch<{ user: User; accessToken: string }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      false,
    );
    this.token = result.accessToken;
    this.update({
      sessionReady: true,
      currentUserId: result.user.id,
      users: this.users([result.user]),
    });
    await this.loadAll();
    return result.user;
  }
  async register(name: string, username: string, email: string, password: string) {
    this.started = true;
    if (this.refreshTask) await this.refreshTask;
    const result = await this.fetch<{ user: User; accessToken: string }>(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify({ display_name: name, username, email, password }),
      },
      false,
    );
    this.token = result.accessToken;
    this.update({
      sessionReady: true,
      currentUserId: result.user.id,
      users: this.users([result.user]),
    });
    await this.loadAll();
    return result.user;
  }
  async forgotPassword(email: string) {
    await this.fetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
  }

  async resetPassword(token: string, password: string) {
    await this.fetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) });
  }

  async enterDemo(): Promise<User> {

    throw new Error("Demo mode is disabled for real accounts.");
  }
  logout() {
    const socket = this.socket;
    this.socket = undefined;
    socket?.disconnect();
    void this.fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    this.token = null;
    this.loadedMessages.clear();
    this.messageCursors.clear();
    this.retries.clear();
    this.state = empty();
    this.update({ sessionReady: true });
  }
  async updateProfile(
    values: Partial<Pick<User, "name" | "username" | "about" | "avatar">>,
    onProgress?: (percent: number) => void,
  ) {
    const body: any = { display_name: values.name, username: values.username, about: values.about };
    if (values.avatar) {
      const blob = await fetch(values.avatar).then((x) => x.blob());
      const attachment: Attachment = {
        id: crypto.randomUUID(),
        name: "avatar.webp",
        type: "image",
        mime: blob.type || "image/webp",
        size: blob.size,
        url: values.avatar,
      };
      const uploaded = await this.upload(attachment, "avatar", onProgress);
      body.avatar_key = uploaded.object_key;
      body.avatar_mime = uploaded.mime_type;
      body.avatar_size = uploaded.file_size;
    }
    const user = await this.fetch<User>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    this.update({
      users: this.state.users.map((x) => (x.id === user.id ? { ...user, username: normalizeUsername(user.username) } : x)),
    });
  }
  async send(
    conversationId: string,
    text: string,
    attachment?: Attachment,
    replyTo?: string,
  ) {
    const temp = `temp-${crypto.randomUUID()}`;
    const optimistic: Message = {
      id: temp,
      conversationId,
      senderId: this.state.currentUserId!,
      text: text.trim(),
      attachment,
      replyTo,
      createdAt: new Date().toISOString(),
      receipt: "sending",
    };
    this.retries.set(temp, { conversationId, text, attachment, replyTo });
    this.update({ messages: [...this.state.messages, optimistic] });
    try {
      const uploaded = attachment ? await this.upload(attachment) : undefined;
      const canonical = await this.fetch<Message>(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            text,
            reply_to: replyTo,
            attachment: uploaded,
          }),
        },
      );
      this.retries.delete(temp);
      const merged = this.state.messages.map((x) =>
        x.id === temp ? canonical : x,
      );
      this.update({
        messages: merged.filter(
          (message, index) =>
            merged.findIndex((x) => x.id === message.id) === index,
        ),
      });
    } catch (error) {
      this.patchMessage(temp, { receipt: "failed" });
      throw error;
    }
  }
  async retry(id: string) {
    const pending = this.retries.get(id);
    if (!pending) return;
    this.update({ messages: this.state.messages.filter((x) => x.id !== id) });
    this.retries.delete(id);
    await this.send(
      pending.conversationId,
      pending.text,
      pending.attachment,
      pending.replyTo,
    );
  }
  async deleteMessage(id: string, everyone: boolean) {
    await this.fetch(`/api/messages/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ mode: everyone ? "everyone" : "me" }),
    });
    if (everyone)
      this.patchMessage(id, {
        text: "",
        attachment: undefined,
        replyTo: undefined,
        deleted: true,
      });
    else
      this.update({ messages: this.state.messages.filter((x) => x.id !== id) });
  }
  markRead(id: string) {
    this.patchConversation(id, { unread: 0 });
    void this.fetch(`/api/conversations/${id}/read`, { method: "POST" });
  }
  async toggleConversation(id: string, key: "muted" | "pinned") {
    const item = this.state.conversations.find((x) => x.id === id);
    if (!item) return;
    const value = !item[key];
    this.patchConversation(id, { [key]: value });
    try {
      await this.fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ [key]: value }),
      });
    } catch (error) {
      this.patchConversation(id, { [key]: !value });
      throw error;
    }
  }
  async getAccessUrl(attachmentId: string) {
    const data = await this.fetch<{ url: string }>(
      `/api/media/${attachmentId}/access`,
    );
    return data.url;
  }
  async loadMessages(conversationId: string) {
    if (this.loadedMessages.has(conversationId)) return Boolean(this.messageCursors.get(conversationId));
    this.loadedMessages.add(conversationId);
    try {
      const page = await this.fetch<{ messages: Message[]; nextCursor: string | null }>(
        `/api/conversations/${conversationId}/messages`,
      );
      const existing = this.state.messages.filter(
        (m) => m.conversationId !== conversationId,
      );
      this.messageCursors.set(conversationId, page.nextCursor);
      this.update({ messages: [...existing, ...page.messages] });
      
      if (this.socket?.connected) {
        page.messages.forEach((m) => {
          if (
            m.senderId !== this.state.currentUserId &&
            m.receipt !== "read" &&
            m.receipt !== "delivered"
          ) {
            this.socket?.emit("message:delivered", { messageId: m.id });
            this.patchMessage(m.id, { receipt: "delivered" });
          }
        });
      }
      return Boolean(page.nextCursor);
    } catch (error) {
      this.loadedMessages.delete(conversationId);
      throw error;
    }
  }
  async loadOlderMessages(conversationId: string) {
    const cursor = this.messageCursors.get(conversationId);
    if (!cursor) return false;
    const page = await this.fetch<{ messages: Message[]; nextCursor: string | null }>(
      `/api/conversations/${conversationId}/messages?before=${encodeURIComponent(cursor)}`,
    );
    this.messageCursors.set(conversationId, page.nextCursor);
    this.update({ messages: this.mergeMessages(page.messages) });
    return Boolean(page.nextCursor);
  }
  typing(conversationId: string, active: boolean) {
    this.socket?.emit(active ? "typing:start" : "typing:stop", {
      conversationId,
    });
  }
  async request(id: string) {
    await this.fetch("/api/friend-requests", {
      method: "POST",
      body: JSON.stringify({ user_id: id }),
    });
    await this.reloadContacts();
  }
  async respond(id: string, accept: boolean) {
    await this.fetch(`/api/friend-requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: accept ? "accept" : "decline" }),
    });
    await this.reloadContacts();
  }
  async remove(id: string) {
    await this.fetch(`/api/contacts/${id}`, { method: "DELETE" });
    await this.reloadContacts();
  }
  async openConversation(id: string) {
    const item = await this.fetch<Conversation>("/api/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ user_id: id }),
    });
    await this.reloadConversations();
    this.socket?.emit("conversation:join", { conversationId: item.id });
    return item.id;
  }
  async block(id: string) {
    const active = this.state.preferences.blocked.includes(id);
    await this.fetch(`/api/blocks/${id}`, {
      method: active ? "DELETE" : "POST",
    });
    await this.reloadContacts();
  }
  async publish(text: string, color: string, attachment?: Attachment, onProgress?: (percent: number) => void) {
    const uploaded = attachment
      ? await this.upload(attachment, "status", onProgress)
      : undefined;
    await this.fetch("/api/status", {
      method: "POST",
      body: JSON.stringify({ text, color, attachment: uploaded }),
    });
    await this.reloadStatus();
  }
  async view(id: string) {
    await this.fetch(`/api/status/${id}/view`, { method: "POST" });
    this.update({
      statuses: this.state.statuses.map((x) =>
        x.id === id && !x.viewedBy.includes(this.state.currentUserId!)
          ? { ...x, viewedBy: [...x.viewedBy, this.state.currentUserId!] }
          : x,
      ),
    });
  }
  async removeStatus(id: string) {
    await this.fetch(`/api/status/${id}`, { method: "DELETE" });
    this.update({ statuses: this.state.statuses.filter((x) => x.id !== id) });
  }
  async updatePreferences(values: Partial<Preferences>) {
    const previous = this.state.preferences;
    const preferences = { ...previous, ...values };
    this.update({ preferences });
    if (typeof window !== "undefined")
      localStorage.setItem(
        "syora:preferences",
        JSON.stringify({
          appearance: preferences.appearance,
          compact: preferences.compact,
          notifications: preferences.notifications,
          sound: preferences.sound,
        }),
      );
    const body: any = {};
    if (values.receipts !== undefined) body.read_receipts = values.receipts;
    if (values.lastSeen !== undefined)
      body.last_seen_visibility = values.lastSeen;
    if (values.photo !== undefined)
      body.profile_photo_visibility = values.photo;
    if (values.status !== undefined) body.status_visibility = values.status;
    try {
      if (Object.keys(body).length)
        await this.fetch("/api/preferences", {
          method: "PATCH",
          body: JSON.stringify(body),
        });
    } catch (error) {
      this.update({ preferences: previous });
      throw error;
    }
  }
  async searchUsers(query: string, signal?: AbortSignal) {
    if (!query.trim()) return [];
    const users = (await this.fetch<User[]>(
      `/api/people/search?q=${encodeURIComponent(query.trim())}&limit=20`,
      { signal },
    )).map(user => ({ ...user, username: normalizeUsername(user.username) }));
    this.update({ users: this.users(users) });
    return users;
  }
}
export const services: Services = new ApiServices();
