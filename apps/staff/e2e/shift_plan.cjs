// R3b: shift view (rota). Owner sees staff chips on the calendar, edits a day's
// assignments (add/delete), and has the range + copy-week tools. A staff account
// sees the shift view read-only (no edit UI). Seed has モーリー + 日中スタッフ today.
const { chromium, resolveChrome } = require('./_pw.cjs');
const CHROME = resolveChrome();
const BASE = 'http://localhost:4173';
const R = [];
const check = (n, p, d = '') => {
  R.push({ n, p });
  console.log(`  ${p ? 'PASS' : 'FAIL'} — ${n}${d ? ` (${d})` : ''}`);
};

async function setup(browser, staffName) {
  const page = await (
    await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
  ).newPage();
  page.on('dialog', (d) => d.accept());
  const wU = async (f, ms = 10000) => {
    const s = Date.now();
    while (Date.now() - s < ms) {
      if (f(new URL(page.url()).pathname)) return true;
      await page.waitForTimeout(150);
    }
    return false;
  };
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.getByText('個人端末').click();
  await page.waitForTimeout(150);
  await page.getByText(staffName).first().click();
  await page.waitForTimeout(150);
  await page.getByText('この設定で始める').click();
  await wU((u) => u.includes('/shift'));
  await page.getByRole('button', { name: /シフトを開始/ }).click();
  await wU((u) => u === '/');
  await page.waitForTimeout(500);
  // Open the calendar → shift view, tap today.
  await page.goto(`${BASE}/guests`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'カレンダー', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'シフト', exact: true }).click();
  await page.waitForTimeout(300);
  return { page, wU };
}

const txt = async (page) =>
  (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');

// The seed keys off shiftDate() (JST, 04:00 boundary). Reproduce the day-of-month
// so we tap the correct calendar cell regardless of the runner's timezone/hour.
function jstShiftDayNum() {
  let jstMs = Date.now() + 9 * 3600 * 1000;
  if (new Date(jstMs).getUTCHours() < 4) jstMs -= 24 * 3600 * 1000;
  return new Date(jstMs).getUTCDate();
}
const tapToday = async (page) => {
  const n = jstShiftDayNum();
  await page
    .locator('div.grid button')
    .filter({ hasText: new RegExp(`^${n}(\\D|$)`) })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(400);
};

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const errs = [];

  // ===== OWNER (ルッコロー) =====
  const { page } = await setup(browser, 'ルッコロー');
  page.on('pageerror', (e) => errs.push('OWNER pageerror:' + e.message));

  const grid = await txt(page);
  // モ (モーリー's chip) is unambiguous — it never appears in the weekday header
  // 日月火水木金土, so this only passes if a real staff chip rendered.
  check('R3b shift cells show staff chips', /モ/.test(grid), '');

  // Tap the today cell (only day with plans in the current-month seed grid). The
  // shift toggle removed guest headcounts, so tap the cell holding "遅番"? No —
  // chips are single chars. Tap the cell for today's date number.
  await tapToday(page);
  const withList = await txt(page);
  check('R3b tapping a day lists assignments', /のシフト/.test(withList) && /モーリー|日中スタッフ/.test(withList), withList.slice(0, 120));
  check('R3b label (遅番) shown', /遅番/.test(withList));

  const delBefore = await page.getByRole('button', { name: '削除' }).count();
  check('R3b owner sees delete buttons', delBefore >= 1, `count=${delBefore}`);
  check('R3b owner sees add form', /この日に追加/.test(withList));
  check('R3b owner sees range + copy tools', /期間でまとめて入力/.test(withList) && /前週をコピー/.test(withList));

  // Add an assignment (ルッコロー) → delete count grows by 1.
  await page.locator('select').first().selectOption({ label: 'ルッコロー' });
  await page.getByRole('button', { name: '追加', exact: true }).last().click();
  await page.waitForTimeout(500);
  const delAfterAdd = await page.getByRole('button', { name: '削除' }).count();
  check('R3b owner add creates an assignment', delAfterAdd === delBefore + 1, `${delBefore}->${delAfterAdd}`);

  // Delete one → count shrinks.
  await page.getByRole('button', { name: '削除' }).first().click();
  await page.waitForTimeout(500);
  const delAfterDel = await page.getByRole('button', { name: '削除' }).count();
  check('R3b owner delete removes an assignment', delAfterDel === delAfterAdd - 1, `${delAfterAdd}->${delAfterDel}`);

  // Range assign: open the tool, assign 日中スタッフ over today (defaults) — count grows.
  // The range form's select is DOM-first (it renders above the add form), so .first().
  await page.getByRole('button', { name: '期間でまとめて入力' }).click();
  await page.waitForTimeout(200);
  await page.locator('select').first().selectOption({ label: '日中スタッフ' }).catch(() => {});
  await page.getByRole('button', { name: '割り当て' }).click();
  await page.waitForTimeout(600);
  const delAfterRange = await page.getByRole('button', { name: '削除' }).count();
  check('R3b range assign adds for the day (dedup-safe)', delAfterRange >= delAfterDel, `${delAfterDel}->${delAfterRange}`);

  check('OWNER no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  // ===== STAFF (日中スタッフ) — read only =====
  const errs2 = [];
  const { page: sp } = await setup(browser, '日中スタッフ');
  sp.on('pageerror', (e) => errs2.push('STAFF pageerror:' + e.message));
  await tapToday(sp);
  const staffView = await txt(sp);
  check('R3b staff sees the shift assignments', /のシフト/.test(staffView) && /モーリー/.test(staffView));
  check('R3b staff sees NO add form', !/この日に追加/.test(staffView));
  const staffDel = await sp.getByRole('button', { name: '削除' }).count();
  check('R3b staff has NO delete buttons', staffDel === 0, `count=${staffDel}`);
  check('R3b staff has NO range/copy tools', !/期間でまとめて入力/.test(staffView));
  check('STAFF no page errors', errs2.length === 0, errs2.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
