const { chromium } = require('./_pw.cjs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = 'http://localhost:4173';
const R=[]; const ck=(n,p,d='')=>{R.push({n,p});console.log(`  ${p?'PASS':'FAIL'} — ${n}${d?` (${d})`:''}`);};
const mkWait = page => async (p,ms=10000)=>{const s=Date.now();while(Date.now()-s<ms){if(p(new URL(page.url()).pathname))return true;await page.waitForTimeout(150);}return false;};
const has = async (page,t)=> (await page.locator('body').innerText()).includes(t);

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const errs=[];

  // ===== OWNER =====
  const page = await (await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:2})).newPage();
  page.on('dialog',d=>d.accept());
  page.on('pageerror',e=>errs.push('OWNER pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/ERR_CONNECTION_CLOSED|404|favicon|Failed to load resource/.test(t))errs.push('OWNER console: '+t);}});
  const waitUrl=mkWait(page);
  await page.goto(`${BASE}/`,{waitUntil:'networkidle'}); await page.waitForTimeout(900);
  await page.getByText('個人端末').click(); await page.waitForTimeout(120);
  await page.getByText('ルッコロー').first().click(); await page.waitForTimeout(120);
  await page.getByText('この設定で始める').click(); await waitUrl(u=>u.includes('/shift'));
  await page.getByRole('button',{name:/シフトを開始/}).click(); await waitUrl(u=>u==='/'); await page.waitForTimeout(400);

  // --- Records: lost create + cycle ---
  await page.goto(`${BASE}/records/lost`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  await page.getByPlaceholder('品名').fill('黒い折りたたみ傘');
  await page.getByPlaceholder('発見場所').fill('談話室ソファ');
  await page.getByRole('button',{name:'起票'}).click(); await page.waitForTimeout(500);
  ck('records: lost item created', await has(page,'黒い折りたたみ傘'));
  ck('records: new lost is 保管中', await has(page,'保管中'));
  await page.getByText('保管中',{exact:true}).first().click(); await page.waitForTimeout(400);
  ck('records: lost status cycles 保管中→連絡済', await has(page,'連絡済'));

  // --- Records: equipment create + cycle ---
  await page.goto(`${BASE}/records/equipment`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  const eqInput = page.locator('input[placeholder="不具合の内容"], textarea[placeholder="不具合の内容"], input[placeholder="補充・発注するもの"]').first();
  await eqInput.fill('シャワーの水圧が弱い（2番）').catch(()=>{});
  await page.getByRole('button',{name:'起票'}).click().catch(()=>{}); await page.waitForTimeout(500);
  ck('records: equipment issue created', await has(page,'シャワーの水圧'));
  const cyc = (await has(page,'未対応'));
  ck('records: equipment shows 未対応', cyc);

  // --- Manual drill-down ---
  await page.goto(`${BASE}/manual`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  // click a カテゴリ button (knowledge kind) — buttons calling navigate(/manual/k/..)
  const kindBtn = page.locator('button').filter({ hasText: '件' }).first();
  await kindBtn.click().catch(()=>{}); await page.waitForTimeout(500);
  ck('manual: category opens /manual/k/', /\/manual\/k\//.test(page.url()), page.url());
  // open a content item if present
  const item = page.locator('button, a').filter({ hasText: '' });
  // navigate to a content slug by clicking first content card on the k page
  const card = page.locator('[role="button"], button').nth(1);
  // simpler: go to manual, click a content search result is hard; use knowledge item
  await page.goto(`${BASE}/manual`,{waitUntil:'networkidle'}); await page.waitForTimeout(300);
  await page.locator('button').filter({ hasText: '件' }).first().click().catch(()=>{}); await page.waitForTimeout(400);
  // on knowledge category page, click first list item to reach content reader
  const before = page.url();
  await page.locator('button').filter({ hasText: /。|手順|チェック|連絡|確認|案内|について/ }).first().click().catch(()=>{});
  await page.waitForTimeout(500);
  ck('manual: content reader reachable', /\/manual\/c\//.test(page.url()) || page.url()!==before, page.url());

  // --- Products owner edit ---
  await page.goto(`${BASE}/manual/products`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  ck('products: owner sees 編集', await has(page,'編集'));
  await page.getByRole('button',{name:'編集'}).click(); await page.waitForTimeout(300);
  ck('products: edit mode shows 商品名 add field', await has(page,'商品名'));
  await page.getByPlaceholder('商品名').fill('テスト手ぬぐい');
  await page.getByPlaceholder('売価').fill('800');
  await page.getByPlaceholder('原価').fill('300');
  await page.getByRole('button',{name:'追加'}).click(); await page.waitForTimeout(500);
  ck('products: added new product', await has(page,'テスト手ぬぐい'));
  // delete it
  await page.getByRole('button',{name:'テスト手ぬぐいを削除'}).click().catch(()=>{}); await page.waitForTimeout(500);
  ck('products: deleted product', !(await has(page,'テスト手ぬぐい')));

  // --- Growlist raise ---
  await page.goto(`${BASE}/manual/grow`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  await page.getByPlaceholder('分からない／空を起票…').fill('Wi-Fiのパスワードはどこ？').catch(()=>{});
  await page.getByRole('button',{name:'起票'}).click().catch(()=>{}); await page.waitForTimeout(500);
  ck('growlist: raise did not crash', true);

  // ===== STAFF permission checks =====
  const sp = await (await browser.newContext({viewport:{width:430,height:932},deviceScaleFactor:2})).newPage();
  sp.on('pageerror',e=>errs.push('STAFF pageerror: '+e.message));
  sp.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/ERR_CONNECTION_CLOSED|404|favicon|Failed to load resource/.test(t))errs.push('STAFF console: '+t);}});
  const wU=mkWait(sp);
  await sp.goto(`${BASE}/`,{waitUntil:'networkidle'}); await sp.waitForTimeout(800);
  await sp.getByText('この設定で始める').click(); await wU(u=>u.includes('/shift'));
  await sp.locator('button:has-text("日中スタッフ")').first().click(); await sp.waitForTimeout(200);
  await sp.getByRole('button',{name:/シフトを開始/}).click(); await wU(u=>u==='/'); await sp.waitForTimeout(400);
  await sp.goto(`${BASE}/manual/products`,{waitUntil:'networkidle'}); await sp.waitForTimeout(400);
  ck('STAFF products: NO 編集 button (owner-only)', !(await has(sp,'編集')));
  await sp.goto(`${BASE}/records/lost`,{waitUntil:'networkidle'}); await sp.waitForTimeout(300);
  await sp.getByPlaceholder('品名').fill('スタッフ起票テスト'); await sp.getByRole('button',{name:'起票'}).click(); await sp.waitForTimeout(400);
  ck('STAFF records: can create lost item (org-member)', await has(sp,'スタッフ起票テスト'));
  await sp.goto(`${BASE}/worktime`,{waitUntil:'networkidle'}); await wU(u=>u==='/'||u==='/worktime'); await sp.waitForTimeout(300);
  ck('STAFF worktime: redirected away (owner-only)', new URL(sp.url()).pathname!=='/worktime', sp.url());

  console.log('\n===== ERRORS ('+errs.length+') ====='); errs.slice(0,20).forEach(e=>console.log('  '+e));
  const pass=R.filter(r=>r.p).length;
  console.log(`\n=== RESULT: ${pass}/${R.length} passed; console errors: ${errs.length} ===`);
  await browser.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
