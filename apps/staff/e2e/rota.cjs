// R9: the login-free shift page (rota.html). Demo mode has no Supabase, so
// this verifies the page is served as its own entry and degrades honestly:
// no token → 「このリンクは無効です」; token but no backend → error notice with
// retry, calendar grid still rendered (staff can at least see the month).
const { chromium, resolveChrome } = require('./_pw.cjs');
const CHROME = resolveChrome();
const BASE = 'http://localhost:4173';
const R = [];
const check = (n, p, d = '') => {
  R.push({ n, p });
  console.log(`  ${p ? 'PASS' : 'FAIL'} — ${n}${d ? ` (${d})` : ''}`);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  const txt = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');

  // vite preview has no vercel rewrites: hit the built entry directly.
  await page.goto(`${BASE}/rota.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const noToken = await txt();
  check('rota: served as its own page (not the staff app shell)', /シフト表/.test(noToken) && !/シフトを始めますか/.test(noToken));
  check('rota: no token → invalid-link message', /このリンクは無効です/.test(noToken));

  await page.goto(`${BASE}/rota.html?t=00000000-0000-0000-0000-000000000000`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const withToken = await txt();
  check('rota: month grid renders', /\d{4}年\d{1,2}月/.test(withToken), (withToken.match(/\d{4}年\d{1,2}月/) || [''])[0]);
  check('rota: backend unavailable → honest error + retry', /読み込めませんでした/.test(withToken) && /再読み込み/.test(withToken));
  const cells = await page.locator('[data-day]').count();
  check('rota: day cells present', cells >= 28, `cells=${cells}`);

  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
