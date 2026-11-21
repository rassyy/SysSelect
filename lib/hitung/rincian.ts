/**
 * T13–T16 — Data lengkap halaman hasil, pengesahan, dan Berita Acara.
 *
 * Sumber: snapshot saw_results/borda_results (RANCANGAN.md 1: hasil disimpan,
 * bukan dihitung ulang setelah sah), ditambah matriks mentah assessments
 * untuk accordion "Rincian perhitungan" (fase konsensus/sah = blind dibuka).
 */
import { prisma } from "@/lib/prisma";
import { hitungSAW, type BarisMatriks, type KriteriaSaw } from "@/lib/hitung/saw";
import { hitungBorda } from "@/lib/hitung/borda";
import {
  INITIALS_BY_RANK,
  ROLE_BY_RANK,
  type BordaRow,
  type DmInfo,
  type KonsensusData,
  type SawCell,
} from "@/components/konsensus/types";

export type DmRincian = {
  id: number;
  username: string;
  namaLengkap: string;
  jabatan: string;
  rankJabatan: number;
  role: "cto" | "headit" | "finance";
  initials: string;
  submittedAt: Date | null;
  /** [vendorIndex][criterionIndex] — nilai mentah dari assessments. */
  raw: number[][];
  normalisasi: number[][];
  terbobot: number[][];
  V: number[];
  peringkat: number[];
  /** vendorId -> alasan penilaian (opsional per vendor). */
  alasanPerVendor: Record<number, string>;
};

export type HasilLog = {
  id: string;
  waktu: Date;
  aksi: "submit_penilaian" | "buka_konsensus" | "sahkan_keputusan" | "hitung_borda";
  label: string;
  aktor: string;
  jabatan: string;
  role: "cto" | "headit" | "finance";
};

export type DataHasil = {
  sessionId: number;
  sessionNama: string;
  status: "setup" | "penilaian" | "konsensus" | "sah";
  ratifiedAt: Date | null;
  ratifiedBy: { namaLengkap: string; jabatan: string } | null;
  criteria: Array<{
    id: number;
    kode: string;
    nama: string;
    bobot: number;
    tipe: "benefit" | "cost";
    satuan: string;
    urutan: number;
  }>;
  vendors: Array<{ id: number; kode: string; nama: string; profil: string | null }>;
  dms: DmInfo[];
  sawCells: SawCell[];
  bordaRows: BordaRow[];
  bobotBorda: Record<number, number>;
  totalPoin: number;
  winner: BordaRow & { namaVendor: string; profil: string | null };
  dmRincian: DmRincian[];
  logs: HasilLog[];
};

