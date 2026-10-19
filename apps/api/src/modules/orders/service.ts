import { randomBytes } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { canTransition, computeOpenStatus, type OrderStatus } from '@buyersclub/core';
import type { OrderCreateInput } from '@buyersclub/core';
import { db } from '../../db/index';
import {
  addresses,
  branchHourExceptions,
  branchHours,
  branchProducts,
  branches,
  businesses,
  conversations,
  orderItems,
  orderStatusEvents,
  orders,
  payments,
  products,
  users,
} from '../../db/schema';
import { AppError } from '../../errors';
import { assertBusinessOwner } from '../businesses/service';
import { buildFileUrl } from '../../lib/file-token';
import { notifyUser } from '../notifications/service';
import { publishToUser } from '../../lib/realtime';
import { recordAudit } from '../../lib/audit';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Recibido',
  awaiting_payment: 'Esperando pago',
  accepted: 'Aceptado',
  preparing: 'Preparando',
  ready: 'Listo para recoger',
  out_for_delivery: 'En camino',
  completed: 'Entregado',
  cancelled: 'Cancelado',
  rejected: 'Rechazado',
};

type Viewer = 'buyer' | 'vendor';

interface OrderBaseRow {
  id: string;
  code: string;
  buyerUserId: string;
  businessId: string;
  branchId: string;
  status: OrderStatus;
  paymentMethod: 'cash' | 'transfer' | 'card_terminal' | 'other';
  paymentStatus: 'pending' | 'evidence_submitted' | 'validated' | 'rejected' | 'refunded';
  fulfillment: 'delivery' | 'pickup';
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  currency: string;
  buyerName: string | null;
  buyerPhone: string | null;
  deliveryAddressSnapshot: unknown;
  notes: string | null;
  etaAt: Date | null;
  acceptedAt: Date | null;
  readyAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  branchName: string;
  branchAddress: string;
  branchCity: string;
  branchPhone: string | null;
  businessName: string;
  businessOwnerUserId: string;
}

