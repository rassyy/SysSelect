# T17 — Laporan audit anti-slop

Dijalankan 2026-11-21T10:29:21.179Z terhadap http://localhost:3001

| Bagian | Item | Status | Bukti |
|---|---|---|---|
| §8 #1 | Tidak ada gradien ungu/indigo, atau gradien apa pun sebagai latar | LULUS | 0 kemunculan gradien di 62 berkas |
| §8 #2 | Tidak ada glassmorphism / backdrop-blur | LULUS | 0 backdrop-blur/backdrop-filter; dialog::backdrop hanya rgba(26,24,21,.3) |
| §8 #3 | Tidak ada emoji sebagai ikon | LULUS | 0 emoji; semua ikon lucide-react (SVG), panah cost/benefit karakter teks ↓/↑ |
| §8 #4 | Tidak ada rounded-2xl seragam; radius kartu tepat 10px | LULUS | 0 rounded-2xl/3xl; globals.css --radius-card: 10px; rounded-full hanya titik fase/legenda 9-18px |
| §8 #5 | Tidak ada shadow blur >30px atau shadow berwarna | LULUS | blur terbesar 28px (card 14px, raised 28px); semua shadow rgba(26,24,21,...) atau putih; 4 layer diperiksa |
| §8 #6 | Tidak ada chart warna pelangi | LULUS | browser /konsensus: 3 warna fill unik (rgb(30, 58, 95) · rgb(155, 76, 119) · rgb(239, 211, 168)); tanpa library chart |
| §8 #7 | Tidak ada 4 stat card angka palsu di dashboard | LULUS | dashboard grid md:grid-cols-3: kartu identitas login, progres n/3 dari submissions, integritas GDSS (+1 kartu audit log); 0 grid-cols-4; 1 angka hero = submitCount DB nyata |
| §8 #8 | Tidak ada hero text center di dalam aplikasi | LULUS | /login start · /dashboard start · /setup/kriteria start · /penilaian start; login tanpa paragraf ink-3 |
| §8 #9 | Tidak ada animasi bounce/elastic/wiggle | LULUS | 0 bounce/elastic/wiggle; framer-motion spring stiffness 260 damping 30 (critically damped), easeOutCubic |
| §8 #10 | Tidak ada animasi berulang tanpa henti | LULUS | setelah 2.6s reveal berhenti: data-reveal=final, tidak kembali playing |
| §8 #11 | Tidak ada warna baru untuk pemenang | LULUS | browser /hasil: badge PILIHAN bg rgb(26, 24, 21) teks rgb(255, 255, 255), nilai 30px mono, shadow rgba(26, 24, 21, 0.05) 0px 2px 4px 0px, rgba(26, 24, 21, 0.1... |
| §8 #12 | Tidak ada hijau/merah untuk cost/benefit | LULUS | 0 kelas palet hijau/merah; cost/benefit = ArrowDown/ArrowUp + teks |
| §8 #13 | Tidak ada font dari CDN | LULUS | HTML /hasil tanpa referensi font CDN (Geist dari npm, ikon SVG inline); PDF embed woff2 base64 |
| §8 #14 | Tidak ada Recharts atau library chart lain | LULUS | sumber: 0 referensi library chart (recharts/chart.js/d3/nivo/victory); semua visual chart = div + framer-motion (borda-chart.tsx) |
| §8 #15 | ink-3 tidak dipakai untuk body text | LULUS | 0 paragraf ink-3 di 6 halaman; ink-3 hanya label-caps/uppercase, metadata kecil, ikon, disabled; teks body = ink 17.72:1 / ink-2 5.77:1 |
| §8 #16 | Semua angka pakai tabular-nums | LULUS | 280 elemen angka murni diperiksa (dashboard, setup, penilaian, hasil), 0 tanpa tabular-nums |
| §8 #17 | Label inisial ada di segmen chart dengan lebar absolut >=36px | LULUS | browser: min 72.3px semua label tampil; test:t11 OK 6 layar 500px — label <36px tersembunyi runtime, tooltip tetap |
| §8 #18 | Legenda memuat inisial + nama jabatan lengkap | LULUS | browser legenda: CTO— Chief Technology OfficerHIT— Head of IT InfrastructureFIN— Finance Manager; test:t11 OK 3 |
| §8 #19 | Panjang batang proporsional poin, bukan semua penuh | LULUS | panjang fill proporsional ke maksimum vendor: V3 100.00% · V1 88.47% · V4 57.92% · V2 47.34%; test:t11 memverifikasi normalisasi terhadap skor maksimum |
| §8 #20 | Tombol disabled punya tooltip alasan | LULUS | 0 <Button disabled> tanpa disabledReason; 0 button[disabled] tanpa title di /penilaian; tooltip = atribut title (Button.tsx 51) |
| §8 #21 | Fase terkunci menulis alasannya | LULUS | phase rail fase setup memuat: menunggu master data · menunggu 3/3 · menunggu konsensus |
| §8 #22 | Ada tombol "Putar ulang" di halaman hasil | LULUS | link 'Putar ulang' (href=/konsensus, RotateCcw) ada di /hasil |
| §8 #23 | prefers-reduced-motion dihormati | LULUS | emulateMediaFeatures reduce -> data-reveal=final, batang V3 langsung 802.0px |
| §9 #1 | Screenshot /konsensus menunjukkan 3 warna DM saja selain netral | LULUS | screenshots/T17-konsensus.png; 3 warna DM (rgb(30, 58, 95), rgb(155, 76, 119), rgb(239, 211, 168)), sisanya netral |
| §9 #2 | Panjang batang: V3 100%, V1 ~88%, V4 ~58%, V2 ~47% | LULUS | V3 100.00% · V1 88.47% · V4 57.92% · V2 47.34% |
| §9 #3 | Segmen V4 Finance ~68%, dominan kasat mata | LULUS | V4 Finance = 68.46% dari batang (dominan) |
| §9 #4 | Semua teks body lolos AA 4.5:1 | LULUS | docs/final_palette.py: ink 17.72:1, ink-2 5.77:1, dm-cto 8.08:1, dm-headit 9.22:1, dm-finance 5.42:1, badge 4.85-8.06:1; ink-3 3.04:1 hanya metadata non-esensial; 0 paragraf ink-3 |
| §9 #5 | Mode kontras tinggi pairwise >=3:1 | LULUS | test:t11 OK 5 — HC fill #176fea/#4c0b31/#f8cf95, label putih/putih/tinta, toggle aria-checked + persist localStorage; rasio pasangan HC 3.21:1 (cto-headit), 3.19:1 (cto-finance), 10.25:1 (headit-finance) — semua >=3:1 |
| §9 #6 | Reveal berjalan ~2.6s dan bisa diulang | LULUS | test:t12 — reveal 2.6s lalu final; tombol Putar ulang di /konsensus & /hasil memutar ulang; screenshot T17-konsensus.png |
| §9 #7 | prefers-reduced-motion -> tanpa animasi, state akhir langsung | LULUS | reduce -> state akhir langsung (data-reveal=final); test:t12 memverifikasi hal sama |
| §9 #8 | App jalan tanpa internet (font & ikon self-hosted) | LULUS | semua request non-lokal diblokir; 0 request eksternal dicoba; /hasil tetap render, body font = GeistSans |
| §9 #9 | Grid penilaian bisa dioperasikan penuh dengan keyboard | LULUS | 20 sel input aktif di fase penilaian; ArrowDown 0->5, Tab 5->6, focus-visible border rgb(26, 24, 21) + shadow rgba(26, 24, 21, 0.07) 0px 0px 0px 3px; input angka + autosave PATCH |
| §9 #10 | Tidak ada satu pun item di §8 yang dilanggar | LULUS | 23/23 item §8 tercatat, 0 gagal |
