import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { signSession } from '../lib/session-token';
import { PUT as updateKriteria } from '../app/api/setup/kriteria/route';
import { NextRequest } from 'next/server';

async function main() {
  console.log('Testing T05 kriteria endpoint...');
  const cto = await prisma.user.findUniqueOrThrow({ where: { username: 'cto' } });
  const finance = await prisma.user.findUniqueOrThrow({ where: { username: 'finance' } });

  const ctoToken = await signSession({ uid: cto.id, username: cto.username, rank: cto.rankJabatan });
  const finToken = await signSession({ uid: finance.id, username: finance.username, rank: finance.rankJabatan });

  // 1. Finance rank 1 calls PUT -> 403
  {
    const req = new NextRequest('http://localhost:3000/api/setup/kriteria', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'sysselect_session=' + finToken,
      },
      body: JSON.stringify({
        kriteria: [
          { kode: 'C1', bobot: 25 },
          { kode: 'C2', bobot: 20 },
          { kode: 'C3', bobot: 20 },
          { kode: 'C4', bobot: 20 },
          { kode: 'C5', bobot: 15 },
        ],
      }),
    });
    const res = await updateKriteria(req);
    assert.equal(res.status, 403);
    console.log('  OK rank 1 ditolak 403');
  }

  // 2. Sum bobot 99 -> 400
  {
    const req = new NextRequest('http://localhost:3000/api/setup/kriteria', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'sysselect_session=' + ctoToken,
      },
      body: JSON.stringify({
        kriteria: [
          { kode: 'C1', bobot: 24 },
          { kode: 'C2', bobot: 20 },
          { kode: 'C3', bobot: 20 },
          { kode: 'C4', bobot: 20 },
          { kode: 'C5', bobot: 15 },
        ],
      }),
    });
    const res = await updateKriteria(req);
    assert.equal(res.status, 400);
    const data = await res.json();
    console.log('  OK total 99 ditolak 400:', data.error);
  }

  // 3. Sum bobot 100 -> 200
  {
    const req = new NextRequest('http://localhost:3000/api/setup/kriteria', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'sysselect_session=' + ctoToken,
      },
      body: JSON.stringify({
        kriteria: [
          { kode: 'C1', bobot: 25 },
          { kode: 'C2', bobot: 20 },
          { kode: 'C3', bobot: 20 },
          { kode: 'C4', bobot: 20 },
          { kode: 'C5', bobot: 15 },
        ],
      }),
    });
    const res = await updateKriteria(req);
    assert.equal(res.status, 200);
    const audit = await prisma.auditLog.findFirst({
      where: { aksi: 'simpan_kriteria' },
      orderBy: { id: 'desc' },
    });
    assert.ok(audit);
    console.log('  OK total 100 sukses 200, audit log:', audit.aksi);
  }

  console.log('T05 test passed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
