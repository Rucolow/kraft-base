// R12: タスク画面が「先当番 / 後当番 / 単発」に再編されたことの回帰。
// スタッフは今まで通りチェックするだけ（編集トグルも削除ボタンも出ない）。
// オーナーは「編集」トグルで改名・並べ替え・当番への追加ができる。
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
  await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  return page;
}

const txt = async (page) =>
  (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');

// The screen renders 先当番 → 後当番 → 単発 in that order, so slicing the body
// text on the headings gives each section's contents.
function section(body, name) {
  const order = ['先当番', '後当番', '単発'];
  const start = body.indexOf(name);
  if (start < 0) return '';
  const rest = order.slice(order.indexOf(name) + 1);
  let end = body.length;
  for (const next of rest) {
    const at = body.indexOf(next, start + name.length);
    if (at >= 0) {
      end = Math.min(end, at);
    }
  }
  return body.slice(start, end);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  // ===== STAFF (日中スタッフ) =====
  const errs = [];
  const page = await setup(browser, '日中スタッフ');
  page.on('pageerror', (e) => errs.push('STAFF pageerror:' + e.message));

  const staffView = await txt(page);
  check('R12 staff sees both duty headings', /先当番/.test(staffView) && /後当番/.test(staffView));
  check(
    'R12 the duty lists carry モーリー’s tasks',
    /のれんと提灯を準備/.test(section(staffView, '先当番')) &&
      /弁当の配達/.test(section(staffView, '後当番')),
    section(staffView, '後当番').slice(0, 60),
  );
  const staffToggle = await page.getByRole('button', { name: '編集' }).count();
  check('R12 staff sees NO 編集 toggle', staffToggle === 0, `count=${staffToggle}`);
  const staffDel = await page.getByRole('button', { name: 'タスクを削除' }).count();
  check('R12 staff sees NO delete button', staffDel === 0, `count=${staffDel}`);

  // Ticking still works for staff (the 0026 column GRANT keeps done/done_at open).
  await page.locator('button:has-text("ベッドメイキング")').first().click();
  await page.waitForTimeout(500);
  const ticked = await page.locator('.line-through', { hasText: 'ベッドメイキング' }).count();
  check('R12 staff can tick a duty task', ticked === 1, `struck=${ticked}`);
  check('STAFF no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  // ===== OWNER (ルッコロー) =====
  const errs2 = [];
  const op = await setup(browser, 'ルッコロー');
  op.on('pageerror', (e) => errs2.push('OWNER pageerror:' + e.message));

  const toggle = op.getByRole('button', { name: '編集' });
  check('R12 owner sees the 編集 toggle', (await toggle.count()) === 1);
  check('R12 the toggle starts off', (await toggle.getAttribute('aria-pressed')) === 'false');
  await toggle.click();
  await op.waitForTimeout(400);
  check('R12 the toggle reports aria-pressed=true', (await toggle.getAttribute('aria-pressed')) === 'true');

  // Rename the first 先当番 row (inline field, committed on Enter).
  const names = op.getByLabel('タスク名');
  const firstName = await names.nth(0).inputValue();
  await names.nth(0).fill('のれんと提灯を準備（改）');
  await names.nth(0).press('Enter');
  await op.waitForTimeout(600);
  const renamed = await op.getByLabel('タスク名').nth(0).inputValue();
  check('R12 owner renames a duty task', renamed === 'のれんと提灯を準備（改）', `${firstName} -> ${renamed}`);

  // Move it down one step → it swaps with ライト類の充電確認.
  await op.getByRole('button', { name: '下へ' }).nth(0).click();
  await op.waitForTimeout(700);
  const after = [
    await op.getByLabel('タスク名').nth(0).inputValue(),
    await op.getByLabel('タスク名').nth(1).inputValue(),
  ];
  check(
    'R12 ↓ moves the row down one place',
    after[0] === 'ライト類の充電確認' && after[1] === 'のれんと提灯を準備（改）',
    after.join(' / '),
  );

  // Add a routine task to 後当番 — it must land in that duty, not in 単発.
  await op.getByLabel('後当番に追加するタスク').fill('タオルの補充');
  await op.getByRole('button', { name: 'この当番に追加' }).nth(1).click();
  await op.waitForTimeout(700);

  await toggle.click();
  await op.waitForTimeout(400);
  check('R12 the toggle turns back off', (await toggle.getAttribute('aria-pressed')) === 'false');

  const ownerView = await txt(op);
  check(
    'R12 the added task is in 後当番, not 単発',
    /タオルの補充/.test(section(ownerView, '後当番')) &&
      !/タオルの補充/.test(section(ownerView, '単発')),
    section(ownerView, '後当番').slice(-60),
  );
  check(
    'R12 the rename and the new order survive the toggle',
    /のれんと提灯を準備（改）/.test(ownerView) &&
      ownerView.indexOf('ライト類の充電確認') < ownerView.indexOf('のれんと提灯を準備（改）'),
  );
  check('OWNER no page errors', errs2.length === 0, errs2.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