async function loadOrder(orderId: string): Promise<OrderBaseRow> {
  const [row] = await db
    .select({
      id: orders.id,
      code: orders.code,
      buyerUserId: orders.buyerUserId,
      businessId: orders.businessId,
      branchId: orders.branchId,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      fulfillment: orders.fulfillment,
      subtotalCents: orders.subtotalCents,
      deliveryFeeCents: orders.deliveryFeeCents,
      totalCents: orders.totalCents,
      currency: orders.currency,
      buyerName: orders.buyerName,
      buyerPhone: orders.buyerPhone,
      deliveryAddressSnapshot: orders.deliveryAddressSnapshot,
      notes: orders.notes,
      etaAt: orders.etaAt,
      acceptedAt: orders.acceptedAt,
      readyAt: orders.readyAt,
      deliveredAt: orders.deliveredAt,
      cancelledAt: orders.cancelledAt,
      cancelReason: orders.cancelReason,
      createdAt: orders.createdAt,
      branchName: branches.name,
      branchAddress: branches.addressLine,
      branchCity: branches.city,
      branchPhone: branches.phone,
      businessName: businesses.name,
      businessOwnerUserId: businesses.ownerUserId,
    })
    .from(orders)
    .innerJoin(branches, eq(orders.branchId, branches.id))
    .innerJoin(businesses, eq(orders.businessId, businesses.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!row) {
    throw new AppError('ORDER_NOT_FOUND', 'El pedido no existe.', 404);
  }
  return row as OrderBaseRow;
}

function viewerFor(row: OrderBaseRow, userId: string): Viewer {
  if (row.buyerUserId === userId) {
    return 'buyer';
  }
  if (row.businessOwnerUserId === userId) {
    return 'vendor';
  }
  throw new AppError('FORBIDDEN', 'No tienes acceso a este pedido.', 403);
}

async function buildDetail(row: OrderBaseRow, viewer: Viewer, userId: string) {
  const [items, events, conversation, paymentRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, row.id)),
    db
      .select({
        status: orderStatusEvents.toStatus,
        note: orderStatusEvents.note,
        at: orderStatusEvents.createdAt,
        actorUserId: orderStatusEvents.actorUserId,
      })
      .from(orderStatusEvents)
      .where(eq(orderStatusEvents.orderId, row.id))
      .orderBy(orderStatusEvents.createdAt),
    db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.orderId, row.id))
      .limit(1),
    db
      .select()
      .from(payments)
      .where(eq(payments.orderId, row.id))
      .orderBy(desc(payments.createdAt))
      .limit(1),
  ]);

  const payment = paymentRows[0];

  return {
    id: row.id,
    code: row.code,
    status: row.status,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    fulfillment: row.fulfillment,
    subtotalCents: row.subtotalCents,
    deliveryFeeCents: row.deliveryFeeCents,
    totalCents: row.totalCents,
    currency: row.currency,
    notes: row.notes,
    buyerName: row.buyerName,
    buyerPhone: row.buyerPhone,
    deliveryAddress: row.deliveryAddressSnapshot,
    etaAt: row.etaAt,
    acceptedAt: row.acceptedAt,
    readyAt: row.readyAt,
    deliveredAt: row.deliveredAt,
    cancelledAt: row.cancelledAt,
    cancelReason: row.cancelReason,
    createdAt: row.createdAt,
    branch: {
      id: row.branchId,
      name: row.branchName,
      addressLine: row.branchAddress,
      city: row.branchCity,
      phone: row.branchPhone,
    },
    business: {
      id: row.businessId,
      name: row.businessName,
    },
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.nameSnapshot,
      unitPriceCents: item.unitPriceCents,
      qty: item.qty,
      lineTotalCents: item.lineTotalCents,
      notes: item.notes,
    })),
    events: events.map((event) => ({
      status: event.status,
      note: event.note,
      at: event.at,
    })),
    conversationId: conversation[0]?.id ?? null,
    payment: payment
      ? {
          id: payment.id,
          status: payment.status,
          amountCents: payment.amountCents,
          currency: payment.currency,
          evidenceFileId: payment.evidenceFileId,
          evidenceUrl: payment.evidenceFileId
            ? await buildFileUrl(payment.evidenceFileId, userId)
            : null,
          note: payment.evidenceNote,
          submittedAt: payment.submittedAt,
          validatedAt: payment.validatedAt,
          rejectionReason: payment.rejectionReason,
        }
      : null,
    canCancel:
      viewer === 'buyer' &&
      (row.status === 'pending' || row.status === 'awaiting_payment'),
    viewer,
  };
}

export async function getOrderDetail(userId: string, orderId: string) {
  const row = await loadOrder(orderId);
  const viewer = viewerFor(row, userId);
  return buildDetail(row, viewer, userId);
}

export interface OrderContact {
  name: string;
  phone: string;
}

