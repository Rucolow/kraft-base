// R13: 現金出納 (/records/cash). スタッフは記録・訂正はできるが削除はできない。
// 合計と「今月の立替」が正しく動くこと、返品（負数）が合計を下げることを見る。
// devSeed が当月に3行（うち1件が立替・1件が返品）入れているので、金額は
// 「差分」で検証する。
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
  await page.goto(`${BASE}/records/cash`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  return page;
}

const txt = async (page) =>
  (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');

// 「今月合計 ¥3,700」 / 「今月の立替 −¥500」 → number. The minus is U+2212.
function yen(body, label) {
  const m = body.match(new RegExp(`${label}\\s*(−?)¥([\\d,]+)`));
  if (!m) return null;
  return (m[1] ? -1 : 1) * Number(m[2].replace(/,/g, ''));
}

async function addRow(page, item, amount, personal) {
  await page.getByPlaceholder('品目（例: 洗剤・ゴミ袋）').fill(item);
  await page.getByLabel('金額', { exact: true }).fill(String(amount));
  if (personal) {
    await page.getByRole('button', { name: '立替', exact: true }).first().click();
  }
  await page.getByRole('button', { name: '追加', exact: true }).click();
  await page.waitForTimeout(700);
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

  const start = await txt(page);
  const total0 = yen(start, '今月合計');
  const personal0 = yen(start, '今月の立替');
  check('R13 the ledger shows both month totals', total0 !== null && personal0 !== null, `合計=${total0} 立替=${personal0}`);

  await addRow(page, '洗剤とゴミ袋', 1200, false);
  await addRow(page, 'コーヒー豆（立替）', 800, true);
  const afterAdds = await txt(page);
  check('R13 the rows are listed', /洗剤とゴミ袋/.test(afterAdds) && /コーヒー豆（立替）/.test(afterAdds));
  check('R13 the 立替 row carries the badge', /コーヒー豆（立替） 立替/.test(afterAdds), afterAdds.slice(afterAdds.indexOf('コーヒー豆（立替）'), afterAdds.indexOf('コーヒー豆（立替）') + 40));
  check('R13 今月合計 adds both rows', yen(afterAdds, '今月合計') === total0 + 2000, `${total0} -> ${yen(afterAdds, '今月合計')}`);
  check('R13 今月の立替 counts only the personal row', yen(afterAdds, '今月の立替') === personal0 + 800, `${personal0} -> ${yen(afterAdds, '今月の立替')}`);

  // 返品 = a negative row; the month total must drop.
  await addRow(page, '洗剤の返品', -500, false);
  const afterRefund = await txt(page);
  check('R13 a 返品 row lowers the total', yen(afterRefund, '今月合計') === total0 + 1500, `${yen(afterAdds, '今月合計')} -> ${yen(afterRefund, '今月合計')}`);
  check('R13 the refund is shown as a negative amount', /洗剤の返品/.test(afterRefund) && /−¥500/.test(afterRefund));

  const staffDel = await page.getByRole('button', { name: '記録を削除' }).count();
  check('R13 staff sees NO delete button', staffDel === 0, `count=${staffDel}`);
  check('STAFF no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  // ===== OWNER (ルッコロー) =====
  const errs2 = [];
  const op = await setup(browser, 'ルッコロー');
  op.on('pageerror', (e) => errs2.push('OWNER pageerror:' + e.message));

  const ownerStart = await txt(op);
  const ownerTotal0 = yen(ownerStart, '今月合計');
  const delBefore = await op.getByRole('button', { name: '記録を削除' }).count();
  check('R13 owner sees delete buttons', delBefore > 0, `count=${delBefore}`);

  await addRow(op, 'オーナーの買い物', 300, false);
  const beforeDelete = await txt(op);
  check('R13 owner can add a row too', /オーナーの買い物/.test(beforeDelete) && yen(beforeDelete, '今月合計') === ownerTotal0 + 300);

  // Delete it again (confirm is auto-accepted by the dialog handler). The list is
  // ordered date DESC, created_at DESC, so the row just added is the first one.
  await op.getByRole('button', { name: '記録を削除' }).first().click();
  await op.waitForTimeout(800);
  const afterDelete = await txt(op);
  check('R13 owner delete removes the row', !/オーナーの買い物/.test(afterDelete), afterDelete.slice(0, 60));
  check('R13 the total goes back down after the delete', yen(afterDelete, '今月合計') === ownerTotal0, `${yen(beforeDelete, '今月合計')} -> ${yen(afterDelete, '今月合計')}`);
  check('OWNER no page errors', errs2.length === 0, errs2.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
