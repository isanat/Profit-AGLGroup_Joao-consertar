import { db, auditLogsTable } from "@workspace/db";
import { Request } from "express";

export async function auditLog(opts: {
  userId?: number;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId?: number;
  ipAddress?: string;
  userAgent?: string;
  previousValue?: string;
  newValue?: string;
  req?: Request;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: opts.userId ?? null,
      userEmail: opts.userEmail ?? null,
      action: opts.action,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      ipAddress: opts.ipAddress ?? opts.req?.ip ?? null,
      userAgent: opts.userAgent ?? opts.req?.headers["user-agent"] ?? null,
      previousValue: opts.previousValue ?? null,
      newValue: opts.newValue ?? null,
    });
  } catch {
    // Non-fatal — never let audit failures break the main flow
  }
}
