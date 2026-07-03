const { chromium } = require('./_pw.cjs');
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'; const BASE='http://localhost:4173';
const R=[]; const ck=(n,p,d='')=>{R.push({n,p});console.log(`  ${p?'PASS':'FAIL'} — ${n}${d?` (${d})`:''}`);};
(async()=>{
  const b=await chromium.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await (await b.newContext({viewport:{width:430,height:932},deviceScaleFactor:2})).newPage();
  let dialogs=0; page.on('dialog',d=>{dialogs++;d.accept();});
  const errs=[]; page.on('pageerror',e=>errs.push('pageerror:'+e.message));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/ERR_CONNECTION_CLOSED|404|favicon|Failed to load resource/.test(t))errs.push('console:'+t);}});
  const wU=async(f,ms=10000)=>{const s=Date.now();while(Date.now()-s<ms){if(f(new URL(page.url()).pathname))return true;await page.waitForTimeout(150);}return false;};
  const body=async()=> (await page.locator('body').innerText());
  const needsCount=async()=>{ await page.goto(`${BASE}/manual`,{waitUntil:'networkidle'}); await page.waitForTimeout(400); const t=await body(); const m=t.match(/マニュアル[\s\S]{0,8}?(\d+)件/); return m?Number(m[1]):-1; };

  await page.goto(`${BASE}/`,{waitUntil:'networkidle'}); await page.waitForTimeout(800);
  await page.getByText('個人端末').click(); await page.waitForTimeout(120);
  await page.getByText('ルッコロー').first().click(); await page.waitForTimeout(120);
  await page.getByText('この設定で始める').click(); await wU(u=>u.includes('/shift'));
  await page.getByRole('button',{name:/シフトを開始/}).click(); await wU(u=>u==='/'); await page.waitForTimeout(400);

  // ---- Manual defer-create: add then CANCEL leaves no orphan ----
  const before = await needsCount();
  await page.goto(`${BASE}/manual/k/manual`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  await page.getByRole('button',{name:/追加/}).first().click(); await wU(u=>/\/manual\/c\//.test(u)); await page.waitForTimeout(300);
  const inEditor = /タイトル|本文/.test(await body());
  ck('manual: add opens editor (new draft)', inEditor && /\/manual\/c\//.test(page.url()), page.url());
  await page.getByRole('button',{name:'キャンセル'}).click(); await page.waitForTimeout(500);
  const afterCancel = await needsCount();
  ck('manual: cancel creates NO orphan row', afterCancel===before, `before=${before} afterCancel=${afterCancel}`);

  // ---- Manual: add then SAVE creates the entry ----
  await page.goto(`${BASE}/manual/k/manual`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  await page.getByRole('button',{name:/追加/}).first().click(); await wU(u=>/\/manual\/c\//.test(u)); await page.waitForTimeout(300);
  await page.getByLabel('タイトル').fill('検証マニュアル項目');
  await page.locator('textarea').first().fill('これは検証で作成した本文です。');
  await page.getByRole('button',{name:'保存',exact:true}).click(); await page.waitForTimeout(800);
  const savedShown = /検証マニュアル項目/.test(await body());
  ck('manual: save persists the new entry', savedShown, page.url());

  // ---- Products draft/blur ----
  await page.goto(`${BASE}/manual/products`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  await page.getByRole('button',{name:'編集',exact:true}).click(); await page.waitForTimeout(300);
  const sell0 = page.locator('input[type=number]').first();
  await sell0.fill('1234');
  await page.getByRole('button',{name:'完了',exact:true}).click(); await page.waitForTimeout(500); // blur+exit edit
  ck('products: blur commits new price', /1,234円/.test(await body()), '');
  // clear should revert (not 0)
  await page.getByRole('button',{name:'編集',exact:true}).click(); await page.waitForTimeout(300);
  const sell1 = page.locator('input[type=number]').first();
  await sell1.fill('');
  await page.getByRole('button',{name:'完了',exact:true}).click(); await page.waitForTimeout(500);
  ck('products: clearing field reverts (not 0)', /1,234円/.test(await body()) && !/^0円|売価[\s\S]{0,4}0円/.test(await body()), '');

  // ---- Lost terminal status confirm ----
  await page.goto(`${BASE}/records/lost`,{waitUntil:'networkidle'}); await page.waitForTimeout(300);
  await page.getByPlaceholder('品名').fill('検証傘'); await page.getByRole('button',{name:'起票'}).click(); await page.waitForTimeout(400);
  // cycle held->contacted->returned (2 taps; held->contacted->returned)
  await page.getByText('保管中',{exact:true}).first().click(); await page.waitForTimeout(300); // -> 連絡済
  await page.getByText('連絡済',{exact:true}).first().click(); await page.waitForTimeout(300); // -> 返却済 (terminal)
  ck('lost: reached terminal 返却済', /返却済/.test(await body()));
  const dlgBefore=dialogs;
  await page.getByText('返却済',{exact:true}).first().click(); await page.waitForTimeout(400); // tapping terminal -> confirm
  ck('lost: tapping terminal triggers confirm', dialogs===dlgBefore+1, `dialogs ${dlgBefore}->${dialogs}`);

  console.log('\nERRORS:',errs.length, errs.slice(0,8).join(' || '));
  const pass=R.filter(r=>r.p).length;
  console.log(`\n=== RESULT: ${pass}/${R.length} passed; console errors ${errs.length} ===`);
  await b.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
