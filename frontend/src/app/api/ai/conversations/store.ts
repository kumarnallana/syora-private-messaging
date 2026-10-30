export interface AIConversationRecord {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
  last_draft?: string;
  last_recipient?: string;
  last_channel?: string;
}

export let inMemoryConversations: AIConversationRecord[] = [];
export const inMemoryMessages = new Map<string, any[]>();

export function deleteConversationFromStore(id: string) {
  inMemoryConversations = inMemoryConversations.filter((c) => c.id !== id);
  inMemoryMessages.delete(id);
}

export function clearAllConversationsFromStore() {
  inMemoryConversations = [];
  inMemoryMessages.clear();
}

export function addMessageToStore(conversationId: string, message: any) {
  const existing = inMemoryMessages.get(conversationId) || [];
  existing.push(message);
  inMemoryMessages.set(conversationId, existing);
}

export function updateConversationInStore(
  conversationId: string,
  updates: Partial<AIConversationRecord>
) {
  const conv = inMemoryConversations.find((c) => c.id === conversationId);
  if (conv) {
    Object.assign(conv, updates);
    conv.updated_at = new Date().toISOString();
  }
}

