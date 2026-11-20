import type { User } from "@prisma/client";
import type { SessionOverview } from "@/lib/session-state";
import { AppShell } from "@/components/app-shell/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PhasePlaceholder({
  user,
  overview,
  phase,
  title,
  description,
  note,
}: {
  user: User;
  overview: SessionOverview | null;
  phase: string;
  title: string;
  description: string;
  note: string;
}) {
  return (
    <AppShell user={user} overview={overview}>
      <p className="label-caps mb-1.5">{phase}</p>
      <h1 className="text-display mb-1.5">{title}</h1>
      <p className="mb-6 max-w-[640px] text-ink-2">{description}</p>

      <Card>
        <CardHeader>
          <CardTitle>Belum diimplementasikan</CardTitle>
          <CardDescription>{note}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-small text-ink-2">
            Shell, PhaseRail, dan guard sudah aktif. Isi halaman menyusul pada
            sesi handoff berikutnya.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
