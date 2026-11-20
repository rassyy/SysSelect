import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { PhasePlaceholder } from "@/components/app-shell/phase-placeholder";

export const metadata: Metadata = {
  title: "Konsensus · SysSelect GDSS",
};

export default async function KonsensusPage() {
  const user = await requireUser();
  const overview = await getSessionOverview();

  return (
    <PhasePlaceholder
      user={user}
      overview={overview}
      phase="Fase Konsensus"
      title="Agregasi Borda Count"
      description="Skor SAW tiap DM diagregasi dengan Borda Count versi modul, lengkap dengan tie-break stabil dan chart proporsional poin."
      note="Mesin SAW/Borda dan chart hero dikerjakan pada T09–T12 (sesi H3)."
    />
  );
}
