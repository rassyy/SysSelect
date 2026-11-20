import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { SessionStatus, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
} from "@/lib/session-token";

/** Baca sesi terverifikasi. Tidak melempar; null bila belum login. */
export async function getSessionUser(): Promise<User | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  // Rank diambil ulang dari DB supaya perubahan jabatan langsung berlaku.
  return prisma.user.findUnique({ where: { id: payload.uid } });
}

/** Wajib login. Redirect ke /login bila tidak ada sesi valid. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Wajib rank >= minRank, ditegakkan di SERVER.
 * Akun dengan rank lebih rendah mendapat 404, bukan halaman.
 */
export async function requireRank(minRank: number): Promise<User> {
  const user = await requireUser();
  if (user.rankJabatan < minRank) notFound();
  return user;
}

/** Status siklus keputusan aktif. */
export async function getSessionStatus(): Promise<SessionStatus | null> {
  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  return session?.status ?? null;
}

export async function createSession(user: User): Promise<void> {
  const token = await signSession({
    uid: user.id,
    username: user.username,
    rank: user.rankJabatan,
  });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
