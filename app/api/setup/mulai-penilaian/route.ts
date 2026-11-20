/**
 * T06 — Transisi status setup -> penilaian. Eksklusif rank 3.
 * Divalidasi di server: 5 kriteria Σ=100, 4 vendor ada, status 'setup'.
 * Catat audit_log 'mulai_penilaian'.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  apiError,
  apiJson,
  isApiFailure,
  requireApiRank,
} from "@/lib/api";

export async function POST(request: NextRequest) {
  const guard = await requireApiRank(3, request);
  if (isApiFailure(guard)) return apiError(guard.status, guard.error);

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(409, "Belum ada sesi.");
  if (session.status !== "setup") {
    return apiError(409, "Sesi sudah tidak dalam status setup.");
  }

  // Validasi 5 kriteria dengan total bobot 100
  const criteria = await prisma.criteria.findMany();
  if (criteria.length !== 5) {
    return apiError(400, `Jumlah kriteria ${criteria.length}, harus tepat 5.`);
  }
  const sumBobot = criteria.reduce((sum, c) => sum + Number(c.bobot), 0);
  if (Math.round(sumBobot * 100) !== 10000) {
    return apiError(400, `Total bobot kriteria ${sumBobot}%, harus tepat 100%.`);
  }

  // Validasi tepat 4 vendor
  const vendorCount = await prisma.vendor.count();
  if (vendorCount !== 4) {
    return apiError(400, `Jumlah vendor ${vendorCount}, harus tepat 4 vendor.`);
  }

  const updatedSession = await prisma.session.update({
    where: { id: session.id },
    data: {
      status: "penilaian",
      openedBy: guard.id,
      openedAt: new Date(),
    },
  });

  await recordAudit(session.id, guard.id, "mulai_penilaian", {
    criteriaCount: criteria.length,
    vendorCount,
    openedAt: updatedSession.openedAt,
  });

  return apiJson({
    ok: true,
    status: updatedSession.status,
  });
}
