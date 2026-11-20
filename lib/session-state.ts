import type { Session } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SessionOverview = {
  session: Session;
  submitted: number;
  dmCount: number;
};

/** Ringkasan sesi aktif untuk PhaseRail dan shell navigasi. */
export async function getSessionOverview(): Promise<SessionOverview | null> {
  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) return null;

  const [submitted, dmCount] = await Promise.all([
    prisma.submission.count({ where: { sessionId: session.id } }),
    prisma.user.count(),
  ]);

  return { session, submitted, dmCount };
}
