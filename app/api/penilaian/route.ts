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

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(404, "Belum ada sesi.");
  if (session.status !== "penilaian") {
    return apiError(409, "Pengisian nilai hanya diperbolehkan pada fase penilaian.");
  }

  // GUARD SUBMISSION: tolak tulis bila user sudah submit
  const existingSubmission = await prisma.submission.findUnique({
    where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
  });
  if (existingSubmission) {
    return apiError(403, "Penilaian sudah disubmit dan terkunci permanen.");
  }

  const body = (await readJson(request)) as {
    vendorId?: number;
    criterionId?: number;
    nilai?: number;
    alasan?: string;
  } | null;

  if (!body || typeof body !== "object") {
    return apiError(400, "Body JSON tidak valid.");
  }

  const { vendorId, criterionId, nilai, alasan } = body;

  if (typeof vendorId !== "number") {
    return apiError(400, "vendorId wajib disertakan.");
  }

  // Kasus 1: Update alasan per vendor
  if (criterionId === undefined && typeof alasan === "string") {
    // Update kolom alasan pada seluruh assessment vendor ini untuk user ini
    await prisma.assessment.updateMany({
      where: { sessionId: session.id, userId: user.id, vendorId },
      data: { alasan },
    });
    return apiJson({ ok: true, type: "alasan" });
  }

  // Kasus 2: Update sel nilai (dan opsional alasan)
  if (typeof criterionId !== "number" || typeof nilai !== "number" || !Number.isFinite(nilai)) {
    return apiError(400, "criterionId dan nilai numerik valid wajib disertakan.");
  }

  if (nilai <= 0) {
    return apiError(400, "Nilai harus lebih besar dari 0.");
  }

  // Validasi criterion C2..C5 biasanya skor 1..100
  const criterion = await prisma.criteria.findUnique({ where: { id: criterionId } });
  if (!criterion) return apiError(404, "Kriteria tidak ditemukan.");

  if (criterion.kode !== "C1" && (nilai < 1 || nilai > 100)) {
    return apiError(400, `Nilai untuk kriteria ${criterion.kode} harus di antara 1 dan 100.`);
  }

  const assessment = await prisma.assessment.upsert({
    where: {
      sessionId_userId_vendorId_criterionId: {
        sessionId: session.id,
        userId: user.id,
        vendorId,
        criterionId,
      },
    },
    create: {
      sessionId: session.id,
      userId: user.id,
      vendorId,
      criterionId,
      nilai,
      alasan: alasan ?? null,
    },
    update: {
      nilai,
      ...(alasan !== undefined ? { alasan } : {}),
    },
  });

  await recordAudit(session.id, user.id, "simpan_nilai", {
    vendorId,
    criterionId,
    nilai,
  });

  return apiJson({
    ok: true,
    assessment: {
      id: assessment.id,
      vendorId: assessment.vendorId,
      criterionId: assessment.criterionId,
      nilai: Number(assessment.nilai),
      alasan: assessment.alasan,
    },
  });
}
