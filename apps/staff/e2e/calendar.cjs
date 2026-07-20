// R3a: guest month calendar. Owner opens the カレンダー tab, sees the guest|shift
// view toggle (shift disabled), the current month, a headcount on the seed day,
// a 貸切 highlight, and — on tapping the day — the guest list below.
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
  const page = await (
    await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
  ).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  const wU = async (f, ms = 10000) => {
    const s = Date.now();
    while (Date.now() - s < ms) {
      if (f(new URL(page.url()).pathname)) return true;
      await page.waitForTimeout(150);
    }
    return false;
  };
  const txt = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');

  // Owner (ルッコロー) so guest add is allowed.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.getByText('個人端末').click();
  await page.waitForTimeout(150);
  await page.getByText('ルッコロー').first().click();
  await page.waitForTimeout(150);
  await page.getByText('この設定で始める').click();
  await wU((u) => u.includes('/shift'));
  await page.getByRole('button', { name: /シフトを開始/ }).click();
  await wU((u) => u === '/');
  await page.waitForTimeout(500);

  // Add a 貸切 guest for today so the calendar has a whole-house day to highlight.
  await page.goto(`${BASE}/guests`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /追加/ }).first().click();
  await wU((u) => /\/new$/.test(u));
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '貸切', exact: true }).click();
  // Name must not contain "カレンダー" — it would collide with the tab locator.
  await page.getByLabel('お名前').fill('マルキリ検証さん');
  await page.getByRole('button', { name: '追加', exact: true }).last().click();
  await wU((u) => u === '/guests');
  await page.waitForTimeout(400);

  // Open the calendar tab (exact — the tab label is exactly "カレンダー").
  await page.getByRole('button', { name: 'カレンダー', exact: true }).click();
  await page.waitForTimeout(400);
  const cal = await txt();
  check('R3a view toggle: ゲスト + シフト（準備中）', /ゲスト/.test(cal) && /シフト.{0,4}準備中/.test(cal), '');
  // The only シフト button on this screen is the (disabled) view toggle; the
  // accessible name has a space before （準備中）, so match loosely.
  const shiftDisabled = await page
    .getByRole('button', { name: /シフト/ })
    .isDisabled()
    .catch(() => false);
  check('R3a シフト toggle is disabled (skeleton)', shiftDisabled);
  check('R3a shows the current month label', /\d{4}年\d{1,2}月/.test(cal), (cal.match(/\d{4}年\d{1,2}月/) || [''])[0]);
  check('R3a a day cell shows a headcount (名)', /\d+名/.test(cal));
  check('R3a 貸切 day highlighted (label in a cell)', /貸切/.test(cal));

  // Tap the day cell that has guests (all seed guests are today) → list appears.
  await page.locator('button').filter({ hasText: /\d+名/ }).first().click();
  await page.waitForTimeout(400);
  const withList = await txt();
  check('R3a tapping a day lists its guests', /Jonas Schmidt/.test(withList) || /マルキリ検証さん/.test(withList), withList.slice(0, 140));

  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
