import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Rekam jejak aksi (audit_logs). Detail JSON opsional. */
export async function recordAudit(
  sessionId: number | null,
  userId: number,
  aksi: string,
  detail?: Prisma.InputJsonValue,
): Promise<void> {
  await prisma.auditLog.create({
    data: { sessionId, userId, aksi, detail: detail ?? undefined },
  });
}

