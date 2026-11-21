/**
 * T13 — Accordion "Rincian perhitungan", default TERTUTUP.
 * matriks mentah -> normalisasi -> terbobot -> V, per decision maker.
 * Untuk menjawab "kok skornya segitu?". Tanpa JavaScript (details/summary).
 */
import { ChevronRight } from "lucide-react";
import type { DataHasil, DmRincian } from "@/lib/hitung/rincian";

function TabelAngka({
  judul,
  kolom,
  rincian,
  nilai,
  digits,
  testId,
}: {
  judul: string;
  kolom: string[];
  rincian: DmRincian;
  nilai: (dm: DmRincian, vendorIndex: number) => number[];
  digits: number;
  testId: string;
}) {
  return (
    <div>
      <p className="label-caps mb-1.5">{judul}</p>
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[520px] border-collapse text-[12.5px]"
          data-testid={testId}
          data-dm={rincian.initials}
        >
          <thead>
            <tr className="border-b border-hairline bg-surface-2 text-left">
              <th scope="col" className="px-2.5 py-1.5">
                <span className="label-caps">Vendor</span>
              </th>
              {kolom.map((k) => (
                <th key={k} scope="col" className="px-2.5 py-1.5 text-right">
                  <span className="label-caps">{k}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rincian.raw.map((_, vi) => (
              <tr key={vi} className="border-b border-hairline last:border-0">
                <th scope="row" className="px-2.5 py-1.5 text-left mono num font-semibold">
                  V{vi + 1}
                </th>
                {nilai(rincian, vi).map((x, j) => (
                  <td key={j} className="px-2.5 py-1.5 text-right mono num text-ink-2">
                    {x.toFixed(digits)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RincianAccordion({ data }: { data: DataHasil }) {
  const kolom = data.criteria.map((c) => `${c.kode} · ${c.bobot}%`);
  return (
    <details className="group" data-testid="rincian-accordion">
      <summary className="focus-ring flex cursor-pointer select-none list-none items-center gap-2 rounded-input py-1 text-[13.5px] font-medium text-ink [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={15}
          strokeWidth={1.5}
          aria-hidden="true"
          className="transition-transform duration-150 group-open:rotate-90"
        />
        Rincian perhitungan
        <span className="text-small font-normal text-ink-2">
          — matriks mentah, normalisasi, terbobot, V
        </span>
      </summary>

      <div className="mt-3 space-y-5 border-t border-hairline pt-4">
        {data.dmRincian.map((dm) => (
          <section key={dm.id} aria-labelledby={`rincian-${dm.id}`}>
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <h3 id={`rincian-${dm.id}`} className="text-[14px] font-semibold text-ink">
                {dm.namaLengkap}
              </h3>
              <span className="text-small text-ink-2">
                {dm.jabatan} · inisial {dm.initials}
              </span>
            </div>

            <div className="space-y-4">
              <TabelAngka
                judul="Matriks mentah"
                kolom={kolom}
                rincian={dm}
                nilai={(d, vi) => d.raw[vi]}
                digits={2}
                testId="rincian-raw"
              />
              <TabelAngka
                judul="Normalisasi (benefit x/max · cost min/x)"
                kolom={kolom}
                rincian={dm}
                nilai={(d, vi) => d.normalisasi[vi]}
                digits={4}
                testId="rincian-normalisasi"
              />
              <TabelAngka
                judul="Terbobot (normalisasi × bobot)"
                kolom={kolom}
                rincian={dm}
                nilai={(d, vi) => d.terbobot[vi]}
                digits={4}
                testId="rincian-terbobot"
              />
              <TabelAngka
                judul="Skor preferensi V (Σ terbobot) + peringkat"
                kolom={["V", "Peringkat"]}
                rincian={dm}
                nilai={(d, vi) => [d.V[vi], d.peringkat[vi]]}
                digits={6}
                testId="rincian-V"
              />
            </div>
          </section>
        ))}

        <p className="text-small text-ink-2">
          Normalisasi dihitung di dalam matriks tiap decision maker. Peringkat memakai
          tie-break stabil skor menurun lalu kode vendor menaik, sehingga selalu unik 1–4.
        </p>
      </div>
    </details>
  );
}
