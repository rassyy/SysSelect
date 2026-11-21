/**
 * T14 — Endpoint "Sahkan Keputusan". HANYA rank 3, HANYA fase konsensus.
 * Setelah sukses status 'sah' dan semua endpoint tulis sesi ini menolak.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiTolak, apiError, apiJson, isApiFailure, requireApiRank } from "@/lib/api";
import { sahkanKeputusan } from "@/lib/hitung/pengesahan";

export async function POST(request: NextRequest) {
  const guard = await requireApiRank(3, request);
  if (isApiFailure(guard)) return apiError(guard.status, guard.error);

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(404, "Belum ada sesi.");
  if (session.status !== "konsensus") {
    return apiError(
      409,
      session.status === "sah"
        ? "Sesi sudah disahkan. Seluruh data read-only."
        : "Pengesahan hanya bisa dilakukan pada fase konsensus.",
    );
  }

  try {
    const hasil = await sahkanKeputusan(session.id, guard.id);
    return apiJson({ ok: true, ...hasil });
  } catch (error) {
    if (error instanceof ApiTolak) return apiError(error.status, error.message);
    throw error;
  }
}
