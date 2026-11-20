import type { Metadata } from "next";
import { requireRank } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell/app-shell";
import { SetupNav } from "@/app/setup/setup-nav";
import { KriteriaForm, type CriteriaItem } from "./kriteria-form";

export const metadata: Metadata = {
  title: "Setup Kriteria · SysSelect GDSS",
};

export default async function SetupKriteriaPage() {
  const user = await requireRank(3);
  const overview = await getSessionOverview();

  const criteriaRaw = await prisma.criteria.findMany({
    orderBy: { urutan: "asc" },
  });

  const criteria: CriteriaItem[] = criteriaRaw.map((c) => ({
    id: c.id,
    kode: c.kode,
    nama: c.nama,
    bobot: Number(c.bobot),
    tipe: c.tipe as "cost" | "benefit",
    satuan: c.satuan,
    urutan: c.urutan,
  }));

  const isSetupPhase = overview?.session.status === "setup";

  return (
    <AppShell user={user} overview={overview}>
      <p className="label-caps mb-1.5">Fase Setup</p>
      <h1 className="text-display mb-1.5">Konfigurasi Kriteria</h1>
      <p className="mb-6 text-ink-2">
        Tentukan 5 kriteria evaluasi vendor cloud dan bobot masing-masing. Total bobot wajib tepat 100%.
      </p>

      <SetupNav active="kriteria" />

      <KriteriaForm initialCriteria={criteria} isSetupPhase={isSetupPhase} />
    </AppShell>
  );
}
