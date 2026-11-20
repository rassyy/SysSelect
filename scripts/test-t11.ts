/**
 * T11 — Uji browser chart Borda hero (Chrome/Edge sistem via puppeteer-core).
 * Jalankan: npm run dev (terminal lain), lalu npm run test:t11
 * Override server: SMOKE_BASE_URL=http://localhost:3001 npm run test:t11
 *
 * Uji: panjang batang proporsional, lebar segmen dari kontribusi, label
 * runtime >=36px, warna default & HC dari tokens.json, legenda, tooltip fokus,
 * preferensi HC localStorage, screenshot /konsensus.
 * DB dipulihkan ke setup + 60 sel fixture di akhir.
 */
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser, Page } from "puppeteer-core";
import {
  BASE,
  cookieUntuk,
  launchBrowser,
  majuKeKonsensus,
  pulihkanSetup,
  tutupPrisma,
} from "./browser-helpers";

const EXPECTED_LENGTH: Record<string, number> = { V3: 100, V1: 88.47, V4: 57.92, V2: 47.34 };
const EXPECTED_SEG: Record<string, number[]> = {
  V3: [29.53, 40.98, 29.49],
  V1: [45.09, 33.13, 21.77],
  V4: [15.56, 15.98, 68.46],
  V2: [40.05, 40.21, 19.74],
};
const DEFAULT_RGB = ["rgb(30, 58, 95)", "rgb(155, 76, 119)", "rgb(239, 211, 168)"];
const HC_RGB = ["rgb(23, 111, 234)", "rgb(76, 11, 49)", "rgb(248, 207, 149)"];
const LABEL_RGB = ["rgb(255, 255, 255)", "rgb(255, 255, 255)", "rgb(26, 24, 21)"];

function dekat(actual: number, expected: number, label: string, tol = 0.12) {
  assert.ok(Math.abs(actual - expected) <= tol, `${label}: dapat ${actual}, harap ${expected} (tol ${tol})`);
}

async function chartData(page: Page) {
  return page.$$eval('[data-testid="borda-row"]', (rows) =>
    rows.map((row) => {
      const track = row.querySelector<HTMLElement>('[data-testid="chart-track"]')!;
      const fill = row.querySelector<HTMLElement>('[data-testid="chart-fill"]')!;
      const segs = [...row.querySelectorAll<HTMLElement>('[data-testid="chart-segment"]')];
      const trackRect = track.getBoundingClientRect();
      const fillRect = fill.getBoundingClientRect();
      return {
        vendor: row.getAttribute("data-vendor")!,
        trackWidth: trackRect.width,
        trackHeight: trackRect.height,
        fillWidth: fillRect.width,
        lengthPct: (fillRect.width / trackRect.width) * 100,
        segments: segs.map((s) => {
          const r = s.getBoundingClientRect();
          const label = s.querySelector<HTMLElement>('[data-testid="segment-label"]');
          return {
            initials: s.dataset.initials!,
            width: r.width,
            pct: (r.width / fillRect.width) * 100,
            label: label?.textContent ?? null,
            labelColor: label ? getComputedStyle(label).color : null,
            labelSize: label ? getComputedStyle(label).fontSize : null,
            labelWeight: label ? getComputedStyle(label).fontWeight : null,
            fill: getComputedStyle(s).backgroundColor,
          };
        }),
      };
    }),
  );
}

