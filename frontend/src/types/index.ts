export type Receipt = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export interface User { id: string; name: string; email: string; about: string; avatar?: string; color: string; online?: boolean; lastSeen?: string }
export interface Attachment { id: string; name: string; type: 'image' | 'video' | 'document'; mime: string; size: number; url: string }
export interface Message { id: string; conversationId: string; senderId: string; text: string; createdAt: string; receipt: Receipt; attachment?: Attachment; replyTo?: string; replyPreview?: Message; deleted?: boolean }
export interface Conversation { id: string; participants: string[]; unread: number; pinned?: boolean; muted?: boolean; typing?: boolean }
export interface Friendship { id: string; from: string; to: string; status: 'pending' | 'accepted' | 'declined' }
export interface StatusPost { id: string; userId: string; text: string; color: string; attachment?: Attachment; createdAt: string; expiresAt: string; viewedBy: string[] }
export interface Preferences { lastSeen: string; photo: string; status: string; receipts: boolean; notifications: boolean; sound: boolean; appearance: 'dark' | 'light'; compact: boolean; blocked: string[] }
export interface AppState { sessionReady: boolean; currentUserId: string | null; users: User[]; conversations: Conversation[]; messages: Message[]; friendships: Friendship[]; statuses: StatusPost[]; preferences: Preferences }
