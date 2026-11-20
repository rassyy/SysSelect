"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LockKeyholeOpen, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BordaChart } from "@/components/konsensus/borda-chart";
import { BordaTable } from "@/components/konsensus/borda-table";
import { SawComparison } from "@/components/konsensus/saw-comparison";
import type { KonsensusData } from "@/components/konsensus/types";

export function KonsensusView({ data }: { data: KonsensusData }) {
  const reducedMotion = useReducedMotion();
  const [reveal, setReveal] = React.useState({ playing: false, key: 0 });

  React.useEffect(() => {
    const key = `sysselect.reveal.${data.sessionId}`;
    let seen = false;
    let replay = false;
    try {
      seen = sessionStorage.getItem(key) === "1";
      replay = sessionStorage.getItem(`${key}.replay`) === "1";
      if (!seen) sessionStorage.setItem(key, "1");
      if (replay) sessionStorage.removeItem(`${key}.replay`);
    } catch {
      // Konten tetap tersedia bila storage tidak dapat diakses.
    }
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches && (!seen || replay)) {
      setReveal({ playing: true, key: 1 });
    }
  }, [data.sessionId]);

  React.useEffect(() => {
    if (!reveal.playing) return;
    const timer = window.setTimeout(() => setReveal((current) => ({ ...current, playing: false })), 2600);
    return () => window.clearTimeout(timer);
  }, [reveal.playing, reveal.key]);

  function replay() {
    if (!reducedMotion && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReveal((current) => ({ playing: true, key: current.key + 1 }));
    }
  }

  return (
    <div className="space-y-6" data-testid="konsensus-view" data-reveal={reveal.playing ? "playing" : "final"}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <motion.div key={`lock-${reveal.key}`} data-testid="reveal-lock" className="mb-1.5 flex items-center gap-2 text-ink-2"
            initial={reveal.playing ? { opacity: 0, scale: 0.94 } : false}
            animate={{ opacity: 1, scale: 1 }} transition={{ duration: reveal.playing ? 0.2 : 0 }}>
            <LockKeyholeOpen size={15} strokeWidth={1.5} aria-hidden="true" />
            <span className="text-[12px] font-medium">Konsensus terbuka</span>
          </motion.div>
          <h1 className="text-display mb-1.5">Konsensus Borda Count</h1>
          <p className="max-w-[640px] text-ink-2">
            Skor SAW tiap decision maker diagregasi dengan Borda Count versi modul.
            Panjang batang proporsional poin; segmen menunjukkan kontribusi tiap DM.
          </p>
        </div>
        <Button variant="secondary" onClick={replay}>
          <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" /> Putar ulang
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nilai Borda per Vendor</CardTitle>
          <CardDescription>Kontribusi setiap decision maker terhadap hasil konsensus.</CardDescription>
        </CardHeader>
        <CardContent>
          <BordaChart rows={data.rows} dms={data.dms} playing={reveal.playing} playKey={reveal.key} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Perbandingan SAW</CardTitle>
          <CardDescription>Skor preferensi dan peringkat individual. Sel berwarna menandai pilihan pertama masing-masing decision maker.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <SawComparison key={reveal.key} data={data} playing={reveal.playing} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rincian Borda (versi modul)</CardTitle>
          <CardDescription>
            Grup adalah jumlah skor preferensi pada setiap peringkat; poin adalah jumlah grup dikali bobot; nilai adalah poin dibagi total poin.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <BordaTable rows={data.rows} bobotBorda={data.bobotBorda} totalPoin={data.totalPoin} />
        </CardContent>
      </Card>
    </div>
  );
}
