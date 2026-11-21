/**
 * T16 — Tombol export Berita Acara di /hasil (semua role).
 * Navigasi langsung ke endpoint PDF; tidak butuh JavaScript.
 */
import { FileDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function ExportBeritaAcara() {
  return (
    <a
      href="/api/hasil/berita-acara"
      className={buttonVariants({ variant: "secondary" })}
      data-testid="export-pdf"
      download
    >
      <FileDown size={14} strokeWidth={1.5} aria-hidden="true" />
      Export Berita Acara (PDF)
    </a>
  );
}
