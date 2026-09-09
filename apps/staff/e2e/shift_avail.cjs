// R11: 「シフト」画面 (/shifts). Staff register their own 「入れない日」 on the
// 休み希望 tab (and never see the owner tabs); the owner plans the rota on the
// シフト作成 tab, where an unavailable person is flagged in the add form and the
// bulk tools drop the days they cannot work (naming them in a confirm).
// Seed: モーリー unavailable today+3, 日中スタッフ today+5 and today+6.
const { chromium, resolveChrome } = require('./_pw.cjs');
const CHROME = resolveChrome();
const BASE = 'http://localhost:4173';
const R = [];
const check = (n, p, d = '') => {
  R.push({ n, p });
  console.log(`  ${p ? 'PASS' : 'FAIL'} — ${n}${d ? ` (${d})` : ''}`);
};

// The app keys off shiftDate() (JST, 04:00 boundary) — reproduce it so we can tap
// the exact cell via its data-day hook (cell text concatenates day + counts).
function jstShiftDate() {
  let jstMs = Date.now() + 9 * 3600 * 1000;
  if (new Date(jstMs).getUTCHours() < 4) jstMs -= 24 * 3600 * 1000;
  return new Date(jstMs).toISOString().slice(0, 10);
}
function plusDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
const short = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

async function setup(browser, staffName, path) {
  const page = await (
    await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
  ).newPage();
  const dialogs = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    d.accept();
  });
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
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  return { page, wU, dialogs };
}

const txt = async (page) =>
  (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');

// Tap a specific day, paging the month grid to reach it (today+8 or today-2 can
// fall outside the month first rendered).
async function tapDay(page, date) {
  for (let i = 0; i < 3; i++) {
    const cell = page.locator(`[data-day="${date}"]`);
    if ((await cell.count()) > 0) {
      await cell.click();
      await page.waitForTimeout(450);
      return true;
    }
    const first = await page.locator('[data-day]').first().getAttribute('data-day');
    await page.getByRole('button', { name: first > date ? '前の月' : '次の月' }).click();
    await page.waitForTimeout(350);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const today = jstShiftDate();

  // ===== STAFF (日中スタッフ) — 休み希望 only =====
  const errs = [];
  const { page } = await setup(browser, '日中スタッフ', '/shifts');
  page.on('pageerror', (e) => errs.push('STAFF pageerror:' + e.message));

  const staffView = await txt(page);
  check('R11 staff sees the 休み希望 tab', /休み希望/.test(staffView), staffView.slice(0, 90));
  check('R11 staff does NOT see the owner tabs', !/シフト作成/.test(staffView) && !/勤務/.test(staffView));
  check('R11 staff sees the intro line', /出勤できない日をタップ/.test(staffView));

  // Tap today+8 → my own × appears on that cell; tap again → gone.
  const target = plusDays(today, 8);
  await tapDay(page, target);
  const onCount = await page.locator(`[data-day="${target}"][data-unavail="me"]`).count();
  check('R11 tapping a day marks it as my 入れない日', onCount === 1, `count=${onCount}`);
  const pressed = await page.locator(`[data-day="${target}"]`).getAttribute('aria-pressed');
  check('R11 the cell reports aria-pressed=true', pressed === 'true', String(pressed));
  await page.locator(`[data-day="${target}"]`).click();
  await page.waitForTimeout(450);
  const offCount = await page.locator(`[data-day="${target}"][data-unavail="me"]`).count();
  check('R11 tapping again removes it', offCount === 0, `count=${offCount}`);

  // today+3 is モーリー's seeded request → listed in the day detail.
  await tapDay(page, plusDays(today, 3));
  const detail = await txt(page);
  const namesSeg = (detail.split('入れない:')[1] || '').split('この日のシフト')[0];
  check('R11 day detail lists who cannot work', /モーリー/.test(namesSeg), namesSeg.slice(0, 60));
  check('R11 day detail shows the day’s rota', /この日のシフト/.test(detail));
  check('STAFF no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  // ===== OWNER (ルッコロー) — シフト作成 =====
  const errs2 = [];
  const { page: op, dialogs } = await setup(browser, 'ルッコロー', '/shifts?tab=plan');
  op.on('pageerror', (e) => errs2.push('OWNER pageerror:' + e.message));

  const ownerView = await txt(op);
  check('R11 owner sees all three tabs', /休み希望/.test(ownerView) && /シフト作成/.test(ownerView) && /勤務/.test(ownerView));
  check('R11 owner sees the rota tools', /期間でまとめて入力/.test(ownerView) && /前週をコピー/.test(ownerView));

  // Select today+5 (日中スタッフ requested it off) → the add-form option is flagged.
  const day5 = plusDays(today, 5);
  await tapDay(op, day5);
  const addSelect = op.locator('select').first();
  const options = await addSelect.locator('option').allInnerTexts();
  check('R11 add form flags an unavailable staff', options.some((o) => /日中スタッフ（入れない）/.test(o)), options.join('/'));

  // Assigning them anyway asks for confirmation, then adds the row.
  const delBefore = await op.getByRole('button', { name: '削除' }).count();
  const dlgBefore = dialogs.length;
  await addSelect.selectOption({ label: '日中スタッフ（入れない）' });
  await op.getByRole('button', { name: '追加', exact: true }).last().click();
  await op.waitForTimeout(600);
  check('R11 assigning an unavailable staff asks first', dialogs.length === dlgBefore + 1 && /入れない日として登録/.test(dialogs[dlgBefore] || ''), (dialogs[dlgBefore] || '').slice(0, 60));
  const delAfter = await op.getByRole('button', { name: '削除' }).count();
  check('R11 the assignment is added after confirming', delAfter === delBefore + 1, `${delBefore}->${delAfter}`);

  // Seed a source week so 前週をコピー would land 日中スタッフ on today+5/+6 (both
  // registered as 入れない). The range tool takes dates directly, so no paging.
  await op.getByRole('button', { name: '期間でまとめて入力' }).click();
  await op.waitForTimeout(250);
  await op.locator('input[type=date]').first().fill(plusDays(today, -2));
  await op.locator('input[type=date]').nth(1).fill(plusDays(today, -1));
  await op.locator('select').first().selectOption({ label: '日中スタッフ' });
  await op.getByRole('button', { name: '割り当て' }).click();
  await op.waitForTimeout(700);

  // Anchor on today+5: source [today-2, today+4] shifts +7 days.
  await tapDay(op, day5);
  const dlgBefore2 = dialogs.length;
  await op.getByRole('button', { name: '前週をコピー' }).click();
  await op.waitForTimeout(900);
  const copyMsg = dialogs.slice(dlgBefore2).join(' | ');
  check('R11 copy-week warns about the excluded days', /除外/.test(copyMsg), copyMsg.slice(0, 120));
  check('R11 copy-week names today+5 and today+6', copyMsg.includes(short(day5)) && copyMsg.includes(short(plusDays(today, 6))), `${short(day5)},${short(plusDays(today, 6))} in "${copyMsg.slice(0, 120)}"`);
  check('OWNER no page errors', errs2.length === 0, errs2.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
