/**
 * T15 — Test audit log lengkap satu siklus.
 * Jalankan: npm run test:t15
 *
 * 1. Login lewat form asli mencatat aksi 'login'.
 * 2. Satu siklus penuh menghasilkan 9 aksi: login, simpan_kriteria,
 *    simpan_vendor, mulai_penilaian, simpan_nilai, submit_penilaian,
 *    buka_konsensus, hitung_borda, sahkan_keputusan.
 * 3. /audit hanya CTO (rank 1 -> 404).
 * 4. Filter aktor & aksi bekerja di server; urutan terbaru dulu.
 * 5. Screenshot /audit.
 * DB dipulihkan ke setup di akhir.
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { Browser } from "puppeteer-core";
import { prisma } from "../lib/prisma";
import { BASE, cookieUntuk, launchBrowser, pulihkanSetup, tutupPrisma } from "./browser-helpers";
import { POST as mulaiPenilaian } from "../app/api/setup/mulai-penilaian/route";
import { POST as submitNilai } from "../app/api/penilaian/submit/route";
import { PATCH as patchNilai } from "../app/api/penilaian/route";
import { POST as bukaKonsensus } from "../app/api/konsensus/buka/route";
import { POST as sahkan } from "../app/api/pengesahan/route";
import { PUT as simpanKriteria } from "../app/api/setup/kriteria/route";
import { POST as simpanVendor } from "../app/api/setup/vendor/route";

function req(url: string, cookie: string, method = "POST", body?: unknown) {
  const headers: Record<string, string> = { cookie };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const SEMUA_AKSI = [
  "login",
  "simpan_kriteria",
  "simpan_vendor",
  "mulai_penilaian",
  "simpan_nilai",
  "submit_penilaian",
  "buka_konsensus",
  "hitung_borda",
  "sahkan_keputusan",
];

async function main() {
  console.log("Testing T15 audit log...");
  let browser: Browser | undefined;
  let sessionId: number | undefined;
  try {
    const users = {
      cto: await prisma.user.findUniqueOrThrow({ where: { username: "cto" } }),
      headit: await prisma.user.findUniqueOrThrow({ where: { username: "headit" } }),
      finance: await prisma.user.findUniqueOrThrow({ where: { username: "finance" } }),
    };
    const session = await prisma.session.findFirstOrThrow({ orderBy: { id: "asc" } });
    sessionId = session.id;
    await pulihkanSetup(sessionId);

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });

    // 1. Login lewat form asli (server action) -> audit 'login'
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.type("#username", "cto");
    await page.type("#password", "rahasia123");
    await Promise.all([
      page.waitForFunction(() => location.pathname === "/dashboard", { timeout: 15000 }),
      page.click('form button[type="submit"]'),
    ]);
    const loginLog = await prisma.auditLog.findFirst({
      where: { aksi: "login", userId: users.cto.id },
      orderBy: { id: "desc" },
    });
    assert.ok(loginLog, "audit login harus tercatat");
    console.log(`  OK 1: login cto tercatat (audit id=${loginLog.id})`);

    const ctoCookie = await cookieUntuk(users.cto);
    const hitCookie = await cookieUntuk(users.headit);

    // 2. Siklus penuh lewat endpoint resmi.
    const criteria = await prisma.criteria.findMany({ orderBy: { urutan: "asc" } });
    const vendor = await prisma.vendor.findFirstOrThrow({ where: { kode: "V1" } });
    const existing = await prisma.assessment.findFirstOrThrow({
      where: { sessionId, userId: users.headit.id, vendorId: vendor.id, criterionId: criteria[0].id },
    });

    const kriteriaRes = await simpanKriteria(
      req(`${BASE}/api/setup/kriteria`, ctoCookie, "PUT", {
        kriteria: criteria.map((c) => ({ kode: c.kode, bobot: Number(c.bobot) })),
      }),
    );
    assert.equal(kriteriaRes.status, 200, "simpan kriteria harus 200");
    const vendorRes = await simpanVendor(
      req(`${BASE}/api/setup/vendor`, ctoCookie, "POST", {
        id: vendor.id,
        kode: vendor.kode,
        nama: vendor.nama,
        profil: vendor.profil ?? "",
      }),
    );
    assert.equal(vendorRes.status, 200, "simpan vendor harus 200");
    assert.equal((await mulaiPenilaian(req(`${BASE}/api/setup/mulai-penilaian`, ctoCookie))).status, 200);
    const patchRes = await patchNilai(
      req(`${BASE}/api/penilaian`, hitCookie, "PATCH", {
        vendorId: vendor.id,
        criterionId: criteria[0].id,
        nilai: Number(existing.nilai),
      }),
    );
    assert.equal(patchRes.status, 200, "simpan nilai harus 200");
    for (const u of [users.cto, users.headit, users.finance]) {
      const cookie = await cookieUntuk(u);
      assert.equal((await submitNilai(req(`${BASE}/api/penilaian/submit`, cookie))).status, 200);
    }
    assert.equal((await bukaKonsensus(req(`${BASE}/api/konsensus/buka`, ctoCookie))).status, 200);
    assert.equal((await sahkan(req(`${BASE}/api/pengesahan`, ctoCookie))).status, 200);

    const tercatat = await prisma.auditLog.findMany({
      where: { sessionId, aksi: { in: SEMUA_AKSI } },
      distinct: ["aksi"],
      select: { aksi: true },
    });
    const ada = new Set(tercatat.map((r) => r.aksi));
    for (const aksi of SEMUA_AKSI) assert.ok(ada.has(aksi), `aksi ${aksi} harus tercatat`);
    console.log(`  OK 2: 9 aksi tercatat — ${SEMUA_AKSI.join(", ")}`);

    // 3-4. Halaman audit sebagai CTO.
    await page.goto(`${BASE}/audit`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="audit-table"]');
    const rows = await page.$$eval('[data-testid="audit-row"]', (els) =>
      els.map((el) => ({
        aksi: el.getAttribute("data-aksi"),
        aktor: el.getAttribute("data-aktor"),
      })),
    );
    assert.ok(rows.length >= 9, `harus >=9 baris, dapat ${rows.length}`);
    assert.equal(rows[0].aksi, "sahkan_keputusan", "baris teratas harus aksi terbaru");
    console.log(`  OK 3: urutan terbaru dulu — baris pertama ${rows[0].aksi}`);

    await page.goto(`${BASE}/audit?aksi=sahkan_keputusan`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="audit-row"]');
    const filteredAksi = await page.$$eval('[data-testid="audit-row"]', (els) =>
      els.map((el) => el.getAttribute("data-aksi")),
    );
    assert.ok(filteredAksi.length >= 1);
    assert.ok(filteredAksi.every((a) => a === "sahkan_keputusan"));
    console.log(`  OK 4: filter aksi=sahkan_keputusan -> ${filteredAksi.length} baris, semua cocok`);

    await page.goto(`${BASE}/audit?aktor=${users.headit.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="audit-row"]');
    const filteredAktor = await page.$$eval('[data-testid="audit-row"]', (els) =>
      els.map((el) => el.getAttribute("data-aktor")),
    );
    assert.ok(filteredAktor.length >= 2);
    assert.ok(filteredAktor.every((a) => a === "headit"));
    console.log(`  OK 5: filter aktor=headit -> ${filteredAktor.length} baris, semua headit`);

    await page.goto(`${BASE}/audit`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="audit-table"]');
    await page.screenshot({ path: "screenshots/T15-audit.png", fullPage: true });
    console.log("Screenshot: screenshots/T15-audit.png");

    // 3b. Rank 1 -> 404
    const financeCookie = await cookieUntuk(users.finance);
    await page.setCookie({ name: "sysselect_session", value: financeCookie.split("=")[1], url: BASE });
    const res = await page.goto(`${BASE}/audit`, { waitUntil: "domcontentloaded" });
    assert.equal(res?.status(), 404, "finance membuka /audit harus 404");
    console.log("  OK 6: finance membuka /audit -> 404 (bukan hanya menu disembunyikan)");
  } catch (error) {
    console.error("GAGAL:", error);
    throw error;
  } finally {
    if (browser) await browser.close();
    if (sessionId !== undefined) await pulihkanSetup(sessionId);
    await tutupPrisma();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
