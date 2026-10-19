import { randomBytes } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type {
  BranchCreateInput,
  BranchHoursUpdateInput,
  BranchUpdateInput,
  BusinessCreateInput,
  BusinessUpdateInput,
} from '@buyersclub/core';
import { db } from '../../db/index';
import {
  branchHourExceptions,
  branchHours,
  branchProducts,
  branches,
  businesses,
  categories,
  orders,
  products,
  userRoles,
} from '../../db/schema';
import { AppError } from '../../errors';
import { geocodeAddress } from '../../lib/geocode';

type BusinessRow = typeof businesses.$inferSelect;
type BranchRow = typeof branches.$inferSelect;

export function slugify(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return normalized || 'negocio';
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const [existing] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1);
    if (!existing) {
      return slug;
    }
    slug = `${base.slice(0, 40)}-${randomBytes(2).toString('hex')}`;
  }
  throw new AppError('SLUG_UNAVAILABLE', 'No pudimos generar la URL de la empresa.', 500);
}

export async function assertBusinessOwner(
  userId: string,
  businessId: string,
): Promise<BusinessRow> {
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) {
    throw new AppError('BUSINESS_NOT_FOUND', 'La empresa no existe.', 404);
  }
  if (business.ownerUserId !== userId) {
    throw new AppError('FORBIDDEN', 'No tienes acceso a esta empresa.', 403);
  }
  return business;
}

export async function assertBranchOwner(userId: string, branchId: string) {
  const [branch] = await db.select().from(branches).where(eq(branches.id, branchId)).limit(1);
  if (!branch) {
    throw new AppError('BRANCH_NOT_FOUND', 'La sucursal no existe.', 404);
  }
  const business = await assertBusinessOwner(userId, branch.businessId);
  return { branch, business };
}

export async function createBusiness(userId: string, input: BusinessCreateInput) {
  if (input.categoryId) {
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, input.categoryId))
      .limit(1);
    if (!category) {
      throw new AppError('CATEGORY_NOT_FOUND', 'La categoría no existe.', 404);
    }
  }

  const slug = await uniqueSlug(slugify(input.name));
  const [business] = await db
    .insert(businesses)
    .values({
      ownerUserId: userId,
      name: input.name.trim(),
      slug,
      description: input.description?.trim() || null,
      categoryId: input.categoryId ?? null,
      currency: input.currency,
      status: 'active',
    })
    .returning();

  if (!business) {
    throw new AppError('BUSINESS_CREATE_FAILED', 'No pudimos crear la empresa.', 500);
  }

  const [vendorRole] = await db
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, 'vendor_owner')))
    .limit(1);
  if (!vendorRole) {
    await db.insert(userRoles).values({ userId, role: 'vendor_owner' });
  }

  return business;
}

export async function listMyBusinesses(userId: string) {
  const rows = await db
    .select()
    .from(businesses)
    .where(eq(businesses.ownerUserId, userId))
    .orderBy(businesses.createdAt);

  const result = [];
  for (const business of rows) {
    const branchRows = await db
      .select({
        id: branches.id,
        name: branches.name,
        city: branches.city,
        addressLine: branches.addressLine,
        manualOpen: branches.manualOpen,
        status: branches.status,
        deliveryEnabled: branches.deliveryEnabled,
        pickupEnabled: branches.pickupEnabled,
        deliveryFeeCents: branches.deliveryFeeCents,
        minOrderCents: branches.minOrderCents,
      })
      .from(branches)
      .where(eq(branches.businessId, business.id));

    const [productCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.businessId, business.id));

    result.push({
      ...business,
      branches: branchRows,
      productCount: productCount?.count ?? 0,
    });
  }
  return result;
}

export async function updateBusiness(
  userId: string,
  businessId: string,
  input: BusinessUpdateInput,
) {
  const business = await assertBusinessOwner(userId, businessId);

  if (input.currency && input.currency !== business.currency) {
    const [orderCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.businessId, businessId));
    if ((orderCount?.count ?? 0) > 0) {
      throw new AppError(
        'CURRENCY_LOCKED',
        'No puedes cambiar la moneda porque ya existen pedidos.',
        409,
      );
    }
  }

  const patch: Partial<typeof businesses.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.currency !== undefined) patch.currency = input.currency;

  const [updated] = await db
    .update(businesses)
    .set(patch)
    .where(eq(businesses.id, businessId))
    .returning();
  return updated;
}

