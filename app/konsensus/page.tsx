/**
 * T11 — Halaman /konsensus (server).
 * Fase setup/penilaian: tampilan menunggu + tombol Buka Konsensus (rank 3).
 * Fase konsensus/sah: muat snapshot saw_results + borda_results, hitung grup
 * & kontribusi segmen chart, kirim data matang ke komponen client.
 * Guard blind sudah dibuka sesuai status di API/page penilaian (T10).
 */
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { prisma } from "@/lib/prisma";
import { hitungBorda } from "@/lib/hitung/borda";
import { AppShell } from "@/components/app-shell/app-shell";
import { KonsensusWaiting } from "@/components/konsensus/konsensus-waiting";
import { KonsensusView } from "@/components/konsensus/konsensus-view";
import {
  INITIALS_BY_RANK,
  ROLE_BY_RANK,
  type BordaRow,
  type DmInfo,
  type KonsensusData,
  type SawCell,
} from "@/components/konsensus/types";

export const metadata: Metadata = {
  title: "Konsensus · SysSelect GDSS",
};

export default async function KonsensusPage() {
  const user = await requireUser();
  const overview = await getSessionOverview();
  const session = overview?.session;
  const status = session?.status ?? "setup";

  const users = await prisma.user.findMany({ orderBy: { rankJabatan: "desc" } });
  const dms: DmInfo[] = users.map((u) => ({
    id: u.id,
    namaLengkap: u.namaLengkap,
    jabatan: u.jabatan,
    role: ROLE_BY_RANK[u.rankJabatan] ?? "finance",
    initials: INITIALS_BY_RANK[u.rankJabatan] ?? "??",
    rankJabatan: u.rankJabatan,
  }));

  // Belum terbuka: tampilan menunggu dengan guard tombol di client + server.
  if (!session || status === "setup" || status === "penilaian") {
    const submissions = session
      ? await prisma.submission.findMany({ where: { sessionId: session.id } })
      : [];
    const submittedIds = new Set(submissions.map((s) => s.userId));
    return (
      <AppShell user={user} overview={overview}>
        <KonsensusWaiting
          status={status}
          submitted={submissions.length}
          isCto={user.rankJabatan === 3}
          dms={dms.map((dm) => ({ ...dm, submitted: submittedIds.has(dm.id) }))}
        />
      </AppShell>
    );
  }

  // Konsensus/sah: baca snapshot hasil (tidak dihitung ulang dari nilai mentah).
  const [vendors, sawDb, bordaDb, weights] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { kode: "asc" } }),
    prisma.sawResult.findMany({ where: { sessionId: session.id } }),
    prisma.bordaResult.findMany({ where: { sessionId: session.id } }),
    prisma.bordaWeight.findMany({ where: { sessionId: session.id }, orderBy: { peringkat: "asc" } }),
  ]);

  const sawCells: SawCell[] = sawDb.map((r) => ({
    userId: r.userId,
    vendorId: r.vendorId,
    skor: Number(r.skorPreferensi),
    peringkat: r.peringkat,
  }));
  const bobotBorda: Record<number, number> = {};
  for (const w of weights) bobotBorda[w.peringkat] = w.bobot;

  const vendorIds = vendors.map((v) => v.id);
  // Grup untuk tabel display — deterministik dari snapshot yang sama.
  const borda = hitungBorda(
    sawCells.map((c) => ({ userId: c.userId, vendorId: c.vendorId, skor: c.skor, peringkat: c.peringkat })),
    bobotBorda,
    vendorIds,
  );

  const maxPoin = Math.max(...bordaDb.map((r) => Number(r.poinBorda)));
  const rows: BordaRow[] = bordaDb
    .map((r) => {
      const vendor = vendors.find((v) => v.id === r.vendorId)!;
      const i = vendorIds.indexOf(vendor.id);
      const poin = Number(r.poinBorda);
      const segments = dms.map((dm) => {
        const cell = sawCells.find((c) => c.userId === dm.id && c.vendorId === vendor.id)!;
        const kontribusi = cell.skor * bobotBorda[cell.peringkat];
        return {
          userId: dm.id,
          role: dm.role,
          initials: dm.initials,
          namaDm: dm.namaLengkap,
          jabatan: dm.jabatan,
          skorSaw: cell.skor,
          peringkatDm: cell.peringkat,
          kontribusi,
          lebarPct: (kontribusi / poin) * 100,
        };
      });
      return {
        vendorId: vendor.id,
        kode: vendor.kode,
        nama: vendor.nama,
        poin,
        nilai: Number(r.nilaiBorda),
        peringkat: r.peringkatAkhir,
        grup: borda.grup[i],
        panjangPct: (poin / maxPoin) * 100,
        segments,
      };
    })
    .sort((a, b) => a.peringkat - b.peringkat);

  const data: KonsensusData = {
    sessionId: session.id,
    dms,
    vendors: vendors.map((v) => ({ id: v.id, kode: v.kode, nama: v.nama })),
    sawCells,
    rows,
    bobotBorda,
    totalPoin: bordaDb.reduce((a, r) => a + Number(r.poinBorda), 0),
  };

  return (
    <AppShell user={user} overview={overview}>
      <KonsensusView data={data} />
    </AppShell>
  );
}
