/**
 * T06 — Transisi status setup -> penilaian. Eksklusif rank 3.
 * Divalidasi di server: 5 kriteria Σ=100, 4 vendor ada, status 'setup'.
 * Catat audit_log 'mulai_penilaian'.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  ApiTolak,
  apiError,
  apiJson,
  isApiFailure,
  requireApiRank,
} from "@/lib/api";

export async function POST(request: NextRequest) {
  const guard = await requireApiRank(3, request);
  if (isApiFailure(guard)) return apiError(guard.status, guard.error);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM sessions ORDER BY id ASC LIMIT 1 FOR UPDATE`;
      if (!locked) throw new ApiTolak(409, "Belum ada sesi.");
      const session = await tx.session.findUniqueOrThrow({ where: { id: locked.id } });
      if (session.status !== "setup") throw new ApiTolak(409, "Sesi sudah tidak dalam status setup.");

      const criteria = await tx.criteria.findMany();
      if (criteria.length !== 5) throw new ApiTolak(400, `Jumlah kriteria ${criteria.length}, harus tepat 5.`);
      const sumBobot = criteria.reduce((sum, c) => sum + Number(c.bobot), 0);
      if (Math.round(sumBobot * 100) !== 10000) {
        throw new ApiTolak(400, `Total bobot kriteria ${sumBobot}%, harus tepat 100%.`);
      }

      const vendorCount = await tx.vendor.count();
      if (vendorCount !== 4) throw new ApiTolak(400, `Jumlah vendor ${vendorCount}, harus tepat 4 vendor.`);
      const updatedSession = await tx.session.update({
        where: { id: session.id },
        data: { status: "penilaian", openedBy: guard.id, openedAt: new Date() },
      });
      await recordAudit(session.id, guard.id, "mulai_penilaian", {
        criteriaCount: criteria.length,
        vendorCount,
        openedAt: updatedSession.openedAt,
      }, tx);
      return updatedSession;
    });
    return apiJson({ ok: true, status: result.status });
  } catch (error) {
    if (error instanceof ApiTolak) return apiError(error.status, error.message);
    throw error;
  }
}
