/**
 * Tabel Borda versi modul (RANCANGAN.md 4.1): vendor, grup rank 1-4, poin,
 * nilai, peringkat akhir. Grup = SUM skor preferensi per posisi peringkat.
 * Komponen server — tanpa interaksi.
 */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { BordaRow } from "./types";

export function BordaTable({
  rows,
  bobotBorda,
  totalPoin,
}: {
  rows: BordaRow[];
  bobotBorda: Record<number, number>;
  totalPoin: number;
}) {
  const n = rows.length;
  const sumNilai = rows.reduce((a, r) => a + r.nilai, 0);

  return (
    <Table data-testid="borda-table">
      <TableHeader>
        <TableRow>
          <TableHead>Vendor</TableHead>
          {Array.from({ length: n }, (_, i) => (
            <TableHead key={i} className="text-right">
              Grup {i + 1}
              <span className="mono num ml-1 font-normal text-ink-3">×{bobotBorda[i + 1]}</span>
            </TableHead>
          ))}
          <TableHead className="text-right">Poin</TableHead>
          <TableHead className="text-right">Nilai</TableHead>
          <TableHead className="text-right">Peringkat</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const winner = row.peringkat === 1;
          return (
            <TableRow key={row.vendorId} data-vendor={row.kode}>
              <TableCell>
                <span className={cn("mono text-[13px] font-semibold", winner ? "text-ink" : "text-ink-2")}>
                  {row.kode}
                </span>
                <p className="max-w-[180px] truncate text-[11px] leading-tight text-ink-3" title={row.nama}>
                  {row.nama.replace(/^PT\s+/, "")}
                </p>
              </TableCell>
              {row.grup.map((g, i) => (
                <TableCell key={i} className="mono num text-right text-[13px] text-ink-2" title={String(g)}>
                  {g.toFixed(2)}
                </TableCell>
              ))}
              <TableCell className="mono num text-right text-[13px] font-medium text-ink" title={String(row.poin)}>
                {row.poin.toFixed(2)}
              </TableCell>
              <TableCell className="mono num text-right text-[13px] text-ink" title={String(row.nilai)}>
                {row.nilai.toFixed(8)}
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={cn(
                    "mono num inline-flex h-[19px] w-[19px] items-center justify-center rounded-badge text-[10.5px] font-bold",
                    winner
                      ? "bg-ink text-surface"
                      : "border border-hairline bg-surface-2 text-ink-2",
                  )}
                >
                  {row.peringkat}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-surface-2 hover:bg-surface-2">
          <TableCell className="label-caps">Total</TableCell>
          <TableCell colSpan={n} />
          <TableCell className="mono num text-right text-[13px] font-semibold text-ink">
            {totalPoin.toFixed(2)}
          </TableCell>
          <TableCell className="mono num text-right text-[13px] font-semibold text-ink" title="Invarian wajib: SUM(nilai) = 1">
            {sumNilai.toFixed(8)}
          </TableCell>
          <TableCell />
        </TableRow>
      </TableBody>
    </Table>
  );
}