export async function createOrder(
  buyerUserId: string,
  input: OrderCreateInput,
  contact?: OrderContact,
  options?: { skipConversation?: boolean },
) {
  const [branch] = await db
    .select({
      id: branches.id,
      businessId: branches.businessId,
      name: branches.name,
      status: branches.status,
      manualOpen: branches.manualOpen,
      deliveryEnabled: branches.deliveryEnabled,
      pickupEnabled: branches.pickupEnabled,
      deliveryFeeCents: branches.deliveryFeeCents,
      minOrderCents: branches.minOrderCents,
      prepTimeMinutes: branches.prepTimeMinutes,
      deliveryEtaMinutes: branches.deliveryEtaMinutes,
      timeZone: branches.timezone,
      currency: businesses.currency,
      businessStatus: businesses.status,
      businessOwnerUserId: businesses.ownerUserId,
    })
    .from(branches)
    .innerJoin(businesses, eq(branches.businessId, businesses.id))
    .where(eq(branches.id, input.branchId))
    .limit(1);

  if (!branch) {
    throw new AppError('BRANCH_NOT_FOUND', 'La sucursal no existe.', 404);
  }
  if (branch.status !== 'active' || branch.businessStatus !== 'active') {
    throw new AppError('BRANCH_UNAVAILABLE', 'La sucursal no está disponible.', 409);
  }
  if (input.fulfillment === 'delivery' && !branch.deliveryEnabled) {
    throw new AppError('FULFILLMENT_UNAVAILABLE', 'La sucursal no ofrece domicilio.', 422);
  }
  if (input.fulfillment === 'pickup' && !branch.pickupEnabled) {
    throw new AppError('FULFILLMENT_UNAVAILABLE', 'La sucursal no ofrece recogida.', 422);
  }

  const [hourRows, exceptionRows, buyer] = await Promise.all([
    db.select().from(branchHours).where(eq(branchHours.branchId, branch.id)),
    db
      .select()
      .from(branchHourExceptions)
      .where(eq(branchHourExceptions.branchId, branch.id)),
    db.select().from(users).where(eq(users.id, buyerUserId)).limit(1),
  ]);

  const openStatus = computeOpenStatus({
    at: new Date(),
    timeZone: branch.timeZone,
    status: branch.status,
    manualOpen: branch.manualOpen,
    hours: hourRows,
    exceptions: exceptionRows,
  });

  if (!openStatus.isOpen) {
    throw new AppError(
      'BRANCH_CLOSED',
      'La sucursal está cerrada en este momento.',
      409,
      { reason: openStatus.reason, localTime: openStatus.localTime },
    );
  }

  const buyerRow = buyer[0];
  if (!buyerRow) {
    throw new AppError('UNAUTHORIZED', 'Sesión no válida.', 401);
  }
  const buyerName = contact?.name ?? buyerRow.fullName ?? buyerRow.email;
  const buyerPhone = contact?.phone ?? buyerRow.phone;

  const quantities = new Map<string, number>();
  for (const item of input.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.qty);
  }

  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      priceCents: branchProducts.priceCents,
      basePriceCents: products.basePriceCents,
      stock: branchProducts.stock,
      isAvailable: branchProducts.isAvailable,
    })
    .from(branchProducts)
    .innerJoin(products, eq(branchProducts.productId, products.id))
    .where(
      and(
        eq(branchProducts.branchId, branch.id),
        inArray(products.id, Array.from(quantities.keys())),
        eq(products.isActive, true),
      ),
    );

  const byId = new Map(productRows.map((product) => [product.id, product]));

  for (const [productId, qty] of quantities) {
    const product = byId.get(productId);
    if (!product || !product.isAvailable) {
      throw new AppError(
        'PRODUCT_UNAVAILABLE',
        'Uno de los productos ya no está disponible.',
        422,
        { productId },
      );
    }
    if (product.stock !== null && product.stock < qty) {
      throw new AppError(
        'PRODUCT_OUT_OF_STOCK',
        `No hay suficiente stock de ${product.name}.`,
        422,
        { productId, available: product.stock },
      );
    }
  }

  const lines = input.items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) {
      throw new AppError('PRODUCT_UNAVAILABLE', 'Producto no disponible.', 422);
    }
    const unitPriceCents = product.priceCents ?? product.basePriceCents;
    return {
      productId: product.id,
      name: product.name,
      unitPriceCents,
      qty: item.qty,
      lineTotalCents: unitPriceCents * item.qty,
      notes: item.notes ?? null,
    };
  });

  const subtotalCents = lines.reduce((total, line) => total + line.lineTotalCents, 0);
  if (
    input.fulfillment === 'delivery' &&
    subtotalCents < branch.minOrderCents
  ) {
    throw new AppError(
      'MIN_ORDER_NOT_MET',
      'El pedido mínimo aplica solo a domicilio.',
      422,
      { minOrderCents: branch.minOrderCents, subtotalCents },
    );
  }

  const deliveryFeeCents =
    input.fulfillment === 'delivery' ? branch.deliveryFeeCents : 0;
  const totalCents = subtotalCents + deliveryFeeCents;

  if (
    input.clientTotalCents !== undefined &&
    input.clientTotalCents !== totalCents
  ) {
    throw new AppError('PRICE_CHANGED', 'Los precios cambiaron. Revisa el carrito.', 409, {
      subtotalCents,
      deliveryFeeCents,
      totalCents,
    });
  }

  const status: OrderStatus =
    input.paymentMethod === 'transfer' ? 'awaiting_payment' : 'pending';
  const code = `BC-${randomBytes(4).toString('hex').toUpperCase()}`;
  const etaAt = new Date(
    Date.now() +
      (branch.prepTimeMinutes +
        (input.fulfillment === 'delivery' ? branch.deliveryEtaMinutes : 0)) *
        60_000,
  );

  const orderId = await db.transaction(async (tx) => {
    let addressId: string | null = null;
    let snapshot: Record<string, unknown> | null = null;

    if (input.fulfillment === 'delivery') {
      if (input.addressId) {
        const [address] = await tx
          .select()
          .from(addresses)
          .where(and(eq(addresses.id, input.addressId), eq(addresses.userId, buyerUserId)))
          .limit(1);
        if (!address) {
          throw new AppError('ADDRESS_NOT_FOUND', 'La dirección no existe.', 404);
        }
        addressId = address.id;
        snapshot = {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          recipientName: address.recipientName,
          phone: address.phone,
          lat: address.lat,
          lng: address.lng,
        };
      } else if (input.deliveryAddress) {
        const address = input.deliveryAddress;
        const [created] = await tx
          .insert(addresses)
          .values({
            userId: buyerUserId,
            label: null,
            recipientName: address.recipientName ?? buyerName,
            phone: address.phone ?? buyerPhone,
            line1: address.line1,
            line2: address.line2 ?? null,
            city: address.city,
            lat: address.lat ?? null,
            lng: address.lng ?? null,
            isDefault: false,
          })
          .returning();
        addressId = created?.id ?? null;
        snapshot = {
          line1: address.line1,
          line2: address.line2 ?? null,
          city: address.city,
          recipientName: address.recipientName ?? buyerName,
          phone: address.phone ?? buyerPhone,
          notes: address.notes ?? null,
          lat: address.lat ?? null,
          lng: address.lng ?? null,
        };
      } else {
        throw new AppError(
          'ADDRESS_REQUIRED',
          'La entrega a domicilio requiere una dirección.',
          400,
        );
      }
    }

    const [order] = await tx
      .insert(orders)
      .values({
        code,
        buyerUserId,
        businessId: branch.businessId,
        branchId: branch.id,
        fulfillment: input.fulfillment,
        status,
        paymentMethod: input.paymentMethod,
        paymentStatus: 'pending',
        subtotalCents,
        deliveryFeeCents,
        discountCents: 0,
        totalCents,
        currency: branch.currency,
        buyerName,
        buyerPhone,
        deliveryAddressId: addressId,
        deliveryAddressSnapshot: snapshot,
        notes: input.notes ?? null,
        etaAt,
      })
      .returning();

    if (!order) {
      throw new AppError('ORDER_CREATE_FAILED', 'No pudimos crear el pedido.', 500);
    }

    await tx.insert(orderItems).values(
      lines.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        nameSnapshot: line.name,
        unitPriceCents: line.unitPriceCents,
        qty: line.qty,
        lineTotalCents: line.lineTotalCents,
        notes: line.notes,
      })),
    );

    await tx.insert(orderStatusEvents).values({
      orderId: order.id,
      fromStatus: null,
      toStatus: status,
      actorUserId: buyerUserId,
      note: 'Pedido creado',
    });

    if (!options?.skipConversation) {
      await tx
        .insert(conversations)
        .values({
          orderId: order.id,
          buyerUserId,
          businessId: branch.businessId,
          branchId: branch.id,
        })
        .onConflictDoNothing();
    }

    return order.id;
  });

  void notifyUser(branch.businessOwnerUserId, {
    type: 'order.new',
    title: 'Nuevo pedido',
    body: `${code} · ${input.fulfillment === 'delivery' ? 'Domicilio' : 'Recogida'} · ${totalCents / 100} ${branch.currency}`,
    data: { orderId, deeplink: '/vendor-orders' },
  });
  publishToUser(branch.businessOwnerUserId, {
    type: 'order.created',
    orderId,
    code,
  });
  await recordAudit({
    actorUserId: buyerUserId,
    businessId: branch.businessId,
    action: 'order.create',
    entityType: 'order',
    entityId: orderId,
    metadata: { totalCents, fulfillment: input.fulfillment },
  });

  return getOrderDetail(buyerUserId, orderId);
}

