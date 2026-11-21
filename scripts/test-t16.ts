/**
 * T16 — Test export Berita Acara PDF.
 * Jalankan: npm run test:t16
 *
 * 1. Sebelum konsensus endpoint menolak 409.
 * 2. Fase konsensus & sah: PDF 200, content-type application/pdf, header %PDF.
 * 3. Angka di HTML sesuai snapshot: pemenang V3 0.34045293, SAW CTO V1 92.084542,
 *    poin Borda, total poin, nama 3 DM, kriteria & bobot, timestamp + pengesah.
 * 4. PDF tersimpan di screenshots/T16-berita-acara.pdf dan punya >=1 halaman.
 * 5. Semua role boleh mengunduh; tombol ada di /hasil.
 * DB dipulihkan ke setup di akhir.
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { NextRequest } from "next/server";
import type { Browser } from "puppeteer-core";
import { prisma } from "../lib/prisma";
import { getDataHasil } from "../lib/hitung/rincian";
import { buildBeritaAcaraHtml } from "../lib/pdf/berita-acara";
import { BASE, cookieUntuk, launchBrowser, majuKeKonsensus, pulihkanSetup, tutupPrisma } from "./browser-helpers";
import { GET as unduhPdf } from "../app/api/hasil/berita-acara/route";
import { POST as sahkan } from "../app/api/pengesahan/route";

function req(cookie: string) {
  return new NextRequest(`${BASE}/api/hasil/berita-acara`, { headers: { cookie } });
}

async function main() {
  console.log("Testing T16 berita acara PDF...");
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

    const ctoCookie = await cookieUntuk(users.cto);
    const finCookie = await cookieUntuk(users.finance);

    const awal = await unduhPdf(req(ctoCookie));
    assert.equal(awal.status, 409, "fase setup harus menolak export");
    console.log("  OK 1: setup -> export ditolak 409");

    await majuKeKonsensus();
    const saatKonsensus = await unduhPdf(req(ctoCookie));
    assert.equal(saatKonsensus.status, 200);
    assert.match(saatKonsensus.headers.get("content-type") ?? "", /application\/pdf/);
    console.log("  OK 2: fase konsensus -> PDF 200 application/pdf");

    const sah = await sahkan(req2(ctoCookie));
    assert.equal(sah.status, 200);
    const belum = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    assert.equal(belum.status, "sah");
    console.log("  OK 3: sesi disahkan, lanjut export final");

    const data = await getDataHasil(sessionId);
    assert.ok(data);
    const html = buildBeritaAcaraHtml(data, `${users.cto.namaLengkap} (${users.cto.jabatan})`);
    assert.ok(html.includes("PT Infrastruktur Prima Digital"));
    assert.ok(html.includes("V3"));
    assert.ok(html.includes(data.winner.nilai.toFixed(8)), "nilai Borda pemenang harus tercetak");
    assert.ok(html.includes("0.34045293"), "nilai fixture 0.34045293");
    assert.ok(html.includes("92.084542"), "SAW CTO V1 92.084542");
    assert.ok(html.includes("816.846922"), "poin V1 816.846922");
    assert.ok(html.includes(data.totalPoin.toFixed(6)), "total poin");
    assert.ok(html.includes(users.headit.namaLengkap) && html.includes(users.finance.namaLengkap));
    assert.ok(html.includes("Pengalaman dan kemampuan teknis migrasi"), "nama kriteria");
    assert.ok(html.includes("cost · ↓ lebih baik"));
    assert.ok(html.includes("Disahkan oleh:"), "pengesah tercantum");
    assert.ok(html.includes("Waktu pengesahan:"), "timestamp pengesahan tercantum");
    assert.ok(!html.includes("<script"), "tanpa script di dokumen cetak");
    console.log("  OK 4: HTML memuat 3 DM, kriteria+bobot, SAW 92.084542, Borda 0.34045293, pengesah & timestamp");

    const final = await unduhPdf(req(ctoCookie));
    assert.equal(final.status, 200);
    const buffer = Buffer.from(await final.arrayBuffer());
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-", "header PDF valid");
    assert.ok(buffer.length > 20_000, `ukuran PDF ${buffer.length} byte terlalu kecil`);
    const text = buffer.toString("latin1");
    const halaman = text.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    assert.ok(halaman >= 1, "PDF harus punya minimal 1 halaman");
    writeFileSync("screenshots/T16-berita-acara.pdf", buffer);
    console.log(`  OK 5: PDF valid ${buffer.length} byte, ${halaman} halaman -> screenshots/T16-berita-acara.pdf`);

    const olehFinance = await unduhPdf(req(finCookie));
    assert.equal(olehFinance.status, 200, "semua role boleh export");
    console.log("  OK 6: finance dapat mengunduh PDF (semua role)");

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1000, height: 1400 });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: "screenshots/T16-berita-acara-preview.png", fullPage: true });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setCookie({ name: "sysselect_session", value: finCookie.split("=")[1], url: BASE });
    await page.goto(`${BASE}/hasil`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="export-pdf"]');
    const href = await page.$eval('[data-testid="export-pdf"]', (el) => el.getAttribute("href"));
    assert.equal(href, "/api/hasil/berita-acara");
    await page.screenshot({ path: "screenshots/T16-hasil-final.png", fullPage: true });
    console.log("  OK 7: tombol Export Berita Acara ada di /hasil untuk finance");
  } finally {
    if (browser) await browser.close();
    if (sessionId !== undefined) await pulihkanSetup(sessionId);
    await tutupPrisma();
  }
}

function req2(cookie: string) {
  return new NextRequest(`${BASE}/api/pengesahan`, { method: "POST", headers: { cookie } });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
