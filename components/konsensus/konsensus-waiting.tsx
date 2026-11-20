"use client";

/**
 * T11 — Tampilan /konsensus SEBELUM konsensus dibuka (fase setup/penilaian).
 * Tombol "Buka Konsensus" hanya untuk rank 3; disabled + tooltip alasan
 * sampai 3/3 submit (RANCANGAN.md 4.1). Server tetap menolak bila dipaksa.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DmRankBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DmInfo } from "./types";

type DmStatus = DmInfo & { submitted: boolean };

export function KonsensusWaiting({
  status,
  submitted,
  isCto,
  dms,
}: {
  status: string;
  submitted: number;
  isCto: boolean;
  dms: DmStatus[];
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const lengkap = submitted >= 3;

  async function bukaKonsensus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/konsensus/buka", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuka konsensus.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Terjadi kesalahan jaringan.");
      setLoading(false);
    }
  }

  let tombol: { label: string; disabled: boolean; reason?: string };
  if (status !== "penilaian") {
    tombol = {
      label: "Buka Konsensus",
      disabled: true,
      reason: "Sesi masih dalam fase setup. Mulai penilaian terlebih dahulu.",
    };
  } else if (!isCto) {
    tombol = {
      label: "Menunggu CTO membuka konsensus",
      disabled: true,
      reason: "Hanya CTO (rank 3) yang dapat membuka konsensus.",
    };
  } else {
    tombol = {
      label: loading ? "Membuka..." : "Buka Konsensus",
      disabled: !lengkap || loading,
      reason: !lengkap ? `Menunggu ${submitted}/3 penilaian` : undefined,
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps mb-1.5">Fase Konsensus</p>
        <h1 className="text-display mb-1.5">Agregasi Borda Count</h1>
        <p className="max-w-[640px] text-ink-2">
          Setelah seluruh decision maker submit, CTO membuka konsensus. Skor SAW
          tiap DM diagregasi dengan Borda Count versi modul — nilai DM lain baru
          boleh dibaca semua role setelah fase ini terbuka.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kelengkapan Penilaian</CardTitle>
          <CardDescription>
            Konsensus terbuka hanya setelah 3/3 decision maker submit (divalidasi server).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-1.5">
            <span className="text-hero-num num mono font-bold text-ink">{submitted}</span>
            <span className="mono text-[16px] font-medium text-ink-3">/ 3</span>
          </div>

          <div className="space-y-2 border-t border-hairline pt-3">
            {dms.map((dm) => (
              <div key={dm.id} className="flex items-center justify-between text-[12.5px]">
                <div className="flex items-center gap-2">
                  <DmRankBadge role={dm.role} rank={dm.rankJabatan} />
                  <span className="font-medium text-ink">{dm.namaLengkap}</span>
                  <span className="text-[11px] text-ink-3">{dm.jabatan}</span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-badge border px-2 py-0.5 text-[11px] font-medium",
                    dm.submitted
                      ? "border-hairline-2 bg-surface-2 text-ink"
                      : "border-hairline bg-track text-ink-3",
                  )}
                >
                  {dm.submitted ? <Check size={11} strokeWidth={2.5} /> : <Clock size={11} strokeWidth={1.5} />}
                  {dm.submitted ? "Submit" : "Menunggu"}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-4">
            <Button
              variant="primary"
              disabled={tombol.disabled}
              disabledReason={tombol.reason}
              onClick={isCto && status === "penilaian" ? bukaKonsensus : undefined}
            >
              {tombol.label}
              {isCto && lengkap && status === "penilaian" ? <ArrowRight size={14} strokeWidth={1.5} /> : null}
            </Button>
            {error ? (
              <span role="alert" className="text-[12.5px] text-ink">
                {error}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-2/60">
        <CardContent className="flex items-start gap-3 p-5 text-[12.5px] leading-relaxed text-ink-2">
          <Lock size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-3" />
          <p>
            Selama fase penilaian, nilai DM lain disaring di lapisan server — tidak
            pernah dikirim ke browser. Pembukaan konsensus menghitung SAW (12 baris)
            dan Borda (4 baris) sebagai snapshot yang dapat diaudit, lalu membuka
            baca nilai seluruh DM untuk semua role.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
