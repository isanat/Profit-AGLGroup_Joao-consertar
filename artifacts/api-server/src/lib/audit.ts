import { db, auditLogsTable } from "@workspace/db";
import { Request } from "express";

/** Extrai o IP real do usuário, considerando proxies (Traefik/Caddy) */
function getClientIp(req?: Request): string | null {
  if (!req) return null;
  // x-forwarded-for: "client-ip, proxy1-ip, proxy2-ip" — pegar o primeiro
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return xff[0].trim();
  }
  // x-real-ip (alguns proxies)
  const xri = req.headers["x-real-ip"];
  if (typeof xri === "string") return xri.trim();
  // Fallback para req.ip (com trust proxy habilitado)
  return req.ip ?? null;
}

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
      ipAddress: opts.ipAddress ?? getClientIp(opts.req),
      userAgent: opts.userAgent ?? opts.req?.headers["user-agent"] ?? null,
      previousValue: opts.previousValue ?? null,
      newValue: opts.newValue ?? null,
    });
  } catch {
    // Non-fatal — never let audit failures break the main flow
  }
}
