// Bento-order mirror UI (plan-bento-integration §5). Demo seed has 5 orders for
// today: PAID linked (Weber ×2 yakiniku), PAID unmatched (ROSSI, note), CONFIRMED
// manual entry (ONSITE, unmatched), CANCELLED linked (Schmidt), stale PENDING
// (hidden by the 45-min rule). Verifies: panel totals, unmatched count, expand,
// note display, 1-tap matching, exclude, cancelled strike, hidden PENDING.
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

  // Staff member is enough — bento matching is org-member work, not owner-only.
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

  await page.goto(`${BASE}/guests`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const panel = await txt();

  // Totals: active = 2 yakiniku (Weber) + 1 vegetarian (Rossi) + 2 onigiri (manual) = 5.
  // Cancelled (Schmidt) and stale PENDING excluded.
  check('bento panel shows total 5 meals', /弁当注文 計5食/.test(panel), (panel.match(/弁当注文[^未]*/) || [''])[0]);
  check('bento panel shows 2 unmatched', /未照合2件/.test(panel));

  // Expand the panel.
  await page.getByRole('button', { name: /弁当注文 計/ }).click();
  await page.waitForTimeout(400);
  const expanded = await txt();
  check('expanded: linked order shows guest name', /→ Lukas & Anna Weber/.test(expanded));
  check('expanded: note visible', /減塩でお願いします/.test(expanded));
  check('expanded: manual-entry tag 現地決済', /現地決済/.test(expanded));
  check('expanded: cancelled order struck with badge', /キャンセル/.test(expanded));
  check('expanded: stale PENDING hidden', !/決済待ち/.test(expanded));

  // Two unmatched orders. ORDER BY id puts bo-manual-1 (電話注文, ONSITE) before
  // bo-unmatched-1 (ROSSI) — so the FIRST 照合 belongs to the manual entry.
  const beforeBtns = await page.getByRole('button', { name: '照合', exact: true }).count();
  check('two 照合 buttons before matching', beforeBtns === 2, `count=${beforeBtns}`);

  // Step 1: exclude the manual phone order (not a staying guest).
  await page.getByRole('button', { name: '照合', exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /宿泊者ではない/ }).click();
  await page.waitForTimeout(500);
  const afterExclude = await txt();
  check('excluded: one unmatched left', /未照合1件/.test(afterExclude), (afterExclude.match(/弁当注文[^詳]*/) || [''])[0]);
  check('excluded row shows 対象外（戻す）', /対象外（戻す）/.test(afterExclude));

  // Step 2: the remaining 照合 is ROSSI's order — link it to Marco Rossi.
  // The picker chip's name includes 当日; the guest-list card doesn't (strict-mode safe).
  await page.getByRole('button', { name: '照合', exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /Marco Rossi.*当日/ }).click();
  await page.waitForTimeout(500);
  const afterLink = await txt();
  check('matched: order now shows → Marco Rossi', /→ Marco Rossi/.test(afterLink));
  check('no unmatched warning left', !/未照合/.test(afterLink));

  // Guest detail: Weber shows the linked order chip, manual field greyed as 手入力.
  // Collapse the panel first — its expanded rows contain a "→ Lukas & Anna Weber"
  // unlink chip that would otherwise shadow the guest card.
  await page.getByRole('button', { name: /弁当注文 計/ }).click();
  await page.waitForTimeout(300);
  await page.locator('text=Lukas & Anna Weber').first().click();
  await wU((u) => /^\/guests\/[^/]+$/.test(u));
  await page.waitForTimeout(400);
  const detail = await txt();
  check('detail: order chip 焼肉×2', /🍱 焼肉×2/.test(detail), (detail.match(/🍱[^ ]*/) || [''])[0]);
  check('detail: manual bento demoted to 手入力', /手入力: 焼肉弁当 ×2/.test(detail));

  // これから先 tab (R5): future orders surface as a per-date summary line and a
  // per-guest 🍱 chip. Seed has Sofia Lombardi (+2 days, linked 焼肉×2) with an
  // unmatched vegetarian the same day (so her date aggregates 計3食（焼肉2・
  // ベジタリアン1）未照合1件), plus an order-only day (+4 days, おむすび×2, no guest).
  // The two future days have DISTINCT meal counts so each assertion isolates one.
  await page.goto(`${BASE}/guests`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /これから先/ }).click();
  await page.waitForTimeout(400);
  const upcoming = await txt();
  // Discriminating: 焼肉2・ベジタリアン1 is unique to the +2 day, so this validates
  // totalMeals across BOTH orders AND that the same-day unmatched still counts.
  check(
    'upcoming: +2 day aggregates linked + same-day unmatched',
    /計3食（焼肉2・ベジタリアン1）\s*未照合1件/.test(upcoming),
    (upcoming.match(/弁当注文[^食]*食[^）]*）\s*(未照合\d件)?/) || [''])[0],
  );
  check('upcoming: +2 day lists the staying guest', /Sofia Lombardi/.test(upcoming));
  check('upcoming: linked guest shows 🍱 chip', /🍱 焼肉×2/.test(upcoming));
  check('upcoming: order-only day surfaces', /計2食（おむすび2）/.test(upcoming));

  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
