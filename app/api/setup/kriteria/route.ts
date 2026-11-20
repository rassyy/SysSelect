/**
 * T05 — Simpan bobot kriteria. Eksklusif rank 3, hanya fase setup.
 * Validasi SUM(bobot) = 100 di SERVER (application layer, bukan CHECK MySQL).
 */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import {
  apiError,
  apiJson,
  isApiFailure,
  readJson,
  requireApiRank,
} from "@/lib/api";

type BobotInput = { kode: string; bobot: number };

function parseBody(body: unknown): BobotInput[] | string {
  if (typeof body !== "object" || body === null) return "Body JSON tidak valid.";
  const list = (body as { kriteria?: unknown }).kriteria;
  if (!Array.isArray(list) || list.length !== 5) {
    return "Harus mengirim tepat 5 kriteria.";
  }
  const parsed: BobotInput[] = [];
  for (const item of list) {
    if (typeof item !== "object" || item === null) return "Baris kriteria tidak valid.";
    const { kode, bobot } = item as { kode?: unknown; bobot?: unknown };
    if (typeof kode !== "string" || typeof bobot !== "number" || !Number.isFinite(bobot)) {
      return "kode harus string dan bobot harus angka.";
    }
    if (bobot <= 0 || bobot > 100) return `Bobot ${kode} harus di antara 0 dan 100.`;
    parsed.push({ kode, bobot });
  }
  return parsed;
}

export async function PUT(request: NextRequest) {
  const guard = await requireApiRank(3, request);
  if (isApiFailure(guard)) return apiError(guard.status, guard.error);

  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return apiError(409, "Belum ada sesi.");
  if (session.status !== "setup") {
    return apiError(409, "Kriteria hanya bisa diubah saat fase setup.");
  }

  const parsed = parseBody(await readJson(request));
  if (typeof parsed === "string") return apiError(400, parsed);

  // Validasi ulang di server: total bobot wajib tepat 100.
  const total = parsed.reduce((sum, item) => sum + item.bobot, 0);
  if (Math.round(total * 100) !== 10000) {
    return apiError(400, `Total bobot ${total}, harus 100.`);
  }

  const criteria = await prisma.criteria.findMany({ orderBy: { urutan: "asc" } });
  const byKode = new Map(criteria.map((c) => [c.kode, c]));
  for (const item of parsed) {
    if (!byKode.has(item.kode)) return apiError(400, `Kriteria ${item.kode} tidak dikenal.`);
  }

  await prisma.$transaction(
    parsed.map((item) =>
      prisma.criteria.update({
        where: { kode: item.kode },
        data: { bobot: item.bobot, updatedBy: guard.id },
      }),
    ),
  );

  await recordAudit(session.id, guard.id, "simpan_kriteria", {
    bobot: Object.fromEntries(parsed.map((p) => [p.kode, p.bobot])),
    total,
  });

  const updated = await prisma.criteria.findMany({ orderBy: { urutan: "asc" } });
  return apiJson({
    kriteria: updated.map((c) => ({
      kode: c.kode,
      nama: c.nama,
      bobot: Number(c.bobot),
      tipe: c.tipe,
      satuan: c.satuan,
      urutan: c.urutan,
    })),
  });
}
