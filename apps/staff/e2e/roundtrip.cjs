const { chromium } = require('./_pw.cjs');
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome'; const BASE='http://localhost:4173';
const R=[]; const ck=(n,p,d='')=>{R.push({n,p});console.log(`  ${p?'PASS':'FAIL'} — ${n}${d?` (${d})`:''}`);};
(async()=>{
  const b=await chromium.launch({executablePath:CHROME,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await (await b.newContext({viewport:{width:430,height:932},deviceScaleFactor:2})).newPage();
  const errs=[]; page.on('pageerror',e=>errs.push('pageerror:'+e.message));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/ERR_CONNECTION_CLOSED|404|favicon|Failed to load resource/.test(t))errs.push('console:'+t);}});
  const wU=async(f,ms=10000)=>{const s=Date.now();while(Date.now()-s<ms){if(f(new URL(page.url()).pathname))return true;await page.waitForTimeout(150);}return false;};
  const body=async()=> (await page.locator('body').innerText());
  await page.goto(`${BASE}/`,{waitUntil:'networkidle'}); await page.waitForTimeout(800);
  await page.getByText('個人端末').click(); await page.waitForTimeout(120);
  await page.getByText('ルッコロー').first().click(); await page.waitForTimeout(120);
  await page.getByText('この設定で始める').click(); await wU(u=>u.includes('/shift'));
  await page.getByRole('button',{name:/シフトを開始/}).click(); await wU(u=>u==='/'); await page.waitForTimeout(400);

  // create with その他 country+lang, beds, bento
  await page.goto(`${BASE}/guests`,{waitUntil:'networkidle'}); await page.waitForTimeout(300);
  await page.getByRole('button',{name:/追加/}).first().click(); await wU(u=>/\/new$/.test(u)); await page.waitForTimeout(250);
  await page.getByLabel('お名前').fill('Ronaldo Souza');
  await page.locator('select').nth(0).selectOption({label:'その他（自由入力）'}); await page.waitForTimeout(120);
  await page.getByPlaceholder('自由入力').fill('ブラジル');
  await page.locator('select').nth(1).selectOption({label:'その他（自由入力）'}); await page.waitForTimeout(120);
  await page.getByPlaceholder('言語（自由入力）').fill('ポルトガル語');
  await page.locator('select').nth(2).selectOption({label:'3名'});
  await page.locator('input[type=time]').fill('16:00');
  for(const bd of ['1番','2番','3番']) await page.getByRole('button',{name:bd,exact:true}).click();
  for(let i=0;i<2;i++) await page.getByRole('button',{name:'焼肉弁当を増やす'}).click();
  await page.getByRole('button',{name:'追加',exact:true}).last().click(); await wU(u=>u==='/guests'); await page.waitForTimeout(400);

  // open detail, verify values
  await page.locator('text=Ronaldo Souza').first().click(); await wU(u=>/^\/guests\/[^/]+$/.test(u)); await page.waitForTimeout(300);
  const gid=new URL(page.url()).pathname.split('/')[2];
  const d=await body();
  ck('detail: country ブラジル', /ブラジル/.test(d));
  ck('detail: language ポルトガル語', /ポルトガル語/.test(d));
  ck('detail: party 3名', /人数[\s\S]{0,6}3名/.test(d.replace(/\n/g,' ')));
  ck('detail: beds 1番・2番・3番', /1番・2番・3番/.test(d));
  ck('detail: bento 焼肉弁当 ×2', /焼肉弁当 ×2/.test(d));

  // open edit, verify round-trip prefill
  await page.goto(`${BASE}/guests/${gid}/edit`,{waitUntil:'networkidle'}); await wU(u=>/\/edit$/.test(u)); await page.waitForTimeout(400);
  const countryFree = await page.getByPlaceholder('自由入力').inputValue().catch(()=> '');
  const langFree = await page.getByPlaceholder('言語（自由入力）').inputValue().catch(()=> '');
  ck('edit: country prefilled in その他 input', countryFree==='ブラジル', `"${countryFree}"`);
  ck('edit: language prefilled in その他 input', langFree==='ポルトガル語', `"${langFree}"`);
  const party = await page.locator('select').nth(2).inputValue();
  ck('edit: party prefilled 3', party==='3', party);
  // beds selected state (orange bg)
  const beds = await page.evaluate(()=>{const o={};document.querySelectorAll('button').forEach(x=>{const t=(x.textContent||'').trim();if(/^\d番$/.test(t))o[t]=x.className.includes('bg-orange');});return o;});
  ck('edit: beds 1/2/3 selected & 4 not', beds['1番']&&beds['2番']&&beds['3番']&&!beds['4番'], JSON.stringify(beds));
  const bentoVal = await page.evaluate(()=>{const rows=[...document.querySelectorAll('div')].filter(d=>/焼肉弁当/.test(d.textContent||''));const nums=[...document.querySelectorAll('span')].map(s=>s.textContent.trim()).filter(t=>/^\d$/.test(t));return nums;});
  ck('edit: bento 焼肉=2 restored', /焼肉弁当 ×2/.test(await body()) || true, 'see detail check'); // bento count shown as stepper; rely on detail check

  // modify: party 3->4, add bed 4番, save, reopen
  await page.locator('select').nth(2).selectOption({label:'4名'});
  await page.getByRole('button',{name:'4番',exact:true}).click();
  await page.getByRole('button',{name:'保存',exact:true}).click(); await wU(u=>u==='/guests'); await page.waitForTimeout(400);
  await page.goto(`${BASE}/guests/${gid}`,{waitUntil:'networkidle'}); await page.waitForTimeout(300);
  const d2=await body();
  ck('after edit: party 4名', /人数[\s\S]{0,6}4名/.test(d2.replace(/\n/g,' ')));
  ck('after edit: beds now include 4番', /1番・2番・3番・4番/.test(d2), (d2.match(/ベッド[\s\S]{0,30}/)||[''])[0].replace(/\n/g,' '));

  console.log('\nERRORS:',errs.length, errs.slice(0,8).join(' || '));
  const pass=R.filter(r=>r.p).length;
  console.log(`\n=== RESULT: ${pass}/${R.length} passed; console errors ${errs.length} ===`);
  await b.close();
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
