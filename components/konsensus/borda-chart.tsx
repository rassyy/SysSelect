"use client";

/**
 * T11 — Chart Borda hero (DESIGN.md 6). TANPA library chart: div + Framer Motion.
 *
 * Struktur: [label vendor 112px] [track flex] [nilai 74px]. Track 22px.
 * Panjang fill PROPORSIONAL poin (poin/max*100) — jangan semua penuh.
 * 3 segmen per batang, lebar = kontribusi DM / poin vendor.
 * Label inisial CTO/HIT/FIN wajib (kontras antar-fill hanya 2.02:1);
 * disembunyikan HANYA bila lebar render <36px (diukur runtime, bukan daftar).
 * Fill sengaja beda dari warna teks DM (DESIGN.md 1.6). Mode kontras tinggi
 * menukar fill ke hc-* (lolos 3:1 pairwise), preferensi di localStorage.
 * Pemenang: badge tinta + elevasi, BUKAN warna baru.
 */
import * as React from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BordaRow, ChartSegment, DmInfo } from "./types";
import { CountUp } from "./count-up";

const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as const;
const SPRING = { type: "spring", stiffness: 260, damping: 30, mass: 1 } as const;
const HC_KEY = "sysselect.hc";

function fillVar(role: ChartSegment["role"], hc: boolean): string {
  return hc ? `var(--hc-${role})` : `var(--fill-${role})`;
}

/** Warna label di atas fill: finance terang -> tinta, lainnya putih (DESIGN 6.3). */
function labelColor(role: ChartSegment["role"]): string {
  return role === "finance" ? "var(--ink)" : "var(--surface)";
}

function tooltipText(seg: ChartSegment, vendor: string): string {
  return (
    `${vendor}. ${seg.namaDm} — ${seg.jabatan}. ` +
    `Skor SAW ${seg.skorSaw.toFixed(6)}, peringkat ${seg.peringkatDm}, ` +
    `kontribusi ${seg.kontribusi.toFixed(2)} poin (${seg.lebarPct.toFixed(2)}%).`
  );
}

