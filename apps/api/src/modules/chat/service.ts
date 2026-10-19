import { and, desc, eq, lt, or } from 'drizzle-orm';
import { db } from '../../db/index';
import {
  branches,
  businesses,
  conversations,
  files,
  messages,
  orders,
} from '../../db/schema';
import { AppError } from '../../errors';
import { buildFileUrl } from '../../lib/file-token';

interface ConversationRow {
  id: string;
  orderId: string;
  orderCode: string;
  buyerUserId: string;
  buyerName: string | null;
  businessId: string;
  businessName: string;
  businessOwnerUserId: string;
  branchName: string;
  lastMessageAt: Date | null;
  buyerLastReadAt: Date | null;
  vendorLastReadAt: Date | null;
}

async function conversationAccess(
  userId: string,
  conversationId: string,
): Promise<{ row: ConversationRow; viewer: 'buyer' | 'vendor' }> {
  const [row] = await db
    .select({
      id: conversations.id,
      orderId: conversations.orderId,
      orderCode: orders.code,
      buyerUserId: conversations.buyerUserId,
      buyerName: orders.buyerName,
      businessId: conversations.businessId,
      businessName: businesses.name,
      businessOwnerUserId: businesses.ownerUserId,
      branchName: branches.name,
      lastMessageAt: conversations.lastMessageAt,
      buyerLastReadAt: conversations.buyerLastReadAt,
      vendorLastReadAt: conversations.vendorLastReadAt,
    })
    .from(conversations)
    .innerJoin(orders, eq(conversations.orderId, orders.id))
    .innerJoin(branches, eq(conversations.branchId, branches.id))
    .innerJoin(businesses, eq(conversations.businessId, businesses.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!row) {
    throw new AppError('CONVERSATION_NOT_FOUND', 'La conversación no existe.', 404);
  }

  if (row.buyerUserId === userId) {
    return { row: row as ConversationRow, viewer: 'buyer' };
  }
  if (row.businessOwnerUserId === userId) {
    return { row: row as ConversationRow, viewer: 'vendor' };
  }
  throw new AppError('FORBIDDEN', 'No tienes acceso a esta conversación.', 403);
}

async function messageDto(
  message: typeof messages.$inferSelect,
  userId: string,
) {
  return {
    id: message.id,
    body: message.body,
    fileId: message.fileId,
    fileUrl: message.fileId ? await buildFileUrl(message.fileId, userId) : null,
    senderUserId: message.senderUserId,
    mine: message.senderUserId === userId,
    createdAt: message.createdAt,
  };
}

export async function listConversations(userId: string) {
  const rows = await db
    .select({
      id: conversations.id,
      orderId: conversations.orderId,
      orderCode: orders.code,
      buyerUserId: conversations.buyerUserId,
      buyerName: orders.buyerName,
      businessName: businesses.name,
      businessOwnerUserId: businesses.ownerUserId,
      branchName: branches.name,
      lastMessageAt: conversations.lastMessageAt,
      buyerLastReadAt: conversations.buyerLastReadAt,
      vendorLastReadAt: conversations.vendorLastReadAt,
    })
    .from(conversations)
    .innerJoin(orders, eq(conversations.orderId, orders.id))
    .innerJoin(branches, eq(conversations.branchId, branches.id))
    .innerJoin(businesses, eq(conversations.businessId, businesses.id))
    .where(
      or(eq(conversations.buyerUserId, userId), eq(businesses.ownerUserId, userId)),
    )
    .orderBy(desc(conversations.lastMessageAt));

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const messageRows = await db
    .select()
    .from(messages)
    .where(or(...ids.map((id) => eq(messages.conversationId, id))))
    .orderBy(desc(messages.createdAt))
    .limit(1000);

  return rows.map((row) => {
    const viewer = row.buyerUserId === userId ? 'buyer' : 'vendor';
    const lastRead = viewer === 'buyer' ? row.buyerLastReadAt : row.vendorLastReadAt;
    const conversationMessages = messageRows.filter(
      (message) => message.conversationId === row.id,
    );
    const last = conversationMessages[0];
    const unread = conversationMessages.filter(
      (message) =>
        message.senderUserId !== userId &&
        (!lastRead || message.createdAt > lastRead),
    ).length;

    return {
      id: row.id,
      orderId: row.orderId,
      orderCode: row.orderCode,
      businessName: row.businessName,
      branchName: row.branchName,
      counterpartName: viewer === 'buyer' ? row.businessName : row.buyerName ?? 'Cliente',
      lastMessageAt: row.lastMessageAt,
      lastMessage: last
        ? {
            body: last.body,
            isImage: Boolean(last.fileId),
            createdAt: last.createdAt,
          }
        : null,
      unread,
      viewer,
    };
  });
}

export async function listMessages(
  userId: string,
  conversationId: string,
  before?: string,
  limit = 50,
) {
  await conversationAccess(userId, conversationId);

  const conditions = [eq(messages.conversationId, conversationId)];
  if (before) {
    conditions.push(lt(messages.createdAt, new Date(before)));
  }

  const rows = await db
    .select()
    .from(messages)
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  rows.reverse();
  return Promise.all(rows.map((message) => messageDto(message, userId)));
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  input: { body?: string; fileId?: string },
) {
  const { row } = await conversationAccess(userId, conversationId);

  const body = input.body?.trim() || null;
  if (!body && !input.fileId) {
    throw new AppError('MESSAGE_EMPTY', 'Escribe un mensaje o adjunta una imagen.', 422);
  }

  if (input.fileId) {
    const [file] = await db
      .select()
      .from(files)
      .where(and(eq(files.id, input.fileId), eq(files.ownerUserId, userId)))
      .limit(1);
    if (!file) {
      throw new AppError('FILE_NOT_FOUND', 'La imagen no existe o no es tuya.', 404);
    }
  }

  const [message] = await db
    .insert(messages)
    .values({
      conversationId,
      senderUserId: userId,
      body,
      fileId: input.fileId ?? null,
    })
    .returning();

  if (!message) {
    throw new AppError('MESSAGE_CREATE_FAILED', 'No pudimos enviar el mensaje.', 500);
  }

  await db
    .update(conversations)
    .set({ lastMessageAt: message.createdAt })
    .where(eq(conversations.id, row.id));

  return messageDto(message, userId);
}

export async function markRead(userId: string, conversationId: string) {
  const { row, viewer } = await conversationAccess(userId, conversationId);
  await db
    .update(conversations)
    .set(
      viewer === 'buyer'
        ? { buyerLastReadAt: new Date() }
        : { vendorLastReadAt: new Date() },
    )
    .where(eq(conversations.id, row.id));
  return { ok: true };
}
