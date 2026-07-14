// P0-5: the build stamp must be visible on /login (so "which build is this
// device on?" is answerable from one screenshot). Demo mode skips auth, so we
// visit /login directly — the stamp renders regardless of session.
const { chromium, resolveChrome } = require('./_pw.cjs');
const CHROME = resolveChrome();
const BASE = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const hasStamp = /build \S/.test(body);
  const hasLoginUi = /ログイン|メールアドレス/.test(body);
  console.log(`  ${hasLoginUi ? 'PASS' : 'FAIL'} — /login renders the login UI`);
  console.log(`  ${hasStamp ? 'PASS' : 'FAIL'} — P0-5 build stamp visible on /login`);
  console.log(`  ${errs.length === 0 ? 'PASS' : 'FAIL'} — no page errors (${errs.slice(0, 2).join(' | ')})`);
  const ok = hasStamp && hasLoginUi && errs.length === 0;
  console.log(`\nRESULT: ${ok ? '3/3' : 'FAIL'}`);
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
