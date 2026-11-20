/**
 * T10 — Mesin Borda Count versi MODUL 7. Fungsi murni, tanpa I/O.
 *
 * Rumus (RANCANGAN.md 5, terverifikasi terhadap golden_fixture.json dan
 * file praktikum mahasiswa — BUKAN Borda textbook "jumlah DM per posisi"):
 *   grup[i][r] = SUM(skor_preferensi vendor i dari DM yang menaruhnya di rank r)
 *   poin[i]    = SUM_r ( grup[i][r] * bobot_borda[r] )
 *   nilai[i]   = poin[i] / SUM_i poin[i]
 *   bobot_borda[r] = n - r + 1   (n=4 -> 4,3,2,1)
 *
 * Invarian wajib: SUM(nilai) = 1 (toleransi 1e-8).
 * Peringkat akhir tie-break stabil: poin DESC, vendor_id ASC (unik 1..n).
 * Peringkat kembar ala RANK() merusak grup — lihat test seri T09/T10.
 */

/** Satu baris saw_results: skor preferensi + peringkat dari satu DM. */
export type BarisSaw = {
  userId: number;
  vendorId: number;
  skor: number;
  peringkat: number;
};

/** peringkat -> bobot Borda (mis. {1:4, 2:3, 3:2, 4:1}). */
export type BobotBorda = Record<number, number>;

export type HasilBorda = {
  /** [index vendor][peringkat-1] = jumlah skor preferensi pada posisi itu. */
  grup: number[][];
  poin: number[];
  nilai: number[];
  /** Peringkat akhir unik 1..n, index mengikuti urutan vendorIds. */
  peringkat: number[];
};

export function hitungBorda(
  saw: BarisSaw[],
  bobot: BobotBorda,
  vendorIds?: number[],
): HasilBorda {
  const ids =
    vendorIds ?? [...new Set(saw.map((r) => r.vendorId))].sort((a, b) => a - b);
  if (ids.length === 0) {
    throw new Error("hitungBorda: tidak ada vendor.");
  }
  const n = ids.length;
  const posisi = Array.from({ length: n }, (_, i) => i + 1);
  for (const r of posisi) {
    if (!Number.isFinite(bobot[r])) {
      throw new Error(`hitungBorda: bobot peringkat ${r} tidak ada.`);
    }
  }
  for (const row of saw) {
    if (!Number.isFinite(row.skor) || row.skor < 0) {
      throw new Error(`hitungBorda: skor vendor ${row.vendorId} tidak valid.`);
    }
    if (!posisi.includes(row.peringkat)) {
      throw new Error(
        `hitungBorda: peringkat ${row.peringkat} di luar 1..${n} (peringkat kembar?).`,
      );
    }
  }

  const idx = new Map(ids.map((id, i) => [id, i]));

  // Input rusak harus DITOLAK, bukan diam-diam dijumlahkan:
  // satu baris per (DM, vendor), dan peringkat tiap DM permutasi 1..n.
  const perDm = new Map<number, { vendors: Set<number>; ranks: number[] }>();
  for (const row of saw) {
    const i = idx.get(row.vendorId);
    if (i === undefined) {
      throw new Error(`hitungBorda: vendor ${row.vendorId} tidak dikenal.`);
    }
    const dm = perDm.get(row.userId) ?? { vendors: new Set<number>(), ranks: [] };
    if (dm.vendors.has(row.vendorId)) {
      throw new Error(`hitungBorda: baris duplikat DM ${row.userId} vendor ${row.vendorId}.`);
    }
    dm.vendors.add(row.vendorId);
    dm.ranks.push(row.peringkat);
    perDm.set(row.userId, dm);
  }
  for (const [userId, dm] of perDm) {
    if (dm.vendors.size !== n) {
      throw new Error(`hitungBorda: DM ${userId} hanya mencakup ${dm.vendors.size}/${n} vendor.`);
    }
    const urut = [...dm.ranks].sort((a, b) => a - b);
    if (urut.some((r, i) => r !== i + 1)) {
      throw new Error(`hitungBorda: peringkat DM ${userId} bukan permutasi unik 1..${n}.`);
    }
  }

  const grup: number[][] = ids.map(() => new Array<number>(n).fill(0));
  for (const row of saw) {
    grup[idx.get(row.vendorId)!][row.peringkat - 1] += row.skor;
  }

  const poin = grup.map((baris) =>
    baris.reduce((sum, g, r) => sum + g * bobot[r + 1], 0),
  );
  const total = poin.reduce((a, b) => a + b, 0);
  if (total <= 0) {
    throw new Error("hitungBorda: total poin nol, nilai tidak terdefinisi.");
  }
  const nilai = poin.map((p) => p / total);

  // Tie-break stabil: poin DESC, vendorId ASC.
  const urutan = ids
    .map((id, i) => ({ i, p: poin[i], vendorId: id }))
    .sort((a, b) => b.p - a.p || a.vendorId - b.vendorId);
  const peringkat = new Array<number>(n).fill(0);
  urutan.forEach((item, pos) => {
    peringkat[item.i] = pos + 1;
  });

  return { grup, poin, nilai, peringkat };
}
