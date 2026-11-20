/**
 * T10 — Orkestrasi buka konsensus: hitung SAW 3 DM, simpan saw_results (12),
 * hitung Borda versi modul, simpan borda_results (4), transisi penilaian ->
 * konsensus, audit 'buka_konsensus' + 'hitung_borda'. Semua dalam SATU
 * transaksi — guard status & 3/3 dicek ulang di dalam transaksi.
 *
 * Hasil adalah snapshot (RANCANGAN.md 1): tidak dihitung ulang setelah sah.
 */
import { prisma } from "@/lib/prisma";
import { hitungSAW, type BarisMatriks } from "@/lib/hitung/saw";
import { hitungBorda, type BarisSaw, type BobotBorda } from "@/lib/hitung/borda";

export class KonsensusError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type HasilKonsensus = {
  status: "konsensus";
  winnerVendorId: number;
  totalPoin: number;
  sawCount: number;
  bordaCount: number;
};

export async function hitungDanSimpanKonsensus(
  sessionId: number,
  actorId: number,
): Promise<HasilKonsensus> {
  return prisma.$transaction(async (tx) => {
    // Serialize against concurrent open requests and assessment PATCH/submit.
    // Lock same session row as those write paths before authoritative guards.
    await tx.$queryRaw<Array<{ id: number }>>`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUniqueOrThrow({ where: { id: sessionId } });
    if (session.status !== "penilaian") {
      throw new KonsensusError(409, "Buka konsensus hanya bisa dilakukan pada fase penilaian.");
    }
    const submitted = await tx.submission.count({ where: { sessionId } });
    if (submitted !== 3) {
      throw new KonsensusError(409, `Menunggu ${submitted}/3 penilaian. Konsensus butuh 3/3.`);
    }

    const [criteria, vendors, users, assessments, weightRows] = await Promise.all([
      tx.criteria.findMany({ orderBy: { urutan: "asc" } }),
      tx.vendor.findMany({ orderBy: { kode: "asc" } }),
      tx.user.findMany({ orderBy: { rankJabatan: "desc" } }),
      tx.assessment.findMany({ where: { sessionId } }),
      tx.bordaWeight.findMany({ where: { sessionId }, orderBy: { peringkat: "asc" } }),
    ]);

    const kriteria = criteria.map((c) => ({
      id: c.id,
      bobot: Number(c.bobot),
      tipe: c.tipe as "benefit" | "cost",
    }));
    const vendorIds = vendors.map((v) => v.id);
    const nilaiByKey = new Map(
      assessments.map((a) => [`${a.userId}:${a.vendorId}:${a.criterionId}`, Number(a.nilai)]),
    );

    // SAW per DM — normalisasi di dalam matriks DM itu sendiri.
    const sawRows: BarisSaw[] = [];
    for (const u of users) {
      const matriks: BarisMatriks[] = vendors.map((v) => ({
        vendorId: v.id,
        nilai: criteria.map((c) => {
          const x = nilaiByKey.get(`${u.id}:${v.id}:${c.id}`);
          if (x === undefined) {
            throw new KonsensusError(409, `Grid ${u.username} belum lengkap (${v.kode} ${c.kode} kosong).`);
          }
          return x;
        }),
      }));
      const hasil = hitungSAW(matriks, kriteria);
      // Kontrak presisi: skor SAW disimpan Decimal(12,6), jadi bulatkan
      // sebelum menentukan rank dan Borda. Snapshot tersimpan harus bisa
      // mereproduksi peringkat serta poin persis; ties pakai vendor_id ASC.
      const skorBulat = hasil.V.map((v) => Math.round(v * 1e6) / 1e6);
      const urutan = skorBulat
        .map((skor, i) => ({ skor, vendorId: vendors[i].id, i }))
        .sort((a, b) => b.skor - a.skor || a.vendorId - b.vendorId);
      const rankBulat = new Array<number>(vendors.length);
      urutan.forEach((row, pos) => { rankBulat[row.i] = pos + 1; });
      vendors.forEach((v, i) => {
        sawRows.push({
          userId: u.id,
          vendorId: v.id,
          skor: skorBulat[i],
          peringkat: rankBulat[i],
        });
      });
    }

    await tx.sawResult.deleteMany({ where: { sessionId } });
    await tx.sawResult.createMany({
      data: sawRows.map((r) => ({
        sessionId,
        userId: r.userId,
        vendorId: r.vendorId,
        skorPreferensi: r.skor,
        peringkat: r.peringkat,
      })),
    });

    // Bobot Borda n - r + 1. Seed sudah mengisi; buat bila belum ada.
    let weights = weightRows;
    if (weights.length === 0) {
      const n = vendors.length;
      await tx.bordaWeight.createMany({
        data: Array.from({ length: n }, (_, i) => ({
          sessionId,
          peringkat: i + 1,
          bobot: n - i,
        })),
      });
      weights = await tx.bordaWeight.findMany({ where: { sessionId }, orderBy: { peringkat: "asc" } });
    }
    const bobot: BobotBorda = {};
    for (const w of weights) bobot[w.peringkat] = w.bobot;

    const borda = hitungBorda(sawRows, bobot, vendorIds);
    const totalPoin = borda.poin.reduce((a, b) => a + b, 0);

    await tx.bordaResult.deleteMany({ where: { sessionId } });
    await tx.bordaResult.createMany({
      data: vendorIds.map((vid, i) => ({
        sessionId,
        vendorId: vid,
        poinBorda: borda.poin[i],
        nilaiBorda: borda.nilai[i],
        peringkatAkhir: borda.peringkat[i],
      })),
    });

    const winnerVendorId = vendorIds[borda.peringkat.indexOf(1)];
    await tx.session.update({
      where: { id: sessionId },
      data: { status: "konsensus", winnerVendorId },
    });

    await tx.auditLog.create({
      data: {
        sessionId,
        userId: actorId,
        aksi: "buka_konsensus",
        detail: { submittedCount: submitted, winnerVendorId },
      },
    });
    await tx.auditLog.create({
      data: {
        sessionId,
        userId: actorId,
        aksi: "hitung_borda",
        detail: {
          sawRows: sawRows.length,
          bordaRows: vendorIds.length,
          totalPoin,
          sumNilai: borda.nilai.reduce((a, b) => a + b, 0),
          winnerVendorId,
        },
      },
    });

    return {
      status: "konsensus",
      winnerVendorId,
      totalPoin,
      sawCount: sawRows.length,
      bordaCount: vendorIds.length,
    };
  }, { timeout: 15000 });
}