export async function listBuyerOrders(userId: string) {
  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      totalCents: orders.totalCents,
      currency: orders.currency,
      fulfillment: orders.fulfillment,
      createdAt: orders.createdAt,
      etaAt: orders.etaAt,
      branchName: branches.name,
      businessName: businesses.name,
    })
    .from(orders)
    .innerJoin(branches, eq(orders.branchId, branches.id))
    .innerJoin(businesses, eq(orders.businessId, businesses.id))
    .where(eq(orders.buyerUserId, userId))
    .orderBy(desc(orders.createdAt))
    .limit(100);

  const ids = rows.map((row) => row.id);
  const items = ids.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          name: orderItems.nameSnapshot,
          qty: orderItems.qty,
        })
        .from(orderItems)
        .where(inArray(orderItems.orderId, ids))
    : [];

  return rows.map((row) => {
    const rowItems = items.filter((item) => item.orderId === row.id);
    return {
      ...row,
      itemCount: rowItems.reduce((total, item) => total + item.qty, 0),
      firstItem: rowItems[0]?.name ?? null,
    };
  });
}

export async function listBusinessOrders(userId: string, businessId: string, status?: OrderStatus) {
  await assertBusinessOwner(userId, businessId);

  const rows = await db
    .select({
      id: orders.id,
      code: orders.code,
      status: orders.status,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      fulfillment: orders.fulfillment,
      totalCents: orders.totalCents,
      currency: orders.currency,
      buyerName: orders.buyerName,
      buyerPhone: orders.buyerPhone,
      deliveryAddressSnapshot: orders.deliveryAddressSnapshot,
      etaAt: orders.etaAt,
      createdAt: orders.createdAt,
      branchName: branches.name,
      conversationId: conversations.id,
    })
    .from(orders)
    .innerJoin(branches, eq(orders.branchId, branches.id))
    .leftJoin(conversations, eq(conversations.orderId, orders.id))
    .where(
      status
        ? and(eq(orders.businessId, businessId), eq(orders.status, status))
        : eq(orders.businessId, businessId),
    )
    .orderBy(desc(orders.createdAt))
    .limit(100);

  const ids = rows.map((row) => row.id);
  const [items, paymentRows] = await Promise.all([
    ids.length
      ? db
          .select({
            orderId: orderItems.orderId,
            name: orderItems.nameSnapshot,
            qty: orderItems.qty,
          })
          .from(orderItems)
          .where(inArray(orderItems.orderId, ids))
      : Promise.resolve([]),
    ids.length
      ? db
          .select()
          .from(payments)
          .where(inArray(payments.orderId, ids))
          .orderBy(desc(payments.createdAt))
      : Promise.resolve([]),
  ]);

  return Promise.all(
    rows.map(async (row) => {
      const payment = paymentRows.find((entry) => entry.orderId === row.id);
      return {
        ...row,
        items: items.filter((item) => item.orderId === row.id),
        payment: payment
          ? {
              id: payment.id,
              status: payment.status,
              evidenceFileId: payment.evidenceFileId,
              evidenceUrl: payment.evidenceFileId
                ? await buildFileUrl(payment.evidenceFileId, userId)
                : null,
              note: payment.evidenceNote,
              submittedAt: payment.submittedAt,
              rejectionReason: payment.rejectionReason,
            }
          : null,
      };
    }),
  );
}

