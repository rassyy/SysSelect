/**
 * T08 — Submit penilaian (pernyataan final DM).
 * Server menolak bila 20 sel belum lengkap.
 * Setelah submit, assessments milik DM terkunci permanen.
 * Catat audit_log 'submit_penilaian'.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  ApiTolak,
  apiError,
  apiJson,
  isApiFailure,
  requireApiUser,
} from "@/lib/api";

export async function POST(request: NextRequest) {
  const user = await requireApiUser(request);
  if (isApiFailure(user)) return apiError(user.status, user.error);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lock same session row as PATCH and buka-konsensus.
      const [locked] = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM sessions ORDER BY id ASC LIMIT 1 FOR UPDATE`;
      if (!locked) throw new ApiTolak(404, "Belum ada sesi.");
      const session = await tx.session.findUniqueOrThrow({ where: { id: locked.id } });
      if (session.status !== "penilaian") {
        throw new ApiTolak(409, "Submit hanya bisa dilakukan pada fase penilaian.");
      }

      const existing = await tx.submission.findUnique({
        where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
      });
      if (existing) throw new ApiTolak(409, "Penilaian sudah disubmit sebelumnya.");

      const [vendorCount, criteriaCount, rows] = await Promise.all([
        tx.vendor.count(),
        tx.criteria.count(),
        tx.assessment.findMany({
          where: { sessionId: session.id, userId: user.id },
          select: { vendorId: true, criterionId: true },
        }),
      ]);
      const expected = vendorCount * criteriaCount;
      const filled = new Set(rows.map((r) => `${r.vendorId}:${r.criterionId}`)).size;
      if (filled < expected) {
        throw new ApiTolak(400, `Baru ${filled}/${expected} sel terisi. Lengkapi seluruh grid sebelum submit.`);
      }

      const submission = await tx.submission.create({
        data: { sessionId: session.id, userId: user.id },
      });
      await recordAudit(session.id, user.id, "submit_penilaian", {
        selTerisi: filled,
        submittedAt: submission.submittedAt,
      }, tx);
      const submittedCount = await tx.submission.count({ where: { sessionId: session.id } });
      return { submission, submittedCount };
    });

    return apiJson({
      ok: true,
      submittedAt: result.submission.submittedAt,
      submittedCount: result.submittedCount,
    });
  } catch (error) {
    if (error instanceof ApiTolak) return apiError(error.status, error.message);
    throw error;
  }
}
