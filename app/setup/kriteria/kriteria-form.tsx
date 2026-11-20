"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type CriteriaItem = {
  id: number;
  kode: string;
  nama: string;
  bobot: number;
  tipe: "cost" | "benefit";
  satuan: string;
  urutan: number;
};

export function KriteriaForm({
  initialCriteria,
  isSetupPhase,
}: {
  initialCriteria: CriteriaItem[];
  isSetupPhase: boolean;
}) {
  const [weights, setWeights] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(initialCriteria.map((c) => [c.kode, c.bobot])),
  );
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const total = React.useMemo(() => {
    const sum = Object.values(weights).reduce((acc, val) => acc + (Number.isFinite(val) ? val : 0), 0);
    return Math.round(sum * 100) / 100;
  }, [weights]);

  const isValid = Math.abs(total - 100) < 0.001;

  function handleChange(kode: string, valueStr: string) {
    setMessage(null);
    const num = parseFloat(valueStr);
    setWeights((prev) => ({
      ...prev,
      [kode]: isNaN(num) ? 0 : num,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !isSetupPhase) return;

    setLoading(true);
    setMessage(null);
    try {
      const payload = {
        kriteria: initialCriteria.map((c) => ({
          kode: c.kode,
          bobot: weights[c.kode] ?? 0,
        })),
      };

      const res = await fetch("/api/setup/kriteria", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Gagal menyimpan bobot kriteria." });
      } else {
        setMessage({ type: "success", text: "Bobot kriteria berhasil disimpan." });
      }
    } catch {
      setMessage({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Kode</TableHead>
                <TableHead>Nama Kriteria</TableHead>
                <TableHead className="w-32">Tipe</TableHead>
                <TableHead className="w-28">Satuan</TableHead>
                <TableHead className="w-36 text-right">Bobot (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialCriteria.map((item) => (
                <TableRow key={item.kode}>
                  <TableCell className="mono font-semibold text-ink">{item.kode}</TableCell>
                  <TableCell>
                    <p className="font-medium text-ink">{item.nama}</p>
                    {item.kode === "C1" ? (
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-2">
                        <Info size={13} className="text-ink-3 shrink-0" />
                        <span>C1 bertipe cost — nilai lebih kecil lebih baik.</span>
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default" className="text-[11px]">
                      {item.tipe === "cost" ? "↓ lebih baik" : "↑ lebih baik"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-ink-2 text-small">{item.satuan}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center justify-end gap-1.5">
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="100"
                        disabled={!isSetupPhase || loading}
                        value={weights[item.kode] ?? ""}
                        onChange={(e) => handleChange(item.kode, e.target.value)}
                        className="h-9 w-24 rounded-input border border-hairline bg-surface px-2.5 text-right font-mono text-[13px] font-medium text-ink focus-ring disabled:bg-track disabled:text-ink-3"
                      />
                      <span className="text-ink-3 text-small mono">%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-hairline bg-surface p-4">
        <div className="flex items-center gap-3">
          {/* Indikator Σbobot monokrom: token tidak memuat hijau/merah
              (DESIGN.md menang untuk tampilan; konflik dgn RANCANGAN dilaporkan). */}
          <div
            className={cn(
              "flex items-center gap-2 rounded-badge border px-3 py-1.5 text-[13px] font-medium",
              isValid
                ? "border-hairline-2 bg-surface-2 text-ink"
                : "border-hairline-2 bg-track text-ink-2",
            )}
            role="status"
          >
            {isValid ? (
              <CheckCircle2 size={16} strokeWidth={1.5} className="text-ink" />
            ) : (
              <AlertCircle size={16} strokeWidth={1.5} className="text-ink-2" />
            )}
            <span>
              Total Bobot: <strong className="num mono">{total}%</strong>
              {isValid ? " (Tepat 100%)" : " (Wajib 100%)"}
            </span>
          </div>

          {message ? (
            <span
              className={cn(
                "text-[12.5px]",
                message.type === "success" ? "text-ink" : "text-ink-2",
              )}
              role={message.type === "error" ? "alert" : undefined}
            >
              {message.text}
            </span>
          ) : null}
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={!isValid || !isSetupPhase || loading}
          disabledReason={
            !isSetupPhase
              ? "Bobot hanya dapat diubah saat fase setup"
              : !isValid
                ? `Total bobot saat ini ${total}%, wajib tepat 100%`
                : undefined
          }
        >
          {loading ? "Menyimpan..." : "Simpan Kriteria"}
        </Button>
      </div>
    </form>
  );
}