export async function createBranch(
  userId: string,
  businessId: string,
  input: BranchCreateInput,
) {
  await assertBusinessOwner(userId, businessId);

  let lat = input.lat;
  let lng = input.lng;
  if (lat === undefined || lng === undefined) {
    const coords = await geocodeAddress({
      addressLine: input.addressLine,
      city: input.city,
      country: input.country,
    });
    lat = coords.lat;
    lng = coords.lng;
  }

  const [branch] = await db
    .insert(branches)
    .values({
      businessId,
      name: input.name.trim(),
      phone: input.phone ?? null,
      addressLine: input.addressLine.trim(),
      city: input.city.trim(),
      region: input.region ?? null,
      country: input.country,
      lat,
      lng,
      timezone: input.timezone,
      pickupEnabled: input.pickupEnabled,
      deliveryEnabled: input.deliveryEnabled,
      deliveryFeeCents: input.deliveryFeeCents,
      minOrderCents: input.minOrderCents,
      prepTimeMinutes: input.prepTimeMinutes,
      deliveryEtaMinutes: input.deliveryEtaMinutes,
      status: 'active',
    })
    .returning();

  if (!branch) {
    throw new AppError('BRANCH_CREATE_FAILED', 'No pudimos crear la sucursal.', 500);
  }

  // Las sucursales nuevas heredan el catálogo compartido de la empresa.
  const sharedProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.businessId, businessId),
        eq(products.shareWithAllBranches, true),
        eq(products.isActive, true),
      ),
    );

  if (sharedProducts.length > 0) {
    await db
      .insert(branchProducts)
      .values(sharedProducts.map((product) => ({ branchId: branch.id, productId: product.id })))
      .onConflictDoNothing();
  }

  return branch;
}

export async function listBranches(userId: string, businessId: string) {
  await assertBusinessOwner(userId, businessId);
  return listBranchesInternal(businessId);
}

async function listBranchesInternal(businessId: string) {
  const rows = await db
    .select()
    .from(branches)
    .where(eq(branches.businessId, businessId))
    .orderBy(branches.createdAt);

  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const hours = await db
    .select()
    .from(branchHours)
    .where(inArray(branchHours.branchId, ids));
  const exceptions = await db
    .select()
    .from(branchHourExceptions)
    .where(inArray(branchHourExceptions.branchId, ids));

  return rows.map((branch) => ({
    ...branch,
    hours: hours.filter((hour) => hour.branchId === branch.id),
    exceptions: exceptions.filter((exception) => exception.branchId === branch.id),
  }));
}

export async function updateBranch(
  userId: string,
  branchId: string,
  input: BranchUpdateInput,
): Promise<BranchRow> {
  const { branch } = await assertBranchOwner(userId, branchId);

  const patch: Partial<typeof branches.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.addressLine !== undefined) patch.addressLine = input.addressLine.trim();
  if (input.city !== undefined) patch.city = input.city.trim();
  if (input.region !== undefined) patch.region = input.region;
  if (input.lat !== undefined) patch.lat = input.lat;
  if (input.lng !== undefined) patch.lng = input.lng;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.timezone !== undefined) patch.timezone = input.timezone;
  if (input.pickupEnabled !== undefined) patch.pickupEnabled = input.pickupEnabled;
  if (input.deliveryEnabled !== undefined) patch.deliveryEnabled = input.deliveryEnabled;
  if (input.deliveryFeeCents !== undefined) patch.deliveryFeeCents = input.deliveryFeeCents;
  if (input.minOrderCents !== undefined) patch.minOrderCents = input.minOrderCents;
  if (input.prepTimeMinutes !== undefined) patch.prepTimeMinutes = input.prepTimeMinutes;
  if (input.deliveryEtaMinutes !== undefined) patch.deliveryEtaMinutes = input.deliveryEtaMinutes;
  if (input.status !== undefined) patch.status = input.status;

  const [updated] = await db
    .update(branches)
    .set(patch)
    .where(eq(branches.id, branch.id))
    .returning();
  return updated ?? branch;
}

export async function setBranchHours(
  userId: string,
  branchId: string,
  input: BranchHoursUpdateInput,
) {
  const { branch } = await assertBranchOwner(userId, branchId);

  await db.transaction(async (tx) => {
    await tx.delete(branchHours).where(eq(branchHours.branchId, branchId));
    await tx
      .delete(branchHourExceptions)
      .where(eq(branchHourExceptions.branchId, branchId));

    if (input.ranges.length > 0) {
      await tx.insert(branchHours).values(
        input.ranges.map((range) => ({
          branchId,
          weekday: range.weekday,
          opensAt: range.opensAt,
          closesAt: range.closesAt,
          isClosed: false,
        })),
      );
    }

    if (input.exceptions.length > 0) {
      await tx.insert(branchHourExceptions).values(
        input.exceptions.map((exception) => ({
          branchId,
          date: exception.date,
          isClosed: exception.isClosed,
          opensAt: exception.opensAt ?? null,
          closesAt: exception.closesAt ?? null,
          note: exception.note ?? null,
        })),
      );
    }
  });

  return listBranchesInternal(branch.businessId);
}

export async function setBranchManualOpen(
  userId: string,
  branchId: string,
  manualOpen: boolean,
) {
  const { branch } = await assertBranchOwner(userId, branchId);
  const [updated] = await db
    .update(branches)
    .set({ manualOpen, updatedAt: new Date() })
    .where(eq(branches.id, branch.id))
    .returning();
  return updated;
}
