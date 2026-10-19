import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { GuestOrderCreateInput } from '@buyersclub/core';
import { db } from '../../db/index';
import {
  branches,
  businesses,
  guestOrderThrottles,
  users,
} from '../../db/schema';
import { AppError } from '../../errors';
import { config } from '../../config';
import { getPublicBranch } from '../discovery/service';
import { createOrder } from '../orders/service';

async function resolveBranch(token: string) {
  const [row] = await db
    .select({
      id: branches.id,
      name: branches.name,
      status: branches.status,
      businessStatus: businesses.status,
    })
    .from(branches)
    .innerJoin(businesses, eq(branches.businessId, businesses.id))
    .where(eq(branches.qrToken, token))
    .limit(1);

  if (!row || row.status !== 'active' || row.businessStatus !== 'active') {
    throw new AppError(
      'QR_NOT_FOUND',
      'Este código QR no está activo o la sucursal no está disponible.',
      404,
    );
  }
  return row;
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+57${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('57')) {
    return `+${digits}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  throw new AppError(
    'INVALID_PHONE',
    'El celular debe tener al menos 10 dígitos.',
    400,
  );
}

function guestEmail(hash: string): string {
  return `guest-${hash.slice(0, 24)}@guest.buyersclub.local`;
}

function guestSyntheticPhone(hash: string): string {
  const digits = hash
    .replace(/[a-f]/g, (char) => (Number.parseInt(char, 16) % 10).toString())
    .slice(0, 11);
  return `+000${digits}`;
}

async function findOrCreateGuest(name: string, phoneHash: string) {
  const email = guestEmail(phoneHash);
  const [created] = await db
    .insert(users)
    .values({
      email,
      phone: guestSyntheticPhone(phoneHash),
      fullName: name,
      status: 'active',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      phoneVerificationMethod: 'qr_guest',
      locale: 'es',
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  const guest =
    created ??
    (
      await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
    )[0];

  if (!guest) {
    throw new AppError('GUEST_CREATE_FAILED', 'No pudimos preparar el pedido.', 500);
  }

  await db
    .update(users)
    .set({ fullName: name, updatedAt: new Date() })
    .where(eq(users.id, guest.id));

  return guest;
}

async function enforceGuestThrottle(branchId: string, phoneHash: string) {
  const result = await db.execute(sql`
    insert into guest_order_throttles (branch_id, phone_hash, last_order_at)
    values (${branchId}, ${phoneHash}, now())
    on conflict (branch_id, phone_hash) do update
      set last_order_at = now()
      where guest_order_throttles.last_order_at <= now() - interval '60 seconds'
    returning last_order_at
  `);

  if (result.length > 0) {
    return;
  }

  const [existing] = await db
    .select({ lastOrderAt: guestOrderThrottles.lastOrderAt })
    .from(guestOrderThrottles)
    .where(
      sql`${guestOrderThrottles.branchId} = ${branchId} and ${guestOrderThrottles.phoneHash} = ${phoneHash}`,
    )
    .limit(1);

  const elapsed = existing
    ? Math.floor((Date.now() - existing.lastOrderAt.getTime()) / 1000)
    : 0;
  const retryAfterSeconds = Math.max(1, 60 - elapsed);

  throw new AppError(
    'GUEST_RATE_LIMIT',
    `Espera ${retryAfterSeconds} segundos antes de volver a pedir desde este QR.`,
    429,
    { retryAfterSeconds },
  );
}

export async function getGuestBranch(token: string) {
  const row = await resolveBranch(token);
  const branch = await getPublicBranch(row.id);
  const baseUrl = config.PUBLIC_APP_URL.replace(/\/$/, '');

  return {
    branch,
    link: {
      token,
      webUrl: `${baseUrl}/qr?token=${encodeURIComponent(token)}`,
      appUrl: `buyersclub://qr?token=${encodeURIComponent(token)}`,
    },
  };
}

export async function createGuestOrder(
  token: string,
  input: GuestOrderCreateInput,
) {
  const row = await resolveBranch(token);
  const branch = await getPublicBranch(row.id);

  if (!branch.isOpen) {
    throw new AppError(
      'BRANCH_CLOSED',
      'La sucursal está cerrada en este momento.',
      409,
    );
  }
  if (input.fulfillment === 'pickup' && !branch.fulfillment.pickup) {
    throw new AppError(
      'FULFILLMENT_UNAVAILABLE',
      'La sucursal no ofrece recogida.',
      422,
    );
  }
  if (input.fulfillment === 'delivery' && !branch.fulfillment.delivery) {
    throw new AppError(
      'FULFILLMENT_UNAVAILABLE',
      'La sucursal no ofrece domicilio.',
      422,
    );
  }

  const available = new Set(branch.products.map((product) => product.id));
  if (input.items.some((item) => !available.has(item.productId))) {
    throw new AppError(
      'PRODUCT_UNAVAILABLE',
      'Uno de los productos ya no está disponible.',
      422,
    );
  }

  const phone = normalizePhone(input.phone);
  const name = input.name.trim();
  const phoneHash = createHash('sha256')
    .update(`${row.id}:${phone}`)
    .digest('hex');

  await enforceGuestThrottle(row.id, phoneHash);
  const guest = await findOrCreateGuest(name, phoneHash);

  const deliveryAddress =
    input.fulfillment === 'delivery' && input.deliveryAddress
      ? {
          ...input.deliveryAddress,
          recipientName: input.deliveryAddress.recipientName ?? name,
          phone: input.deliveryAddress.phone ?? phone,
        }
      : undefined;

  const detail = await createOrder(
    guest.id,
    {
      branchId: row.id,
      fulfillment: input.fulfillment,
      paymentMethod: input.paymentMethod,
      items: input.items,
      notes: input.notes,
      deliveryAddress,
    },
    { name, phone },
    { skipConversation: true },
  );

  return {
    order: {
      id: detail.id,
      code: detail.code,
      status: detail.status,
      paymentMethod: detail.paymentMethod,
      paymentStatus: detail.paymentStatus,
      fulfillment: detail.fulfillment,
      subtotalCents: detail.subtotalCents,
      deliveryFeeCents: detail.deliveryFeeCents,
      totalCents: detail.totalCents,
      currency: detail.currency,
      notes: detail.notes,
      etaAt: detail.etaAt,
      createdAt: detail.createdAt,
      branch: detail.branch,
      business: detail.business,
      items: detail.items,
    },
    customer: { name, phone },
  };
}
