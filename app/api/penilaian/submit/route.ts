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
  apiError,
  apiJson,
  isApiFailure,
  requireApiUser,
} from "@/lib/api";

export async function POST(request: NextRequest) {
  const user = await requireApiUser(request);
  if (isApiFailure(user)) return apiError(user.status, user.error);

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(404, "Belum ada sesi.");
  if (session.status !== "penilaian") {
    return apiError(409, "Submit hanya bisa dilakukan pada fase penilaian.");
  }

  const existing = await prisma.submission.findUnique({
    where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
  });
  if (existing) {
    return apiError(409, "Penilaian sudah disubmit sebelumnya.");
  }

  // Grid 4 vendor x 5 kriteria = 20 sel wajib lengkap.
  // Hitung sel UNIK (vendor,criterion) — bukan jumlah baris — supaya
  // duplikat tidak bisa mengelabui guard kelengkapan.
  const vendorCount = await prisma.vendor.count();
  const criteriaCount = await prisma.criteria.count();
  const expected = vendorCount * criteriaCount;

  const rows = await prisma.assessment.findMany({
    where: { sessionId: session.id, userId: user.id },
    select: { vendorId: true, criterionId: true },
  });
  const filled = new Set(rows.map((r) => `${r.vendorId}:${r.criterionId}`)).size;
  if (filled < expected) {
    return apiError(400, `Baru ${filled}/${expected} sel terisi. Lengkapi seluruh grid sebelum submit.`);
  }

  const submission = await prisma.submission.create({
    data: { sessionId: session.id, userId: user.id },
  });

  await recordAudit(session.id, user.id, "submit_penilaian", {
    selTerisi: filled,
    submittedAt: submission.submittedAt,
  });

  const submittedCount = await prisma.submission.count({
    where: { sessionId: session.id },
  });

  return apiJson({
    ok: true,
    submittedAt: submission.submittedAt,
    submittedCount,
  });
}
