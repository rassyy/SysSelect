/**
 * T16 — Berita Acara PDF.
 * Pilihan implementasi: puppeteer-core + Chrome/Edge sistem (sudah ada di
 * devDependencies, dipakai uji browser T12). Tidak mengunduh browser,
 * demo tetap offline. Font Geist di-embed base64 dari paket npm 'geist'
 * supaya PDF tidak memanggil CDN. Tanpa library chart, tanpa emoji.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import type { DataHasil } from "@/lib/hitung/rincian";

const SANS = join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2");
const MONO = join(process.cwd(), "node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2");

const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

function esc(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fontFace(nama: string, file: string): string {
  if (!existsSync(file)) return "";
  const base64 = readFileSync(file).toString("base64");
  return `@font-face{font-family:'${nama}';src:url(data:font/woff2;base64,${base64}) format('woff2');font-weight:100 900;font-style:normal;}`;
}

function waktu(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" });
}

export function buildBeritaAcaraHtml(data: DataHasil, dicetakOleh: string): string {
  const dmKeys = ["CTO", "HEAD_IT", "FINANCE"];
  const kriteriaHead = data.criteria
    .map((c) => `<th class="num"><span>${esc(c.kode)}</span><br><small>${c.bobot}%</small></th>`)
    .join("");

  const kriteriaRows = data.criteria
    .map(
      (c) => `<tr>
        <td class="mono">${esc(c.kode)}</td>
        <td>${esc(c.nama)}</td>
        <td class="num">${c.bobot}%</td>
        <td>${c.tipe === "cost" ? "cost · ↓ lebih baik" : "benefit · ↑ lebih baik"}</td>
        <td>${esc(c.satuan)}</td>
      </tr>`,
    )
    .join("");

  const sawRows = data.vendors
    .map((vendor) => {
      const cells = data.dms
        .map((dm) => {
          const cell = data.sawCells.find((c) => c.userId === dm.id && c.vendorId === vendor.id);
          if (!cell) return `<td class="num">—</td>`;
          return `<td class="num">${cell.skor.toFixed(6)} <span class="rank">${cell.peringkat}</span></td>`;
        })
        .join("");
      return `<tr><td><span class="mono">${esc(vendor.kode)}</span> ${esc(vendor.nama)}</td>${cells}</tr>`;
    })
    .join("");

  const bordaRows = data.bordaRows
    .map(
      (row) => `<tr class="${row.peringkat === 1 ? "winner" : ""}">
        <td class="num">${row.peringkat}</td>
        <td><span class="mono">${esc(row.kode)}</span> ${esc(row.nama)}</td>
        <td class="num">${row.poin.toFixed(6)}</td>
        <td class="num">${row.nilai.toFixed(8)}</td>
        <td class="num">${(row.nilai * 100).toFixed(4)}%</td>
        <td>${row.peringkat === 1 ? "PILIHAN" : ""}</td>
      </tr>`,
    )
    .join("");

  const dmRows = data.dms
    .map((dm) => {
      const rincian = data.dmRincian.find((d) => d.id === dm.id);
      return `<tr>
        <td>${esc(dm.namaLengkap)}</td>
        <td>${esc(dm.jabatan)}</td>
        <td class="mono">${esc(dm.initials)}</td>
        <td class="num">${rincian?.submittedAt ? waktu(rincian.submittedAt) : "—"}</td>
      </tr>`;
    })
    .join("");

  const pengesahan =
    data.status === "sah" && data.ratifiedBy && data.ratifiedAt
      ? `<p><strong>Disahkan oleh:</strong> ${esc(data.ratifiedBy.namaLengkap)} — ${esc(data.ratifiedBy.jabatan)}</p>
         <p><strong>Waktu pengesahan:</strong> <span class="mono">${esc(waktu(data.ratifiedAt))}</span></p>`
      : `<p><strong>Status:</strong> konsensus terbuka, belum disahkan CTO.</p>`;

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Berita Acara — ${esc(data.sessionNama)}</title>
<style>
${fontFace("Geist", SANS)}
${fontFace("GeistMono", MONO)}
:root{--canvas:#faf9f7;--surface:#fff;--surface-2:#fcfbfa;--track:#f4f2ef;--hairline:#e8e4de;--hairline-2:#d8d2c8;--ink:#1a1815;--ink-2:#6b655c;--ink-3:#9a938a;}
*{box-sizing:border-box}
body{margin:0;background:var(--surface);color:var(--ink);font-family:'Geist',Arial,sans-serif;font-size:10.5pt;line-height:1.45}
.page{padding:0}
h1{font-size:19pt;font-weight:600;letter-spacing:-.02em;margin:0 0 2mm}
h2{font-size:11pt;font-weight:600;letter-spacing:-.01em;margin:7mm 0 2mm;padding-bottom:1.5mm;border-bottom:1px solid var(--hairline-2)}
.kicker{font-size:7.5pt;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);margin:0 0 1.5mm}
.meta{color:var(--ink-2);font-size:9pt;margin:1mm 0}
table{width:100%;border-collapse:collapse;font-size:9pt}
th{background:var(--surface-2);border-bottom:1px solid var(--hairline);text-align:left;padding:2mm 2.5mm;font-size:7.5pt;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3)}
td{border-bottom:1px solid var(--hairline);padding:2mm 2.5mm;vertical-align:top}
tr:last-child td{border-bottom:0}
.num{text-align:right;font-family:'GeistMono','Courier New',monospace;font-variant-numeric:tabular-nums}
.mono{font-family:'GeistMono','Courier New',monospace;font-variant-numeric:tabular-nums}
.rank{display:inline-block;min-width:4.2mm;padding:.3mm 1mm;border-radius:1.2mm;background:var(--track);color:var(--ink-2);font-size:8pt;font-weight:700;text-align:center;margin-left:1mm}
tr.winner td{background:var(--surface-2);font-weight:600}
tr.winner td:first-child{border-left:2px solid var(--ink)}
.box{border:1px solid var(--hairline-2);border-radius:2.5mm;background:var(--surface-2);padding:4mm 5mm;margin:3mm 0}
.box .kicker{margin-bottom:1mm}
.winner-name{font-size:14pt;font-weight:600;margin:0}
.winner-nilai{font-family:'GeistMono','Courier New',monospace;font-size:16pt;font-weight:600;margin:1mm 0 0}
.pill{display:inline-block;background:var(--ink);color:#fff;border-radius:1.2mm;padding:.8mm 2mm;font-size:7.5pt;font-weight:700;letter-spacing:.08em;margin-left:2mm;vertical-align:middle}
.fine{font-size:8pt;color:var(--ink-2)}
.footer{margin-top:8mm;padding-top:2mm;border-top:1px solid var(--hairline);font-size:8pt;color:var(--ink-2);display:flex;justify-content:space-between;gap:4mm}
</style>
</head>
<body>
<div class="page">
  <p class="kicker">Berita Acara Keputusan</p>
  <h1>Pemilihan Vendor Managed Cloud Service Provider</h1>
  <p class="meta">Sesi: <strong>${esc(data.sessionNama)}</strong></p>
  <p class="meta">Metode: SAW (individual) + Borda Count versi modul (konsensus kelompok)</p>
  <p class="meta">Dicetak: <span class="mono">${esc(waktu(new Date()))}</span> oleh ${esc(dicetakOleh)}</p>

  <h2>1. Decision Maker</h2>
  <table>
    <thead><tr><th>Nama</th><th>Jabatan</th><th>Inisial</th><th class="num">Submit</th></tr></thead>
    <tbody>${dmRows}</tbody>
  </table>

  <h2>2. Kriteria dan bobot</h2>
  <table>
    <thead><tr><th>Kode</th><th>Kriteria</th><th class="num">Bobot</th><th>Tipe</th><th>Satuan</th></tr></thead>
    <tbody>${kriteriaRows}</tbody>
  </table>

  <h2>3. Skor preferensi SAW per decision maker</h2>
  <table>
    <thead><tr><th>Vendor</th>${data.dms
      .map((dm) => `<th class="num">${esc(dm.initials)} · ${esc(dm.jabatan)}</th>`)
      .join("")}</tr></thead>
    <tbody>${sawRows}</tbody>
  </table>
  <p class="fine">Angka adalah skor V; badge kecil adalah peringkat individual (1 = terbaik). Normalisasi dihitung di dalam matriks masing-masing decision maker.</p>

  <h2>4. Hasil konsensus Borda Count</h2>
  <table>
    <thead><tr><th class="num">Rank</th><th>Vendor</th><th class="num">Poin</th><th class="num">Nilai</th><th class="num">Persen</th><th>Status</th></tr></thead>
    <tbody>${bordaRows}</tbody>
  </table>
  <p class="fine">Total poin ${data.totalPoin.toFixed(6)} · jumlah nilai 1.00000000. Poin = Σ (grup skor per peringkat × bobot Borda); nilai = poin ÷ total poin.</p>

  <div class="box">
    <p class="kicker">Pemenang</p>
    <p class="winner-name"><span class="mono">${esc(data.winner.kode)}</span> · ${esc(data.winner.namaVendor)}<span class="pill">PILIHAN</span></p>
    <p class="winner-nilai">${data.winner.nilai.toFixed(8)}</p>
    <p class="fine">Poin Borda ${data.winner.poin.toFixed(6)} · peringkat 1 dari ${data.bordaRows.length} vendor</p>
  </div>

  <h2>5. Pengesahan</h2>
  ${pengesahan}

  <h2>6. Rekaman aktivitas</h2>
  <table>
    <thead><tr><th>Waktu</th><th>Aktor</th><th>Aksi</th></tr></thead>
    <tbody>${data.logs
      .map(
        (log) => `<tr>
          <td class="mono">${esc(waktu(log.waktu))}</td>
          <td>${esc(log.aktor)} — ${esc(log.jabatan)}</td>
          <td>${esc(log.label)}</td>
        </tr>`,
      )
      .join("")}</tbody>
  </table>

  <div class="footer">
    <span>SysSelect GDSS · ${esc(data.sessionNama)}</span>
    <span>Dokumen dihasilkan otomatis dari snapshot saw_results dan borda_results.</span>
  </div>
</div>
</body>
</html>`;
}

export async function renderBeritaAcaraPdf(data: DataHasil, dicetakOleh: string): Promise<Buffer> {
  const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!executablePath) {
    throw new Error("Chrome/Edge sistem tidak ditemukan untuk membuat PDF.");
  }
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(buildBeritaAcaraHtml(data, dicetakOleh), { waitUntil: "load" });
    await page.evaluateHandle("document.fonts.ready");
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;font-family:Arial,sans-serif;font-size:7.5pt;color:#6b655c;padding:0 18mm;display:flex;justify-content:flex-end;">Halaman <span class="pageNumber"></span> dari <span class="totalPages"></span></div>',
      margin: { top: "18mm", right: "18mm", bottom: "16mm", left: "18mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
