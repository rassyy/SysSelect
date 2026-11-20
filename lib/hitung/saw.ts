/**
 * T09 — Mesin SAW (Simple Additive Weighting). Fungsi murni, tanpa I/O.
 *
 * Rumus (RANCANGAN.md 5, terverifikasi terhadap golden_fixture.json):
 *   Normalisasi DI DALAM matriks DM itu sendiri:
 *     benefit : r_ij = x_ij / MAX_i(x_ij kolom itu)
 *     cost    : r_ij = MIN_i(x_ij kolom itu) / x_ij
 *   V_i = SUM_j ( r_ij * bobot_j )          (bobot dalam persen, Σ=100)
 *
 * Peringkat WAJIB tie-break stabil: skor DESC, vendor_id ASC (peringkat unik
 * 1..n). RANK() SQL memberi peringkat kembar (1,1,3,4) dan MERUSAK Borda —
 * posisi peringkat yang kosong membuat bobot Borda tidak terpakai.
 */

export type KriteriaSaw = {
  id: number;
  /** Bobot persen (0..100). Total seluruh kriteria = 100. */
  bobot: number;
  tipe: "benefit" | "cost";
};

/** Satu baris matriks keputusan: nilai sejajar dengan urutan kriteria. */
export type BarisMatriks = {
  vendorId: number;
  nilai: number[];
};

export type HasilSaw = {
  /** [index vendor][index kriteria] */
  normalisasi: number[][];
  /** [index vendor][index kriteria] = normalisasi * bobot */
  terbobot: number[][];
  /** Skor preferensi per vendor, index mengikuti urutan matriks. */
  V: number[];
  /** Peringkat unik 1..n per vendor, index mengikuti urutan matriks. */
  peringkat: number[];
};

export function hitungSAW(
  matriks: BarisMatriks[],
  kriteria: KriteriaSaw[],
): HasilSaw {
  if (matriks.length === 0) {
    throw new Error("hitungSAW: matriks kosong.");
  }
  if (kriteria.length === 0) {
    throw new Error("hitungSAW: kriteria kosong.");
  }
  for (const k of kriteria) {
    if (!Number.isFinite(k.bobot) || k.bobot < 0) {
      throw new Error(`hitungSAW: bobot kriteria ${k.id} tidak valid.`);
    }
  }
  for (const baris of matriks) {
    if (baris.nilai.length !== kriteria.length) {
      throw new Error(
        `hitungSAW: vendor ${baris.vendorId} punya ${baris.nilai.length} nilai, harus ${kriteria.length}.`,
      );
    }
    for (const x of baris.nilai) {
      // cost memakai MIN/x — nol/negatif merusak normalisasi.
      if (!Number.isFinite(x) || x <= 0) {
        throw new Error(`hitungSAW: nilai vendor ${baris.vendorId} harus > 0.`);
      }
    }
  }

  const n = matriks.length;
  const m = kriteria.length;

  // Normalisasi per kolom, dihitung dalam matriks DM ini sendiri.
  const normalisasi: number[][] = matriks.map(() => new Array<number>(m).fill(0));
  for (let j = 0; j < m; j++) {
    const kolom = matriks.map((b) => b.nilai[j]);
    if (kriteria[j].tipe === "benefit") {
      const mx = Math.max(...kolom);
      for (let i = 0; i < n; i++) normalisasi[i][j] = kolom[i] / mx;
    } else {
      const mn = Math.min(...kolom);
      for (let i = 0; i < n; i++) normalisasi[i][j] = mn / kolom[i];
    }
  }

  const terbobot = normalisasi.map((baris) =>
    baris.map((r, j) => r * kriteria[j].bobot),
  );
  const V = terbobot.map((baris) => baris.reduce((a, b) => a + b, 0));

  // Tie-break stabil: V DESC, vendorId ASC. Bukan RANK() — peringkat unik 1..n.
  const urutan = matriks
    .map((baris, i) => ({ i, v: V[i], vendorId: baris.vendorId }))
    .sort((a, b) => b.v - a.v || a.vendorId - b.vendorId);
  const peringkat = new Array<number>(n).fill(0);
  urutan.forEach((item, posisi) => {
    peringkat[item.i] = posisi + 1;
  });

  return { normalisasi, terbobot, V, peringkat };
}
