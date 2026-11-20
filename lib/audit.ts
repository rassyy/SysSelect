import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Rekam jejak aksi (audit_logs). Detail JSON opsional.
 * `client` opsional: pakai klien transaksi yang sama bila audit harus
 * atomik dengan tulisannya (rollback bersama saat guard menolak).
 */
export async function recordAudit(
  sessionId: number | null,
  userId: number,
  aksi: string,
  detail?: Prisma.InputJsonValue,
  client: PrismaClient | Prisma.TransactionClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: { sessionId, userId, aksi, detail: detail ?? undefined },
  });
}
