import { db } from '../db/index';
import { auditLog } from '../db/schema';

export interface AuditInput {
  actorUserId?: string;
  businessId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** La auditoría nunca debe romper la operación principal. */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorUserId: input.actorUserId ?? null,
      businessId: input.businessId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
    });
  } catch (error) {
    console.error('[audit] no se pudo registrar la acción', error);
  }
}
