/**
 * T13 — Log siapa submit kapan, siapa buka konsensus, siapa sahkan.
 * Sumber audit_logs (bukan tebakan dari status sesi).
 */
import { DmBadge } from "@/components/ui/badge";
import type { DataHasil } from "@/lib/hitung/rincian";

const LABEL_AKSI: Record<string, string> = {
  submit_penilaian: "Submit penilaian",
  buka_konsensus: "Buka konsensus",
  hitung_borda: "Hitung Borda",
  sahkan_keputusan: "Sahkan keputusan",
};

export function LogList({ logs }: { logs: DataHasil["logs"] }) {
  if (logs.length === 0) {
    return <p className="text-small text-ink-2">Belum ada aktivitas tercatat.</p>;
  }
  return (
    <ol className="divide-y divide-hairline border-y border-hairline" data-testid="hasil-log">
      {logs.map((log) => (
        <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-1 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <DmBadge role={log.role}>{log.role === "headit" ? "HIT" : log.role === "finance" ? "FIN" : "CTO"}</DmBadge>
            <span className="text-[12.5px] font-medium text-ink">{LABEL_AKSI[log.aksi] ?? log.aksi}</span>
            <span className="text-small text-ink-2">
              oleh {log.aktor} · {log.jabatan}
            </span>
          </div>
          <time dateTime={log.waktu.toISOString()} className="mono num text-[11.5px] text-ink-2">
            {log.waktu.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </li>
      ))}
    </ol>
  );
}
