/**
 * Helper respons JSON & guard untuk route handler API.
 * Middleware mengecualikan /api — setiap route WAJIB panggil guard sendiri.
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

export type ApiFailure = { ok: false; status: number; error: string };

/**
 * Penolakan guard di DALAM transaksi: dilempar agar transaksi rollback,
 * lalu dipetakan route menjadi apiError(status, message).
 */
export class ApiTolak extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function apiJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function apiError(status: number, error: string): NextResponse {
  return apiJson({ error }, status);
}

/**
 * User login atau null. Mendukung pembacaan dari request (uji/handler) atau cookies().
 */
export async function getApiUser(request?: Request | NextRequest): Promise<User | null> {
  let token: string | undefined;

  if (request && "cookies" in request && typeof (request as NextRequest).cookies?.get === "function") {
    token = (request as NextRequest).cookies.get(SESSION_COOKIE)?.value;
  }

  if (!token && request) {
    const header = request.headers.get("cookie");
    if (header) {
      const match = header.match(new RegExp(`(?:^|;\s*)${SESSION_COOKIE}=([^;]+)`));
      if (match) token = match[1];
    }
  }

  if (!token) {
    try {
      token = (await cookies()).get(SESSION_COOKIE)?.value;
    } catch {
      // Di luar konteks request Next.js
    }
  }

  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  return prisma.user.findUnique({ where: { id: payload.uid } });
}

/** Guard login untuk API. */
export async function requireApiUser(request?: Request | NextRequest): Promise<User | ApiFailure> {
  const user = await getApiUser(request);
  if (!user) return { ok: false, status: 401, error: "Belum login." };
  return user;
}

/** Guard rank untuk API: rank kurang = 403 (bukan 404 seperti halaman). */
export async function requireApiRank(
  minRank: number,
  request?: Request | NextRequest,
): Promise<User | ApiFailure> {
  const result = await requireApiUser(request);
  if ("ok" in result) return result;
  if (result.rankJabatan < minRank) {
    return { ok: false, status: 403, error: `Hanya rank >= ${minRank}.` };
  }
  return result;
}

export function isApiFailure(value: User | ApiFailure): value is ApiFailure {
  return "ok" in value;
}

/** Parse body JSON; null bila tidak valid. */
export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
