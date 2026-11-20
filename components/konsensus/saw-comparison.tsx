"use client";

import { motion } from "framer-motion";
import { DmRankBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { KonsensusData } from "./types";

const spring = { type: "spring", stiffness: 260, damping: 30, mass: 1 } as const;
const tint = { cto: "bg-tint-cto", headit: "bg-tint-headit", finance: "bg-tint-finance" } as const;
const color = { cto: "text-dm-cto", headit: "text-dm-headit", finance: "text-dm-finance" } as const;

export function SawComparison({ data, playing }: { data: KonsensusData; playing: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table data-testid="saw-comparison" className="w-full min-w-[600px] border-collapse text-[13px]" aria-label="Perbandingan skor SAW tiap vendor berdasarkan decision maker">
        <thead className="border-b border-hairline bg-surface-2 text-left">
          <tr>
            <th scope="col" className="label-caps px-3.5 py-2.5">Vendor</th>
            {data.dms.map((dm) => (
              <th key={dm.id} scope="col" className={cn("px-3.5 py-2.5 text-right text-[12px] font-semibold", color[dm.role])}>
                {dm.initials} · {dm.namaLengkap} · {dm.jabatan}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.vendors.map((vendor) => (
            <tr key={vendor.id} className="border-b border-hairline last:border-0">
              <th scope="row" className="px-3.5 py-2.5 text-left font-semibold">
                <span className="mono num">{vendor.kode}</span>
                <span className="ml-2 text-[12px] font-normal text-ink-2">{vendor.nama}</span>
              </th>
              {data.dms.map((dm, index) => {
                const cell = data.sawCells.find((c) => c.userId === dm.id && c.vendorId === vendor.id);
                if (!cell) return <td key={dm.id} className="px-3.5 py-2.5 text-right">—</td>;
                return (
                  <td key={dm.id} data-testid="saw-cell" data-vendor={vendor.kode} data-role={dm.role} data-rank={cell.peringkat}
                    className={cn("px-3.5 py-2.5 text-right", cell.peringkat === 1 && tint[dm.role])}>
                    <motion.div
                      className="inline-flex items-center gap-2"
                      initial={playing ? { x: (index - 1) * 48, opacity: 0.7 } : false}
                      animate={{ x: 0, opacity: 1 }}
                      transition={playing ? { ...spring, delay: 0.2 + index * 0.08 } : { duration: 0 }}
                    >
                      <span className="mono num font-medium">{cell.skor.toFixed(4)}</span>
                      <DmRankBadge role={dm.role} rank={cell.peringkat} aria-label={`Peringkat ${cell.peringkat}`} />
                    </motion.div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