async function main() {
  console.log(`Testing T11 chart Borda via browser terhadap ${BASE} ...`);
  let browser: Browser | undefined;
  let sessionId: number | undefined;
  try {
    const state = await majuKeKonsensus();
    sessionId = state.sessionId;
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
    await page.setCookie({
      name: "sysselect_session",
      value: (await cookieUntuk(state.users.cto)).split("=")[1],
      url: BASE,
    });
    await page.goto(`${BASE}/konsensus`, { waitUntil: "networkidle0" });
    await page.waitForSelector('[data-testid="borda-chart"]');

    // 1. Batang proporsional, track 22px, urutan V3 > V1 > V4 > V2.
    const data = await chartData(page);
    assert.deepEqual(data.map((r) => r.vendor), ["V3", "V1", "V4", "V2"]);
    for (const row of data) {
      dekat(row.trackHeight, 22, `${row.vendor} tinggi track`, 0.01);
      dekat(row.lengthPct, EXPECTED_LENGTH[row.vendor], `${row.vendor} panjang batang`);
      row.segments.forEach((seg, i) => dekat(seg.pct, EXPECTED_SEG[row.vendor][i], `${row.vendor} seg ${i}`));
    }
    assert.ok(data[2].segments[2].pct > 60, "Finance V4 harus dominan secara kasat mata");
    console.log(`  OK 1: batang=${data.map((r) => `${r.vendor} ${r.lengthPct.toFixed(2)}%`).join(" · ")}`);
    console.log(`        V4 Finance=${data[2].segments[2].pct.toFixed(2)}% dari batang (dominan)`);

    // 2. Semua label tampak pada desktop normal; warna & tipografi tepat.
    for (const row of data) {
      assert.deepEqual(row.segments.map((s) => s.initials), ["CTO", "HIT", "FIN"]);
      for (let i = 0; i < 3; i++) {
        const seg = row.segments[i];
        assert.ok(seg.width >= 36, `${row.vendor} ${seg.initials} >=36px di desktop`);
        assert.equal(seg.label, seg.initials, `${row.vendor} ${seg.initials} label wajib`);
        assert.equal(seg.labelSize, "9.5px");
        assert.equal(seg.labelWeight, "700");
        assert.equal(seg.fill, DEFAULT_RGB[i]);
        assert.equal(seg.labelColor, LABEL_RGB[i]);
      }
    }
    console.log(`  OK 2: 12 label CTO/HIT/FIN tampil di desktop, min=${Math.min(...data.flatMap((r) => r.segments.map((s) => s.width))).toFixed(1)}px; fill/label/font sesuai token`);

    // 3. Legenda memuat inisial + nama jabatan lengkap.
    const legend = await page.$eval('[data-testid="chart-legend"]', (el) => el.textContent ?? "");
    for (const text of ["CTO", "Chief Technology Officer", "HIT", "Head of IT Infrastructure", "FIN", "Finance Manager"]) {
      assert.ok(legend.includes(text), `legenda harus memuat ${text}`);
    }
    console.log("  OK 3: legenda CTO/HIT/FIN + nama jabatan lengkap");

    // 4. Fokus keyboard memunculkan tooltip dengan data DM, skor, rank, kontribusi.
    await page.focus('[data-testid="borda-row"][data-vendor="V3"] [data-testid="chart-segment"][data-role="cto"]');
    await page.waitForSelector('[data-testid="segment-tooltip"]');
    const tooltip = await page.$eval('[data-testid="segment-tooltip"]', (el) => el.textContent ?? "");
    for (const text of ["Chief Technology Officer", "Skor SAW", "Peringkat", "Kontribusi", "poin"]) {
      assert.ok(tooltip.includes(text), `tooltip harus memuat ${text}`);
    }
    console.log("  OK 4: segmen fokus -> tooltip nama DM, skor SAW, peringkat, kontribusi");

    // Screenshot default chart. Kembali fokus netral agar tooltip tidak menutupi.
    await page.click("h1");
    mkdirSync(resolve(process.cwd(), "screenshots"), { recursive: true });
    const screenshot = resolve(process.cwd(), "screenshots", "T11-konsensus.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    console.log(`  OK screenshot: ${screenshot}`);

    // 5. Mode HC: fill sesuai token, label tetap & warna sesuai aturan.
    await page.click('[data-testid="hc-toggle"]');
    const hc = await chartData(page);
    for (const row of hc) {
      row.segments.forEach((seg, i) => {
        assert.equal(seg.fill, HC_RGB[i]);
        assert.equal(seg.labelColor, LABEL_RGB[i]);
        assert.equal(seg.label, seg.initials);
      });
    }
    assert.equal(await page.$eval('[data-testid="hc-toggle"]', (el) => el.getAttribute("aria-checked")), "true");
    assert.equal(await page.evaluate(() => localStorage.getItem("sysselect.hc")), "1");
    await page.reload({ waitUntil: "networkidle0" });
    assert.equal(await page.$eval('[data-testid="hc-toggle"]', (el) => el.getAttribute("aria-checked")), "true");
    console.log("  OK 5: mode HC fill/label sesuai token, label tetap, localStorage bertahan reload");

    // 6. Track sempit: label <36px disembunyikan runtime, tooltip tetap tersedia.
    await page.setViewport({ width: 500, height: 900, deviceScaleFactor: 1 });
    const narrow = await chartData(page);
    let tersembunyi = 0;
    for (const row of narrow) {
      for (const seg of row.segments) {
        if (seg.width < 36) {
          assert.equal(seg.label, null, `${row.vendor} ${seg.initials} <36px harus sembunyi`);
          tersembunyi++;
        } else {
          assert.equal(seg.label, seg.initials, `${row.vendor} ${seg.initials} >=36px harus tampil`);
        }
      }
    }
    assert.ok(tersembunyi > 0, "setidaknya satu label tersembunyi pada layar sempit");
    console.log(`  OK 6: layar sempit — ${tersembunyi} label <36px tersembunyi berdasarkan ukuran runtime`);

    console.log("T11 test passed.");
  } finally {
    if (browser) await browser.close();
    if (sessionId !== undefined) await pulihkanSetup(sessionId);
    await tutupPrisma();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
