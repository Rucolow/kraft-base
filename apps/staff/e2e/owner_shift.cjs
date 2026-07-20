// Verifies the owner login/shift-start repair (docs/plan-owner-login.md):
//   P0-1  owner appears in the shared-mode shift roster and can start a shift
//   P0-3  Setup starts with no mode chosen (no silent "shared iPad" default)
//   P0-4  a "端末の設定を変更" link reaches Setup, pre-filled with current values
// Demo seed: ルッコロー(owner) / モーリー(staff) / 日中スタッフ(staff).
const { chromium, resolveChrome } = require('./_pw.cjs');
const CHROME = resolveChrome();
const BASE = 'http://localhost:4173';
const R = [];
const check = (name, pass, detail = '') => {
  R.push({ name, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror:' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!/ERR_CONNECTION_CLOSED|404|favicon/.test(t)) errs.push('console:' + t);
    }
  });
  const waitUrl = async (p, ms = 10000) => {
    const s = Date.now();
    while (Date.now() - s < ms) {
      if (p(new URL(page.url()).pathname)) return true;
      await page.waitForTimeout(150);
    }
    return false;
  };
  const txt = async () => (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');

  // Fresh device → Setup.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300);

  // P0-3: nothing chosen yet → the start button must not be shown.
  const startBefore = await page.getByRole('button', { name: 'この設定で始める' }).count();
  check('P0-3 no start button before a mode is chosen', startBefore === 0, `count=${startBefore}`);

  // Choose the shared (reception iPad) mode, then start.
  await page.getByText('共有（受付iPad）').click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'この設定で始める' }).click();
  await waitUrl((u) => u.includes('/shift'));
  await page.waitForTimeout(600);

  // P0-1: the owner must be tappable in the shared roster.
  const roster = await txt();
  check('P0-1 owner (ルッコロー) shown in shared roster', /ルッコロー/.test(roster), roster.slice(0, 140));

  await page.getByText('ルッコロー').first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /シフトを開始/ }).click();
  await waitUrl((u) => u === '/');
  await page.waitForTimeout(700);
  check('P0-1 owner starts a shift and reaches Today', new URL(page.url()).pathname === '/', page.url());

  // P0-4: re-config link on the roster → Setup pre-filled (start button shown at once).
  await page.goto(`${BASE}/shift`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const linkCount = await page.getByRole('button', { name: '端末の設定を変更' }).count();
  check('P0-4 re-config link present on roster', linkCount >= 1, `count=${linkCount}`);
  if (linkCount > 0) {
    await page.getByRole('button', { name: '端末の設定を変更' }).click();
    await waitUrl((u) => u.includes('/setup'));
    await page.waitForTimeout(500);
    const startReconf = await page.getByRole('button', { name: 'この設定で始める' }).count();
    check('P0-4 re-config pre-fills mode (start button shown)', startReconf > 0, `count=${startReconf}`);
  }

  check('no console/page errors', errs.length === 0, errs.slice(0, 3).join(' | '));

  const passed = R.filter((r) => r.pass).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})();
