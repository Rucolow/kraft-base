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

  // ===== R14: サブタスク（1 段の親子） =====
  // 本日カードに出るのは「今の当番」だけなので（cockpitSlot: 先当番 04:00–15:59 /
  // 後当番 16:00–03:59）、親はその当番の実在タスクから選ぶ。計画が名指しする
  // 「トイレとシャワーの清掃」は先当番の行なので、後当番の時間帯に走ったときは
  // 同じ形の後当番の行（弁当の配達）で同じ契約を検証する。
  const jstHour = Number(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo', hour: '2-digit', hour12: false }),
  );
  const PARENT = jstHour >= 4 && jstHour < 16 ? 'トイレとシャワーの清掃' : '弁当の配達';
  const [CHILD_A, CHILD_B] =
    PARENT === 'トイレとシャワーの清掃' ? ['便器を洗う', '鏡を拭く'] : ['弁当を数える', '受付に置く'];
  // 本日カードのカウンタ「done / total」。R14 で total は葉の数になる。
  const counter = (body) => {
    const m = /当番のタスク (\d+) \/ (\d+)/.exec(body);
    return m ? { done: Number(m[1]), total: Number(m[2]) } : null;
  };

  await op.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await op.waitForTimeout(800);
  const before = counter(await txt(op));
  check('R14 the cockpit card shows a done/total counter', before !== null, JSON.stringify(before));

  // オーナーが親にサブタスクを 2 つ足す（編集モード・親行スコープの locator）。
  await op.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' });
  await op.waitForTimeout(600);
  await op.getByRole('button', { name: '編集' }).click();
  await op.waitForTimeout(400);
  const group = op.locator(`[data-task="${PARENT}"]`);
  for (const title of [CHILD_A, CHILD_B]) {
    await group.getByLabel('サブタスクの名前').fill(title);
    await group.getByRole('button', { name: 'サブタスクを追加' }).click();
    await op.waitForTimeout(700);
  }
  // 編集中の行はタイトルが input なので本文テキストには出ない（e2e/README の落とし穴 5）。
  // 置き場所の確認は編集を閉じた通常表示＝折りたたみ行を開いて行う。
  const duty = PARENT === 'トイレとシャワーの清掃' ? '先当番' : '後当番';
  await op.getByRole('button', { name: '編集' }).click();
  await op.waitForTimeout(500);
  const collapsedTasks = await txt(op);
  check(
    'R14 タスク画面: closing 編集 folds the children away',
    !new RegExp(CHILD_A).test(collapsedTasks) && !new RegExp(CHILD_B).test(collapsedTasks),
  );

  await op
    .locator(`[data-task="${PARENT}"]`)
    .getByRole('button', { name: new RegExp(PARENT) })
    .click();
  await op.waitForTimeout(400);
  const editView = await txt(op);
  check(
    'R14 both subtasks land in the parent’s duty, not in 単発',
    new RegExp(CHILD_A).test(section(editView, duty)) &&
      new RegExp(CHILD_B).test(section(editView, duty)) &&
      !new RegExp(CHILD_A).test(section(editView, '単発')),
    section(editView, duty).slice(-80),
  );

  // 本日画面: 親は「0/2」バッジの開閉行になり、畳んだ子は DOM に無い。
  await op.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await op.waitForTimeout(800);
  const parentRow = op.getByRole('button', { name: new RegExp(PARENT) });
  check('R14 本日画面: the parent is one row', (await parentRow.count()) === 1);
  check(
    'R14 本日画面: the parent starts collapsed',
    (await parentRow.getAttribute('aria-expanded')) === 'false',
  );
  const badge = await parentRow.innerText();
  check('R14 本日画面: the parent carries a 0/2 progress badge', /0\/2/.test(badge), badge.trim());
  const foldedToday = await txt(op);
  check(
    'R14 本日画面: a folded child is not in the DOM',
    !new RegExp(CHILD_A).test(foldedToday) && !new RegExp(CHILD_B).test(foldedToday),
  );
  const afterAdd = counter(foldedToday);
  check(
    'R14 the counter counts leaves (parent replaced by its 2 children = +1)',
    before !== null && afterAdd !== null && afterAdd.total === before.total + 1,
    `${before && before.total} -> ${afterAdd && afterAdd.total}`,
  );

  await parentRow.click();
  await op.waitForTimeout(400);
  check(
    'R14 本日画面: tapping the parent opens it',
    (await parentRow.getAttribute('aria-expanded')) === 'true' &&
      (await op.getByRole('button', { name: CHILD_A }).count()) === 1,
  );

  await op.getByRole('button', { name: CHILD_A }).click();
  await op.waitForTimeout(500);
  await op.getByRole('button', { name: CHILD_B }).click();
  await op.waitForTimeout(700);
  const bothDone = await txt(op);
  const struck = await op.locator('.line-through', { hasText: PARENT }).count();
  check('R14 ticking every child strikes the parent through', struck >= 1, `struck=${struck}`);
  const doneCounter = counter(bothDone);
  check(
    'R14 the counter moves by leaves (2 children done)',
    doneCounter !== null && afterAdd !== null &&
      doneCounter.done === afterAdd.done + 2 &&
      doneCounter.total === afterAdd.total,
    JSON.stringify(doneCounter),
  );
  check(
    'R14 the group stays open after the last child is ticked',
    (await parentRow.getAttribute('aria-expanded')) === 'true',
  );

  await op.getByRole('button', { name: CHILD_B }).click();
  await op.waitForTimeout(700);
  const oneOff = await txt(op);
  check(
    'R14 unticking one child un-does the parent',
    (await op.locator('.line-through', { hasText: PARENT }).count()) === 0 &&
      /1\/2/.test(await parentRow.innerText()),
    (await parentRow.innerText()).trim(),
  );
  const backCounter = counter(oneOff);
  check(
    'R14 the counter follows the leaves back down',
    backCounter !== null && doneCounter !== null && backCounter.done === doneCounter.done - 1,
    JSON.stringify(backCounter),
  );

  // 親を消すと子も消える（removeTaskTree。ローカル SQLite に CASCADE は無い）。
  await op.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' });
  await op.waitForTimeout(600);
  await op.getByRole('button', { name: '編集' }).click();
  await op.waitForTimeout(400);
  await op
    .locator(`[data-task="${PARENT}"]`)
    .getByRole('button', { name: 'タスクを削除' })
    .first()
    .click();
  await op.waitForTimeout(900);
  const afterDelete = await txt(op);
  check(
    'R14 deleting the parent deletes its subtasks too',
    !new RegExp(PARENT).test(afterDelete) &&
      !new RegExp(CHILD_A).test(afterDelete) &&
      !new RegExp(CHILD_B).test(afterDelete),
  );
  check('R14 no page errors', errs2.length === 0, errs2.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
