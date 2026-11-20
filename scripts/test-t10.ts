/**
 * T10 — Test mesin Borda + endpoint Buka Konsensus.
 * Jalankan: npm run test:t10
 *
 * Uji murni:
 *   1. Borda golden: grup/poin/nilai/rank cocok golden_fixture.json (tol 1e-4),
 *      SUM(nilai)=1 (tol 1e-8), pemenang V3.
 *   2. Borda seri: SAW seri -> peringkat stabil -> total poin BENAR.
 *      RANK() kembar membuat bobot peringkat 2 tak terpakai (total salah).
 * Uji endpoint (handler langsung, lapisan server):
 *   3. rank < 3 ditolak 403.
 *   4. 2 submissions -> ditolak 409 (server, bukan cuma UI).
 *   5. 3 submissions -> 200: saw_results 12 baris + borda_results 4 baris
 *      cocok fixture, status konsensus, audit buka_konsensus + hitung_borda.
 *   6. Setelah konsensus: GET penilaian sebagai finance memuat nilai SEMUA DM
 *      (blind dibuka sesuai status), PATCH tetap ditolak.
 * DB dipulihkan ke setup + 60 sel fixture di akhir.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { signSession } from "../lib/session-token";
import { hitungSAW } from "../lib/hitung/saw";
import { hitungBorda, type BarisSaw } from "../lib/hitung/borda";
import { POST as bukaKonsensus } from "../app/api/konsensus/buka/route";
import { POST as submitPenilaian } from "../app/api/penilaian/submit/route";
import { POST as mulaiPenilaian } from "../app/api/setup/mulai-penilaian/route";
import { GET as getPenilaian, PATCH as patchNilai } from "../app/api/penilaian/route";

const COOKIE = "sysselect_session";
const TOL = 1e-4;

type Fixture = {
  per_dm: Record<string, { raw: number[][]; V: number[]; rank: number[] }>;
  borda_modul: {
    grup: Record<string, Record<string, number>>;
    poin: number[];
    total: number;
    nilai: number[];
    winner: string;
  };
};

function req(url: string, token: string, init?: { method?: string; body?: unknown }) {
  const headers: Record<string, string> = { cookie: `${COOKIE}=${token}` };
  if (init?.body !== undefined) headers["Content-Type"] = "application/json";
  return new NextRequest(url, {
    method: init?.method ?? "GET",
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

function dekat(actual: number, expected: number, label: string, tol = TOL) {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label}: dapat ${actual}, harap ${expected} (tol ${tol})`,
  );
}

async function main() {
  console.log("Testing T10 mesin Borda & buka konsensus...");

  const fixture = JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "golden_fixture.json"), "utf8"),
  ) as Fixture;

  // === Uji 1: Borda golden (murni) ===
  const bobot = { 1: 4, 2: 3, 3: 2, 4: 1 };
  const dmKeys = ["CTO", "HEAD_IT", "FINANCE"];
  const sawGolden: BarisSaw[] = [];
  dmKeys.forEach((dm, ui) => {
    const data = fixture.per_dm[dm];
    data.V.forEach((skor, vi) => {
      sawGolden.push({ userId: ui + 1, vendorId: vi + 1, skor, peringkat: data.rank[vi] });
    });
  });
  {
    const hasil = hitungBorda(sawGolden, bobot, [1, 2, 3, 4]);
    for (let i = 0; i < 4; i++) {
      for (let r = 1; r <= 4; r++) {
        dekat(hasil.grup[i][r - 1], fixture.borda_modul.grup[String(i)][String(r)], `grup V${i + 1} rank${r}`);
      }
      dekat(hasil.poin[i], fixture.borda_modul.poin[i], `poin V${i + 1}`);
      dekat(hasil.nilai[i], fixture.borda_modul.nilai[i], `nilai V${i + 1}`, 1e-8);
    }
    const sumNilai = hasil.nilai.reduce((a, b) => a + b, 0);
    dekat(sumNilai, 1, "SUM(nilai)", 1e-8);
    dekat(hasil.poin.reduce((a, b) => a + b, 0), fixture.borda_modul.total, "total poin");
    assert.deepEqual(hasil.peringkat, [2, 4, 1, 3], "peringkat akhir V1..V4");
    assert.equal([1, 2, 3, 4][hasil.peringkat.indexOf(1)], 3, "pemenang harus V3");
    console.log(`  OK 1: Borda golden — poin=[${hasil.poin.map((p) => p.toFixed(6)).join(", ")}]`);
    console.log(`        SUM(nilai)=${sumNilai.toFixed(10)} (tol 1e-8), pemenang=V3, peringkat=[2,4,1,3]`);
  }

  // === Uji 2: Borda seri — peringkat stabil menyelamatkan total poin ===
  {
    // Satu DM, seri puncak V1=V2. SAW stabil memberi rank 1,2,3,4.
    const saw = hitungSAW(
      [
        { vendorId: 1, nilai: [80] },
        { vendorId: 2, nilai: [80] },
        { vendorId: 3, nilai: [60] },
        { vendorId: 4, nilai: [40] },
      ],
      [{ id: 1, bobot: 100, tipe: "benefit" }],
    );
    assert.deepEqual(saw.peringkat, [1, 2, 3, 4]);
    const rows: BarisSaw[] = saw.V.map((skor, i) => ({
      userId: 1,
      vendorId: i + 1,
      skor,
      peringkat: saw.peringkat[i],
    }));
    const hasil = hitungBorda(rows, bobot, [1, 2, 3, 4]);
    // Stabil: 100*4 + 100*3 + 75*2 + 50*1 = 900.
    // RANK() kembar (1,1,3,4): 100*4 + 100*4 + 75*2 + 50*1 = 1000 (SALAH).
    dekat(hasil.poin.reduce((a, b) => a + b, 0), 900, "total poin seri");
    assert.deepEqual(hasil.poin, [400, 300, 150, 50]);
    dekat(hasil.nilai.reduce((a, b) => a + b, 0), 1, "SUM(nilai) seri", 1e-8);
    assert.deepEqual(hasil.peringkat, [1, 2, 3, 4]);
    console.log("  OK 2: Borda seri — total poin 900 (RANK() kembar akan menghasilkan 1000), SUM(nilai)=1");
  }

  // === Uji endpoint: prasyarat & pemulihan ===
  const cto = await prisma.user.findUniqueOrThrow({ where: { username: "cto" } });
  const headit = await prisma.user.findUniqueOrThrow({ where: { username: "headit" } });
  const finance = await prisma.user.findUniqueOrThrow({ where: { username: "finance" } });
  const tokens: Record<number, string> = {};
  for (const u of [cto, headit, finance]) {
    tokens[u.id] = await signSession({ uid: u.id, username: u.username, rank: u.rankJabatan });
  }
  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) throw new Error("Sesi tidak ditemukan. Jalankan db:seed:golden dulu.");

  const snapshot = await prisma.assessment.findMany({ where: { sessionId: session.id } });
  assert.equal(snapshot.length, 60, "prasyarat: 60 sel fixture");

  // Bersihkan state uji lalu masuk fase penilaian lewat endpoint resmi.
  await prisma.bordaResult.deleteMany({ where: { sessionId: session.id } });
  await prisma.sawResult.deleteMany({ where: { sessionId: session.id } });
  await prisma.submission.deleteMany({ where: { sessionId: session.id } });
  await prisma.session.update({
    where: { id: session.id },
    data: { status: "setup", openedBy: null, openedAt: null, winnerVendorId: null },
  });
  {
    const res = await mulaiPenilaian(req("http://localhost:3000/api/setup/mulai-penilaian", tokens[cto.id], { method: "POST" }));
    assert.equal(res.status, 200);
  }

  // === Uji 3: rank < 3 ditolak 403 ===
  for (const u of [headit, finance]) {
    const res = await bukaKonsensus(req("http://localhost:3000/api/konsensus/buka", tokens[u.id], { method: "POST" }));
    assert.equal(res.status, 403, `${u.username} harus ditolak 403`);
  }
  console.log("  OK 3: headit & finance panggil buka konsensus -> 403 (guard rank server)");

  // === Uji 4: 2 submissions -> ditolak 409 ===
  for (const u of [headit, finance]) {
    const res = await submitPenilaian(req("http://localhost:3000/api/penilaian/submit", tokens[u.id], { method: "POST" }));
    assert.equal(res.status, 200, `${u.username} submit harus 200`);
  }
  {
    const res = await bukaKonsensus(req("http://localhost:3000/api/konsensus/buka", tokens[cto.id], { method: "POST" }));
    assert.equal(res.status, 409, "2 submissions harus ditolak");
    const data = await res.json();
    assert.match(data.error, /2\/3/);
    const statusDb = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(statusDb.status, "penilaian", "status tidak boleh berubah");
    const sawCount = await prisma.sawResult.count({ where: { sessionId: session.id } });
    assert.equal(sawCount, 0, "saw_results tidak boleh tertulis saat ditolak");
    console.log("  OK 4: buka konsensus dengan 2 submissions -> 409:", data.error);
  }

  // === Uji 5: 3 submissions -> 200, hasil cocok fixture ===
  {
    const res = await submitPenilaian(req("http://localhost:3000/api/penilaian/submit", tokens[cto.id], { method: "POST" }));
    assert.equal(res.status, 200);
  }
  {
    const res = await bukaKonsensus(req("http://localhost:3000/api/konsensus/buka", tokens[cto.id], { method: "POST" }));
    assert.equal(res.status, 200, "3 submissions harus sukses");
    const data = await res.json();
    assert.equal(data.status, "konsensus");
    assert.equal(data.sawCount, 12);
    assert.equal(data.bordaCount, 4);
    console.log("  OK 5: buka konsensus 3/3 -> 200, saw_results=12, borda_results=4");
  }
  {
    const sessionDb = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(sessionDb.status, "konsensus");

    const vendors = await prisma.vendor.findMany({ orderBy: { kode: "asc" } });
    const sawDb = await prisma.sawResult.findMany({ where: { sessionId: session.id } });
    assert.equal(sawDb.length, 12);
    const dmByKey: Record<string, number> = { CTO: cto.id, HEAD_IT: headit.id, FINANCE: finance.id };
    for (const [dm, userId] of Object.entries(dmByKey)) {
      const data = fixture.per_dm[dm];
      vendors.forEach((v, vi) => {
        const row = sawDb.find((r) => r.userId === userId && r.vendorId === v.id);
        assert.ok(row, `saw_results ${dm} ${v.kode} ada`);
        dekat(Number(row.skorPreferensi), data.V[vi], `saw_results ${dm} ${v.kode}`);
        assert.equal(row.peringkat, data.rank[vi], `peringkat ${dm} ${v.kode}`);
      });
    }
    console.log("  OK 5a: saw_results 12 baris cocok fixture (tol 1e-4), peringkat tepat");

    const bordaDb = await prisma.bordaResult.findMany({ where: { sessionId: session.id } });
    assert.equal(bordaDb.length, 4);
    vendors.forEach((v, vi) => {
      const row = bordaDb.find((r) => r.vendorId === v.id);
      assert.ok(row, `borda_results ${v.kode} ada`);
      dekat(Number(row.poinBorda), fixture.borda_modul.poin[vi], `poin_borda ${v.kode}`);
      dekat(Number(row.nilaiBorda), fixture.borda_modul.nilai[vi], `nilai_borda ${v.kode}`, 1e-8);
    });
    const sumNilaiDb = bordaDb.reduce((a, r) => a + Number(r.nilaiBorda), 0);
    dekat(sumNilaiDb, 1, "SUM(nilai_borda) DB", 1e-8);
    const totalPoinDb = bordaDb.reduce((a, r) => a + Number(r.poinBorda), 0);
    dekat(totalPoinDb, fixture.borda_modul.total, "total poin DB");
    const winner = bordaDb.find((r) => r.peringkatAkhir === 1);
    assert.equal(winner?.vendorId, vendors[2].id, "pemenang DB harus V3");
    assert.equal(sessionDb.winnerVendorId, vendors[2].id, "session.winner_vendor_id = V3");
    console.log(`  OK 5b: borda_results cocok fixture — total=${totalPoinDb.toFixed(6)}, SUM(nilai)=${sumNilaiDb.toFixed(8)}, pemenang=V3`);

    const audits = await prisma.auditLog.findMany({
      where: { sessionId: session.id, aksi: { in: ["buka_konsensus", "hitung_borda"] } },
    });
    assert.equal(audits.filter((a) => a.aksi === "buka_konsensus").length, 1);
    assert.equal(audits.filter((a) => a.aksi === "hitung_borda").length, 1);
    assert.ok(audits.every((a) => a.userId === cto.id), "audit dicatat atas nama CTO");
    console.log("  OK 5c: audit_log buka_konsensus + hitung_borda tercatat");
  }

  // === Uji 6: setelah konsensus, blind dibuka sesuai status ===
  {
    const res = await getPenilaian(req("http://localhost:3000/api/penilaian", tokens[finance.id]));
    assert.equal(res.status, 200);
    const text = await res.text();
    const data = JSON.parse(text);
    assert.equal(data.status, "konsensus");
    assert.equal(data.assessments.length, 60, "finance kini membaca 60 sel (3 DM)");
    assert.ok(text.includes(`"userId":${cto.id}`), "payload memuat nilai cto");
    assert.ok(text.includes(`"userId":${headit.id}`), "payload memuat nilai headit");
    console.log("  OK 6: GET penilaian sebagai finance fase konsensus -> 60 sel, nilai cto/headit terbuka");

    // Guard tulis TIDAK dilonggarkan: PATCH di luar fase penilaian -> 409.
    const target = snapshot[0];
    const patch = await patchNilai(req("http://localhost:3000/api/penilaian", tokens[cto.id], {
      method: "PATCH",
      body: { vendorId: target.vendorId, criterionId: target.criterionId, nilai: 99 },
    }));
    assert.equal(patch.status, 409, "PATCH setelah konsensus harus ditolak");
    console.log("  OK 6a: PATCH fase konsensus -> 409 (guard H2 tidak dilonggarkan)");

    // Buka konsensus kedua kali -> 409 (status sudah konsensus).
    const lagi = await bukaKonsensus(req("http://localhost:3000/api/konsensus/buka", tokens[cto.id], { method: "POST" }));
    assert.equal(lagi.status, 409);
    console.log("  OK 6b: buka konsensus ganda -> 409");
  }

  // === Pemulihan: setup + 60 sel fixture, hasil & submissions dihapus ===
  await prisma.$transaction([
    prisma.auditLog.deleteMany({
      where: {
        sessionId: session.id,
        aksi: { in: ["mulai_penilaian", "submit_penilaian", "buka_konsensus", "hitung_borda", "simpan_nilai"] },
      },
    }),
    prisma.bordaResult.deleteMany({ where: { sessionId: session.id } }),
    prisma.sawResult.deleteMany({ where: { sessionId: session.id } }),
    prisma.submission.deleteMany({ where: { sessionId: session.id } }),
    prisma.session.update({
      where: { id: session.id },
      data: { status: "setup", openedBy: null, openedAt: null, winnerVendorId: null },
    }),
  ]);
  const [finalAssess, finalSub, finalSaw, finalBorda] = await Promise.all([
    prisma.assessment.count({ where: { sessionId: session.id } }),
    prisma.submission.count({ where: { sessionId: session.id } }),
    prisma.sawResult.count({ where: { sessionId: session.id } }),
    prisma.bordaResult.count({ where: { sessionId: session.id } }),
  ]);
  assert.equal(finalAssess, 60);
  assert.equal(finalSub, 0);
  assert.equal(finalSaw, 0);
  assert.equal(finalBorda, 0);

  console.log("T10 test passed. DB dipulihkan ke setup + 60 sel fixture (submissions/saw/borda = 0).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
