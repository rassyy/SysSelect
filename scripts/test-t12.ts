import assert from "node:assert/strict";
import type { Browser } from "puppeteer-core";
import { BASE, cookieUntuk, launchBrowser, majuKeKonsensus, pulihkanSetup, tutupPrisma } from "./browser-helpers";

async function main() {
  let browser: Browser | undefined;
  let sessionId: number | undefined;
  try {
    const state = await majuKeKonsensus();
    sessionId = state.sessionId;
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setCookie({ name: "sysselect_session", value: (await cookieUntuk(state.users.cto)).split("=")[1], url: BASE });
    await page.goto(`${BASE}/konsensus`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="saw-comparison"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="konsensus-view"]')?.getAttribute('data-reveal') === 'playing', { timeout: 10000 });
    const tops = await page.$$eval('[data-testid="saw-cell"][data-rank="1"]', cells => cells.map(c => `${c.getAttribute('data-role')}:${c.getAttribute('data-vendor')}`).sort());
    assert.deepEqual(tops, ['cto:V1', 'finance:V4', 'headit:V3']);
    console.log('OK tabel SAW: cto:V1, headit:V3, finance:V4');
    // Check interactions during reveal, not after completion.
    await page.click('[data-testid="hc-toggle"]');
    assert.equal(await page.$eval('[data-testid="hc-toggle"]', el => el.getAttribute('aria-checked')), 'true');
    console.log('OK interaksi: toggle dapat diklik saat reveal');
    await page.waitForFunction(() => {
      const fill = document.querySelector<HTMLElement>('[data-vendor="V3"] [data-testid="chart-fill"]');
      return fill?.style.width === '100%';
    }, { timeout: 6000 });
    await page.waitForFunction(() => {
      const winner = document.querySelector<HTMLElement>('[data-testid="borda-row"][data-winner="1"]');
      return !!winner && getComputedStyle(winner).transform.includes('-4');
    }, { timeout: 6000 });
    await page.click('[data-testid="hc-toggle"]');
    const screenshot = 'screenshots/T12-konsensus.png';
    await page.screenshot({ path: screenshot, fullPage: true });
    await page.click('a[href="/dashboard"]');
    await page.waitForFunction(() => location.pathname === '/dashboard');
    await page.waitForSelector('a[href="/konsensus"]');
    await page.click('a[href="/konsensus"]');
    await page.waitForFunction(() => location.pathname === '/konsensus');
    await page.waitForSelector('[data-testid="borda-chart"]');
    assert.equal(await page.$eval('[data-testid="konsensus-view"]', el => el.getAttribute('data-reveal')), 'final');
    console.log('OK navigasi: reveal tidak berulang saat kembali ke konsensus');
    await page.click('a[href="/hasil"]');
    await page.waitForFunction(() => [...document.querySelectorAll('a')].some(el => el.textContent?.includes('Putar ulang')));
    await page.evaluate(() => [...document.querySelectorAll('a')].find(el => el.textContent?.includes('Putar ulang'))?.click());
    await page.waitForFunction(() => document.querySelector('[data-testid="konsensus-view"]')?.getAttribute('data-reveal') === 'playing');
    console.log('OK replay: tombol /hasil memutar reveal kembali');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="borda-chart"]');
    await page.waitForFunction(() => document.querySelector('[data-testid="konsensus-view"]')?.getAttribute('data-reveal') === 'final');
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent?.includes('Putar ulang'))?.click());
    assert.equal(await page.$eval('[data-testid="konsensus-view"]', el => el.getAttribute('data-reveal')), 'final');
    await page.click('a[href="/dashboard"]');
    await page.waitForFunction(() => location.pathname === '/dashboard');
    await page.click('a[href="/konsensus"]');
    await page.waitForFunction(() => location.pathname === '/konsensus');
    assert.equal(await page.$eval('[data-testid="konsensus-view"]', el => el.getAttribute('data-reveal')), 'final');
    assert.equal(await page.$eval('[data-testid="konsensus-view"]', el => el.getAttribute('data-reveal')), 'final');
    console.log('OK reduced motion: state akhir langsung; prefers-reduced-motion benar di browser', await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
    console.log(`Screenshot: ${screenshot}`);
  } finally {
    if (browser) await browser.close();
    if (sessionId !== undefined) await pulihkanSetup(sessionId);
    await tutupPrisma();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
