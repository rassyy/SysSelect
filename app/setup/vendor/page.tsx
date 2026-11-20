import type { Metadata } from "next";
import { requireRank } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/app-shell/app-shell";
import { SetupNav } from "@/app/setup/setup-nav";
import { VendorManager, type VendorItem } from "./vendor-manager";

export const metadata: Metadata = {
  title: "Setup Vendor · SysSelect GDSS",
};

export default async function SetupVendorPage() {
  const user = await requireRank(3);
  const overview = await getSessionOverview();

  const [vendorsRaw, criteria] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { kode: "asc" } }),
    prisma.criteria.findMany({ orderBy: { urutan: "asc" } }),
  ]);

  const vendors: VendorItem[] = vendorsRaw.map((v) => ({
    id: v.id,
    kode: v.kode,
    nama: v.nama,
    profil: v.profil ?? "",
  }));

  const sumBobot = criteria.reduce((sum, c) => sum + Number(c.bobot), 0);
  const criteriaValid = criteria.length === 5 && Math.abs(sumBobot - 100) < 0.001;
  const vendorCountValid = vendors.length === 4;
  const isSetupPhase = overview?.session.status === "setup";

  return (
    <AppShell user={user} overview={overview}>
      <p className="label-caps mb-1.5">Fase Setup</p>
      <h1 className="text-display mb-1.5">Master Data Vendor</h1>
      <p className="mb-6 text-ink-2">
        Kelola 4 kandidat vendor managed cloud service provider dan mulai fase penilaian individual.
      </p>

      <SetupNav active="vendor" />

      <VendorManager
        initialVendors={vendors}
        isSetupPhase={isSetupPhase}
        criteriaValid={criteriaValid}
        vendorCountValid={vendorCountValid}
        sumBobot={sumBobot}
      />
    </AppShell>
  );
}
