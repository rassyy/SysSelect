import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { signSession } from '../lib/session-token';
import { POST as simpanVendor } from '../app/api/setup/vendor/route';
import { POST as mulaiPenilaian } from '../app/api/setup/mulai-penilaian/route';
import { NextRequest } from 'next/server';

async function main() {
  console.log('Testing T06 vendor & mulai-penilaian endpoints...');

  const cto = await prisma.user.findUniqueOrThrow({ where: { username: 'cto' } });
  const headit = await prisma.user.findUniqueOrThrow({ where: { username: 'headit' } });
  const finance = await prisma.user.findUniqueOrThrow({ where: { username: 'finance' } });

  const ctoToken = await signSession({ uid: cto.id, username: cto.username, rank: cto.rankJabatan });
  const headitToken = await signSession({ uid: headit.id, username: headit.username, rank: headit.rankJabatan });
  const finToken = await signSession({ uid: finance.id, username: finance.username, rank: finance.rankJabatan });

  // Pastikan sesi ada dan berstatus setup
  let session = await prisma.session.findFirst({ orderBy: { id: 'asc' } });
  if (!session) {
    throw new Error('Sesi tidak ditemukan');
  }
  if (session.status !== 'setup') {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'setup', openedBy: null, openedAt: null },
    });
  }

  // 1. Akun rank 1 (finance) panggil mulai-penilaian -> 403
  {
    const req = new NextRequest('http://localhost:3000/api/setup/mulai-penilaian', {
      method: 'POST',
      headers: { cookie: 'sysselect_session=' + finToken },
    });
    const res = await mulaiPenilaian(req);
    assert.equal(res.status, 403);
    console.log('  OK: Akun rank 1 ditolak 403 saat memanggil mulai-penilaian');
  }

  // 2. Akun rank 2 (headit) panggil mulai-penilaian -> 403
  {
    const req = new NextRequest('http://localhost:3000/api/setup/mulai-penilaian', {
      method: 'POST',
      headers: { cookie: 'sysselect_session=' + headitToken },
    });
    const res = await mulaiPenilaian(req);
    assert.equal(res.status, 403);
    console.log('  OK: Akun rank 2 ditolak 403 saat memanggil mulai-penilaian');
  }

  // 3. Akun rank 3 (cto) simpan vendor -> 200 & audit log 'simpan_vendor'
  {
    const v1 = await prisma.vendor.findUniqueOrThrow({ where: { kode: 'V1' } });
    const req = new NextRequest('http://localhost:3000/api/setup/vendor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'sysselect_session=' + ctoToken,
      },
      body: JSON.stringify({
        id: v1.id,
        kode: 'V1',
        nama: v1.nama,
        profil: v1.profil + ' (Diperbarui)',
      }),
    });
    const res = await simpanVendor(req);
    assert.equal(res.status, 200);
    const audit = await prisma.auditLog.findFirst({
      where: { aksi: 'simpan_vendor' },
      orderBy: { id: 'desc' },
    });
    assert.ok(audit);
    console.log('  OK: CTO simpan vendor berhasil, audit log:', audit.aksi);
  }

  // 4. Akun rank 3 panggil mulai-penilaian -> 200 & status berubah ke 'penilaian'
  {
    const req = new NextRequest('http://localhost:3000/api/setup/mulai-penilaian', {
      method: 'POST',
      headers: { cookie: 'sysselect_session=' + ctoToken },
    });
    const res = await mulaiPenilaian(req);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'penilaian');

    const checkSession = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });
    assert.equal(checkSession.status, 'penilaian');
    assert.equal(checkSession.openedBy, cto.id);

    const audit = await prisma.auditLog.findFirst({
      where: { aksi: 'mulai_penilaian' },
      orderBy: { id: 'desc' },
    });
    assert.ok(audit);
    console.log('  OK: CTO mulai penilaian sukses 200, status DB:', checkSession.status, 'audit log:', audit.aksi);
  }

  // 5. Panggil lagi saat status bukan setup -> 409
  {
    const req = new NextRequest('http://localhost:3000/api/setup/mulai-penilaian', {
      method: 'POST',
      headers: { cookie: 'sysselect_session=' + ctoToken },
    });
    const res = await mulaiPenilaian(req);
    assert.equal(res.status, 409);
    console.log('  OK: Panggil ulang saat status sudah penilaian ditolak 409');
  }

  console.log('T06 test passed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
