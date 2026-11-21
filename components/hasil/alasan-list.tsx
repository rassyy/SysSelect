/**
 * T13 — Alasan penilaian tiap DM per vendor (opsional, tampil di hasil).
 */
import { DmBadge } from "@/components/ui/badge";
import type { DataHasil } from "@/lib/hitung/rincian";

export function AlasanList({ data }: { data: DataHasil }) {
  return (
    <div className="space-y-4" data-testid="alasan-list">
      {data.dmRincian.map((dm) => (
        <section key={dm.id}>
          <div className="mb-2 flex items-center gap-2">
            <DmBadge role={dm.role}>{dm.initials}</DmBadge>
            <h3 className="text-[13.5px] font-semibold text-ink">{dm.namaLengkap}</h3>
            <span className="text-small text-ink-2">{dm.jabatan}</span>
          </div>
          <dl className="divide-y divide-hairline border-y border-hairline">
            {data.vendors.map((vendor) => {
              const alasan = dm.alasanPerVendor[vendor.id];
              return (
                <div key={vendor.id} className="grid gap-1 px-1 py-2 sm:grid-cols-[120px_1fr] sm:gap-3">
                  <dt className="text-[12.5px] font-medium text-ink">
                    <span className="mono num">{vendor.kode}</span> · {vendor.nama}
                  </dt>
                  <dd className={alasan ? "text-small text-ink-2" : "text-small text-ink-2"}>
                    {alasan ?? "Tanpa alasan tertulis."}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}
    </div>
  );
}
