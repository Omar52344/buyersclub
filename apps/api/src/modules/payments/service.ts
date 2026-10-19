import { and, desc, eq } from 'drizzle-orm';
import type { PaymentEvidenceInput } from '@buyersclub/core';
import { db } from '../../db/index';
import {
  businesses,
  files,
  orderStatusEvents,
  orders,
  payments,
} from '../../db/schema';
import { AppError } from '../../errors';
import { getOrderDetail } from '../orders/service';

async function loadOrder(orderId: string) {
  const [row] = await db
    .select({
      id: orders.id,
      buyerUserId: orders.buyerUserId,
      businessOwnerUserId: businesses.ownerUserId,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      totalCents: orders.totalCents,
      currency: orders.currency,
    })
    .from(orders)
    .innerJoin(businesses, eq(orders.businessId, businesses.id))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) {
    throw new AppError('ORDER_NOT_FOUND', 'El pedido no existe.', 404);
  }
  return row;
}

async function loadPayment(paymentId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!payment) {
    throw new AppError('PAYMENT_NOT_FOUND', 'El pago no existe.', 404);
  }
  const order = await loadOrder(payment.orderId);
  return { payment, order };
}

export async function submitPaymentEvidence(
  userId: string,
  orderId: string,
  input: PaymentEvidenceInput,
) {
  const order = await loadOrder(orderId);
  if (order.buyerUserId !== userId) {
    throw new AppError('FORBIDDEN', 'Solo el comprador puede subir el comprobante.', 403);
  }
  if (order.status !== 'pending' && order.status !== 'awaiting_payment') {
    throw new AppError(
      'ORDER_STATE_INVALID',
      'El pedido ya no admite comprobantes de pago.',
      422,
    );
  }
  if (order.paymentStatus === 'validated') {
    throw new AppError('PAYMENT_ALREADY_VALIDATED', 'El pago ya está validado.', 409);
  }

  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.id, input.fileId), eq(files.ownerUserId, userId)))
    .limit(1);
  if (!file) {
    throw new AppError('FILE_NOT_FOUND', 'La imagen no existe o no es tuya.', 404);
  }

  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  await db.transaction(async (tx) => {
    if (existing) {
      await tx
        .update(payments)
        .set({
          evidenceFileId: input.fileId,
          evidenceNote: input.note ?? null,
          status: 'evidence_submitted',
          submittedAt: new Date(),
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, existing.id));
    } else {
      await tx.insert(payments).values({
        orderId,
        method: order.paymentMethod,
        amountCents: order.totalCents,
        currency: order.currency,
        status: 'evidence_submitted',
        evidenceFileId: input.fileId,
        evidenceNote: input.note ?? null,
        submittedAt: new Date(),
      });
    }

    await tx
      .update(orders)
      .set({ paymentStatus: 'evidence_submitted', updatedAt: new Date() })
      .where(eq(orders.id, orderId));
  });

  return getOrderDetail(userId, orderId);
}

export async function validatePayment(userId: string, paymentId: string) {
  const { payment, order } = await loadPayment(paymentId);
  if (order.businessOwnerUserId !== userId) {
    throw new AppError('FORBIDDEN', 'Solo el vendedor puede validar el pago.', 403);
  }
  if (payment.status === 'validated') {
    throw new AppError('PAYMENT_ALREADY_VALIDATED', 'El pago ya está validado.', 409);
  }
  if (!payment.evidenceFileId) {
    throw new AppError('PAYMENT_EVIDENCE_REQUIRED', 'Falta el comprobante de pago.', 422);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: 'validated',
        validatedByUserId: userId,
        validatedAt: new Date(),
        rejectionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    await tx
      .update(orders)
      .set({ paymentStatus: 'validated', updatedAt: new Date() })
      .where(eq(orders.id, order.id));

    if (order.status === 'awaiting_payment') {
      await tx
        .update(orders)
        .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      await tx.insert(orderStatusEvents).values({
        orderId: order.id,
        fromStatus: 'awaiting_payment',
        toStatus: 'accepted',
        actorUserId: userId,
        note: 'Pago validado',
      });
    }
  });

  return getOrderDetail(userId, order.id);
}

export async function rejectPayment(userId: string, paymentId: string, reason: string) {
  const { payment, order } = await loadPayment(paymentId);
  if (order.businessOwnerUserId !== userId) {
    throw new AppError('FORBIDDEN', 'Solo el vendedor puede rechazar el pago.', 403);
  }
  if (payment.status === 'validated') {
    throw new AppError('PAYMENT_ALREADY_VALIDATED', 'El pago ya está validado.', 409);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: 'rejected',
        rejectionReason: reason,
        validatedByUserId: userId,
        validatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    await tx
      .update(orders)
      .set({ paymentStatus: 'rejected', updatedAt: new Date() })
      .where(eq(orders.id, order.id));
  });

  return getOrderDetail(userId, order.id);
}