export async function updateOrderStatus(
  userId: string,
  orderId: string,
  status: OrderStatus,
  note?: string,
) {
  const row = await loadOrder(orderId);
  if (row.businessOwnerUserId !== userId) {
    throw new AppError('FORBIDDEN', 'No puedes operar este pedido.', 403);
  }
  if (!canTransition(row.status, status, 'vendor')) {
    throw new AppError(
      'ORDER_STATE_INVALID',
      `No se puede pasar de ${row.status} a ${status}.`,
      422,
    );
  }
  if (
    status === 'accepted' &&
    row.paymentMethod === 'transfer' &&
    row.paymentStatus !== 'validated'
  ) {
    throw new AppError(
      'PAYMENT_NOT_VALIDATED',
      'Primero valida la evidencia de pago del pedido.',
      422,
    );
  }

  const patch: Partial<typeof orders.$inferInsert> = {
    status,
    updatedAt: new Date(),
  };
  if (status === 'accepted') patch.acceptedAt = new Date();
  if (status === 'ready') patch.readyAt = new Date();
  if (status === 'completed') patch.deliveredAt = new Date();
  if (status === 'rejected') patch.cancelReason = note ?? 'Rechazado por el vendedor';

  await db.transaction(async (tx) => {
    await tx.update(orders).set(patch).where(eq(orders.id, orderId));
    await tx.insert(orderStatusEvents).values({
      orderId,
      fromStatus: row.status,
      toStatus: status,
      actorUserId: userId,
      note: note ?? null,
    });
  });

  const detail = await getOrderDetail(userId, orderId);
  void notifyUser(row.buyerUserId, {
    type: 'order.status',
    title: `Pedido ${row.code}: ${STATUS_LABELS[status] ?? status}`,
    body: 'Tu pedido cambió de estado.',
    data: { orderId, deeplink: `/order?id=${orderId}` },
  });
  publishToUser(row.buyerUserId, {
    type: 'order.status_changed',
    orderId,
    status,
  });
  await recordAudit({
    actorUserId: userId,
    businessId: row.businessId,
    action: 'order.status',
    entityType: 'order',
    entityId: orderId,
    metadata: { from: row.status, to: status },
  });
  return detail;
}

