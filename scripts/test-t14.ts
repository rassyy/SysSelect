/**
 * T14 — Test pengesahan & kunci read-only.
 * Jalankan: npm run test:t14
 *
 * Uji endpoint langsung (lapisan server):
 *   1. rank 1 memanggil /api/pengesahan -> 403, status tetap konsensus.
 *   2. rank 3 -> 200; sesi jadi sah, ratified_by/at + winner_vendor_id terisi,
 *      audit 'sahkan_keputusan' tercatat.
 *   3. Setelah sah SEMUA endpoint tulis menolak 409:
 *      PATCH penilaian, POST submit, PUT kriteria, POST vendor,
 *      POST mulai-penilaian, POST buka-konsensus, POST pengesahan ulang.
 * Uji UI:
 *   4. Fase konsensus: tombol Sahkan hanya untuk CTO (finance tidak melihat).
 *   5. Dialog konfirmasi -> sah -> badge "Disahkan oleh CTO · {timestamp}".
 * DB dipulihkan ke setup di akhir.
 */
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { Browser } from "puppeteer-core";
import { prisma } from "../lib/prisma";
import { BASE, cookieUntuk, launchBrowser, majuKeKonsensus, pulihkanSetup, tutupPrisma } from "./browser-helpers";
import { POST as sahkan } from "../app/api/pengesahan/route";
import { PATCH as patchNilai } from "../app/api/penilaian/route";
import { POST as submitNilai } from "../app/api/penilaian/submit/route";
import { PUT as simpanKriteria } from "../app/api/setup/kriteria/route";
import { POST as simpanVendor } from "../app/api/setup/vendor/route";
import { POST as mulaiPenilaian } from "../app/api/setup/mulai-penilaian/route";
import { POST as bukaKonsensus } from "../app/api/konsensus/buka/route";

function req(url: string, cookie: string, method = "POST", body?: unknown) {
  const headers: Record<string, string> = { cookie };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return new NextRequest(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function main() {
  console.log("Testing T14 pengesahan & kunci read-only...");
  let browser: Browser | undefined;
  let sessionId: number | undefined;
  try {
    const state = await majuKeKonsensus();
    sessionId = state.sessionId;

    const ctoCookie = await cookieUntuk(state.users.cto);
    const finCookie = await cookieUntuk(state.users.finance);
    const hitCookie = await cookieUntuk(state.users.headit);

    // 1. rank 1 -> 403
    const tolak = await sahkan(req(`${BASE}/api/pengesahan`, finCookie));
    assert.equal(tolak.status, 403, "finance memanggil sahkan harus 403");
    const masih = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    assert.equal(masih.status, "konsensus");
    console.log("  OK 1: rank 1 memanggil sahkan -> 403, status tetap konsensus");

    // 4 & 5. UI sebelum sah
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });

    await page.setCookie({ name: "sysselect_session", value: finCookie.split("=")[1], url: BASE });
    await page.goto(`${BASE}/hasil`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="winner-card"]');
    assert.equal(await page.$('[data-testid="sahkan-button"]'), null, "finance tidak boleh melihat tombol sahkan");
    console.log("  OK 2: finance tidak melihat tombol Sahkan");

    await page.setCookie({ name: "sysselect_session", value: ctoCookie.split("=")[1], url: BASE });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="sahkan-button"][data-ready="1"]');
    await page.click('[data-testid="sahkan-button"]');
    await page.waitForFunction(() => (document.querySelector('[data-testid="sahkan-dialog"]') as HTMLDialogElement)?.open === true);
    await page.screenshot({ path: "screenshots/T14-dialog-sahkan.png", fullPage: true });
    console.log("  OK 3: CTO melihat tombol Sahkan dan dialog konfirmasi terbuka");

    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[data-testid="sahkan-dialog"] button')];
      (buttons.find((b) => b.textContent?.includes("Ya, sahkan")) as HTMLButtonElement | undefined)?.click();
    });
    await page.waitForSelector('[data-testid="ratified-badge"]', { timeout: 10000 });
    const badge = await page.$eval('[data-testid="ratified-badge"]', (el) => el.textContent?.replace(/\s+/g, " ").trim());
    assert.match(badge ?? "", /Disahkan oleh/);
    console.log(`  OK 4: badge pengesahan tampil — "${badge}"`);
    await page.screenshot({ path: "screenshots/T14-hasil-sah.png", fullPage: true });

    // 2. Verifikasi DB
    const sah = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    assert.equal(sah.status, "sah");
    assert.equal(sah.ratifiedBy, state.users.cto.id);
    assert.ok(sah.ratifiedAt instanceof Date);
    const winner = await prisma.vendor.findUniqueOrThrow({ where: { id: sah.winnerVendorId! } });
    assert.equal(winner.kode, "V3");
    const audit = await prisma.auditLog.findFirst({
      where: { sessionId, aksi: "sahkan_keputusan" },
      orderBy: { id: "desc" },
    });
    assert.ok(audit, "audit sahkan_keputusan harus ada");
    assert.equal(audit.userId, state.users.cto.id);
    console.log(
      `  OK 5: DB sah — ratified_by=${sah.ratifiedBy}, winner=${winner.kode}, audit id=${audit.id}`,
    );

    // 3. Semua endpoint tulis ditolak setelah sah
    const vendor = await prisma.vendor.findFirstOrThrow({ where: { kode: "V1" } });
    const criterion = await prisma.criteria.findFirstOrThrow({ where: { kode: "C1" } });
    const assessments = [
      ["PATCH penilaian", await patchNilai(req(`${BASE}/api/penilaian`, hitCookie, "PATCH", { vendorId: vendor.id, criterionId: criterion.id, nilai: 900 }))],
      ["POST submit", await submitNilai(req(`${BASE}/api/penilaian/submit`, hitCookie))],
      ["PUT kriteria", await simpanKriteria(req(`${BASE}/api/setup/kriteria`, ctoCookie, "PUT", { kriteria: [] }))],
      ["POST vendor", await simpanVendor(req(`${BASE}/api/setup/vendor`, ctoCookie, "POST", { kode: "V9", nama: "Vendor Uji" }))],
      ["POST mulai-penilaian", await mulaiPenilaian(req(`${BASE}/api/setup/mulai-penilaian`, ctoCookie))],
      ["POST buka-konsensus", await bukaKonsensus(req(`${BASE}/api/konsensus/buka`, ctoCookie))],
      ["POST pengesahan ulang", await sahkan(req(`${BASE}/api/pengesahan`, ctoCookie))],
    ] as const;
    for (const [nama, res] of assessments) {
      assert.ok([403, 409].includes(res.status), `${nama} harus 403/409, dapat ${res.status}`);
      console.log(`  OK 6: ${nama} setelah sah -> ${res.status}`);
    }

    const [nilaiC1, jumlahVendor, jumlahAssessment] = await Promise.all([
      prisma.assessment.findFirstOrThrow({ where: { vendorId: vendor.id, criterionId: criterion.id, userId: state.users.headit.id } }),
      prisma.vendor.count(),
      prisma.assessment.count({ where: { sessionId } }),
    ]);
    assert.notEqual(Number(nilaiC1.nilai), 900, "nilai tidak boleh berubah setelah sah");
    assert.equal(jumlahVendor, 4);
    assert.equal(jumlahAssessment, 60);
    console.log("  OK 7: data tidak berubah — assessments=60, vendors=4, nilai C1 tetap");
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
