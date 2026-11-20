import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { PhasePlaceholder } from "@/components/app-shell/phase-placeholder";

export const metadata: Metadata = {
  title: "Hasil · SysSelect GDSS",
};

export default async function HasilPage() {
  const user = await requireUser();
  const overview = await getSessionOverview();

  return (
    <PhasePlaceholder
      user={user}
      overview={overview}
      phase="Fase Sah"
      title="Hasil keputusan"
      description="Halaman hasil read-only untuk seluruh decision maker, pengesahan CTO, dan export Berita Acara PDF."
      note="Halaman hasil dan pengesahan dikerjakan pada T13–T16 (sesi H4)."
    />
  );
}
