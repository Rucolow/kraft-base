// R1: explicit clock-out (退勤). Staff (モーリー, personal device) starts a shift,
// ends it from /shift, sees the persistent "お疲れさまでした" card (survives a
// reload), and can start again. The timeline "退勤（終了！！）" marker is covered by
// the endShift unit logic; here we verify the user-facing card behavior.
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
  page.on('dialog', (d) => d.accept()); // auto-accept the 退勤 confirm
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

  // Personal device bound to モーリー (staff), start a shift.
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.getByText('個人端末').click();
  await page.waitForTimeout(150);
  await page.getByText('モーリー').first().click();
  await page.waitForTimeout(150);
  await page.getByText('この設定で始める').click();
  await wU((u) => u.includes('/shift'));
  await page.getByRole('button', { name: /シフトを開始/ }).click();
  await wU((u) => u === '/');
  await page.waitForTimeout(500);

  // Go to /shift — the end-shift affordance must be there.
  await page.goto(`${BASE}/shift`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const endBtn = await page.getByRole('button', { name: /シフトを終了する/ }).count();
  check('R1 end-shift button present while on shift', endBtn >= 1, `count=${endBtn}`);
  check('R1 current-shift card names モーリー', /現在のシフト[\s\S]{0,8}モーリー/.test(await txt()));

  // Clock out.
  await page.getByRole('button', { name: /シフトを終了する/ }).click();
  await page.waitForTimeout(700);
  check('R1 clocked-out card shows お疲れさまでした', /お疲れさまでした/.test(await txt()), (await txt()).slice(0, 100));

  // Persists across reload (the whole point vs a volatile done screen).
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  check('R1 clocked-out card persists after reload', /お疲れさまでした/.test(await txt()));

  // Can start again.
  const startAgain = await page.getByRole('button', { name: /シフトを開始/ }).count();
  check('R1 can start a shift again after clock-out', startAgain >= 1, `count=${startAgain}`);

  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
