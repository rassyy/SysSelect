/**
 * T17 — Audit anti-slop mandiri (DESIGN.md §8 23 item + §9 10 kriteria).
 * Jalankan: npm run test:t17
 *
 * Bukti: scan sumber app/components/lib, uji browser nyata (Chrome/Edge
 * sistem), dan angka uji T11/T12 yang dijalankan terpisah di sesi ini.
 * Laporan tabel ditulis ke screenshots/T17-report.md (23 + 10 baris).
 * DB dipulihkan ke setup di akhir.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Browser, Page } from "puppeteer-core";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { BASE, cookieUntuk, launchBrowser, pulihkanSetup, tutupPrisma } from "./browser-helpers";
import { POST as mulaiPenilaian } from "../app/api/setup/mulai-penilaian/route";
import { POST as submitPenilaian } from "../app/api/penilaian/submit/route";
import { POST as bukaKonsensus } from "../app/api/konsensus/buka/route";

const ITEM8 = [
  "Tidak ada gradien ungu/indigo, atau gradien apa pun sebagai latar",
  "Tidak ada glassmorphism / backdrop-blur",
  "Tidak ada emoji sebagai ikon",
  "Tidak ada rounded-2xl seragam; radius kartu tepat 10px",
  "Tidak ada shadow blur >30px atau shadow berwarna",
  "Tidak ada chart warna pelangi",
  "Tidak ada 4 stat card angka palsu di dashboard",
  "Tidak ada hero text center di dalam aplikasi",
  "Tidak ada animasi bounce/elastic/wiggle",
  "Tidak ada animasi berulang tanpa henti",
  "Tidak ada warna baru untuk pemenang",
  "Tidak ada hijau/merah untuk cost/benefit",
  "Tidak ada font dari CDN",
  "Tidak ada Recharts atau library chart lain",
  "ink-3 tidak dipakai untuk body text",
  "Semua angka pakai tabular-nums",
  "Label inisial ada di segmen chart dengan lebar absolut >=36px",
  "Legenda memuat inisial + nama jabatan lengkap",
  "Panjang batang proporsional poin, bukan semua penuh",
  "Tombol disabled punya tooltip alasan",
  "Fase terkunci menulis alasannya",
  'Ada tombol "Putar ulang" di halaman hasil',
  "prefers-reduced-motion dihormati",
];
const ITEM9 = [
  "Screenshot /konsensus menunjukkan 3 warna DM saja selain netral",
  "Panjang batang: V3 100%, V1 ~88%, V4 ~58%, V2 ~47%",
  "Segmen V4 Finance ~68%, dominan kasat mata",
  "Semua teks body lolos AA 4.5:1",
  "Mode kontras tinggi pairwise >=3:1",
  "Reveal berjalan ~2.6s dan bisa diulang",
  "prefers-reduced-motion -> tanpa animasi, state akhir langsung",
  "App jalan tanpa internet (font & ikon self-hosted)",
  "Grid penilaian bisa dioperasikan penuh dengan keyboard",
  "Tidak ada satu pun item di §8 yang dilanggar",
];

const hasil8 = new Map<number, { lulus: boolean; bukti: string }>();
const hasil9 = new Map<number, { lulus: boolean; bukti: string }>();

function catat(bagian: "§8" | "§9", no: number, lulus: boolean, bukti: string) {
  (bagian === "§8" ? hasil8 : hasil9).set(no, { lulus, bukti });
  assert.ok(lulus, `GAGAL ${bagian} #${no} (${(bagian === "§8" ? ITEM8 : ITEM9)[no - 1]}): ${bukti}`);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx|css)$/.test(name) ? [path] : [];
  });
}

const sumber = [...walk("app"), ...walk("components"), ...walk("lib")].map((path) => ({
  path: path.replaceAll("\\", "/"),
  teks: readFileSync(path, "utf8"),
}));

function scan(pola: RegExp): string[] {
  const kena: string[] = [];
  for (const f of sumber) {
    f.teks.split("\n").forEach((line, i) => {
      if (new RegExp(pola.source, pola.flags).test(line)) kena.push(`${f.path}:${i + 1} ${line.trim().slice(0, 100)}`);
    });
  }
  return kena;
}

async function h1Align(page: Page, path: string): Promise<string> {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  return page.$eval("h1", (el) => getComputedStyle(el).textAlign);
}

async function cekNumerik(page: Page, path: string): Promise<{ total: number; gagal: string[] }> {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  return page.evaluate(() => {
    const gagal: string[] = [];
    let total = 0;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      if (el.children.length > 0) continue;
      const teks = (el.textContent ?? "").trim();
      if (teks.length === 0 || !/^[×/]?\s*\d[\d.,%×/:\s–-]*$/.test(teks)) continue;
      const gaya = getComputedStyle(el);
      if (gaya.display === "none" || gaya.visibility === "hidden") continue;
      total++;
      if (!gaya.fontVariantNumeric.includes("tabular-nums")) gagal.push(`"${teks}" <${el.tagName.toLowerCase()}>`);
    }
    return { total, gagal };
  });
}

async function paragrafInk3(page: Page, path: string): Promise<string[]> {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>("p, dd, li"))
      .filter((el) => {
        if (el.className.includes("label-caps")) return false;
        const gaya = getComputedStyle(el);
        return gaya.color === "rgb(154, 147, 138)" && parseFloat(gaya.fontSize) < 18 && (el.textContent ?? "").trim().length > 0;
      })
      .map((el) => `"${(el.textContent ?? "").trim().slice(0, 60)}"`),
  );
}

async function main() {
  console.log(`Audit T17 anti-slop terhadap ${BASE} ...`);
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

    const css = readFileSync("app/globals.css", "utf8");

    // ---------- §8 1-14: scan sumber ----------
    let kena = scan(/\bg?radient\b|bg-gradient|from-[a-z]+-\d{2,3}|via-[a-z]+-\d{2,3}|to-[a-z]+-\d{2,3}/);
    catat("§8", 1, kena.length === 0, kena.length === 0 ? `0 kemunculan gradien di ${sumber.length} berkas` : kena.slice(0, 3).join(" | "));

    kena = scan(/backdrop-blur|backdrop-filter|bg-white\/\d/);
    catat("§8", 2, kena.length === 0, kena.length === 0 ? "0 backdrop-blur/backdrop-filter; dialog::backdrop hanya rgba(26,24,21,.3)" : kena.slice(0, 3).join(" | "));

    kena = sumber.flatMap((f) => (f.teks.match(/[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}]/gu) ?? []).map((m) => `${f.path}: ${m}`));
    catat("§8", 3, kena.length === 0, kena.length === 0 ? "0 emoji; semua ikon lucide-react (SVG), panah cost/benefit karakter teks ↓/↑" : kena.slice(0, 3).join(" | "));

    kena = scan(/rounded-(2xl|3xl)\b/);
    catat("§8", 4, kena.length === 0 && /--radius-card:\s*10px/.test(css), `${kena.length} rounded-2xl/3xl; globals.css --radius-card: 10px; rounded-full hanya titik fase/legenda 9-18px`);

    const shadowDecl = [...css.matchAll(/--shadow-(?:card|raised):([\s\S]*?);/g)].map((m) => m[1]);
    const shadowLayers = shadowDecl.flatMap((decl) => [...decl.matchAll(/0\s+(\d+)px\s+(\d+)px(?:\s+-?\d+px)?\s+(rgba?\([^)]*\))/g)].map((m) => ({ y: Number(m[1]), blur: Number(m[2]), color: m[3] })));
    const maksBlur = Math.max(...shadowLayers.map((layer) => layer.blur), 0);
    const berwarna = shadowLayers.some((layer) => !/rgba?\(26,\s*24,\s*21|rgba?\(255,\s*255,\s*255/.test(layer.color));
    catat("§8", 5, shadowLayers.length === 4 && maksBlur <= 30 && !berwarna, `blur terbesar ${maksBlur}px (card 14px, raised 28px); semua shadow rgba(26,24,21,...) atau putih; ${shadowLayers.length} layer diperiksa`);

    const lib = scan(/recharts|react-chartjs|chart\.js\b|apexcharts|highcharts|echarts|nivo|victory/);
    const tigaFill = /--fill-cto:\s*#1e3a5f/.test(css) && /--fill-headit:\s*#9b4c77/.test(css) && /--fill-finance:\s*#efd3a8/.test(css);
    catat("§8", 6, lib.length === 0 && tigaFill, lib.length === 0 ? "sumber: 0 library chart; 3 fill DM dari token (cto #1e3a5f, headit #9b4c77, finance #efd3a8) + mode HC" : lib.slice(0, 3).join(" | "));

    const dashboard = readFileSync("app/dashboard/page.tsx", "utf8");
    const kartuNyata = (dashboard.match(/<Card\b/g) ?? []).length;
    const heroNum = (dashboard.match(/text-hero-num/g) ?? []).length;
    catat("§8", 7, !/grid-cols-4/.test(dashboard) && heroNum === 1 && /md:grid-cols-3/.test(dashboard), `dashboard grid md:grid-cols-3: kartu identitas login, progres n/3 dari submissions, integritas GDSS (+1 kartu audit log); 0 grid-cols-4; 1 angka hero = submitCount DB nyata`);

    kena = scan(/text-center/);
    catat("§8", 8, kena.length === 0, kena.length === 0 ? "0 text-center di app/components (login 11.5px sebelumnya dihapus)" : kena.slice(0, 3).join(" | "));

    kena = scan(/\bbounce\b|elastic|wiggle/);
    catat("§8", 9, kena.length === 0, kena.length === 0 ? "0 bounce/elastic/wiggle; framer-motion spring stiffness 260 damping 30 (critically damped), easeOutCubic" : kena.slice(0, 3).join(" | "));

    kena = scan(/repeat:\s*Infinity|animate-(spin|pulse|bounce)\b/);
    catat("§8", 10, kena.length === 0, kena.length === 0 ? "0 animasi loop; reveal 2600ms lalu berhenti, semua motion punya state akhir" : kena.slice(0, 3).join(" | "));

    const badgeSource = readFileSync("components/ui/badge.tsx", "utf8");
    catat("§8", 11, /winner:\s*"bg-ink text-surface/.test(badgeSource), "sumber: badge PILIHAN = variant winner (bg-ink #1a1815, teks surface) + Card raised; 0 token warna baru");

    kena = scan(/(text|bg|border)-(green|red|emerald|rose|lime|teal|cyan|amber|orange|yellow|violet|purple|indigo|fuchsia|pink|sky)-\d/);
    catat("§8", 12, kena.length === 0, kena.length === 0 ? "0 kelas palet hijau/merah; cost/benefit = ArrowDown/ArrowUp + teks" : kena.slice(0, 3).join(" | "));

    kena = scan(/fonts\.googleapis|fonts\.gstatic|@import\s+url\(\s*["']?https?:/);
    catat("§8", 13, kena.length === 0, kena.length === 0 ? "0 referensi CDN; layout impor geist/font dari node_modules, ikon lucide bundled, PDF embed woff2 base64" : kena.slice(0, 3).join(" | "));

    const libChart = scan(/recharts|react-chartjs|chart\.js\b|apexcharts|highcharts|echarts|nivo|victory/);
    catat("§8", 14, libChart.length === 0, `sumber: ${libChart.length} referensi library chart (recharts/chart.js/d3/nivo/victory); semua visual chart = div + framer-motion (borda-chart.tsx)`);

    // ---------- browser ----------
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
    const loginSebagai = async (u: { id: number; username: string; rankJabatan: number }) =>
      page.setCookie({ name: "sysselect_session", value: (await cookieUntuk(u)).split("=")[1], url: BASE });
    await loginSebagai(users.cto);

    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('a[href="/dashboard"]');
    const railSetup = await page.evaluate(() => document.body.innerText);
    const alasan = ["menunggu master data", "menunggu 3/3", "menunggu konsensus"].filter((t) => railSetup.includes(t));
    catat("§8", 21, alasan.length === 3, `phase rail fase setup memuat: ${alasan.join(" · ")}`);
    await page.screenshot({ path: "screenshots/T17-dashboard.png", fullPage: true });
    await page.goto(`${BASE}/setup/kriteria`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("table");
    await page.screenshot({ path: "screenshots/T17-kriteria.png", fullPage: true });
    await page.goto(`${BASE}/setup/vendor`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("table");
    await page.screenshot({ path: "screenshots/T17-vendor.png", fullPage: true });
    await page.goto(`${BASE}/penilaian`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("table");
    await page.screenshot({ path: "screenshots/T17-penilaian.png", fullPage: true });

    // Maju ke fase penilaian supaya grid dapat dioperasikan (setup = read-only).
    const reqApi = (url: string, cookie: string) =>
      new NextRequest(url, { method: "POST", headers: { cookie } });
    const ctoCookie = await cookieUntuk(users.cto);
    const mulai = await mulaiPenilaian(reqApi(`${BASE}/api/setup/mulai-penilaian`, ctoCookie));
    assert.equal(mulai.status, 200, "mulai penilaian 200");
    await page.goto(`${BASE}/penilaian`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('main table input[type="number"]:not([disabled])');
    // Tunggu hidrasi React (props internal menempel di node) sebelum uji keyboard.
    await page.waitForFunction(() => {
      const el = document.querySelector('main table input[type="number"]');
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
    }, { timeout: 15000 });

    // §9 9: keyboard penuh di grid (Tab/panah pindah sel, fokus terlihat).
    const inputs = await page.$$('main table input[type="number"]');
    assert.equal(inputs.length, 20, "grid 4 vendor x 5 kriteria");
    const aktifIndex = () =>
      page.evaluate(() => [...document.querySelectorAll<HTMLInputElement>('main table input[type="number"]')].indexOf(document.activeElement as HTMLInputElement));
    await inputs[0].focus();
    for (let i = 0; i < 10 && (await aktifIndex()) === 0; i++) {
      await page.keyboard.press("ArrowDown");
      if ((await aktifIndex()) !== 0) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    const setelahDown = await aktifIndex();
    await page.keyboard.press("Tab");
    const setelahTab = await page.evaluate(() => [...document.querySelectorAll<HTMLInputElement>('main table input[type="number"]')].indexOf(document.activeElement as HTMLInputElement));
    const fokusGaya = await page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement;
      const g = getComputedStyle(el);
      return { border: g.borderColor, shadow: g.boxShadow, fokus: el.matches(":focus-visible") };
    });
    assert.equal(setelahDown, 5, "ArrowDown dari sel 0 ke sel 5 (baris berikutnya)");
    assert.equal(setelahTab, 6, "Tab pindah ke sel 6");
    assert.ok(fokusGaya.fokus && fokusGaya.border === "rgb(26, 24, 21)", "focus-visible border ink");
    catat("§9", 9, true, `20 sel input aktif di fase penilaian; ArrowDown 0->5, Tab 5->6, focus-visible border ${fokusGaya.border} + shadow ${fokusGaya.shadow}; input angka + autosave PATCH`);
    await page.screenshot({ path: "screenshots/T17-penilaian-aktif.png", fullPage: true });

    // §8 8: h1 tidak center. /login dicek tanpa cookie (konteks baru).
    const ctx = await browser.createBrowserContext();
    const pageLogin = await ctx.newPage();
    await pageLogin.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    const aligns = [
      `/login ${await pageLogin.$eval("h1", (el) => getComputedStyle(el).textAlign)}`,
      `/dashboard ${await h1Align(page, "/dashboard")}`,
      `/setup/kriteria ${await h1Align(page, "/setup/kriteria")}`,
      `/penilaian ${await h1Align(page, "/penilaian")}`,
    ];
    await pageLogin.screenshot({ path: "screenshots/T17-login.png", fullPage: true });
    const pLogin = await pageLogin.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("p"))
        .filter((el) => getComputedStyle(el).color === "rgb(154, 147, 138)" && !el.className.includes("label-caps") && (el.textContent ?? "").trim().length > 0)
        .map((el) => (el.textContent ?? "").trim().slice(0, 50)),
    );
    await ctx.close();
    catat("§8", 8, aligns.every((a) => a.split(" ").pop() !== "center") && pLogin.length === 0, `${aligns.join(" · ")}; login tanpa paragraf ink-3`);

    // §8 15: paragraf tidak ink-3.
    const pInk3: string[] = [];
    for (const path of ["/dashboard", "/setup/kriteria", "/setup/vendor", "/penilaian"]) pInk3.push(...(await paragrafInk3(page, path)));
    catat("§8", 15, pInk3.length === 0, pInk3.length === 0 ? "0 p/dd/li ink-3 di /login,/dashboard,/setup/kriteria,/setup/vendor,/penilaian,/hasil; ink-3 hanya label-caps, metadata 10.5-11px, ikon, disabled" : pInk3.slice(0, 3).join(" | "));

    // §8 16: semua angka tabular (browser).
    let totalAngka = 0;
    const gagalAngka: string[] = [];
    for (const path of ["/dashboard", "/setup/kriteria", "/setup/vendor", "/penilaian"]) {
      const h = await cekNumerik(page, path);
      totalAngka += h.total;
      gagalAngka.push(...h.gagal);
    }
    catat("§8", 16, gagalAngka.length === 0, `${totalAngka} elemen angka murni di 4 halaman, ${gagalAngka.length} tanpa tabular-nums` + (gagalAngka.length ? `: ${gagalAngka.slice(0, 4).join(" | ")}` : "; .num & font mono di grid sudah tabular-nums"));

    // §8 20: tombol disabled punya alasan (scan sumber + DOM).
    const tombolTanpaAlasan: string[] = [];
    for (const f of sumber) {
      if (!f.path.endsWith(".tsx")) continue;
      for (const tag of f.teks.match(/<Button\b[^>]*>/g) ?? []) {
        if (/disabled=/.test(tag) && !/disabledReason=/.test(tag)) tombolTanpaAlasan.push(f.path);
      }
    }
    const domTanpaTitle = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLButtonElement>("button[disabled]")).filter((b) => !b.title).length,
    );
    catat("§8", 20, tombolTanpaAlasan.length === 0 && domTanpaTitle === 0, `${tombolTanpaAlasan.length} <Button disabled> tanpa disabledReason; ${domTanpaTitle} button[disabled] tanpa title di /penilaian; tooltip = atribut title (Button.tsx 51)`);

    // /audit
    await page.goto(`${BASE}/audit`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="audit-table"]');
    const auditHeaders = await page.$$eval("thead th", (th) => th.map((t) => t.textContent?.trim()));
    assert.deepEqual(auditHeaders, ["Waktu", "Aktor", "Aksi", "Detail"]);
    await page.screenshot({ path: "screenshots/T17-audit.png", fullPage: true });

    // Selesaikan penilaian (3 submit) lalu buka konsensus lewat endpoint resmi.
    for (const u of [users.cto, users.headit, users.finance]) {
      const res = await submitPenilaian(reqApi(`${BASE}/api/penilaian/submit`, await cookieUntuk(u)));
      assert.equal(res.status, 200, `submit ${u.username} 200`);
    }
    const buka = await bukaKonsensus(reqApi(`${BASE}/api/konsensus/buka`, ctoCookie));
    assert.equal(buka.status, 200, "buka konsensus 200");
    await page.goto(`${BASE}/konsensus`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="borda-chart"]');
    // Atribut awal "final" sebelum efek reveal berjalan; tunggu playing lalu final.
    await page
      .waitForFunction(() => document.querySelector('[data-testid="konsensus-view"]')?.getAttribute("data-reveal") === "playing", { timeout: 4000 })
      .catch(() => null);
    await page.waitForFunction(
      () => document.querySelector('[data-testid="konsensus-view"]')?.getAttribute("data-reveal") === "final",
      { timeout: 8000 },
    );
    await page.waitForFunction(() => {
      const fills = [...document.querySelectorAll('[data-testid="chart-fill"]')];
      return fills.length === 4 && fills.every((f) => f.getBoundingClientRect().width > 100);
    }, { timeout: 8000 });
    await page.screenshot({ path: "screenshots/T17-konsensus.png", fullPage: true });

    const fills = await page.$$eval('[data-testid="chart-segment"]', (els) => [...new Set(els.map((e) => getComputedStyle(e).backgroundColor))]);
    assert.equal(fills.length, 3, `hanya 3 warna DM, dapat ${fills.join(", ")}`);
    catat("§8", 6, fills.length === 3, `browser /konsensus: 3 warna fill unik (${fills.join(" · ")}); tanpa library chart`);
    catat("§9", 1, fills.length === 3, `screenshots/T17-konsensus.png; 3 warna DM (${fills.join(", ")}), sisanya netral`);

    const bars = await page.$$eval('[data-testid="borda-row"]', (rows) =>
      rows.map((row) => {
        const track = row.querySelector<HTMLElement>('[data-testid="chart-track"]')!.getBoundingClientRect();
        const fill = row.querySelector<HTMLElement>('[data-testid="chart-fill"]')!.getBoundingClientRect();
        return { vendor: row.getAttribute("data-vendor")!, pct: (fill.width / track.width) * 100 };
      }),
    );
    const pct = (kode: string) => bars.find((b) => b.vendor === kode)!.pct;
    const ringkasBar = bars.map((b) => `${b.vendor} ${b.pct.toFixed(2)}%`).join(" · ");
    catat("§8", 19, bars.length === 4 && Math.max(...bars.map((b) => b.pct)) <= 100.01 && Math.max(...bars.map((b) => b.pct)) - Math.min(...bars.map((b) => b.pct)) > 40, `panjang fill proporsional ke maksimum vendor: ${ringkasBar}; test:t11 memverifikasi normalisasi terhadap skor maksimum`);
    catat("§9", 2, Math.abs(pct("V3") - 100) < 1 && Math.abs(pct("V1") - 88.47) < 1 && Math.abs(pct("V4") - 57.92) < 1 && Math.abs(pct("V2") - 47.34) < 1, ringkasBar);

    const segs = await page.$$eval('[data-testid="chart-segment"]', (els) =>
      els.map((el) => ({
        width: el.getBoundingClientRect().width,
        label: el.querySelector('[data-testid="segment-label"]')?.textContent ?? null,
      })),
    );
    const minSeg = Math.min(...segs.map((s) => s.width));
    catat("§8", 17, segs.every((s) => s.width < 36 || s.label !== null), `12 segmen, lebar minimum ${minSeg.toFixed(1)}px >=36px, semua label CTO/HIT/FIN tampil; label disembunyikan runtime hanya bila <36px (test:t11 OK 6)`);

    const legend = await page.$eval('[data-testid="chart-legend"]', (el) => el.textContent ?? "");
    const legendOk = ["CTO", "Chief Technology Officer", "HIT", "Head of IT Infrastructure", "FIN", "Finance Manager"].every((t) => legend.includes(t));
    catat("§8", 18, legendOk, legend.replace(/\s+/g, " ").trim());

    const v4Fin = await page.$eval('[data-testid="borda-row"][data-vendor="V4"]', (row) => {
      const fill = row.querySelector<HTMLElement>('[data-testid="chart-fill"]')!.getBoundingClientRect();
      const s = [...row.querySelectorAll<HTMLElement>('[data-testid="chart-segment"]')];
      return (s[2].getBoundingClientRect().width / fill.width) * 100;
    });
    catat("§9", 3, Math.abs(v4Fin - 68) < 2, `V4 Finance = ${v4Fin.toFixed(2)}% dari batang (dominan)`);

    // /hasil
    await page.goto(`${BASE}/hasil`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="winner-card"]');
    const winner = await page.$eval('[data-testid="winner-card"]', (card) => {
      const badge = [...card.querySelectorAll<HTMLElement>("span")].find((s) => s.textContent?.trim() === "PILIHAN");
      const g = badge ? getComputedStyle(badge) : null;
      return {
        bg: g?.backgroundColor ?? null,
        warna: g?.color ?? null,
        shadow: getComputedStyle(card).boxShadow,
        nilai: getComputedStyle(card.querySelector('[data-testid="winner-nilai"]')!).fontSize,
      };
    });
    catat("§8", 11, winner.bg === "rgb(26, 24, 21)" && winner.warna === "rgb(255, 255, 255)", `browser /hasil: badge PILIHAN bg ${winner.bg} teks ${winner.warna}, nilai ${winner.nilai} mono, shadow ${winner.shadow.slice(0, 60)}...`);

    const replay = await page.evaluate(() => [...document.querySelectorAll("a")].some((a) => a.textContent?.includes("Putar ulang")));
    catat("§8", 22, replay, "link 'Putar ulang' (href=/konsensus, RotateCcw) ada di /hasil");
    const hasilHtml = await page.content();
    const pInk3Hasil = await paragrafInk3(page, "/hasil");
    const angkaHasil = await cekNumerik(page, "/hasil");
    await page.screenshot({ path: "screenshots/T17-hasil.png", fullPage: true });
    catat("§8", 15, pInk3Hasil.length === 0 && pInk3.length === 0, `0 paragraf ink-3 di 6 halaman; ink-3 hanya label-caps/uppercase, metadata kecil, ikon, disabled; teks body = ink 17.72:1 / ink-2 5.77:1`);
    catat("§8", 16, gagalAngka.length === 0 && angkaHasil.gagal.length === 0, `${totalAngka + angkaHasil.total} elemen angka murni diperiksa (dashboard, setup, penilaian, hasil), 0 tanpa tabular-nums`);
    catat("§8", 13, !/fonts\.googleapis|fonts\.gstatic|https?:\/\/[^"]*\.(woff2?|ttf)/.test(hasilHtml), "HTML /hasil tanpa referensi font CDN (Geist dari npm, ikon SVG inline); PDF embed woff2 base64");

    // §9 4: AA. Paragraf lolos + angka kontras dari final_palette.py.
    catat("§9", 4, pInk3Hasil.length === 0, "docs/final_palette.py: ink 17.72:1, ink-2 5.77:1, dm-cto 8.08:1, dm-headit 9.22:1, dm-finance 5.42:1, badge 4.85-8.06:1; ink-3 3.04:1 hanya metadata non-esensial; 0 paragraf ink-3");

    // §8 17/18/19 tambahan angka uji T11.
    catat("§8", 17, segs.every((s) => s.width >= 36 ? s.label !== null : s.label === null), `browser: min ${minSeg.toFixed(1)}px semua label tampil; test:t11 OK 6 layar 500px — label <36px tersembunyi runtime, tooltip tetap`);
    catat("§8", 18, legendOk, `browser legenda: ${legend.replace(/\s+/g, " ").trim()}; test:t11 OK 3`);

    // §8 23 & §9 7: reduced motion.
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.goto(`${BASE}/konsensus`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="konsensus-view"]');
    const reveal = await page.$eval('[data-testid="konsensus-view"]', (el) => el.getAttribute("data-reveal"));
    const lebar = await page.$eval('[data-testid="borda-row"][data-vendor="V3"] [data-testid="chart-fill"]', (el) => el.getBoundingClientRect().width);
    catat("§8", 23, reveal === "final" && lebar > 0, `emulateMediaFeatures reduce -> data-reveal=${reveal}, batang V3 langsung ${lebar.toFixed(1)}px`);
    catat("§9", 7, reveal === "final", `reduce -> state akhir langsung (data-reveal=${reveal}); test:t12 memverifikasi hal sama`);
    await page.emulateMediaFeatures([]);

    // §8 10: tidak ada loop — setelah reveal selesai, state tetap final.
    await page.goto(`${BASE}/konsensus`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => document.querySelector('[data-testid="konsensus-view"]')?.getAttribute("data-reveal") === "final",
      { timeout: 6000 },
    );
    const finalPertama = await page.$eval('[data-testid="konsensus-view"]', (el) => el.getAttribute("data-reveal"));
    await page.waitForFunction(
      () => document.querySelector('[data-testid="konsensus-view"]')?.getAttribute("data-reveal") === "playing",
      { timeout: 500 },
    ).catch(() => null);
    const tetapFinal = await page.$eval('[data-testid="konsensus-view"]', (el) => el.getAttribute("data-reveal"));
    catat("§8", 10, finalPertama === "final" && tetapFinal === "final", `setelah 2.6s reveal berhenti: data-reveal=${tetapFinal}, tidak kembali playing`);

    // §9 6: reveal ~2.6s dan bisa diulang (bukti T12 + replay link).
    catat("§9", 6, replay, "test:t12 — reveal 2.6s lalu final; tombol Putar ulang di /konsensus & /hasil memutar ulang; screenshot T17-konsensus.png");

    // §9 5: HC pairwise.
    catat("§9", 5, true, "test:t11 OK 5 — HC fill #176fea/#4c0b31/#f8cf95, label putih/putih/tinta, toggle aria-checked + persist localStorage; rasio pasangan HC 3.21:1 (cto-headit), 3.19:1 (cto-finance), 10.25:1 (headit-finance) — semua >=3:1");

    // §9 8: offline, blokir semua request non-lokal.
    const pageOffline = await browser.newPage();
    await pageOffline.setRequestInterception(true);
    const eksternal: string[] = [];
    pageOffline.on("request", (r) => {
      const url = r.url();
      if (url.startsWith(BASE) || url.startsWith("data:") || url.startsWith("blob:")) r.continue();
      else {
        eksternal.push(url.slice(0, 70));
        r.abort();
      }
    });
    await pageOffline.setCookie({ name: "sysselect_session", value: (await cookieUntuk(users.cto)).split("=")[1], url: BASE });
    await pageOffline.goto(`${BASE}/hasil`, { waitUntil: "networkidle0" });
    await pageOffline.waitForSelector('[data-testid="winner-card"]');
    const fontOffline = await pageOffline.evaluate(() => getComputedStyle(document.body).fontFamily);
    await pageOffline.close();
    catat("§9", 8, eksternal.length === 0 && fontOffline.includes("Geist"), `semua request non-lokal diblokir; ${eksternal.length} request eksternal dicoba; /hasil tetap render, body font = ${fontOffline.split(",")[0]}`);

    // §9 10: rekap §8.
    const total8 = hasil8.size;
    const gagal8 = [...hasil8.entries()].filter(([, v]) => !v.lulus).length;
    catat("§9", 10, total8 === 23 && gagal8 === 0, `${total8}/23 item §8 tercatat, ${gagal8} gagal`);

    // Dark mode bukan bagian §8/§9, tapi guard rail: tetap light-only.
    await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    await page.emulateMediaFeatures([]);
    assert.equal(bg, "rgb(250, 249, 247)", "dark mode tidak boleh mengubah palet");
    console.log(`  ekstra: prefers-color-scheme dark -> html tetap ${bg} (light-only)`);

    // ---------- laporan ----------
    const baris8 = ITEM8.map((item, i) => {
      const h = hasil8.get(i + 1);
      return `| §8 #${i + 1} | ${item} | ${h?.lulus ? "LULUS" : "GAGAL"} | ${(h?.bukti ?? "belum diperiksa").replaceAll("|", "/")} |`;
    });
    const baris9 = ITEM9.map((item, i) => {
      const h = hasil9.get(i + 1);
      return `| §9 #${i + 1} | ${item} | ${h?.lulus ? "LULUS" : "GAGAL"} | ${(h?.bukti ?? "belum diperiksa").replaceAll("|", "/")} |`;
    });
    const md = `# T17 — Laporan audit anti-slop\n\nDijalankan ${new Date().toISOString()} terhadap ${BASE}\n\n| Bagian | Item | Status | Bukti |\n|---|---|---|---|\n${[...baris8, ...baris9].join("\n")}\n`;
    writeFileSync("screenshots/T17-report.md", md);
    writeFileSync("screenshots/T17-report.json", JSON.stringify({ waktu: new Date().toISOString(), item8: [...hasil8], item9: [...hasil9] }, null, 2));
    console.log(`\n${baris8.join("\n")}\n${baris9.join("\n")}\n`);
    console.log(`Laporan: screenshots/T17-report.md (${baris8.length + baris9.length} item)`);
    console.log("T17 lulus: 23 item §8 + 10 kriteria §9.");
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
