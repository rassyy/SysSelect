"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge, DmRankBadge, type DmRole } from "@/components/ui/badge";
import { Lock, LockOpen, ShieldCheck, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type CriterionData = {
  id: number;
  kode: string;
  nama: string;
  bobot: number;
  tipe: "cost" | "benefit";
  satuan: string;
  urutan: number;
};

export type VendorData = {
  id: number;
  kode: string;
  nama: string;
  profil: string | null;
};

export type AssessmentData = {
  id: number;
  userId: number;
  vendorId: number;
  criterionId: number;
  nilai: number;
  alasan: string | null;
};

export type OtherDm = {
  id: number;
  username: string;
  namaLengkap: string;
  jabatan: string;
  rankJabatan: number;
  submitted: boolean;
};

const ROLE_BY_RANK: Record<number, DmRole> = {
  3: "cto",
  2: "headit",
  1: "finance",
};

export function PenilaianGrid({
  userId,
  initialCriteria,
  initialVendors,
  initialAssessments,
  initialSubmitted,
  otherDms,
  sessionStatus,
}: {
  userId: number;
  initialCriteria: CriterionData[];
  initialVendors: VendorData[];
  initialAssessments: AssessmentData[];
  initialSubmitted: boolean;
  otherDms: OtherDm[];
  sessionStatus: string;
}) {
  const router = useRouter();
  const isReadOnly = initialSubmitted || sessionStatus !== "penilaian";
  // Setelah konsensus dibuka, server mengirim nilai SEMUA DM (blind dibuka
  // sesuai status). Grid edit tetap hanya milik user login — nilai DM lain
  // dibaca di halaman /konsensus, bukan ditimpa ke sel editable.
  const konsensusTerbuka = sessionStatus === "konsensus" || sessionStatus === "sah";
  const ownAssessments = initialAssessments.filter((a) => a.userId === userId);

  // Map cell values: key = `${vendorId}_${criterionId}`
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const a of ownAssessments) {
      initial[`${a.vendorId}_${a.criterionId}`] = String(a.nilai);
    }
    return initial;
  });

  // Map vendor reasons: key = vendorId
  const [reasons, setReasons] = React.useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const a of ownAssessments) {
      if (a.alasan) initial[a.vendorId] = a.alasan;
    }
    return initial;
  });

  // Saving indicators per cell: key = `${vendorId}_${criterionId}`
  const [saveStatus, setSaveStatus] = React.useState<Record<string, "saved" | "saving" | "idle">>({});
  const [submitted, setSubmitted] = React.useState(initialSubmitted);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const debounceTimers = React.useRef<Record<string, NodeJS.Timeout>>({});
  const cellRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  const totalExpected = initialVendors.length * initialCriteria.length;
  const filledCount = React.useMemo(() => {
    let count = 0;
    for (const v of initialVendors) {
      for (const c of initialCriteria) {
        const val = parseFloat(values[`${v.id}_${c.id}`] ?? "");
        if (!isNaN(val) && val > 0) count++;
      }
    }
    return count;
  }, [values, initialVendors, initialCriteria]);

  const isAllFilled = filledCount === totalExpected;

  // Cleanup debounce timers on unmount
  React.useEffect(() => {
    const timers = debounceTimers.current;
    return () => {
      for (const key of Object.keys(timers)) {
        clearTimeout(timers[key]);
      }
    };
  }, []);

  function handleCellChange(vendorId: number, criterionId: number, text: string) {
    if (isReadOnly) return;
    const key = `${vendorId}_${criterionId}`;
    setValues((prev) => ({ ...prev, [key]: text }));
    setSaveStatus((prev) => ({ ...prev, [key]: "saving" }));

    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    const num = parseFloat(text);
    if (isNaN(num) || num <= 0) {
      setSaveStatus((prev) => ({ ...prev, [key]: "idle" }));
      return;
    }

    debounceTimers.current[key] = setTimeout(async () => {
      try {
        const res = await fetch("/api/penilaian", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendorId,
            criterionId,
            nilai: num,
          }),
        });
        if (res.ok) {
          setSaveStatus((prev) => ({ ...prev, [key]: "saved" }));
          setTimeout(() => {
            setSaveStatus((prev) => (prev[key] === "saved" ? { ...prev, [key]: "idle" } : prev));
          }, 1200);
        } else {
          setSaveStatus((prev) => ({ ...prev, [key]: "idle" }));
        }
      } catch {
        setSaveStatus((prev) => ({ ...prev, [key]: "idle" }));
      }
    }, 600);
  }

  function handleReasonChange(vendorId: number, text: string) {
    if (isReadOnly) return;
    setReasons((prev) => ({ ...prev, [vendorId]: text }));
    const key = `reason_${vendorId}`;
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }
    debounceTimers.current[key] = setTimeout(async () => {
      try {
        await fetch("/api/penilaian", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorId, alasan: text }),
        });
      } catch {
        // Ignore reason save fail
      }
    }, 600);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, colIdx: number) {
    const numRows = initialVendors.length;
    const numCols = initialCriteria.length;

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const nextRow = Math.max(0, rowIdx - 1);
      cellRefs.current[`${nextRow}_${colIdx}`]?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextRow = Math.min(numRows - 1, rowIdx + 1);
      cellRefs.current[`${nextRow}_${colIdx}`]?.focus();
    } else if (e.key === "ArrowLeft") {
      const input = e.currentTarget;
      if (input.selectionStart === 0 && input.selectionEnd === 0) {
        e.preventDefault();
        const nextCol = Math.max(0, colIdx - 1);
        cellRefs.current[`${rowIdx}_${nextCol}`]?.focus();
      }
    } else if (e.key === "ArrowRight") {
      const input = e.currentTarget;
      if (input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
        e.preventDefault();
        const nextCol = Math.min(numCols - 1, colIdx + 1);
        cellRefs.current[`${rowIdx}_${nextCol}`]?.focus();
      }
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (!e.shiftKey) {
        e.preventDefault();
        let nextRow = rowIdx;
        let nextCol = colIdx + 1;
        if (nextCol >= numCols) {
          nextCol = 0;
          nextRow = Math.min(numRows - 1, rowIdx + 1);
        }
        cellRefs.current[`${nextRow}_${nextCol}`]?.focus();
      }
    } else if (e.key === "Escape") {
      e.currentTarget.blur();
    }
  }

  async function handleFinalSubmit() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/penilaian/submit", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Gagal submit penilaian.");
        setDialogOpen(false);
      } else {
        setSubmitted(true);
        setDialogOpen(false);
        router.refresh();
      }
    } catch {
      setErrorMessage("Terjadi kesalahan jaringan saat submit.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Banner Permanen Blind Assessment (RANCANGAN.md 4.2) */}
      <div className="flex items-start gap-3 rounded-card border border-hairline bg-surface-2 p-4 text-[13px] leading-relaxed text-ink">
        <ShieldCheck size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink" />
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {konsensusTerbuka ? "Konsensus Telah Dibuka" : "Prinsip Blind Assessment"}
          </p>
          <p className="text-ink-2">
            {konsensusTerbuka ? (
              <>
                Nilai seluruh decision maker kini dapat dibaca semua role.{" "}
                <Link href="/konsensus" className="font-medium text-ink underline underline-offset-2">
                  Lihat perbandingan di halaman Konsensus
                </Link>
                . Grid Anda tetap terkunci permanen.
              </>
            ) : (
              "Penilaian bersifat individual. Nilai decision maker lain tidak dapat dilihat sampai sesi konsensus dibuka untuk mencegah anchoring bias."
            )}
          </p>
        </div>
      </div>

      {submitted ? (
        <div className="flex items-center gap-2 rounded-card border border-hairline-2 bg-surface p-4 text-[13px] text-ink">
          <CheckCircle2 size={18} strokeWidth={1.5} className="text-ink shrink-0" />
          <p className="font-medium">
            Penilaian Anda telah disubmit dan terkunci permanen. Menunggu seluruh decision maker menyelesaikan penilaian.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Kolom Kiri: Grid Penilaian (3/4) */}
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Alternatif</TableHead>
                    {initialCriteria.map((c) => (
                      <TableHead key={c.kode} className="min-w-[140px] text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="mono font-bold text-ink">{c.kode}</span>
                            <span className="mono text-[11px] text-ink-3">({c.bobot}%)</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10.5px]">
                            <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                              {c.tipe === "cost" ? "↓ lebih baik" : "↑ lebih baik"}
                            </Badge>
                            <span className="text-ink-3 font-normal">{c.satuan}</span>
                          </div>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialVendors.map((v, rowIdx) => (
                    <React.Fragment key={v.kode}>
                      <TableRow>
                        <TableCell className="align-middle">
                          <span className="mono font-bold text-ink">{v.kode}</span>
                          <p className="text-[11px] text-ink-3 leading-tight truncate max-w-[90px]">
                            {v.nama.replace(/^PT\s+/, "")}
                          </p>
                        </TableCell>
                        {initialCriteria.map((c, colIdx) => {
                          const key = `${v.id}_${c.id}`;
                          const status = saveStatus[key] ?? "idle";
                          const val = values[key] ?? "";
                          return (
                            <TableCell key={c.kode} className="p-2 text-right align-middle">
                              <div className="relative inline-flex items-center justify-end w-full">
                                <input
                                  ref={(el) => {
                                    cellRefs.current[`${rowIdx}_${colIdx}`] = el;
                                  }}
                                  type="number"
                                  step={c.kode === "C1" ? "1" : "0.1"}
                                  min="1"
                                  max={c.kode === "C1" ? "999999" : "100"}
                                  disabled={isReadOnly || loading}
                                  value={val}
                                  placeholder={c.kode === "C1" ? "Juta Rp" : "1-100"}
                                  onChange={(e) => handleCellChange(v.id, c.id, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                                  className={cn(
                                    "h-[38px] w-full rounded-input border border-hairline bg-surface px-2.5 text-right font-mono text-[13px] font-medium text-ink tabular-nums focus-ring disabled:bg-track disabled:text-ink-2",
                                    c.kode === "C1" ? "w-[130px]" : "w-[105px]",
                                  )}
                                />
                                {/* Indikator tersimpan titik kecil di pojok kanan atas sel (DESIGN.md 4.5) */}
                                {status === "saved" ? (
                                  <span
                                    className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ink-3 transition-opacity duration-200"
                                    title="Tersimpan"
                                    aria-hidden
                                  />
                                ) : null}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      {/* Textarea Alasan Penilaian per Vendor (opsional) */}
                      <TableRow className="hover:bg-transparent border-b border-hairline-2">
                        <TableCell colSpan={initialCriteria.length + 1} className="py-2 px-3.5 bg-surface-2/40">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11.5px] font-medium text-ink-3 shrink-0">
                              Catatan {v.kode}:
                            </span>
                            <input
                              type="text"
                              disabled={isReadOnly || loading}
                              value={reasons[v.id] ?? ""}
                              placeholder={`Alasan atau pertimbangan kualitatif untuk ${v.nama} (opsional)`}
                              onChange={(e) => handleReasonChange(v.id, e.target.value)}
                              className="h-7 flex-1 rounded-input border border-hairline bg-surface px-2.5 text-[12px] text-ink focus-ring disabled:bg-track disabled:text-ink-3"
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Bar Aksi Submit */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-hairline bg-surface p-4">
            <div className="flex items-center gap-2.5 text-[13px]">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-badge border px-3 py-1.5 font-medium",
                  isAllFilled ? "border-hairline-2 bg-surface-2 text-ink" : "border-hairline-2 bg-track text-ink-2",
                )}
              >
                {isAllFilled ? (
                  <CheckCircle2 size={16} strokeWidth={1.5} className="text-ink shrink-0" />
                ) : (
                  <AlertCircle size={16} strokeWidth={1.5} className="text-ink-2 shrink-0" />
                )}
                <span>
                  Kelengkapan Sel: <strong className="mono num">{filledCount}/{totalExpected}</strong>
                  {isAllFilled ? " (Lengkap)" : " (Wajib 20 sel)"}
                </span>
              </div>

              {errorMessage ? (
                <span className="text-[12px] text-ink" role="alert">
                  {errorMessage}
                </span>
              ) : null}
            </div>

            {!submitted ? (
              <Button
                variant="primary"
                disabled={!isAllFilled || isReadOnly || loading}
                disabledReason={
                  !isAllFilled
                    ? `Lengkapi seluruh ${totalExpected} sel (${filledCount} terisi)`
                    : isReadOnly
                      ? "Sesi penilaian tidak aktif"
                      : undefined
                }
                onClick={() => setDialogOpen(true)}
              >
                Submit Penilaian
              </Button>
            ) : (
              <Badge variant="secondary" className="px-3 py-1.5 text-[12.5px]">
                Sudah Disubmit & Terkunci
              </Badge>
            )}
          </div>
        </div>

        {/* Kolom Kanan: Panel Tersegel DM Lain (1/4) (DESIGN.md 4.6) */}
        <div className="space-y-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink mb-1">Decision Maker Lain</h2>
            <p className="text-small text-ink-3">
              Kartu tersegel untuk menjaga independensi.
            </p>
          </div>

          {otherDms.map((dm) => {
            const role = ROLE_BY_RANK[dm.rankJabatan] ?? "finance";
            return (
              <Card key={dm.id} className="border-hairline bg-surface-2/60">
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <DmRankBadge role={role} rank={dm.rankJabatan} />
                      <div>
                        <p className="text-[13px] font-semibold text-ink">{dm.namaLengkap}</p>
                        <p className="text-[11px] text-ink-3">{dm.jabatan}</p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="mt-2 flex items-center justify-between rounded-badge border border-hairline bg-surface px-3 py-2 text-[12px]">
                    <div className="flex items-center gap-2 text-ink-2">
                      {konsensusTerbuka ? (
                        <LockOpen size={14} strokeWidth={1.5} className="text-ink-3" />
                      ) : (
                        <Lock size={14} strokeWidth={1.5} className="text-ink-3" />
                      )}
                      <span>{konsensusTerbuka ? "Terbuka di Konsensus" : "Nilai Tersegel"}</span>
                    </div>
                    {konsensusTerbuka ? (
                      <Link
                        href="/konsensus"
                        className="mono text-[11px] font-medium text-ink underline underline-offset-2"
                      >
                        Lihat nilai
                      </Link>
                    ) : (
                      <span className="mono text-[11px] font-medium text-ink-3">
                        {dm.submitted ? "Tersimpan" : "Sedang Mengisi"}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <div className="rounded-card border border-hairline bg-surface p-4 text-[12px] text-ink-2 leading-relaxed space-y-2">
            <p className="font-medium text-ink flex items-center gap-1.5">
              <Info size={14} className="text-ink-3 shrink-0" />
              Petunjuk Penilaian
            </p>
            <p>
              • Gunakan tombol <kbd className="mono bg-track px-1 rounded">Tab</kbd> atau tombol panah untuk berpindah sel.
            </p>
            <p>
              • Nilai tersimpan secara otomatis setelah Anda mengetik (<span className="mono">autosave 600ms</span>).
            </p>
            <p>
              • Setelah submit, seluruh 20 sel akan terkunci dan tidak dapat diubah lagi.
            </p>
          </div>
        </div>
      </div>

      {/* Dialog Konfirmasi Submit */}
      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(26,24,21,0.35)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-card border border-hairline bg-surface p-6 shadow-raised space-y-4">
            <div className="space-y-1.5">
              <h2 className="text-[17px] font-semibold text-ink">Submit Penilaian Anda?</h2>
              <p className="text-small text-ink-2 leading-normal">
                Setelah submit, nilai tidak dapat diubah kembali. Hasil evaluasi Anda akan digabungkan pada sesi konsensus Borda Count.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={loading}>
                Batal
              </Button>
              <Button variant="primary" onClick={handleFinalSubmit} disabled={loading}>
                {loading ? "Memproses..." : "Ya, Submit Sekarang"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