function Segmen({
  seg,
  vendor,
  isFirst,
  isLast,
  hc,
}: {
  seg: ChartSegment;
  vendor: string;
  isFirst: boolean;
  isLast: boolean;
  hc: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const hoverTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const aktif = hovered || focused;
  const tooltipId = `tooltip-${vendor}-${seg.userId}`;

  function masukPointer() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setHovered(true);
  }
  function keluarPointer() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(false), 180);
  }

  React.useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);
  // Label diukur saat RUNTIME. Desktop normal: semua label tampil.
  const [muat, setMuat] = React.useState(true);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ukur = () => setMuat(el.getBoundingClientRect().width >= 36);
    ukur();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(ukur);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", ukur);
    return () => window.removeEventListener("resize", ukur);
  }, []);

  return (
    <div
      ref={ref}
      data-testid="chart-segment"
      role="img"
      aria-roledescription="kontribusi Borda"
      data-role={seg.role}
      data-initials={seg.initials}
      tabIndex={0}
      aria-label={tooltipText(seg, vendor)}
      aria-describedby={aktif ? tooltipId : undefined}
      onMouseEnter={masukPointer}
      onMouseLeave={keluarPointer}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setHovered(false);
          setFocused(false);
        }
      }}
      className={cn(
        "relative flex h-full items-center justify-center outline-none",
        isFirst && "rounded-l-[5px]",
        isLast && "rounded-r-[5px]",
        "focus-visible:ring-2 focus-visible:ring-ink/40",
      )}
      style={{
        width: `${seg.lebarPct}%`,
        background: fillVar(seg.role, hc),
        borderLeft: isFirst ? undefined : "1px solid rgba(255,255,255,0.85)",
      }}
    >
      {muat ? (
        <span
          data-testid="segment-label"
          aria-hidden
          className="mono font-bold"
          style={{
            fontSize: "9.5px",
            lineHeight: 1,
            color: labelColor(seg.role),
            whiteSpace: "nowrap",
            padding: "0 3px",
          }}
        >
          {seg.initials}
        </span>
      ) : null}

      {aktif ? (
        <div
          id={tooltipId}
          data-testid="segment-tooltip"
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1 max-w-[min(280px,calc(100vw-24px))] -translate-x-1/2 rounded-input border border-hairline bg-surface px-3 py-2 text-left shadow-raised"
          onMouseEnter={masukPointer}
          onMouseLeave={keluarPointer}
        >
          <p className="text-[12px] font-semibold text-ink">{vendor} · {seg.namaDm}</p>
          <p className="text-[11px] text-ink-2">{seg.jabatan}</p>
          <div className="mono num mt-1.5 space-y-0.5 border-t border-hairline pt-1.5 text-[11px] text-ink">
            <p className="flex justify-between gap-5">
              <span className="text-ink-2">Skor SAW</span>
              <span>{seg.skorSaw.toFixed(6)}</span>
            </p>
            <p className="flex justify-between gap-5">
              <span className="text-ink-2">Peringkat</span>
              <span>{seg.peringkatDm}</span>
            </p>
            <p className="flex justify-between gap-5">
              <span className="text-ink-2">Kontribusi</span>
              <span>
                {seg.kontribusi.toFixed(2)} poin · {seg.lebarPct.toFixed(2)}%
              </span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BarisChart({
  row,
  urutan,
  hc,
  playing,
}: {
  row: BordaRow;
  urutan: number;
  hc: boolean;
  playing: boolean;
}) {
  const winner = row.peringkat === 1;

  return (
    <motion.div
      data-testid="borda-row"
      data-vendor={row.kode}
      data-winner={winner ? "1" : "0"}
      className={cn(
        "-mx-3 grid grid-cols-[112px_minmax(0,1fr)_74px] items-center gap-x-3 rounded-card border px-3 py-2",
        winner ? "border-hairline-2 bg-surface" : "border-transparent",
      )}
      initial={playing && winner ? { y: 0, boxShadow: "0 0 0 rgba(26,24,21,0)" } : false}
      animate={
        winner
          ? { y: -4, boxShadow: "var(--shadow-raised)" }
          : { y: 0, boxShadow: "0 0 0 rgba(26,24,21,0)" }
      }
      transition={
        playing && winner ? { delay: 2.0, duration: 0.24, ease: [...EASE_OUT_CUBIC] } : { duration: 0 }
      }
    >
      {/* Label vendor 112px */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="mono text-[13px] font-bold text-ink">{row.kode}</span>
          {winner ? (
            <motion.span
              data-testid="winner-badge"
              className="inline-flex"
              initial={playing ? { scale: 0.9 } : false}
              animate={{ scale: 1 }}
              transition={playing ? { ...SPRING, delay: 2.0 } : { duration: 0 }}
            >
              <Badge variant="winner">Pilihan</Badge>
            </motion.span>
          ) : null}
        </div>
        <p className="truncate text-[11px] leading-tight text-ink-3" title={row.nama}>
          {row.nama.replace(/^PT\s+/, "")}
        </p>
      </div>

      {/* Track flex, tinggi 22px */}
      <div
        data-testid="chart-track"
        className="relative h-[22px] rounded-[5px] bg-track"
      >
        <motion.div
          data-testid="chart-fill"
          className="absolute inset-y-0 left-0 flex"
          initial={playing ? { width: 0 } : false}
          animate={{ width: `${row.panjangPct}%` }}
          transition={
            playing
              ? { duration: 0.7, delay: 0.7 + urutan * 0.12, ease: [...EASE_OUT_CUBIC] }
              : { duration: 0 }
          }
        >
          {row.segments.map((seg, i) => (
            <Segmen
              key={seg.userId}
              seg={seg}
              vendor={row.kode}
              isFirst={i === 0}
              isLast={i === row.segments.length - 1}
              hc={hc}
            />
          ))}
        </motion.div>
      </div>

      {/* Nilai 74px — menghitung naik saat reveal (DESIGN 5.1 t=1400ms) */}
      <div className="text-right">
        <CountUp
          value={row.nilai}
          decimals={4}
          playing={playing}
          className="mono num block text-[13px] font-medium text-ink"
        />
      </div>
    </motion.div>
  );
}

export function BordaChart({
  rows,
  dms,
  playing,
  playKey,
}: {
  rows: BordaRow[];
  dms: DmInfo[];
  playing: boolean;
  playKey: number;
}) {
  const [hc, setHc] = React.useState(false);

  // Preferensi kontras tinggi tersimpan di localStorage (DESIGN 6.5).
  React.useEffect(() => {
    try {
      if (localStorage.getItem(HC_KEY) === "1") setHc(true);
    } catch {
      // localStorage tidak tersedia (mode privat) — pakai default.
    }
  }, []);

  function toggleHc() {
    setHc((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HC_KEY, next ? "1" : "0");
      } catch {
        // abaikan
      }
      return next;
    });
  }

  return (
    <figure data-testid="borda-chart" className="m-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <figcaption className="text-small text-ink-2">
          Panjang batang proporsional poin; segmen = kontribusi tiap DM.
        </figcaption>
        <button
          type="button"
          role="switch"
          aria-checked={hc}
          data-testid="hc-toggle"
          onClick={toggleHc}
          className="focus-ring flex h-7 items-center gap-2 rounded-input border border-hairline-2 bg-surface px-2.5 text-[12px] font-medium text-ink-2 transition-colors duration-[140ms] hover:bg-surface-2"
        >
          <span
            aria-hidden
            className={cn(
              "relative h-3.5 w-6 rounded-full border transition-colors duration-[140ms]",
              hc ? "border-ink bg-ink" : "border-hairline-2 bg-track",
            )}
          >
            <span
              className={cn(
                "absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full transition-all duration-[140ms]",
                hc ? "left-[11px] bg-surface" : "left-[2px] bg-ink-3",
              )}
            />
          </span>
          Kontras tinggi
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <BarisChart
            key={`${playKey}:${row.vendorId}`}
            row={row}
            urutan={i}
            hc={hc}
            playing={playing}
          />
        ))}
      </div>

      {/* Legenda: titik 9px + INISIAL lalu nama jabatan lengkap (DESIGN 6.4) */}
      <div
        data-testid="chart-legend"
        className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-3"
      >
        {dms.map(dm => (
          <span key={dm.id} className="flex items-center gap-2 text-[12.5px] text-ink-2">
            <span
              aria-hidden
              className="h-[9px] w-[9px] shrink-0 rounded-full"
              style={{ background: fillVar(dm.role, hc) }}
            />
            <span className="mono text-[10.5px] font-bold text-ink">{dm.initials}</span>
            <span>— {dm.jabatan}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}
