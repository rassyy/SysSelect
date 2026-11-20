/**
 * T07 & T08 — API Penilaian Individual & Guard Blind.
 * Fase penilaian: Nilai DM lain TIDAK BOLEH dikirim ke browser (BLIND GUARD).
 * Hanya mengembalikan nilai milik user yang login.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  apiError,
  apiJson,
  ApiTolak,
  isApiFailure,
  readJson,
  requireApiUser,
} from "@/lib/api";

export async function GET(request: NextRequest) {
  const user = await requireApiUser(request);
  if (isApiFailure(user)) return apiError(user.status, user.error);

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(404, "Belum ada sesi aktif.");

  const [criteria, vendors, allUsers, submissions] = await Promise.all([
    prisma.criteria.findMany({ orderBy: { urutan: "asc" } }),
    prisma.vendor.findMany({ orderBy: { kode: "asc" } }),
    prisma.user.findMany({ orderBy: { rankJabatan: "desc" } }),
    prisma.submission.findMany({ where: { sessionId: session.id } }),
  ]);

  const submittedUserIds = new Set(submissions.map((s) => s.userId));
  const isSubmitted = submittedUserIds.has(user.id);

  // BLIND GUARD:
  // Selama fase setup & penilaian, HANYA ambil nilai milik user yang sedang login.
  // Nilai DM lain sama sekali TIDAK BOLEH disertakan dalam payload database query.
  const isBlind = session.status === "setup" || session.status === "penilaian";

  const assessments = await prisma.assessment.findMany({
    where: {
      sessionId: session.id,
      ...(isBlind ? { userId: user.id } : {}),
    },
    select: {
      id: true,
      userId: true,
      vendorId: true,
      criterionId: true,
      nilai: true,
      alasan: true,
      updatedAt: true,
    },
  });

  // Informasi DM lain untuk panel tersegel (tanpa nilai!)
  const otherDms = allUsers
    .filter((u) => u.id !== user.id)
    .map((u) => ({
      id: u.id,
      username: u.username,
      namaLengkap: u.namaLengkap,
      jabatan: u.jabatan,
      rankJabatan: u.rankJabatan,
      submitted: submittedUserIds.has(u.id),
    }));

  return apiJson({
    status: session.status,
    sessionId: session.id,
    isSubmitted,
    submittedCount: submissions.length,
    criteria: criteria.map((c) => ({
      id: c.id,
      kode: c.kode,
      nama: c.nama,
      bobot: Number(c.bobot),
      tipe: c.tipe,
      satuan: c.satuan,
      urutan: c.urutan,
    })),
    vendors: vendors.map((v) => ({
      id: v.id,
      kode: v.kode,
      nama: v.nama,
      profil: v.profil,
    })),
    assessments: assessments.map((a) => ({
      id: a.id,
      userId: a.userId,
      vendorId: a.vendorId,
      criterionId: a.criterionId,
      nilai: Number(a.nilai),
      alasan: a.alasan,
    })),
    otherDms,
  });
}

/**
 * Autosave per sel atau alasan vendor.
 * Ditolak bila user sudah submit atau sesi bukan fase penilaian.
 */
export async function PATCH(request: NextRequest) {
  const user = await requireApiUser(request);
  if (isApiFailure(user)) return apiError(user.status, user.error);

  const body = (await readJson(request)) as {
    vendorId?: number;
    criterionId?: number;
    nilai?: number;
    alasan?: string;
  } | null;
  if (!body || typeof body !== "object") return apiError(400, "Body JSON tidak valid.");
  const { vendorId, criterionId, nilai, alasan } = body;
  if (typeof vendorId !== "number") return apiError(400, "vendorId wajib disertakan.");

  if (!(criterionId === undefined && typeof alasan === "string")) {
    if (typeof criterionId !== "number" || typeof nilai !== "number" || !Number.isFinite(nilai)) {
      return apiError(400, "criterionId dan nilai numerik valid wajib disertakan.");
    }
    if (nilai <= 0) return apiError(400, "Nilai harus lebih besar dari 0.");
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Same lock as submit and buka-konsensus: writes cannot pass a stale guard.
      const [session] = await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM sessions ORDER BY id ASC LIMIT 1 FOR UPDATE`;
      if (!session) throw new ApiTolak(404, "Belum ada sesi aktif.");
      const active = await tx.session.findUniqueOrThrow({ where: { id: session.id } });
      if (active.status !== "penilaian") {
        throw new ApiTolak(409, "Pengisian nilai hanya diperbolehkan pada fase penilaian.");
      }
      const submission = await tx.submission.findUnique({
        where: { sessionId_userId: { sessionId: active.id, userId: user.id } },
      });
      if (submission) throw new ApiTolak(403, "Penilaian sudah disubmit dan terkunci permanen.");

      // Update alasan vendor.
      if (criterionId === undefined && typeof alasan === "string") {
        await tx.assessment.updateMany({
          where: { sessionId: active.id, userId: user.id, vendorId },
          data: { alasan },
        });
        return { type: "alasan" as const };
      }

      // Update satu sel nilai.
      const criterion = await tx.criteria.findUnique({ where: { id: criterionId! } });
      if (!criterion) throw new ApiTolak(404, "Kriteria tidak ditemukan.");
      if (criterion.kode !== "C1" && (nilai! < 1 || nilai! > 100)) {
        throw new ApiTolak(400, `Nilai untuk kriteria ${criterion.kode} harus di antara 1 dan 100.`);
      }
      const assessment = await tx.assessment.upsert({
        where: {
          sessionId_userId_vendorId_criterionId: {
            sessionId: active.id,
            userId: user.id,
            vendorId,
            criterionId: criterionId!,
          },
        },
        create: {
          sessionId: active.id,
          userId: user.id,
          vendorId,
          criterionId: criterionId!,
          nilai: nilai!,
          alasan: alasan ?? null,
        },
        update: { nilai: nilai!, ...(alasan !== undefined ? { alasan } : {}) },
      });
      await recordAudit(active.id, user.id, "simpan_nilai", { vendorId, criterionId, nilai }, tx);
      return { type: "nilai" as const, assessment };
    });

    if (result.type === "alasan") return apiJson({ ok: true, type: "alasan" });
    return apiJson({
      ok: true,
      assessment: {
        id: result.assessment.id,
        vendorId: result.assessment.vendorId,
        criterionId: result.assessment.criterionId,
        nilai: Number(result.assessment.nilai),
        alasan: result.assessment.alasan,
      },
    });
  } catch (error) {
    if (error instanceof ApiTolak) return apiError(error.status, error.message);
    throw error;
  }
}