export async function getDataHasil(sessionId: number): Promise<DataHasil | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { ratifiedByUser: true },
  });
  if (!session) return null;

  const [criteria, vendors, users, assessments, submissions, sawDb, bordaDb, weights, auditRows] =
    await Promise.all([
      prisma.criteria.findMany({ orderBy: { urutan: "asc" } }),
      prisma.vendor.findMany({ orderBy: { kode: "asc" } }),
      prisma.user.findMany({ orderBy: { rankJabatan: "desc" } }),
      prisma.assessment.findMany({ where: { sessionId } }),
      prisma.submission.findMany({ where: { sessionId } }),
      prisma.sawResult.findMany({ where: { sessionId } }),
      prisma.bordaResult.findMany({ where: { sessionId } }),
      prisma.bordaWeight.findMany({ where: { sessionId }, orderBy: { peringkat: "asc" } }),
      prisma.auditLog.findMany({
        where: {
          sessionId,
          aksi: { in: ["submit_penilaian", "buka_konsensus", "hitung_borda", "sahkan_keputusan"] },
        },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const kriteriaSaw: KriteriaSaw[] = criteria.map((c) => ({
    id: c.id,
    bobot: Number(c.bobot),
    tipe: c.tipe,
  }));
  const vendorIds = vendors.map((v) => v.id);

  const nilaiMap = new Map<string, number>();
  const alasanMap = new Map<string, string>();
  for (const a of assessments) {
    nilaiMap.set(`${a.userId}:${a.vendorId}:${a.criterionId}`, Number(a.nilai));
    if (a.alasan) alasanMap.set(`${a.userId}:${a.vendorId}`, a.alasan);
  }
  const submittedAtMap = new Map(submissions.map((s) => [s.userId, s.submittedAt]));

  const dms: DmInfo[] = users.map((u) => ({
    id: u.id,
    namaLengkap: u.namaLengkap,
    jabatan: u.jabatan,
    role: ROLE_BY_RANK[u.rankJabatan] ?? "finance",
    initials: INITIALS_BY_RANK[u.rankJabatan] ?? "??",
    rankJabatan: u.rankJabatan,
  }));

  const dmRincian: DmRincian[] = users.map((u) => {
    const raw = vendors.map((v) =>
      criteria.map((c) => nilaiMap.get(`${u.id}:${v.id}:${c.id}`) ?? 0),
    );
    const matriks: BarisMatriks[] = vendors.map((v, i) => ({ vendorId: v.id, nilai: raw[i] }));
    let hasil;
    try {
      hasil = hitungSAW(matriks, kriteriaSaw);
    } catch {
      hasil = {
        normalisasi: vendors.map(() => criteria.map(() => 0)),
        terbobot: vendors.map(() => criteria.map(() => 0)),
        V: vendors.map(() => 0),
        peringkat: vendors.map((_, i) => i + 1),
      };
    }
    const alasanPerVendor: Record<number, string> = {};
    for (const v of vendors) {
      const text = alasanMap.get(`${u.id}:${v.id}`);
      if (text) alasanPerVendor[v.id] = text;
    }
    return {
      id: u.id,
      username: u.username,
      namaLengkap: u.namaLengkap,
      jabatan: u.jabatan,
      rankJabatan: u.rankJabatan,
      role: ROLE_BY_RANK[u.rankJabatan] ?? "finance",
      initials: INITIALS_BY_RANK[u.rankJabatan] ?? "??",
      submittedAt: submittedAtMap.get(u.id) ?? null,
      raw,
      normalisasi: hasil.normalisasi,
      terbobot: hasil.terbobot,
      V: hasil.V,
      peringkat: hasil.peringkat,
      alasanPerVendor,
    };
  });

  const sawCells: SawCell[] = sawDb.map((r) => ({
    userId: r.userId,
    vendorId: r.vendorId,
    skor: Number(r.skorPreferensi),
    peringkat: r.peringkat,
  }));
  const bobotBorda: Record<number, number> = {};
  for (const w of weights) bobotBorda[w.peringkat] = w.bobot;

  const borda = hitungBorda(
    sawCells.map((c) => ({
      userId: c.userId,
      vendorId: c.vendorId,
      skor: c.skor,
      peringkat: c.peringkat,
    })),
    bobotBorda,
    vendorIds,
  );

  const maxPoin = Math.max(...bordaDb.map((r) => Number(r.poinBorda)), 1);
  const bordaRows: BordaRow[] = bordaDb
    .map((r) => {
      const vendor = vendors.find((v) => v.id === r.vendorId);
      if (!vendor) return null;
      const i = vendorIds.indexOf(vendor.id);
      const poin = Number(r.poinBorda);
      const segments = dms.map((dm) => {
        const cell = sawCells.find((c) => c.userId === dm.id && c.vendorId === vendor.id);
        const kontribusi = cell ? cell.skor * (bobotBorda[cell.peringkat] ?? 0) : 0;
        return {
          userId: dm.id,
          role: dm.role,
          initials: dm.initials,
          namaDm: dm.namaLengkap,
          jabatan: dm.jabatan,
          skorSaw: cell?.skor ?? 0,
          peringkatDm: cell?.peringkat ?? vendors.length,
          kontribusi,
          lebarPct: poin > 0 ? (kontribusi / poin) * 100 : 0,
        };
      });
      return {
        vendorId: vendor.id,
        kode: vendor.kode,
        nama: vendor.nama,
        poin,
        nilai: Number(r.nilaiBorda),
        peringkat: r.peringkatAkhir,
        grup: borda.grup[i] ?? [0, 0, 0, 0],
        panjangPct: (poin / maxPoin) * 100,
        segments,
      } satisfies BordaRow;
    })
    .filter((row): row is BordaRow => row !== null)
    .sort((a, b) => a.peringkat - b.peringkat);

  const totalPoin = bordaDb.reduce((acc, r) => acc + Number(r.poinBorda), 0);

  const winnerRow = bordaRows.find((r) => r.peringkat === 1);
  const winnerVendor = vendors.find((v) => v.id === (winnerRow?.vendorId ?? session.winnerVendorId));
  if (!winnerRow || !winnerVendor) {
    // Fase konsensus/sah selalu punya borda_results; data tidak lengkap = sesi rusak.
    return null;
  }

  const labelByAksi: Record<HasilLog["aksi"], string> = {
    submit_penilaian: "Submit penilaian",
    buka_konsensus: "Buka konsensus",
    hitung_borda: "Hitung Borda",
    sahkan_keputusan: "Sahkan keputusan",
  };
  const logs: HasilLog[] = auditRows.map((a) => ({
    id: `audit-${a.id}`,
    waktu: a.createdAt,
    aksi: a.aksi as HasilLog["aksi"],
    label: labelByAksi[a.aksi as HasilLog["aksi"]] ?? a.aksi,
    aktor: a.user.namaLengkap,
    jabatan: a.user.jabatan,
    role: ROLE_BY_RANK[a.user.rankJabatan] ?? "finance",
  }));

  return {
    sessionId: session.id,
    sessionNama: session.nama,
    status: session.status,
    ratifiedAt: session.ratifiedAt,
    ratifiedBy: session.ratifiedByUser
      ? { namaLengkap: session.ratifiedByUser.namaLengkap, jabatan: session.ratifiedByUser.jabatan }
      : null,
    criteria: criteria.map((c) => ({
      id: c.id,
      kode: c.kode,
      nama: c.nama,
      bobot: Number(c.bobot),
      tipe: c.tipe,
      satuan: c.satuan,
      urutan: c.urutan,
    })),
    vendors: vendors.map((v) => ({ id: v.id, kode: v.kode, nama: v.nama, profil: v.profil })),
    dms,
    sawCells,
    bordaRows,
    bobotBorda,
    totalPoin,
    winner: {
      ...winnerRow,
      namaVendor: winnerVendor.nama,
      profil: winnerVendor.profil,
    },
    dmRincian,
    logs,
  };
}

/** Data chart konsensus untuk panel perbandingan di /hasil. */
export function keKonsensusData(data: DataHasil): KonsensusData {
  return {
    sessionId: data.sessionId,
    dms: data.dms,
    vendors: data.vendors.map((v) => ({ id: v.id, kode: v.kode, nama: v.nama })),
    sawCells: data.sawCells,
    rows: data.bordaRows,
    bobotBorda: data.bobotBorda,
    totalPoin: data.totalPoin,
  };
}
