"use client";

/**
 * T14 — Dialog konfirmasi pengesahan. Tombol HANYA dirender untuk CTO
 * pada fase konsensus; server tetap memvalidasi rank 3.
 * Setelah sah seluruh sesi read-only.
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export function SahkanPanel({ winnerLabel }: { winnerLabel: string }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [siap, setSiap] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => setSiap(true), []);

  function buka() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function tutup() {
    if (!busy) dialogRef.current?.close();
  }

  async function sahkan() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pengesahan", { method: "POST" });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? `Gagal mengesahkan (HTTP ${res.status}).`);
        return;
      }
      dialogRef.current?.close();
      router.refresh();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={buka} data-testid="sahkan-button" data-ready={siap ? "1" : "0"}>
        <ShieldCheck size={14} strokeWidth={1.5} aria-hidden="true" />
        Sahkan Keputusan
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby="sahkan-judul"
        className="w-[min(460px,calc(100vw-32px))] rounded-card border border-hairline-2 bg-surface p-0 text-ink shadow-raised"
        onClose={() => setError(null)}
        onCancel={(event) => {
          if (busy) event.preventDefault();
        }}
        data-testid="sahkan-dialog"
      >
        <div className="p-5">
          <p className="label-caps mb-1.5">Pengesahan akhir</p>
          <h2 id="sahkan-judul" className="text-h2 mb-2">
            Sahkan keputusan untuk {winnerLabel}?
          </h2>
          <p className="text-small text-ink-2">
            Setelah disahkan, seluruh data sesi menjadi read-only permanen: nilai,
            kriteria, vendor, dan status tidak dapat diubah lagi. Keputusan tercatat
            di audit log atas nama Anda.
          </p>
          {error ? (
            <p role="alert" className="mt-3 rounded-input border border-hairline-2 bg-track px-2.5 py-2 text-[12.5px] text-ink">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={tutup} disabled={busy} disabledReason="Pengesahan sedang diproses.">
              Batal
            </Button>
            <Button onClick={sahkan} disabled={busy} disabledReason="Pengesahan sedang diproses.">
              {busy ? "Mengesahkan…" : "Ya, sahkan"}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
