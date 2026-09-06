// R8 (前日使用ベッド) + 0022 hidden-staff filter. Seed: Emma Müller stayed last
// night in 5番・6番; a hidden legacy row （旧）モーリー must never appear in
// forward-looking pickers.
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

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.getByText('個人端末').click();
  await page.waitForTimeout(200);

  // 0022: the setup staff picker must hide the legacy row but keep the real one.
  const setup = await txt();
  check('setup picker hides （旧）モーリー', !/（旧）モーリー/.test(setup));
  check('setup picker still shows モーリー', /モーリー/.test(setup));

  await page.getByText('ルッコロー').first().click();
  await page.waitForTimeout(150);
  await page.getByText('この設定で始める').click();
  await wU((u) => u.includes('/shift'));
  await page.getByRole('button', { name: /シフトを開始/ }).click();
  await wU((u) => u === '/');
  await page.waitForTimeout(500);

  // R8: cockpit shows last night's beds.
  const today = await txt();
  check('cockpit shows 昨日使用ベッド 5番・6番', /昨日使用ベッド:?\s*5番・6番/.test(today), (today.match(/昨日使用ベッド[^（]*/) || [''])[0]);

  // R8: the bed picker marks last night's beds (edit Rossi, staying today).
  await page.goto(`${BASE}/guests`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('text=Marco Rossi').first().click();
  await wU((u) => /^\/guests\/[^/]+$/.test(u));
  const gid = new URL(page.url()).pathname.split('/')[2];
  await page.goto(`${BASE}/guests/${gid}/edit`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const edit = await txt();
  check('edit: 5番 marked 昨日使用', /5番\s*昨日使用/.test(edit));
  check('edit: 6番 marked 昨日使用', /6番\s*昨日使用/.test(edit));
  check('edit: 3番 NOT marked', !/3番\s*昨日使用/.test(edit));
  check('edit: explainer line shown', /前泊で使われたベッド/.test(edit));

  check('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));

  // Bed chips on the detail screen are editable by NON-owner staff (guests pick
  // beds on arrival, the person on shift records them).
  const sp = await (
    await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 })
  ).newPage();
  const errs2 = [];
  sp.on('pageerror', (e) => errs2.push('STAFF pageerror:' + e.message));
  const wU2 = async (f, ms = 10000) => {
    const s = Date.now();
    while (Date.now() - s < ms) {
      if (f(new URL(sp.url()).pathname)) return true;
      await sp.waitForTimeout(150);
    }
    return false;
  };
  await sp.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sp.waitForTimeout(900);
  await sp.getByText('個人端末').click();
  await sp.waitForTimeout(150);
  await sp.getByText('日中スタッフ').first().click();
  await sp.waitForTimeout(150);
  await sp.getByText('この設定で始める').click();
  await wU2((u) => u.includes('/shift'));
  await sp.getByRole('button', { name: /シフトを開始/ }).click();
  await wU2((u) => u === '/');
  // New context = fresh OPFS = re-seeded ids, so reach Rossi through the list.
  await sp.goto(`${BASE}/guests`, { waitUntil: 'networkidle' });
  await sp.waitForTimeout(400);
  await sp.locator('text=Marco Rossi').first().click();
  await wU2((u) => /^\/guests\/[^/]+$/.test(u));
  await sp.waitForTimeout(500);
  const chips = sp.locator('[data-testid="bed-chips"] button');
  const chipCount = await chips.count();
  check('staff: bed chips shown on detail', chipCount >= 7, `count=${chipCount}`);
  const chip4 = sp.locator('[data-testid="bed-chips"] button', { hasText: /^4番/ });
  const before = await chip4.getAttribute('aria-pressed');
  await chip4.click();
  await sp.waitForTimeout(400);
  const after = await chip4.getAttribute('aria-pressed');
  check('staff: tapping a bed chip toggles it', before !== after, `${before} -> ${after}`);
  const editCount = await sp.getByRole('button', { name: /ゲストの登録・編集/ }).count();
  check('staff: still no owner edit screen needed', editCount === 0);
  // Restore so other suites see the seed state.
  await chip4.click();
  await sp.waitForTimeout(300);
  check('staff: toggle back restores', (await chip4.getAttribute('aria-pressed')) === before);
  check('STAFF no page errors', errs2.length === 0, errs2.slice(0, 2).join(' | '));

  const passed = R.filter((r) => r.p).length;
  console.log(`\nRESULT: ${passed}/${R.length} passed`);
  await browser.close();
  process.exit(passed === R.length ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
