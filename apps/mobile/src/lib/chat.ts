import { authedRequest } from './authed';

export interface ChatMessage {
  id: string;
  body: string | null;
  fileId: string | null;
  fileUrl: string | null;
  senderUserId: string;
  mine: boolean;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  orderId: string;
  orderCode: string;
  businessName: string;
  branchName: string;
  counterpartName: string;
  lastMessageAt: string | null;
  lastMessage: { body: string | null; isImage: boolean; createdAt: string } | null;
  unread: number;
  viewer: 'buyer' | 'vendor';
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await authedRequest<{ conversations: ConversationSummary[] }>(
    '/v1/conversations',
  );
  return response.conversations;
}

export async function listMessages(id: string): Promise<ChatMessage[]> {
  const response = await authedRequest<{ messages: ChatMessage[] }>(
    `/v1/conversations/${encodeURIComponent(id)}/messages?limit=100`,
  );
  return response.messages;
}

export async function sendMessage(
  id: string,
  input: { body?: string; fileId?: string },
): Promise<ChatMessage> {
  const response = await authedRequest<{ message: ChatMessage }>(
    `/v1/conversations/${encodeURIComponent(id)}/messages`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return response.message;
}

export async function markConversationRead(id: string): Promise<void> {
  await authedRequest(`/v1/conversations/${encodeURIComponent(id)}/read`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
