const { chromium, resolveChrome } = require('./_pw.cjs');
const CHROME = resolveChrome(); const BASE='http://localhost:4173';
const R=[]; const ck=(n,p,d='')=>{R.push({n,p});console.log(`  ${p?'PASS':'FAIL'} — ${n}${d?` (${d})`:''}`);};
(async()=>{
  const b=await chromium.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await (await b.newContext({viewport:{width:430,height:932},deviceScaleFactor:2})).newPage();
  const errs=[]; page.on('pageerror',e=>errs.push('pageerror:'+e.message));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/ERR_CONNECTION_CLOSED|404|favicon|Failed to load resource/.test(t))errs.push('console:'+t);}});
  const wU=async(f,ms=10000)=>{const s=Date.now();while(Date.now()-s<ms){if(f(new URL(page.url()).pathname))return true;await page.waitForTimeout(150);}return false;};
  const body=async()=> (await page.locator('body').innerText());

  // enter owner, create a party-of-3 guest
  await page.goto(`${BASE}/`,{waitUntil:'networkidle'}); await page.waitForTimeout(800);
  await page.getByText('個人端末').click(); await page.waitForTimeout(120);
  await page.getByText('ルッコロー').first().click(); await page.waitForTimeout(120);
  await page.getByText('この設定で始める').click(); await wU(u=>u.includes('/shift'));
  await page.getByRole('button',{name:/シフトを開始/}).click(); await wU(u=>u==='/'); await page.waitForTimeout(400);
  await page.goto(`${BASE}/guests`,{waitUntil:'networkidle'}); await page.waitForTimeout(300);
  await page.getByRole('button',{name:/追加/}).first().click(); await wU(u=>/\/new$/.test(u)); await page.waitForTimeout(250);
  await page.getByLabel('お名前').fill('山田ファミリー');
  await page.locator('select').nth(0).selectOption({label:'日本'});
  await page.locator('select').nth(2).selectOption({label:'3名'});
  await page.getByRole('button',{name:'追加',exact:true}).last().click(); await wU(u=>u==='/guests'); await page.waitForTimeout(400);

  // open checkin
  await page.locator('text=山田ファミリー').first().click(); await wU(u=>/^\/guests\/[^/]+$/.test(u)); await page.waitForTimeout(300);
  const gid=new URL(page.url()).pathname.split('/')[2];
  await page.getByRole('button',{name:/チェックイン入力/}).click(); await wU(u=>/\/checkin\//.test(u)); await page.waitForTimeout(300);
  await page.getByText('日本にお住まいの方').click(); await page.waitForTimeout(300);

  const t1=await body();
  ck('form shows 3名 + 代表者 + 同行者2', /3名/.test(t1) && /代表者/.test(t1) && /同行者\s*2/.test(t1), '');
  let ins = page.locator('input');
  const n0 = await ins.count();
  ck('party-3 japan renders 7 inputs (rep:3 + 2×2)', n0===7, `inputs=${n0}`);

  // fill rep (name/address/contact) + 2 companions (names only; addresses blank -> inherit)
  await ins.nth(0).fill('山田 太郎');
  await ins.nth(1).fill('大阪府大阪市北区1-2-3');
  await ins.nth(2).fill('taro@example.com');
  await ins.nth(3).fill('山田 花子');
  await ins.nth(5).fill('山田 次郎');
  await page.getByRole('button',{name:/記入を完了/}).click(); await page.waitForTimeout(700);
  ck('multi submit completes', /ありがとうございました/.test(await body()));

  // detail shows 記入済み
  await page.goto(`${BASE}/guests/${gid}`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  ck('detail shows 記入済み', /記入済み/.test(await body()));

  // re-enter: should prefill 3 people; companion addresses inherited from rep
  await page.goto(`${BASE}/checkin/${gid}`,{waitUntil:'networkidle'}); await page.waitForTimeout(500);
  // completed screen -> reenter
  await page.getByText('記入をやり直す').click().catch(()=>{}); await page.waitForTimeout(500);
  ins = page.locator('input');
  const cnt = await ins.count();
  const names = [await ins.nth(0).inputValue().catch(()=> ''), await ins.nth(3).inputValue().catch(()=> ''), await ins.nth(5).inputValue().catch(()=> '')];
  const addr0 = await ins.nth(1).inputValue().catch(()=> '');
  const addrC1 = await ins.nth(4).inputValue().catch(()=> '');
  const addrC2 = await ins.nth(6).inputValue().catch(()=> '');
  ck('re-enter prefills all 3 names', names[0]==='山田 太郎' && names[1]==='山田 花子' && names[2]==='山田 次郎', JSON.stringify(names));
  ck('companion addresses inherited rep address', addrC1==='大阪府大阪市北区1-2-3' && addrC2==='大阪府大阪市北区1-2-3', `c1="${addrC1}" c2="${addrC2}" rep="${addr0}"`);

  // single-guest still works (Marco Rossi party 1)
  await page.goto(`${BASE}/guests`,{waitUntil:'networkidle'}); await page.waitForTimeout(300);
  await page.locator('text=Marco Rossi').first().click(); await wU(u=>/^\/guests\/[^/]+$/.test(u)); await page.waitForTimeout(200);
  await page.getByRole('button',{name:/チェックイン入力/}).click(); await wU(u=>/\/checkin\//.test(u)); await page.waitForTimeout(300);
  await page.getByText('日本にお住まいの方').click().catch(()=>{}); await page.waitForTimeout(300);
  const singleInputs = await page.locator('input').count();
  ck('party-1 renders 3 inputs (single rep)', singleInputs===3, `inputs=${singleInputs}`);

  console.log('\nERRORS:',errs.length, errs.slice(0,8).join(' || '));
  const pass=R.filter(r=>r.p).length;
  console.log(`\n=== RESULT: ${pass}/${R.length} passed; console errors ${errs.length} ===`);
  await b.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
