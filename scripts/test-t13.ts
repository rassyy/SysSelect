/**
 * T13 — Test Halaman Hasil.
 * Jalankan: npm run test:t13
 *
 * 1. getDataHasil cocok golden_fixture.json (Borda + SAW per DM, toleransi 1e-4).
 * 2. Pemenang V3 PT Infrastruktur Prima Digital, nilai 0.34045293 (tol 1e-8).
 * 3. Accordion rincian default TERTUTUP; setelah dibuka memuat angka fixture.
 * 4. Semua role dapat membuka /hasil.
 * 5. Screenshot /hasil.
 * DB dipulihkan ke setup di akhir.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser } from "puppeteer-core";
import { prisma } from "../lib/prisma";
import { getDataHasil } from "../lib/hitung/rincian";
import { BASE, cookieUntuk, launchBrowser, majuKeKonsensus, pulihkanSetup, tutupPrisma } from "./browser-helpers";

type Fixture = {
  per_dm: Record<string, { raw: number[][]; norm: number[][]; weighted: number[][]; V: number[]; rank: number[] }>;
  borda_modul: { poin: number[]; total: number; nilai: number[]; winner: string };
};

const TOL = 1e-4;

async function main() {
  console.log("Testing T13 halaman hasil...");
  const fixture = JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "golden_fixture.json"), "utf8"),
  ) as Fixture;

  let browser: Browser | undefined;
  let sessionId: number | undefined;
  try {
    const state = await majuKeKonsensus();
    sessionId = state.sessionId;

    // --- Data layer ---
    const data = await getDataHasil(sessionId);
    assert.ok(data, "getDataHasil harus mengembalikan data");
    assert.equal(data.winner.namaVendor, "PT Infrastruktur Prima Digital");
    assert.equal(data.winner.kode, "V3");
    assert.ok(Math.abs(data.winner.nilai - 0.34045293) <= 1e-8, `nilai pemenang ${data.winner.nilai}`);
    console.log(`  OK 1: pemenang V3 ${data.winner.namaVendor} nilai=${data.winner.nilai.toFixed(8)}`);

    const dmKeys = ["CTO", "HEAD_IT", "FINANCE"];
    assert.equal(data.bordaRows.length, 4);
    for (let i = 0; i < 4; i++) {
      const row = data.bordaRows.find((r) => r.kode === `V${i + 1}`);
      assert.ok(row);
      assert.ok(Math.abs(row.poin - fixture.borda_modul.poin[i]) <= TOL, `poin V${i + 1}`);
      assert.ok(Math.abs(row.nilai - fixture.borda_modul.nilai[i]) <= 1e-8, `nilai V${i + 1}`);
    }
    console.log(
      `  OK 2: poin Borda cocok fixture [${data.bordaRows.map((r) => r.poin.toFixed(6)).join(", ")}]`,
    );

    data.dmRincian.forEach((dm, di) => {
      const fx = fixture.per_dm[dmKeys[di]];
      for (let vi = 0; vi < 4; vi++) {
        assert.ok(Math.abs(dm.V[vi] - fx.V[vi]) <= TOL, `${dm.initials} V${vi + 1}`);
        assert.equal(dm.peringkat[vi], fx.rank[vi], `${dm.initials} peringkat V${vi + 1}`);
        for (let cj = 0; cj < fx.raw[0].length; cj++) {
          assert.ok(Math.abs(dm.raw[vi][cj] - fx.raw[vi][cj]) <= 1e-6, `${dm.initials} raw`);
          assert.ok(Math.abs(dm.normalisasi[vi][cj] - fx.norm[vi][cj]) <= 1e-6, `${dm.initials} norm`);
          assert.ok(Math.abs(dm.terbobot[vi][cj] - fx.weighted[vi][cj]) <= 1e-6, `${dm.initials} weighted`);
        }
      }
    });
    console.log("  OK 3: rincian mentah/normalisasi/terbobot/V/peringkat cocok fixture untuk 3 DM");

    // --- Browser ---
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100 });
    const roleResults: string[] = [];
    for (const u of [state.users.cto, state.users.headit, state.users.finance]) {
      const cookie = (await cookieUntuk(u)).split("=")[1];
      await page.setCookie({ name: "sysselect_session", value: cookie, url: BASE });
      const res = await page.goto(`${BASE}/hasil`, { waitUntil: "domcontentloaded" });
      assert.equal(res?.status(), 200, `${u.username} harus bisa membuka /hasil`);
      await page.waitForSelector('[data-testid="winner-card"]');
      roleResults.push(u.username);
    }
    console.log(`  OK 4: /hasil dapat dibuka semua role (${roleResults.join(", ")})`);

    assert.equal(await page.$eval('[data-testid="rincian-accordion"]', (el) => (el as HTMLDetailsElement).open), false);
    console.log("  OK 5: accordion rincian default tertutup");

    await page.click('[data-testid="rincian-accordion"] > summary');
    await page.waitForFunction(() => (document.querySelector('[data-testid="rincian-accordion"]') as HTMLDetailsElement).open);
    const ctoV = await page.$eval(
      '[data-testid="rincian-V"][data-dm="CTO"] tbody',
      (tbody) => [...tbody.querySelectorAll("tr")].map((tr) => tr.textContent?.replace(/\s+/g, " ").trim()),
    );
    assert.ok(ctoV[0]?.includes("92.084542"), `V CTO V1 harus 92.084542, dapat ${ctoV[0]}`);
    console.log(`  OK 6: accordion terbuka, V CTO V1 = ${ctoV[0]?.replace(/\s+/g, " ")}`);

    await page.screenshot({ path: "screenshots/T13-hasil.png", fullPage: true });
    console.log("Screenshot: screenshots/T13-hasil.png");
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
