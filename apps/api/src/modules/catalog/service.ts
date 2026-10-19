import { and, eq, inArray } from 'drizzle-orm';
import type {
  BranchProductsBulkInput,
  ProductBranchesUpdateInput,
  ProductCreateInput,
  ProductUpdateInput,
} from '@buyersclub/core';
import { db } from '../../db/index';
import {
  branchProducts,
  branches,
  categories,
  products,
} from '../../db/schema';
import { AppError } from '../../errors';
import { assertBranchOwner, assertBusinessOwner } from '../businesses/service';

type ProductRow = typeof products.$inferSelect;

export async function listCategories() {
  return db.select().from(categories).orderBy(categories.sortOrder, categories.name);
}

async function getOwnedProduct(userId: string, productId: string): Promise<ProductRow> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!product) {
    throw new AppError('PRODUCT_NOT_FOUND', 'El producto no existe.', 404);
  }
  await assertBusinessOwner(userId, product.businessId);
  return product;
}

export async function createProduct(userId: string, input: ProductCreateInput) {
  const business = await assertBusinessOwner(userId, input.businessId);

  const [product] = await db
    .insert(products)
    .values({
      businessId: input.businessId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      categoryId: input.categoryId ?? null,
      basePriceCents: input.basePriceCents,
      currency: business.currency,
      imageFileId: input.imageFileId ?? null,
      shareWithAllBranches: input.shareWithAllBranches,
      isActive: true,
    })
    .returning();

  if (!product) {
    throw new AppError('PRODUCT_CREATE_FAILED', 'No pudimos crear el producto.', 500);
  }

  let branchIds: string[] = [];
  if (input.shareWithAllBranches) {
    const rows = await db
      .select({ id: branches.id })
      .from(branches)
      .where(eq(branches.businessId, input.businessId));
    branchIds = rows.map((row) => row.id);
  } else if (input.branchIds?.length) {
    const rows = await db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(eq(branches.businessId, input.businessId), inArray(branches.id, input.branchIds)),
      );
    if (rows.length !== input.branchIds.length) {
      throw new AppError(
        'BRANCH_NOT_FOUND',
        'Alguna sucursal no pertenece a tu empresa.',
        400,
      );
    }
    branchIds = rows.map((row) => row.id);
  }

  if (branchIds.length > 0) {
    await db
      .insert(branchProducts)
      .values(branchIds.map((branchId) => ({ branchId, productId: product.id })))
      .onConflictDoNothing();
  }

  return product;
}

export async function listProducts(userId: string, businessId: string) {
  await assertBusinessOwner(userId, businessId);

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.businessId, businessId))
    .orderBy(products.createdAt);

  const links = await db
    .select({
      branchId: branchProducts.branchId,
      productId: branchProducts.productId,
      priceCents: branchProducts.priceCents,
      stock: branchProducts.stock,
      isAvailable: branchProducts.isAvailable,
      branchName: branches.name,
    })
    .from(branchProducts)
    .innerJoin(branches, eq(branchProducts.branchId, branches.id))
    .where(eq(branches.businessId, businessId));

  return rows.map((product) => ({
    ...product,
    branches: links
      .filter((link) => link.productId === product.id)
      .map((link) => ({
        branchId: link.branchId,
        branchName: link.branchName,
        priceCents: link.priceCents,
        stock: link.stock,
        isAvailable: link.isAvailable,
      })),
  }));
}

export async function updateProduct(
  userId: string,
  productId: string,
  input: ProductUpdateInput,
) {
  await getOwnedProduct(userId, productId);

  const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
  if (input.basePriceCents !== undefined) patch.basePriceCents = input.basePriceCents;
  if (input.imageFileId !== undefined) patch.imageFileId = input.imageFileId;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.shareWithAllBranches !== undefined) {
    patch.shareWithAllBranches = input.shareWithAllBranches;
  }

  const [updated] = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, productId))
    .returning();
  return updated;
}

export async function setProductBranches(
  userId: string,
  productId: string,
  input: ProductBranchesUpdateInput,
) {
  const product = await getOwnedProduct(userId, productId);

  const businessBranches = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.businessId, product.businessId));
  const allowed = new Set(businessBranches.map((branch) => branch.id));

  for (const item of input.branches) {
    if (!allowed.has(item.branchId)) {
      throw new AppError(
        'BRANCH_NOT_FOUND',
        'Alguna sucursal no pertenece a tu empresa.',
        400,
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(branchProducts).where(eq(branchProducts.productId, productId));
    if (input.branches.length > 0) {
      await tx.insert(branchProducts).values(
        input.branches.map((item) => ({
          branchId: item.branchId,
          productId,
          priceCents: item.priceCents ?? null,
          stock: item.stock ?? null,
          isAvailable: item.isAvailable,
        })),
      );
    }
    await tx
      .update(products)
      .set({ shareWithAllBranches: false, updatedAt: new Date() })
      .where(eq(products.id, productId));
  });

  return listProducts(userId, product.businessId);
}

export async function bulkSetBranchProducts(
  userId: string,
  branchId: string,
  input: BranchProductsBulkInput,
) {
  const { branch } = await assertBranchOwner(userId, branchId);
  const productIds = [...new Set(input.productIds)];

  const ownedProducts = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.businessId, branch.businessId),
        inArray(products.id, productIds),
      ),
    );

  if (ownedProducts.length !== productIds.length) {
    throw new AppError(
      'PRODUCT_NOT_FOUND',
      'Algún producto no pertenece a tu empresa.',
      400,
    );
  }

  await db
    .insert(branchProducts)
    .values(
      productIds.map((productId) => ({
        branchId,
        productId,
        isAvailable: input.isAvailable,
      })),
    )
    .onConflictDoUpdate({
      target: [branchProducts.branchId, branchProducts.productId],
      set: { isAvailable: input.isAvailable },
    });

  if (!input.isAvailable) {
    await db
      .update(products)
      .set({ shareWithAllBranches: false, updatedAt: new Date() })
      .where(inArray(products.id, productIds));
  }

  return { updated: productIds.length };
}

export async function listBranchProducts(userId: string, branchId: string) {
  const { branch } = await assertBranchOwner(userId, branchId);

  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      description: products.description,
      imageFileId: products.imageFileId,
      basePriceCents: products.basePriceCents,
      currency: products.currency,
      priceCents: branchProducts.priceCents,
      stock: branchProducts.stock,
      isAvailable: branchProducts.isAvailable,
    })
    .from(branchProducts)
    .innerJoin(products, eq(branchProducts.productId, products.id))
    .where(and(eq(branchProducts.branchId, branch.id), eq(products.isActive, true)));

  return rows.map((row) => ({
    ...row,
    effectivePriceCents: row.priceCents ?? row.basePriceCents,
  }));
}
