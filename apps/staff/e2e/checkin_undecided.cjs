// R2: "未定" check-in time. Owner (ルッコロー) creates a guest marked 未定, sees the
// IN未定 badge, and the toggle round-trips on edit. Plus the free-text guard: the
// seed's Jonas Schmidt has checkin_time '遅着 ~19:30' (not a real HH:MM); an
// unrelated edit must NOT let the type=time input silently wipe it.
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

  // Owner (ルッコロー) so guest add/edit is allowed.
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

  // Create a guest with 未定 check-in.
  await page.goto(`${BASE}/guests`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: /追加/ }).first().click();
  await wU((u) => /\/new$/.test(u));
  await page.waitForTimeout(300);
  await page.getByLabel('お名前').fill('未定テストさん');
  await page.getByRole('button', { name: '未定', exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole('button', { name: '追加', exact: true }).last().click();
  await wU((u) => u === '/guests');
  await page.waitForTimeout(500);
  check('R2 new 未定 guest shows IN未定 badge', /IN未定/.test(await txt()), (await txt()).slice(0, 120));

  // Edit it: the 未定 toggle must come back active.
  await page.locator('text=未定テストさん').first().click();
  await wU((u) => /^\/guests\/[^/]+$/.test(u));
  await page.waitForTimeout(300);
  const gid = new URL(page.url()).pathname.split('/')[2];
  await page.goto(`${BASE}/guests/${gid}/edit`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const undecidedOn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '未定');
    return b ? b.className.includes('bg-orange') : false;
  });
  check('R2 edit restores 未定 toggle active', undecidedOn);

  // Free-text preservation: edit Jonas Schmidt's party only; '遅着 ~19:30' survives.
  await page.goto(`${BASE}/guests`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  await page.locator('text=Jonas Schmidt').first().click();
  await wU((u) => /^\/guests\/[^/]+$/.test(u));
  await page.waitForTimeout(300);
  const sgid = new URL(page.url()).pathname.split('/')[2];
  await page.goto(`${BASE}/guests/${sgid}/edit`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('select').nth(2).selectOption({ label: '2名' }); // party 1 -> 2, time untouched
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await wU((u) => u === '/guests');
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/guests/${sgid}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const detail = await txt();
  check('R2 free-text checkin preserved on unrelated edit', /遅着 ~19:30/.test(detail), (detail.match(/チェックイン[\s\S]{0,16}/) || [''])[0]);

  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
