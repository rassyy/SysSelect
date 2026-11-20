/**
 * T08 — 4 uji wajib blind assessment & submission lock (HANDOFF H2).
 * Uji via pemanggilan handler langsung (lapisan server), bukan UI:
 *   a) GET penilaian sebagai headit TIDAK memuat nilai cto / finance
 *   b) PATCH setelah submit -> ditolak 403
 *   c) submit dengan 19 sel -> ditolak 400
 *   d) setelah 3 submit -> progress 3/3 (COUNT(submissions))
 *
 * Prasyarat: seed golden sudah jalan. Jalankan: npx tsx scripts/test-t08.ts
 * Test ini mengubah state DB lalu mengembalikan ke kondisi bersih (setup,
 * nilai fixture utuh) di akhir.
 */
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { signSession } from '../lib/session-token';
import { GET as getPenilaian, PATCH as patchNilai } from '../app/api/penilaian/route';
import { POST as submitPenilaian } from '../app/api/penilaian/submit/route';
import { POST as mulaiPenilaian } from '../app/api/setup/mulai-penilaian/route';
import { NextRequest } from 'next/server';

const COOKIE = 'sysselect_session';

function req(url: string, token: string, init?: { method?: string; body?: unknown }) {
  const headers: Record<string, string> = { cookie: `${COOKIE}=${token}` };
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  return new NextRequest(url, {
    method: init?.method ?? 'GET',
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

async function main() {
  console.log('Testing T08 blind guard & submission lock...');

  const cto = await prisma.user.findUniqueOrThrow({ where: { username: 'cto' } });
  const headit = await prisma.user.findUniqueOrThrow({ where: { username: 'headit' } });
  const finance = await prisma.user.findUniqueOrThrow({ where: { username: 'finance' } });

  const tokens: Record<number, string> = {};
  for (const u of [cto, headit, finance]) {
    tokens[u.id] = await signSession({ uid: u.id, username: u.username, rank: u.rankJabatan });
  }

  const session = await prisma.session.findFirst({ orderBy: { id: 'asc' } });
  if (!session) throw new Error('Sesi tidak ditemukan. Jalankan db:seed:golden dulu.');

  const criteria = await prisma.criteria.findMany({ orderBy: { urutan: 'asc' } });
  const vendors = await prisma.vendor.findMany({ orderBy: { kode: 'asc' } });
  assert.equal(criteria.length, 5);
  assert.equal(vendors.length, 4);

  // Simpan snapshot nilai fixture untuk pemulihan di akhir.
  const snapshot = await prisma.assessment.findMany({ where: { sessionId: session.id } });

  // Bersihkan state uji lalu masuk fase penilaian lewat endpoint resmi.
  await prisma.submission.deleteMany({ where: { sessionId: session.id } });
  await prisma.session.update({
    where: { id: session.id },
    data: { status: 'setup', openedBy: null, openedAt: null },
  });
  {
    const res = await mulaiPenilaian(req('http://localhost:3000/api/setup/mulai-penilaian', tokens[cto.id], { method: 'POST' }));
    assert.equal(res.status, 200, 'mulai penilaian harus sukses');
  }

  // === Uji (a): blind guard — GET headit tidak memuat nilai DM lain ===
  {
    const res = await getPenilaian(req('http://localhost:3000/api/penilaian', tokens[headit.id]));
    assert.equal(res.status, 200);
    const text = await res.text(); // periksa PAYLOAD MENTAH, bukan field terpilih
    const data = JSON.parse(text);

    assert.ok(Array.isArray(data.assessments));
    assert.equal(data.assessments.length, 20, 'headit hanya melihat 20 sel miliknya');
    for (const a of data.assessments) {
      assert.equal(a.userId, headit.id, 'setiap baris nilai harus milik headit');
    }
    // Nilai milik cto/finance tidak boleh muncul di payload sama sekali.
    assert.ok(!text.includes(`"userId":${cto.id}`), 'payload memuat userId cto');
    assert.ok(!text.includes(`"userId":${finance.id}`), 'payload memuat userId finance');
    // Panel tersegel hanya memuat identitas + status submit, tanpa nilai.
    for (const dm of data.otherDms) {
      assert.ok(!('nilai' in dm), 'otherDms tidak boleh memuat nilai');
      assert.ok(!('assessments' in dm), 'otherDms tidak boleh memuat assessments');
    }
    console.log('  OK (a): GET headit fase penilaian — 20 sel miliknya saja, 0 nilai cto/finance di payload');
  }

  // === Uji (c): submit dengan 19 sel -> ditolak ===
  {
    // Hapus satu sel headit supaya tinggal 19.
    const victim = snapshot.find((a) => a.userId === headit.id)!;
    await prisma.assessment.delete({ where: { id: victim.id } });

    const res = await submitPenilaian(req('http://localhost:3000/api/penilaian/submit', tokens[headit.id], { method: 'POST' }));
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /19\/20/);
    console.log('  OK (c): submit 19 sel ditolak 400:', data.error);

    // Kembalikan sel ke-20 lewat PATCH (autosave endpoint).
    const restore = await patchNilai(req('http://localhost:3000/api/penilaian', tokens[headit.id], {
      method: 'PATCH',
      body: { vendorId: victim.vendorId, criterionId: victim.criterionId, nilai: Number(victim.nilai) },
    }));
    assert.equal(restore.status, 200);
  }

  // === headit submit lengkap -> 200 ===
  {
    const res = await submitPenilaian(req('http://localhost:3000/api/penilaian/submit', tokens[headit.id], { method: 'POST' }));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.submittedCount, 1);
    console.log('  OK: headit submit 20 sel -> 200, progress 1/3');
  }

  // === Uji (b): PATCH setelah submit -> ditolak ===
  {
    const target = snapshot.find((a) => a.userId === headit.id)!;
    const res = await patchNilai(req('http://localhost:3000/api/penilaian', tokens[headit.id], {
      method: 'PATCH',
      body: { vendorId: target.vendorId, criterionId: target.criterionId, nilai: 99 },
    }));
    assert.equal(res.status, 403);
    const data = await res.json();
    console.log('  OK (b): PATCH setelah submit ditolak 403:', data.error);

    // Nilai di DB tidak berubah.
    const check = await prisma.assessment.findUniqueOrThrow({
      where: {
        sessionId_userId_vendorId_criterionId: {
          sessionId: session.id,
          userId: headit.id,
          vendorId: target.vendorId,
          criterionId: target.criterionId,
        },
      },
    });
    assert.equal(Number(check.nilai), Number(target.nilai), 'nilai tidak boleh berubah setelah submit');
  }

  // Submit ganda juga ditolak.
  {
    const res = await submitPenilaian(req('http://localhost:3000/api/penilaian/submit', tokens[headit.id], { method: 'POST' }));
    assert.equal(res.status, 409);
    console.log('  OK: submit ganda ditolak 409');
  }

  // === Uji (d): 3 submit -> progress 3/3 dari COUNT(submissions) ===
  for (const u of [cto, finance]) {
    const res = await submitPenilaian(req('http://localhost:3000/api/penilaian/submit', tokens[u.id], { method: 'POST' }));
    assert.equal(res.status, 200, `${u.username} submit harus 200`);
  }
  {
    const count = await prisma.submission.count({ where: { sessionId: session.id } });
    assert.equal(count, 3);

    const res = await getPenilaian(req('http://localhost:3000/api/penilaian', tokens[cto.id]));
    const data = await res.json();
    assert.equal(data.submittedCount, 3, 'progress endpoint harus 3/3');
    assert.equal(data.isSubmitted, true);
    console.log('  OK (d): setelah 3 submit, COUNT(submissions)=3, endpoint progress 3/3');
  }

  // Audit 'simpan_nilai' dan 'submit_penilaian' tercatat.
  {
    const actions = await prisma.auditLog.findMany({
      where: { sessionId: session.id, aksi: { in: ['simpan_nilai', 'submit_penilaian'] } },
    });
    assert.ok(actions.some((a) => a.aksi === 'simpan_nilai'), 'audit simpan_nilai ada');
    assert.ok(actions.filter((a) => a.aksi === 'submit_penilaian').length === 3, 'audit submit_penilaian 3 baris');
    console.log('  OK: audit log simpan_nilai + submit_penilaian (3) tercatat');
  }

  // === Pemulihan: kembalikan DB ke kondisi bersih (setup + fixture utuh) ===
  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { sessionId: session.id, aksi: { in: ['simpan_nilai', 'submit_penilaian', 'mulai_penilaian', 'simpan_vendor', 'simpan_kriteria'] } } }),
    prisma.submission.deleteMany({ where: { sessionId: session.id } }),
    prisma.session.update({
      where: { id: session.id },
      data: { status: 'setup', openedBy: null, openedAt: null },
    }),
  ]);
  // Pulihkan nilai & alasan persis snapshot (PATCH uji (b) ditolak, tapi autosave restore mengubah updated_at).
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
  assert.equal(finalCount, 60, 'pemulihan: assessments kembali 60');

  console.log('T08 test passed successfully. DB dipulihkan ke setup + 60 sel fixture.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
