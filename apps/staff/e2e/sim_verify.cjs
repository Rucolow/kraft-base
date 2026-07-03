const { chromium } = require('./_pw.cjs');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const BASE = 'http://localhost:4173';
const R = [];
const check = (name, pass, detail='') => { R.push({name,pass,detail}); console.log(`  ${pass?'PASS':'FAIL'} — ${name}${detail?` (${detail})`:''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept()); // auto-accept window.confirm
  const errs=[]; page.on('pageerror',e=>errs.push('pageerror:'+e.message));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/ERR_CONNECTION_CLOSED|404|favicon/.test(t))errs.push('console:'+t);}});
  const waitUrl=async(p,ms=10000)=>{const s=Date.now();while(Date.now()-s<ms){if(p(new URL(page.url()).pathname))return true;await page.waitForTimeout(150);}return false;};
  const txt=async()=>(await page.locator('body').innerText().catch(()=> '')).replace(/\s+/g,' ');

  // === OWNER ===
  await page.goto(`${BASE}/`,{waitUntil:'networkidle'}); await page.waitForTimeout(1000);
  await page.getByText('個人端末').click(); await page.waitForTimeout(150);
  await page.getByText('ルッコロー').first().click(); await page.waitForTimeout(150);
  await page.getByText('この設定で始める').click(); await waitUrl(u=>u.includes('/shift'));
  await page.getByRole('button',{name:/シフトを開始/}).click(); await waitUrl(u=>u==='/'); await page.waitForTimeout(500);

  // --- #4a trailing separator: create a guest with no time/bed ---
  await page.goto(`${BASE}/guests`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  await page.getByRole('button',{name:/追加/}).first().click(); await waitUrl(u=>/\/new$/.test(u)); await page.waitForTimeout(300);
  await page.getByLabel('お名前').fill('セパレータ検証さん');
  await page.locator('select').nth(0).selectOption({label:'日本'});
  await page.getByRole('button',{name:'追加',exact:true}).last().click(); await waitUrl(u=>u==='/guests'); await page.waitForTimeout(400);
  const body1 = await txt();
  // card should read "日本・1名" with NO " ／ IN" and NO trailing "・名"
  const sepIdx = body1.indexOf('セパレータ検証さん');
  const seg = body1.slice(sepIdx, sepIdx+60);
  check('#4a no dangling separator (no IN when time/bed empty)', /日本・1名/.test(seg) && !/／ IN/.test(seg.split('予定')[0]||seg), seg.trim());

  // --- #1 cancelled excluded from count ---
  // count before
  const before = await txt();
  const beforeToday = (before.match(/今日 (\d+)/)||[])[1];
  // cancel Marco Rossi
  await page.locator('text=Marco Rossi').first().click(); await waitUrl(u=>/^\/guests\/[^/]+$/.test(u)); await page.waitForTimeout(300);
  // #4b date format check on detail
  const detail = await txt();
  check('#4b detail date formatted (no raw ISO)', /宿泊日 \d+\/\d+\(/.test(detail) && !/宿泊日 20\d\d-/.test(detail), (detail.match(/宿泊日 [^ ]+/)||[''])[0]);
  await page.getByText('キャンセル',{exact:true}).click(); await page.waitForTimeout(400);
  await page.goto(`${BASE}/guests`,{waitUntil:'networkidle'}); await page.waitForTimeout(500);
  const after = await txt();
  const afterToday = (after.match(/今日 (\d+)/)||[])[1];
  const headerCount = (after.match(/本日のゲスト — (\d+)名/)||[])[1];
  const rossiStillShown = /Marco Rossi/.test(after);
  check('#1 cancel lowers 今日 count', Number(afterToday) === Number(beforeToday)-1, `before=${beforeToday} after=${afterToday}`);
  check('#1 header count matches active', headerCount === afterToday, `header=${headerCount} tab=${afterToday}`);
  check('#1 cancelled guest still visible in list', rossiStillShown, '');

  // --- #2 owner sees task delete; delete works ---
  await page.goto(`${BASE}/tasks`,{waitUntil:'networkidle'}); await page.waitForTimeout(400);
  await page.getByPlaceholder('単発タスクを追加…').fill('削除テストタスク');
  await page.getByRole('button',{name:'タスクを追加'}).click(); await page.waitForTimeout(500);
  const delBtns = await page.getByRole('button',{name:'タスクを削除'}).count();
  check('#2 owner sees delete buttons', delBtns>0, `count=${delBtns}`);
  const hadTask = /削除テストタスク/.test(await txt());
  // delete the one-off we just added (last delete button is in 単発 group)
  await page.getByRole('button',{name:'タスクを削除'}).last().click(); await page.waitForTimeout(600);
  const stillThere = /削除テストタスク/.test(await txt());
  check('#2 owner delete removes task', hadTask && !stillThere, '');

  // === STAFF (shared) ===
  const page2 = await (await browser.newContext({ viewport:{width:430,height:932}, deviceScaleFactor:2 })).newPage();
  page2.on('dialog', d=>d.accept());
  const wU=async(p,ms=10000)=>{const s=Date.now();while(Date.now()-s<ms){if(p(new URL(page2.url()).pathname))return true;await page2.waitForTimeout(150);}return false;};
  await page2.goto(`${BASE}/`,{waitUntil:'networkidle'}); await page2.waitForTimeout(900);
  await page2.getByText('この設定で始める').click(); await wU(u=>u.includes('/shift'));
  await page2.locator('button:has-text("日中スタッフ")').first().click(); await page2.waitForTimeout(300);
  await page2.getByRole('button',{name:/シフトを開始/}).click(); await wU(u=>u==='/'); await page2.waitForTimeout(400);
  await page2.goto(`${BASE}/tasks`,{waitUntil:'networkidle'}); await page2.waitForTimeout(400);
  const staffDel = await page2.getByRole('button',{name:'タスクを削除'}).count();
  check('#2 staff sees NO delete button', staffDel===0, `count=${staffDel}`);

  // --- #3 check-in re-entry ---
  await page2.goto(`${BASE}/guests`,{waitUntil:'networkidle'}); await page2.waitForTimeout(300);
  await page2.locator('text=Jonas Schmidt').first().click(); await wU(u=>/^\/guests\/[^/]+$/.test(u)); await page2.waitForTimeout(300);
  await page2.getByRole('button',{name:/チェックイン入力/}).click(); await wU(u=>/\/checkin\//.test(u)); await page2.waitForTimeout(400);
  await page2.getByText('日本にお住まいの方').click(); await page2.waitForTimeout(300);
  // fill japan form (name/address/contact)
  const fill = async (labelRe, val) => { const el = page2.locator('label:has-text("'+labelRe+'") input'); await el.first().fill(val); };
  await page2.locator('input').nth(0).fill('山田 太郎');
  await page2.locator('input').nth(1).fill('大阪府大阪市1-2-3');
  await page2.locator('input').nth(2).fill('test@example.com');
  await page2.getByRole('button',{name:/記入を完了/}).click(); await page2.waitForTimeout(500);
  const thanks = /ありがとうございました/.test(await page2.locator('body').innerText());
  check('#3 checkin completes', thanks, '');
  // re-enter
  await page2.getByText('記入をやり直す').click(); await page2.waitForTimeout(400);
  const reText = (await page2.locator('body').innerText());
  const prefilled = await page2.locator('input').nth(0).inputValue().catch(()=> '');
  check('#3 re-enter reopens form prefilled', /チェックイン|Check-in/.test(reText) && prefilled==='山田 太郎', `name="${prefilled}"`);
  // correct the name and resubmit
  await page2.locator('input').nth(0).fill('山田 太郎(修正)');
  await page2.getByRole('button',{name:/記入を完了/}).click(); await page2.waitForTimeout(500);
  const thanks2 = /ありがとうございました/.test(await page2.locator('body').innerText());
  check('#3 re-submit completes again', thanks2, '');

  console.log('\nCONSOLE ERRORS:', errs.length, errs.slice(0,10).join(' || '));
  const passed = R.filter(r=>r.pass).length;
  console.log(`\n=== RESULT: ${passed}/${R.length} checks passed ===`);
  await browser.close();
  process.exit(passed===R.length?0:2);
})().catch(e=>{console.error('FATAL',e);process.exit(1);});
