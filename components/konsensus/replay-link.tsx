"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function ReplayLink({ sessionId }: { sessionId: number }) {
  function replay() {
    try {
      sessionStorage.setItem(`sysselect.reveal.${sessionId}.replay`, "1");
    } catch {
      // Navigasi tetap dapat digunakan tanpa storage.
    }
  }
  return (
    <Link href="/konsensus" onClick={replay} className={buttonVariants({ variant: "secondary" })}>
      <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" /> Putar ulang
    </Link>
  );
}
