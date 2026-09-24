export type Receipt = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export interface User { id: string; name: string; username: string; email: string; role?: 'admin' | 'user'; about: string; avatar?: string; color: string; online?: boolean; lastSeen?: string }
export interface Attachment { id: string; name: string; type: 'image' | 'video' | 'document'; mime: string; size: number; url: string }
export interface Message { id: string; conversationId: string; senderId: string; text: string; createdAt: string; receipt: Receipt; attachment?: Attachment; replyTo?: string; replyPreview?: Message; deleted?: boolean }
export interface Conversation { id: string; participants: string[]; unread: number; pinned?: boolean; muted?: boolean; typing?: boolean }
export interface Friendship { id: string; from: string; to: string; status: 'pending' | 'accepted' | 'declined' }
export interface StatusPost { id: string; userId: string; text: string; color: string; attachment?: Attachment; createdAt: string; expiresAt: string; viewedBy: string[] }
export interface Preferences { lastSeen: string; photo: string; status: string; receipts: boolean; notifications: boolean; sound: boolean; appearance: 'dark' | 'light' | 'system'; compact: boolean; blocked: string[] }
export interface AppState { sessionReady: boolean; sessionError?: string; connection: 'connecting' | 'online' | 'offline'; currentUserId: string | null; users: User[]; conversations: Conversation[]; messages: Message[]; friendships: Friendship[]; statuses: StatusPost[]; preferences: Preferences }
export interface AdminSignedInPerson { userId: string; displayName: string; username: string; totalSessionCount: number; activeSessionCount: number; lastSignedInAt: string; lastActiveAt: string; isCurrentUser: boolean; canRevoke: boolean }
export interface AdminMetrics { signedInUsers: number; previouslySignedInUsers: number; people: AdminSignedInPerson[] }
export interface AdminNotificationSettings { loginAlerts: boolean; messageAlerts: boolean; messagePreview: boolean; pushEnabled: boolean; pushSupported: boolean; publicKey?: string }
export interface AdminNotificationEvent { id: string; type: 'ADMIN_USER_LOGIN' | 'ADMIN_LOGIN_FAILED' | 'ADMIN_DIRECT_MESSAGE'; title: string; body: string; url: string; timestamp: string; conversationId?: string; senderName?: string }
