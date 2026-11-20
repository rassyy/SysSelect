import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { PhasePlaceholder } from "@/components/app-shell/phase-placeholder";
import { AppShell } from "@/components/app-shell/app-shell";
import { ReplayLink } from "@/components/konsensus/replay-link";

export const metadata: Metadata = {
  title: "Hasil · SysSelect GDSS",
};

export default async function HasilPage() {
  const user = await requireUser();
  const overview = await getSessionOverview();

  if (overview && (overview.session.status === "konsensus" || overview.session.status === "sah")) {
    return (
      <AppShell user={user} overview={overview}>
        <h1 className="text-display mb-1.5">Hasil keputusan</h1>
        <p className="mb-6 text-ink-2">Rincian hasil dan pengesahan tersedia pada sesi berikutnya. Putar ulang reveal konsensus untuk presentasi.</p>
        <ReplayLink sessionId={overview.session.id} />
      </AppShell>
    );
  }

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
