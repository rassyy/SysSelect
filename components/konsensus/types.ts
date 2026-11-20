/**
 * Tipe data tampilan konsensus (T11/T12). Dipakai server page & komponen client.
 * Semua angka sudah dihitung di server dari snapshot saw_results/borda_results.
 */
import type { DmRole } from "@/components/ui/badge";

export type DmInfo = {
  id: number;
  namaLengkap: string;
  jabatan: string;
  role: DmRole;
  /** Inisial wajib di segmen chart & legenda: CTO / HIT / FIN. */
  initials: string;
  rankJabatan: number;
};

export type VendorInfo = {
  id: number;
  kode: string;
  nama: string;
};

/** Satu sel tabel SAW: skor V + peringkat dari satu DM untuk satu vendor. */
export type SawCell = {
  userId: number;
  vendorId: number;
  skor: number;
  peringkat: number;
};

/** Segmen chart = kontribusi satu DM pada poin Borda vendor. */
export type ChartSegment = {
  userId: number;
  role: DmRole;
  initials: string;
  namaDm: string;
  jabatan: string;
  skorSaw: number;
  peringkatDm: number;
  /** kontribusi poin = skor SAW * bobot Borda peringkat DM. */
  kontribusi: number;
  /** lebar segmen dalam batang = kontribusi / poin vendor * 100. */
  lebarPct: number;
};

export type BordaRow = {
  vendorId: number;
  kode: string;
  nama: string;
  poin: number;
  nilai: number;
  peringkat: number;
  /** grup[r-1] = SUM skor preferensi pada posisi peringkat r (versi modul). */
  grup: number[];
  /** panjang batang = poin / max(poin) * 100 — jujur, bukan semua penuh. */
  panjangPct: number;
  segments: ChartSegment[];
};

export type KonsensusData = {
  sessionId: number;
  dms: DmInfo[];
  vendors: VendorInfo[];
  sawCells: SawCell[];
  /** Urut peringkat akhir 1..4 (pemenang dulu). */
  rows: BordaRow[];
  bobotBorda: Record<number, number>;
  totalPoin: number;
};

export const ROLE_BY_RANK: Record<number, DmRole> = {
  3: "cto",
  2: "headit",
  1: "finance",
};

export const INITIALS_BY_RANK: Record<number, string> = {
  3: "CTO",
  2: "HIT",
  1: "FIN",
};
