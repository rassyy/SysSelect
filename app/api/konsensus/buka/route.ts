/**
 * T10 — "Buka Konsensus": transisi penilaian -> konsensus.
 * Guard SERVER: hanya rank 3, hanya fase penilaian, hanya COUNT(submissions)=3.
 * Menghitung SAW (12 baris) + Borda modul (4 baris) dalam satu transaksi,
 * lalu audit 'buka_konsensus' dan 'hitung_borda'.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, apiJson, isApiFailure, requireApiRank } from "@/lib/api";
import { hitungDanSimpanKonsensus, KonsensusError } from "@/lib/hitung/konsensus";

export async function POST(request: NextRequest) {
  const guard = await requireApiRank(3, request);
  if (isApiFailure(guard)) return apiError(guard.status, guard.error);

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(404, "Belum ada sesi.");
  if (session.status !== "penilaian") {
    return apiError(409, "Buka konsensus hanya bisa dilakukan pada fase penilaian.");
  }

  const submitted = await prisma.submission.count({ where: { sessionId: session.id } });
  if (submitted !== 3) {
    return apiError(409, `Menunggu ${submitted}/3 penilaian. Konsensus butuh 3/3.`);
  }

  try {
    const hasil = await hitungDanSimpanKonsensus(session.id, guard.id);
    return apiJson({ ok: true, ...hasil });
  } catch (e) {
    if (e instanceof KonsensusError) return apiError(e.status, e.message);
    throw e;
  }
}