export async function cancelOrder(userId: string, orderId: string, reason: string) {
  const row = await loadOrder(orderId);
  if (row.buyerUserId !== userId) {
    throw new AppError('FORBIDDEN', 'Solo el comprador puede cancelar.', 403);
  }
  if (row.status !== 'pending' && row.status !== 'awaiting_payment') {
    throw new AppError(
      'ORDER_STATE_INVALID',
      'El pedido ya no se puede cancelar.',
      422,
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
    await tx.insert(orderStatusEvents).values({
      orderId,
      fromStatus: row.status,
      toStatus: 'cancelled',
      actorUserId: userId,
      note: reason,
    });
  });

  const detail = await getOrderDetail(userId, orderId);
  void notifyUser(row.businessOwnerUserId, {
    type: 'order.cancelled',
    title: `Pedido ${row.code} cancelado`,
    body: reason,
    data: { orderId, deeplink: '/vendor-orders' },
  });
  publishToUser(row.businessOwnerUserId, {
    type: 'order.status_changed',
    orderId,
    status: 'cancelled',
  });
  await recordAudit({
    actorUserId: userId,
    businessId: row.businessId,
    action: 'order.cancel',
    entityType: 'order',
    entityId: orderId,
    metadata: { reason },
  });
  return detail;
}
