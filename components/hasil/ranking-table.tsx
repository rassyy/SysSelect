/**
 * T13 — Tabel peringkat akhir 4 vendor: poin, nilai (desimal + persen), peringkat.
 * Pemenang ditandai badge tinta, bukan warna baru.
 */
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DataHasil } from "@/lib/hitung/rincian";

export function RankingTable({ rows }: { rows: DataHasil["bordaRows"] }) {
  return (
    <Table data-testid="ranking-table" aria-label="Peringkat akhir Borda Count">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-14">Rank</TableHead>
          <TableHead>Vendor</TableHead>
          <TableHead className="text-right">Poin Borda</TableHead>
          <TableHead className="text-right">Nilai Borda</TableHead>
          <TableHead className="text-right">Persen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.vendorId} data-testid="ranking-row" data-vendor={row.kode} data-rank={row.peringkat}>
            <TableCell>
              <span
                className={
                  row.peringkat === 1
                    ? "inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-badge bg-ink px-1 font-mono text-[10.5px] font-bold text-surface"
                    : "inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-badge bg-track px-1 font-mono text-[10.5px] font-bold text-ink-2"
                }
              >
                {row.peringkat}
              </span>
            </TableCell>
            <TableCell>
              <span className="mono font-semibold">{row.kode}</span>
              <span className="ml-2 text-[13px] font-semibold">{row.nama}</span>
              {row.peringkat === 1 ? (
                <Badge variant="winner" className="ml-2 align-middle">
                  PILIHAN
                </Badge>
              ) : null}
            </TableCell>
            <TableCell className="mono num text-right">{row.poin.toFixed(6)}</TableCell>
            <TableCell className="mono num text-right">{row.nilai.toFixed(8)}</TableCell>
            <TableCell className="mono num text-right text-ink-2">
              {(row.nilai * 100).toFixed(4)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
