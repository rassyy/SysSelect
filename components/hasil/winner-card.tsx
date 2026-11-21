/**
 * T13 — Kartu pemenang di /hasil. Read-only, semua role.
 * Latar surface-2, border hairline-2, shadow raised, badge PILIHAN tinta,
 * nilai Borda 30px mono. Tanpa warna baru (DESIGN.md 7).
 */
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import type { DataHasil } from "@/lib/hitung/rincian";

export function WinnerCard({ data }: { data: DataHasil }) {
  const { winner } = data;
  return (
    <Card
      raised
      className="border-hairline-2 bg-surface-2 p-5 md:p-6"
      data-testid="winner-card"
      data-vendor={winner.kode}
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="label-caps mb-2">Pemenang konsensus</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="winner" className="px-2 py-1">
              PILIHAN
            </Badge>
            <h2 className="text-display">
              <span className="mono">{winner.kode}</span>
              <span className="mx-2 text-ink-3" aria-hidden="true">·</span>
              {winner.namaVendor}
            </h2>
          </div>
          {winner.profil ? (
            <p className="mt-2 max-w-[560px] text-small text-ink-2">{winner.profil}</p>
          ) : null}
          {data.status === "sah" && data.ratifiedAt && data.ratifiedBy ? (
            <p
              className="mt-3 inline-flex items-center gap-1.5 rounded-badge border border-hairline-2 bg-surface px-2 py-1 text-[12px] font-medium text-ink"
              data-testid="ratified-badge"
            >
              <Check size={12} strokeWidth={2.5} aria-hidden="true" />
              Disahkan oleh {data.ratifiedBy.jabatan} ·{" "}
              <time dateTime={data.ratifiedAt.toISOString()} className="mono num">
                {data.ratifiedAt.toLocaleString("id-ID", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </p>
          ) : null}
        </div>

        <div className="text-right">
          <p className="label-caps mb-1">Nilai Borda</p>
          <p className="text-hero-num text-ink" data-testid="winner-nilai">
            {winner.nilai.toFixed(8)}
          </p>
          <p className="mt-1 text-small text-ink-2">
            <span className="mono num">{winner.poin.toFixed(6)}</span> poin · peringkat{" "}
            <span className="mono num">1</span>
          </p>
        </div>
      </div>
    </Card>
  );
}
