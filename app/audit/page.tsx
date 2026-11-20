import type { Metadata } from "next";
import { requireRank } from "@/lib/auth";
import { getSessionOverview } from "@/lib/session-state";
import { PhasePlaceholder } from "@/components/app-shell/phase-placeholder";

export const metadata: Metadata = {
  title: "Audit · SysSelect GDSS",
};

export default async function AuditPage() {
  const user = await requireRank(3);
  const overview = await getSessionOverview();

  return (
    <PhasePlaceholder
      user={user}
      overview={overview}
      phase="Audit"
      title="Jejak aktivitas"
      description="Log login, simpan nilai, submit, buka konsensus, dan pengesahan. Hanya CTO yang dapat membuka halaman ini."
      note="Halaman audit dikerjakan pada T15 (sesi H4)."
    />
  );
}
