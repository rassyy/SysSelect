/**
 * T09 — Test mesin SAW (fungsi murni hitungSAW).
 * Jalankan: npm run test:t09
 *
 * Uji 1 (golden): normalisasi, terbobot, V, peringkat cocok golden_fixture.json
 *                 untuk 3 DM x 4 vendor, toleransi 1e-4.
 * Uji 2 (seri)  : data seri -> peringkat tetap UNIK 1..4, tie-break vendor_id ASC.
 *                 Golden fixture tidak punya seri, jadi bug RANK() hanya
 *                 ketahuan dari test ini.
 * Test ini murni (tanpa DB) — state database tidak diubah.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hitungSAW, type BarisMatriks, type KriteriaSaw } from "../lib/hitung/saw";

const TOL = 1e-4;

type FixtureDm = {
  raw: number[][];
  norm: number[][];
  weighted: number[][];
  V: number[];
  rank: number[];
};
type Fixture = {
  criteria: Array<{ code: string; weight: number; type: "benefit" | "cost" }>;
  per_dm: Record<string, FixtureDm>;
};

function dekat(actual: number, expected: number, label: string, tol = TOL) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: dapat ${actual}, harap ${expected} (tol ${tol})`,
  );
}

function matriksDariRaw(raw: number[][]): BarisMatriks[] {
  // vendorId 1..4 meniru urutan kode V1..V4 (ascending).
  return raw.map((nilai, i) => ({ vendorId: i + 1, nilai }));
}

function main() {
  console.log("Testing T09 mesin SAW (fungsi murni)...");

  const fixture = JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "golden_fixture.json"), "utf8"),
  ) as Fixture;

  const kriteria: KriteriaSaw[] = fixture.criteria.map((c, i) => ({
    id: i + 1,
    bobot: c.weight,
    tipe: c.type,
  }));

  // === Uji 1: golden fixture, 3 DM x 4 vendor x 5 kriteria ===
  for (const [dm, data] of Object.entries(fixture.per_dm)) {
    const hasil = hitungSAW(matriksDariRaw(data.raw), kriteria);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 5; j++) {
        dekat(hasil.normalisasi[i][j], data.norm[i][j], `${dm} norm V${i + 1} C${j + 1}`, 1e-9);
        dekat(hasil.terbobot[i][j], data.weighted[i][j], `${dm} terbobot V${i + 1} C${j + 1}`, 1e-9);
      }
      dekat(hasil.V[i], data.V[i], `${dm} V V${i + 1}`);
      assert.equal(hasil.peringkat[i], data.rank[i], `${dm} peringkat V${i + 1}`);
    }
    console.log(
      `  OK golden ${dm.padEnd(7)} V=[${hasil.V.map((v) => v.toFixed(6)).join(", ")}] peringkat=[${hasil.peringkat.join(",")}]`,
    );
  }

  // === Uji 2: data seri -> peringkat unik 1..4, tie-break vendor_id ASC ===
  const satuKriteria: KriteriaSaw[] = [{ id: 1, bobot: 100, tipe: "benefit" }];

  // 2a. Seri di puncak: V1 = V2. RANK() SQL memberi (1,1,3,4) — SALAH.
  {
    const hasil = hitungSAW(
      [
        { vendorId: 1, nilai: [80] },
        { vendorId: 2, nilai: [80] },
        { vendorId: 3, nilai: [60] },
        { vendorId: 4, nilai: [40] },
      ],
      satuKriteria,
    );
    assert.deepEqual(hasil.V, [100, 100, 75, 50]);
    assert.deepEqual(hasil.peringkat, [1, 2, 3, 4], "seri puncak: vendor_id ASC memenangkan tie");
    assert.equal(new Set(hasil.peringkat).size, 4, "peringkat harus unik");
    console.log("  OK seri 2a: seri puncak (80,80,60,40) -> peringkat [1,2,3,4] unik");
  }

  // 2b. Seri tengah + seri bawah: V2 = V3 dan V1 = V4.
  {
    const hasil = hitungSAW(
      [
        { vendorId: 1, nilai: [50] },
        { vendorId: 2, nilai: [90] },
        { vendorId: 3, nilai: [90] },
        { vendorId: 4, nilai: [50] },
      ],
      satuKriteria,
    );
    assert.deepEqual(hasil.peringkat, [3, 1, 2, 4]);
    assert.equal(new Set(hasil.peringkat).size, 4);
    console.log("  OK seri 2b: seri tengah+bawah (50,90,90,50) -> peringkat [3,1,2,4] unik");
  }

  // 2c. Semua seri: tie-break murni vendor_id ASC.
  {
    const hasil = hitungSAW(
      [
        { vendorId: 1, nilai: [70] },
        { vendorId: 2, nilai: [70] },
        { vendorId: 3, nilai: [70] },
        { vendorId: 4, nilai: [70] },
      ],
      satuKriteria,
    );
    assert.deepEqual(hasil.peringkat, [1, 2, 3, 4]);
    console.log("  OK seri 2c: semua seri -> peringkat [1,2,3,4] dari vendor_id ASC");
  }

  // 2d. Urutan matriks ACAK: tie-break ikut vendorId, bukan posisi array.
  {
    const hasil = hitungSAW(
      [
        { vendorId: 4, nilai: [70] },
        { vendorId: 2, nilai: [70] },
        { vendorId: 3, nilai: [70] },
        { vendorId: 1, nilai: [70] },
      ],
      satuKriteria,
    );
    assert.deepEqual(hasil.peringkat, [4, 2, 3, 1], "index mengikuti urutan matriks, rank ikut vendorId");
    console.log("  OK seri 2d: matriks acak [4,2,3,1] -> peringkat [4,2,3,1] (id ASC)");
  }

  // 2e. Seri pada kriteria cost: MIN/x = 1 untuk semua, tetap unik.
  {
    const hasil = hitungSAW(
      [
        { vendorId: 3, nilai: [500, 80] },
        { vendorId: 1, nilai: [500, 80] },
        { vendorId: 2, nilai: [500, 60] },
      ],
      [
        { id: 1, bobot: 50, tipe: "cost" },
        { id: 2, bobot: 50, tipe: "benefit" },
      ],
    );
    assert.deepEqual(hasil.V, [100, 100, 87.5]);
    assert.deepEqual(hasil.peringkat, [2, 1, 3], "seri cost: vendorId 1 sebelum vendorId 3");
    console.log("  OK seri 2e: seri cost -> peringkat unik, tie-break vendor_id ASC");
  }

  // 2f. Validasi input: nilai 0 ditolak (cost MIN/x tidak terdefinisi).
  {
    assert.throws(
      () => hitungSAW([{ vendorId: 1, nilai: [0] }], satuKriteria),
      /> 0/,
    );
    console.log("  OK validasi 2f: nilai 0 ditolak");
  }

  console.log("T09 test passed: golden 3 DM cocok (tol 1e-4) + 6 uji seri/validasi lolos.");
}

main();
