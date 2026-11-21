/**
 * T13 — Halaman /hasil: read-only, semua role, aktif saat konsensus & sah.
 * Kartu pemenang, tabel peringkat akhir, perbandingan SAW 3 DM,
 * accordion rincian perhitungan, alasan DM, dan log transisi.
 * Pengesahan (T14) & export Berita Acara (T16) menyusul di halaman ini.
 */
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { getDataHasil, keKonsensusData } from "@/lib/hitung/rincian";
import { AppShell } from "@/components/app-shell/app-shell";
import { PhasePlaceholder } from "@/components/app-shell/phase-placeholder";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReplayLink } from "@/components/konsensus/replay-link";
import { SawComparison } from "@/components/konsensus/saw-comparison";
import { WinnerCard } from "@/components/hasil/winner-card";
import { RankingTable } from "@/components/hasil/ranking-table";
import { RincianAccordion } from "@/components/hasil/rincian-accordion";
import { AlasanList } from "@/components/hasil/alasan-list";
import { LogList } from "@/components/hasil/log-list";
import { SahkanPanel } from "@/components/hasil/sahkan-panel";

export const metadata: Metadata = {
  title: "Hasil · SysSelect GDSS",
};

export default async function HasilPage() {
  const user = await requireUser();
  const overview = await getSessionOverview();
  const session = overview?.session;

  if (!session || (session.status !== "konsensus" && session.status !== "sah")) {
    return (
      <PhasePlaceholder
        user={user}
        overview={overview}
        phase="Fase Sah"
        title="Hasil keputusan"
        description="Halaman hasil read-only untuk seluruh decision maker, pengesahan CTO, dan export Berita Acara PDF."
        note="Hasil tersedia setelah CTO membuka konsensus."
      />
    );
  }

  const data = await getDataHasil(session.id);
  if (!data) {
    return (
      <PhasePlaceholder
        user={user}
        overview={overview}
        phase="Fase Sah"
        title="Hasil keputusan"
        description="Data hasil sesi tidak lengkap."
        note="Snapshot Borda belum tersedia. Buka konsensus terlebih dahulu."
      />
    );
  }

  return (
    <AppShell user={user} overview={overview}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-caps mb-1.5">Hasil keputusan</p>
          <h1 className="text-display mb-1.5">{data.sessionNama}</h1>
          <p className="max-w-[640px] text-ink-2">
            Hasil akhir Borda Count dari 3 decision maker. Halaman ini read-only untuk
            seluruh role.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.status === "konsensus" && user.rankJabatan === 3 ? (
            <SahkanPanel winnerLabel={`${data.winner.kode} ${data.winner.namaVendor}`} />
          ) : null}
          <ReplayLink sessionId={data.sessionId} />
        </div>
      </div>

      <div className="space-y-4">
        <WinnerCard data={data} />

        <Card>
          <CardHeader>
            <CardTitle>Peringkat akhir</CardTitle>
            <CardDescription>
              Poin Borda dijumlahkan dari kontribusi tiap decision maker; nilai adalah
              poin dibagi total poin.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <RankingTable rows={data.bordaRows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perbandingan penilaian individual</CardTitle>
            <CardDescription>
              Skor SAW dan peringkat tiap decision maker. Sel bertint menandai pilihan
              pertama masing-masing.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <SawComparison data={keKonsensusData(data)} playing={false} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rincian perhitungan</CardTitle>
            <CardDescription>
              Matriks mentah sampai skor preferensi V, dihitung ulang dari nilai tersimpan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RincianAccordion data={data} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alasan penilaian</CardTitle>
            <CardDescription>Catatan tiap decision maker per vendor.</CardDescription>
          </CardHeader>
          <CardContent>
            <AlasanList data={data} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Log keputusan</CardTitle>
            <CardDescription>
              Submit penilaian, buka konsensus, dan pengesahan — terbaru lebih dulu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogList logs={data.logs} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
