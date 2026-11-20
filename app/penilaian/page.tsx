import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { PhasePlaceholder } from "@/components/app-shell/phase-placeholder";

export const metadata: Metadata = {
  title: "Penilaian · SysSelect GDSS",
};

export default async function PenilaianPage() {
  const user = await requireUser();
  const overview = await getSessionOverview();

  return (
    <PhasePlaceholder
      user={user}
      overview={overview}
      phase="Fase Penilaian"
      title="Penilaian individual"
      description="Grid 4 vendor × 5 kriteria, autosave, dan kunci setelah submit. Nilai decision maker lain tidak dikirim ke browser selama fase ini."
      note="Grid penilaian dan guard blind assessment dikerjakan pada T07–T08 (sesi H2)."
    />
  );
}
