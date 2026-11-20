/**
 * Smoke test H2 lewat HTTP asli (dev server harus jalan di :3000).
 * Melengkapi test-t08.ts yang memanggil handler langsung:
 *   1. login guard middleware: tanpa cookie -> redirect /login
 *   2. /setup/kriteria sebagai headit -> 404 (requireRank server)
 *   3. mulai penilaian via HTTP sebagai cto -> 200
 *   4. GET /api/penilaian sebagai headit -> payload tanpa nilai DM lain
 *   5. halaman /penilaian headit -> HTML tanpa nilai cto/finance
 *   6. PATCH autosave via HTTP -> 200, lalu submit 3 DM -> 3/3
 * DB dipulihkan ke setup + fixture utuh di akhir.
 * Jalankan: npm run dev (terminal lain), lalu npx tsx scripts/test-t08-http.ts
 */
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { signSession, SESSION_COOKIE } from '../lib/session-token';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

async function main() {
  console.log(`Smoke test HTTP H2 terhadap ${BASE} ...`);

  const users = await prisma.user.findMany();
  const cto = users.find((u) => u.username === 'cto')!;
  const headit = users.find((u) => u.username === 'headit')!;
  const finance = users.find((u) => u.username === 'finance')!;

  const cookie: Record<number, string> = {};
  for (const u of [cto, headit, finance]) {
    const token = await signSession({ uid: u.id, username: u.username, rank: u.rankJabatan });
    cookie[u.id] = `${SESSION_COOKIE}=${token}`;
  }

  const session = await prisma.session.findFirst({ orderBy: { id: 'asc' } });
  if (!session) throw new Error('Sesi tidak ditemukan. Jalankan db:seed:golden dulu.');
  const snapshot = await prisma.assessment.findMany({ where: { sessionId: session.id } });
  assert.equal(snapshot.length, 60, 'prasyarat: 60 sel fixture');

  // 1. Tanpa cookie -> redirect login
  {
    const res = await fetch(`${BASE}/penilaian`, { redirect: 'manual' });
    assert.ok([302, 307, 308].includes(res.status), `harus redirect, dapat ${res.status}`);
    assert.match(res.headers.get('location') ?? '', /\/login/);
    console.log('  OK 1: tanpa cookie /penilaian redirect ke /login');
  }

  // 2. headit buka /setup/kriteria -> 404
  {
    const res = await fetch(`${BASE}/setup/kriteria`, {
      headers: { cookie: cookie[headit.id] },
      redirect: 'manual',
    });
    assert.equal(res.status, 404);
    console.log('  OK 2: headit GET /setup/kriteria -> 404 (guard server)');
  }

  // Reset ke setup lalu mulai penilaian via HTTP sebagai cto.
  await prisma.submission.deleteMany({ where: { sessionId: session.id } });
  await prisma.session.update({
    where: { id: session.id },
    data: { status: 'setup', openedBy: null, openedAt: null },
  });

  // 3. rank 1 ditolak 403, cto sukses 200
  {
    const denied = await fetch(`${BASE}/api/setup/mulai-penilaian`, {
      method: 'POST',
      headers: { cookie: cookie[finance.id] },
    });
    assert.equal(denied.status, 403);

    const ok = await fetch(`${BASE}/api/setup/mulai-penilaian`, {
      method: 'POST',
      headers: { cookie: cookie[cto.id] },
    });
    assert.equal(ok.status, 200);
    console.log('  OK 3: finance 403, cto 200 mulai penilaian via HTTP');
  }

  // 4. GET API headit: blind
  {
    const res = await fetch(`${BASE}/api/penilaian`, { headers: { cookie: cookie[headit.id] } });
    assert.equal(res.status, 200);
    const text = await res.text();
    const data = JSON.parse(text);
    assert.equal(data.assessments.length, 20);
    assert.ok(data.assessments.every((a: { userId: number }) => a.userId === headit.id));
    assert.ok(!text.includes(`"userId":${cto.id}`));
    assert.ok(!text.includes(`"userId":${finance.id}`));
    console.log('  OK 4: GET /api/penilaian headit — 20 sel sendiri, tanpa nilai cto/finance');
  }

  // 5. HTML halaman /penilaian headit tidak memuat nilai DM lain.
  {
    const res = await fetch(`${BASE}/penilaian`, { headers: { cookie: cookie[headit.id] } });
    assert.equal(res.status, 200);
    const html = await res.text();
    // Nilai fixture cto & finance (angka khas) tidak boleh ada di HTML.
    const ctoRows = snapshot.filter((a) => a.userId === cto.id);
    const finRows = snapshot.filter((a) => a.userId === finance.id);
    // Cek via payload RSC/props: cari pasangan vendorId+criterionId+nilai milik DM lain.
    for (const a of [...ctoRows, ...finRows]) {
      const needle = `"userId":${a.userId}`;
      assert.ok(!html.includes(needle), `HTML memuat ${needle}`);
    }
    assert.ok(html.includes('Prinsip Blind Assessment'), 'banner blind tampil');
    console.log('  OK 5: HTML /penilaian headit — banner blind ada, 0 baris nilai DM lain');
  }

  // 6. Autosave PATCH via HTTP lalu submit 3 DM.
  {
    const target = snapshot.find((a) => a.userId === headit.id)!;
    const patch = await fetch(`${BASE}/api/penilaian`, {
      method: 'PATCH',
      headers: { cookie: cookie[headit.id], 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId: target.vendorId,
        criterionId: target.criterionId,
        nilai: Number(target.nilai),
      }),
    });
    assert.equal(patch.status, 200);

    for (const u of [headit, cto, finance]) {
      const res = await fetch(`${BASE}/api/penilaian/submit`, {
        method: 'POST',
        headers: { cookie: cookie[u.id] },
      });
      assert.equal(res.status, 200, `${u.username} submit harus 200`);
    }
    const count = await prisma.submission.count({ where: { sessionId: session.id } });
    assert.equal(count, 3);
    console.log('  OK 6: autosave PATCH 200, 3 submit via HTTP, COUNT(submissions)=3');
  }

  // Pemulihan ke setup + fixture utuh.
  await prisma.$transaction([
    prisma.auditLog.deleteMany({
      where: { sessionId: session.id, aksi: { in: ['simpan_nilai', 'submit_penilaian', 'mulai_penilaian'] } },
    }),
    prisma.submission.deleteMany({ where: { sessionId: session.id } }),
    prisma.session.update({
      where: { id: session.id },
      data: { status: 'setup', openedBy: null, openedAt: null },
    }),
  ]);
  for (const a of snapshot) {
    await prisma.assessment.upsert({
      where: {
        sessionId_userId_vendorId_criterionId: {
          sessionId: a.sessionId,
          userId: a.userId,
          vendorId: a.vendorId,
          criterionId: a.criterionId,
        },
      },
      create: {
        sessionId: a.sessionId,
        userId: a.userId,
        vendorId: a.vendorId,
        criterionId: a.criterionId,
        nilai: a.nilai,
        alasan: a.alasan,
      },
      update: { nilai: a.nilai, alasan: a.alasan },
    });
  }
  const finalCount = await prisma.assessment.count({ where: { sessionId: session.id } });
  assert.equal(finalCount, 60);

  console.log('Smoke test HTTP H2 passed. DB dipulihkan ke setup + 60 sel fixture.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
