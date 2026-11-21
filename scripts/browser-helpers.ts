/**
 * Helper uji browser (T11/T12): puppeteer-core + Chrome/Edge sistem.
 *Tidak mengunduh browser. Dev server harus jalan (SMOKE_BASE_URL).
 * State DB dimajukan lewat endpoint resmi lalu dipulihkan ke setup.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";
import { NextRequest } from "next/server";
import { prisma } from "../lib/prisma";
import { signSession, SESSION_COOKIE } from "../lib/session-token";
import { POST as mulaiPenilaian } from "../app/api/setup/mulai-penilaian/route";
import { POST as submitPenilaian } from "../app/api/penilaian/submit/route";
import { POST as bukaKonsensus } from "../app/api/konsensus/buka/route";

export const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

const CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

export async function launchBrowser(): Promise<Browser> {
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  assert.ok(executablePath, "Chrome/Edge sistem tidak ditemukan untuk uji browser.");
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
  });
}

export type UserKeys = {
  cto: { id: number; username: string; rankJabatan: number };
  headit: { id: number; username: string; rankJabatan: number };
  finance: { id: number; username: string; rankJabatan: number };
};

export async function ambilUsers(): Promise<UserKeys> {
  const [cto, headit, finance] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { username: "cto" } }),
    prisma.user.findUniqueOrThrow({ where: { username: "headit" } }),
    prisma.user.findUniqueOrThrow({ where: { username: "finance" } }),
  ]);
  return { cto, headit, finance };
}

export async function cookieUntuk(u: { id: number; username: string; rankJabatan: number }): Promise<string> {
  const token = await signSession({ uid: u.id, username: u.username, rank: u.rankJabatan });
  return `${SESSION_COOKIE}=${token}`;
}

function req(url: string, cookie: string, method = "POST") {
  return new NextRequest(url, { method, headers: { cookie } });
}

/** Majukan DB setup -> penilaian -> 3 submit -> konsensus via endpoint resmi. */
export async function majuKeKonsensus(): Promise<{ sessionId: number; users: UserKeys }> {
  const users = await ambilUsers();
  const session = await prisma.session.findFirst({ orderBy: { id: "asc" } });
  if (!session) throw new Error("Sesi tidak ditemukan. Jalankan db:seed:golden dulu.");

  await prisma.bordaResult.deleteMany({ where: { sessionId: session.id } });
  await prisma.sawResult.deleteMany({ where: { sessionId: session.id } });
  await prisma.submission.deleteMany({ where: { sessionId: session.id } });
  await prisma.session.update({
    where: { id: session.id },
    data: { status: "setup", openedBy: null, openedAt: null, winnerVendorId: null },
  });

  const ctoCookie = await cookieUntuk(users.cto);
  const mulai = await mulaiPenilaian(req(`${BASE}/api/setup/mulai-penilaian`, ctoCookie));
  assert.equal(mulai.status, 200, "mulai penilaian harus 200");
  for (const u of [users.cto, users.headit, users.finance]) {
    const res = await submitPenilaian(req(`${BASE}/api/penilaian/submit`, await cookieUntuk(u)));
    assert.equal(res.status, 200, `submit ${u.username} harus 200`);
  }
  const buka = await bukaKonsensus(req(`${BASE}/api/konsensus/buka`, ctoCookie));
  assert.equal(buka.status, 200, "buka konsensus harus 200");
  return { sessionId: session.id, users };
}

/** Pulihkan DB ke setup + 60 sel fixture (submissions/saw/borda = 0). */
export async function pulihkanSetup(sessionId: number): Promise<void> {
  await prisma.$transaction([
    prisma.auditLog.deleteMany({
      where: {
        sessionId,
        aksi: { in: ["mulai_penilaian", "submit_penilaian", "buka_konsensus", "hitung_borda", "simpan_nilai", "sahkan_keputusan"] },
      },
    }),
    prisma.bordaResult.deleteMany({ where: { sessionId } }),
    prisma.sawResult.deleteMany({ where: { sessionId } }),
    prisma.submission.deleteMany({ where: { sessionId } }),
    prisma.session.update({
      where: { id: sessionId },
      data: { status: "setup", openedBy: null, openedAt: null, winnerVendorId: null, ratifiedBy: null, ratifiedAt: null },
    }),
  ]);
  const counts = await Promise.all([
    prisma.assessment.count({ where: { sessionId } }),
    prisma.submission.count({ where: { sessionId } }),
    prisma.sawResult.count({ where: { sessionId } }),
    prisma.bordaResult.count({ where: { sessionId } }),
  ]);
  assert.deepEqual(counts, [60, 0, 0, 0], "pemulihan: 60 sel fixture, hasil kosong");
}

export async function tutupPrisma(): Promise<void> {
  await prisma.$disconnect();
}
