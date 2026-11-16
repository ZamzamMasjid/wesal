import { and, desc, eq, lt } from "drizzle-orm";

import type { Database } from "@/db/client";
import { auditLog, staffUser } from "@/db/schema";
import type { Clock } from "@/lib/clock";

// The audit helper (auth architecture, "Audit"). Every staff action that changes
// a booking or a setting calls recordAudit; rows are append-only (the database
// refuses UPDATE and DELETE).

/** Accepts the database or a transaction, so an audit row can commit with its change. */
type Executor = Pick<Database, "insert">;

export interface AuditEntry {
  actorId: string;
  /** A dotted verb, e.g. "staff.create". */
  action: string;
  target?: string;
  bookingId?: number;
  detail?: Record<string, unknown>;
}

export async function recordAudit(
  executor: Executor,
  clock: Clock,
  entry: AuditEntry,
): Promise<void> {
  await executor.insert(auditLog).values({
    actorId: entry.actorId,
    action: entry.action,
    target: entry.target ?? null,
    bookingId: entry.bookingId ?? null,
    detail: entry.detail ?? null,
    at: clock.now(),
  });
}

export interface AuditQuery {
  bookingId?: number;
  /** Return entries older than this id (for paging). */
  before?: number;
  limit: number;
}

export async function listAudit(db: Database, query: AuditQuery) {
  const conditions = [];
  if (query.bookingId !== undefined) {
    conditions.push(eq(auditLog.bookingId, query.bookingId));
  }
  if (query.before !== undefined) {
    conditions.push(lt(auditLog.id, query.before));
  }
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      target: auditLog.target,
      bookingId: auditLog.bookingId,
      detail: auditLog.detail,
      at: auditLog.at,
      actorId: auditLog.actorId,
      actorName: staffUser.name,
    })
    .from(auditLog)
    .innerJoin(staffUser, eq(staffUser.id, auditLog.actorId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.id))
    .limit(query.limit);
  return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
}
