"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Edit3, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type VendorItem = {
  id: number;
  kode: string;
  nama: string;
  profil: string;
};

export function VendorManager({
  initialVendors,
  isSetupPhase,
  criteriaValid,
  vendorCountValid,
  sumBobot,
}: {
  initialVendors: VendorItem[];
  isSetupPhase: boolean;
  criteriaValid: boolean;
  vendorCountValid: boolean;
  sumBobot: number;
}) {
  const router = useRouter();
  const [vendors, setVendors] = React.useState<VendorItem[]>(initialVendors);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editForm, setEditForm] = React.useState<{ nama: string; profil: string }>({
    nama: "",
    profil: "",
  });
  const [loading, setLoading] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const canStart = isSetupPhase && criteriaValid && vendorCountValid;

  let disabledReason: string | undefined;
  if (!isSetupPhase) {
    disabledReason = "Status sesi bukan lagi setup";
  } else if (!criteriaValid) {
    disabledReason = `Total bobot 5 kriteria harus 100% (saat ini ${sumBobot}%)`;
  } else if (!vendorCountValid) {
    disabledReason = `Harus ada tepat 4 vendor (saat ini ${vendors.length})`;
  }

  function startEdit(v: VendorItem) {
    if (!isSetupPhase) return;
    setEditingId(v.id);
    setEditForm({ nama: v.nama, profil: v.profil });
    setMessage(null);
  }

  async function handleSaveVendor(id: number, kode: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/setup/vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          kode,
          nama: editForm.nama,
          profil: editForm.profil,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Gagal menyimpan vendor." });
      } else {
        setVendors((prev) =>
          prev.map((item) => (item.id === id ? { ...item, nama: editForm.nama, profil: editForm.profil } : item)),
        );
        setEditingId(null);
        setMessage({ type: "success", text: `Vendor ${kode} berhasil diperbarui.` });
      }
    } catch {
      setMessage({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setLoading(false);
    }
  }

  async function handleMulaiPenilaian() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/setup/mulai-penilaian", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Gagal memulai penilaian." });
        setConfirmOpen(false);
      } else {
        router.push("/penilaian");
        router.refresh();
      }
    } catch {
      setMessage({ type: "error", text: "Terjadi kesalahan jaringan." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Kode</TableHead>
                <TableHead className="w-72">Nama Vendor</TableHead>
                <TableHead>Profil & Spesifikasi Singkat</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((v) => {
                const isEditing = editingId === v.id;
                return (
                  <TableRow key={v.kode}>
                    <TableCell className="mono font-bold text-ink align-top pt-3.5">{v.kode}</TableCell>
                    <TableCell className="align-top pt-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.nama}
                          onChange={(e) => setEditForm({ ...editForm, nama: e.target.value })}
                          className="h-8.5 w-full rounded-input border border-hairline bg-surface px-2.5 text-[13px] font-medium text-ink focus-ring"
                        />
                      ) : (
                        <p className="font-semibold text-ink text-[13.5px]">{v.nama}</p>
                      )}
                    </TableCell>
                    <TableCell className="align-top pt-3">
                      {isEditing ? (
                        <textarea
                          rows={3}
                          value={editForm.profil}
                          onChange={(e) => setEditForm({ ...editForm, profil: e.target.value })}
                          className="w-full rounded-input border border-hairline bg-surface p-2 text-[12.5px] text-ink focus-ring"
                        />
                      ) : (
                        <p className="text-ink-2 text-small leading-relaxed line-clamp-3">
                          {v.profil || "Belum ada profil."}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top pt-3">
                      {isSetupPhase ? (
                        isEditing ? (
                          <div className="flex flex-col gap-1.5 items-end">
                            <Button
                              variant="primary"
                              className="h-7 px-2.5 text-[11.5px]"
                              onClick={() => handleSaveVendor(v.id, v.kode)}
                              disabled={loading}
                            >
                              Simpan
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-7 px-2 text-[11.5px]"
                              onClick={() => setEditingId(null)}
                              disabled={loading}
                            >
                              Batal
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            className="h-8 px-2.5 text-[12px]"
                            onClick={() => startEdit(v)}
                          >
                            <Edit3 size={13} className="mr-1 shrink-0 text-ink-2" />
                            Edit
                          </Button>
                        )
                      ) : (
                        <Badge variant="secondary">Terkunci</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Kotak status syarat transisi & Tombol Mulai Penilaian */}
      <Card className="border-hairline bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">Kesiapan Sesi Penilaian</CardTitle>
          <CardDescription>
            Penilaian individual dapat dimulai setelah syarat master data terpenuhi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-badge border p-3 text-[13px]",
                criteriaValid
                  ? "border-hairline-2 bg-surface-2 text-ink"
                  : "border-hairline-2 bg-track text-ink-2",
              )}
            >
              {criteriaValid ? (
                <CheckCircle2 size={18} strokeWidth={1.5} className="text-ink shrink-0" />
              ) : (
                <AlertCircle size={18} strokeWidth={1.5} className="text-ink-2 shrink-0" />
              )}
              <div>
                <p className="font-medium">5 Kriteria Valid</p>
                <p className="text-[11.5px] text-ink-3">
                  Total bobot: <span className="mono font-medium">{sumBobot}%</span> (harus 100%)
                </p>
              </div>
            </div>

            <div
              className={cn(
                "flex items-center gap-2.5 rounded-badge border p-3 text-[13px]",
                vendorCountValid
                  ? "border-hairline-2 bg-surface-2 text-ink"
                  : "border-hairline-2 bg-track text-ink-2",
              )}
            >
              {vendorCountValid ? (
                <CheckCircle2 size={18} strokeWidth={1.5} className="text-ink shrink-0" />
              ) : (
                <AlertCircle size={18} strokeWidth={1.5} className="text-ink-2 shrink-0" />
              )}
              <div>
                <p className="font-medium">4 Alternatif Vendor</p>
                <p className="text-[11.5px] text-ink-3">
                  Terdaftar: <span className="mono font-medium">{vendors.length}</span> vendor
                </p>
              </div>
            </div>
          </div>

          {message ? (
            <div
              className={cn(
                "rounded-card border p-3 text-small",
                message.type === "success"
                  ? "border-hairline-2 bg-surface-2 text-ink"
                  : "border-hairline-2 bg-track text-ink",
              )}
            >
              {message.text}
            </div>
          ) : null}

          <div className="flex items-center justify-between border-t border-hairline pt-4">
            <p className="text-small text-ink-3">
              {isSetupPhase
                ? "Setelah dimulai, transisi ke fase 'penilaian' dan master data dikunci."
                : "Fase penilaian sudah aktif."}
            </p>

            {isSetupPhase ? (
              <Button
                variant="primary"
                disabled={!canStart || loading}
                disabledReason={disabledReason}
                onClick={() => setConfirmOpen(true)}
              >
                <span>Mulai Penilaian</span>
                <ArrowRight size={15} strokeWidth={1.5} />
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => router.push("/penilaian")}>
                Buka Grid Penilaian
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal Dialog Konfirmasi Mulai Penilaian */}
      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(26,24,21,0.35)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-card border border-hairline bg-surface p-6 shadow-raised space-y-4">
            <div className="space-y-1.5">
              <h2 className="text-[17px] font-semibold text-ink">Mulai Fase Penilaian?</h2>
              <p className="text-small text-ink-2">
                Setelah fase penilaian dimulai, bobot kriteria dan daftar vendor akan dikunci. Ketiga Decision Maker dapat mulai menginput evaluasi.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleMulaiPenilaian}
                disabled={loading}
              >
                {loading ? "Memproses..." : "Ya, Mulai Penilaian"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
