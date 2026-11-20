"use client";

/**
 * T11 — Tampilan /konsensus setelah terbuka: chart Borda hero + tabel rincian.
 * Koreografi reveal & tabel perbandingan 3 DM menyusul di T12.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BordaChart } from "@/components/konsensus/borda-chart";
import { BordaTable } from "@/components/konsensus/borda-table";
import type { KonsensusData } from "@/components/konsensus/types";

export function KonsensusView({ data }: { data: KonsensusData }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps mb-1.5">Fase Konsensus</p>
        <h1 className="text-display mb-1.5">Konsensus Borda Count</h1>
        <p className="max-w-[640px] text-ink-2">
          Skor SAW tiap decision maker diagregasi dengan Borda Count versi modul.
          Panjang batang jujur terhadap poin; segmen menunjukkan kontribusi tiap DM.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nilai Borda per Vendor</CardTitle>
          <CardDescription>
            Pemenang ditandai badge tinta dan elevasi — bukan warna baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BordaChart rows={data.rows} dms={data.dms} playing={false} playKey={0} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rincian Borda (versi modul)</CardTitle>
          <CardDescription>
            grup[i][r] = SUM skor preferensi vendor i dari DM yang menaruhnya di
            peringkat r; poin = SUM grup × bobot; nilai = poin ÷ total poin.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <BordaTable rows={data.rows} bobotBorda={data.bobotBorda} totalPoin={data.totalPoin} />
        </CardContent>
      </Card>
    </div>
  );
}
