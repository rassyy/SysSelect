/**
 * T16 — Endpoint export Berita Acara PDF. Semua role (sama seperti /hasil).
 * Hanya saat fase konsensus atau sah.
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, isApiFailure, requireApiUser } from "@/lib/api";
import { getDataHasil } from "@/lib/hitung/rincian";
import { renderBeritaAcaraPdf } from "@/lib/pdf/berita-acara";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await requireApiUser(request);
  if (isApiFailure(user)) return apiError(user.status, user.error);

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(404, "Belum ada sesi.");
  if (session.status !== "konsensus" && session.status !== "sah") {
    return apiError(409, "Berita acara hanya tersedia setelah konsensus dibuka.");
  }

  const data = await getDataHasil(session.id);
  if (!data) return apiError(409, "Snapshot hasil Borda belum lengkap.");

  const pdf = await renderBeritaAcaraPdf(data, `${user.namaLengkap} (${user.jabatan})`);
  const namaFile = `berita-acara-sysselect-${data.status}.pdf`;
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${namaFile}"`,
      "Cache-Control": "no-store",
    },
  });
}
