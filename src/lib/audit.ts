import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE' | 'IMPORT' | 'EXPORT'
export type AuditEntity = 'Region' | 'CameraRegion' | 'RegionBooth'

export interface AuditActor {
  id: string
  name?: string | null
}

export interface AuditInput {
  actor: AuditActor
  action: AuditAction
  entityType: AuditEntity
  entityId: string
  marketId?: string | null
  /** Free-form snapshot/diff, e.g. { before, after } or { added: [...] }. */
  metadata?: Prisma.InputJsonValue
}

/**
 * Append an entry to the audit trail. Best-effort: a logging failure must never
 * break the originating mutation, so errors are swallowed (and logged via Pino).
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actor.id,
        actorName: input.actor.name ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        marketId: input.marketId ?? null,
        metadata: input.metadata,
      },
    })
  } catch (err) {
    logger.error({ err, audit: { ...input, metadata: undefined } }, 'failed to write audit log')
  }
}
