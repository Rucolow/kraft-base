const { chromium, resolveChrome } = require('./_pw.cjs');
const CHROME = resolveChrome();
const BASE = 'http://localhost:4173';

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox','--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  let label = 'init';
  const errors = [];          // {label, msg}
  const routeReport = [];     // {label, url, bodyLen, head}
  page.on('pageerror', e => errors.push({ label, msg: 'pageerror: ' + e.message }));
  page.on('console', m => { if (m.type()==='error'){ const t=m.text(); if(!/ERR_CONNECTION_CLOSED|404 \(Not Found\)|favicon|Failed to load resource: the server responded/.test(t)) errors.push({ label, msg: 'console: ' + t }); } });
  const waitUrl=async(p,ms=10000)=>{const s=Date.now();while(Date.now()-s<ms){if(p(new URL(page.url()).pathname))return true;await page.waitForTimeout(150);}return false;};
  async function record(lbl){
    label = lbl;
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText().catch(()=> '');
    const head = body.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,4).join(' | ');
    routeReport.push({ label: lbl, url: new URL(page.url()).pathname, bodyLen: body.replace(/\s/g,'').length, head });
  }
  async function visit(lbl, path, expect){
    label = lbl;
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }).catch(()=>{});
    await page.waitForTimeout(500);
    const body = await page.locator('body').innerText().catch(()=> '');
    const present = expect ? body.includes(expect) : true;
    routeReport.push({ label: lbl, url: new URL(page.url()).pathname, bodyLen: body.replace(/\s/g,'').length, expectOk: present, head: body.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,3).join(' | ') });
  }

  // ===== enter as owner =====
  label = 'enter';
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  await page.getByText('個人端末').click(); await page.waitForTimeout(150);
  await page.getByText('ルッコロー').first().click(); await page.waitForTimeout(150);
  await page.getByText('この設定で始める').click(); await waitUrl(u=>u.includes('/shift'));
  await page.getByRole('button',{name:/シフトを開始/}).click(); await waitUrl(u=>u==='/'); await page.waitForTimeout(500);
  await record('home');

  // seed a guest with full data + an empty-ish guest, to exercise rendering
  async function addGuest(p){
    await page.goto(`${BASE}/guests`,{waitUntil:'networkidle'}); await page.waitForTimeout(300);
    await page.getByRole('button',{name:/追加/}).first().click(); await waitUrl(u=>/\/new$/.test(u)); await page.waitForTimeout(250);
    if(p.whole) await page.getByRole('button',{name:'貸切',exact:true}).click();
    await page.getByLabel('お名前').fill(p.name);
    const s=page.locator('select');
    if(p.countryOther){await s.nth(0).selectOption({label:'その他（自由入力）'});await page.waitForTimeout(120);await page.getByPlaceholder('自由入力').fill(p.countryOther);}
    else if(p.country){await s.nth(0).selectOption({label:p.country});}
    if(p.party) await s.nth(2).selectOption({label:`${p.party}名`});
    if(p.time) await page.locator('input[type=time]').fill(p.time);
    for(const b of (p.beds||[])) await page.getByRole('button',{name:b,exact:true}).click();
    for(const [it,n] of Object.entries(p.bento||{})){for(let i=0;i<n;i++) await page.getByRole('button',{name:`${it}を増やす`}).click();}
    await page.getByRole('button',{name:'追加',exact:true}).last().click(); await waitUrl(u=>u==='/guests'); await page.waitForTimeout(300);
  }
  label='create-guests';
  await addGuest({name:'Família Silva', countryOther:'ブラジル', party:4, whole:true, time:'15:30', beds:['1番','2番','3番','4番'], bento:{'焼肉弁当':2,'ヴィーガン弁当':2}});
  await addGuest({name:'空フィールドさん'}); // minimal: only name

  // guests today + upcoming
  await page.goto(`${BASE}/guests`,{waitUntil:'networkidle'}); await record('guests-today');
  await page.getByRole('button',{name:/これから先/}).click().catch(()=>{}); await record('guests-upcoming');

  // open a guest detail, cycle statuses, edit
  await page.goto(`${BASE}/guests`,{waitUntil:'networkidle'}); await page.waitForTimeout(300);
  await page.getByRole('button',{name:/今日/}).click().catch(()=>{}); await page.waitForTimeout(200);
  await page.locator('text=Marco Rossi').first().click(); await waitUrl(u=>/^\/guests\/[^/]+$/.test(u));
  const gid = new URL(page.url()).pathname.split('/')[2];
  await record('guest-detail');
  // status cycle
  for(const st of ['到着済','遅着','予定','キャンセル','到着済']){ await page.getByText(st,{exact:true}).first().click().catch(()=>{}); await page.waitForTimeout(200); }
  label='status-cycled';
  // add a memo + a thread comment with mention
  await page.locator('input[placeholder="メモを追加…"]').fill('テストメモ：鍵は玄関左の箱'); await page.getByRole('button',{name:'メモを追加'}).click(); await page.waitForTimeout(300);
  await page.locator('input[placeholder="このゲストについて残す…"]').fill('スレッドcoメント');
  // mention toggle if present
  await page.locator('button:has-text("@")').first().click().catch(()=>{});
  await page.getByRole('button',{name:'送信'}).click().catch(()=>{}); await page.waitForTimeout(300);
  await record('guest-notes-added');
  // edit form populated
  await page.goto(`${BASE}/guests/${gid}/edit`,{waitUntil:'networkidle'}); await record('guest-edit');

  // checkin full abroad branch + reentry + long-press
  await page.goto(`${BASE}/guests/${gid}`,{waitUntil:'networkidle'}); await page.waitForTimeout(300);
  await page.getByRole('button',{name:/チェックイン入力/}).click(); await waitUrl(u=>/\/checkin\//.test(u)); await record('checkin-choose');
  await page.getByText('Visiting from abroad').click(); await page.waitForTimeout(300); await record('checkin-abroad-form');
  // fill abroad fields (name/address/contact/nationality/passport)
  const ins = page.locator('input');
  await ins.nth(0).fill('John Abroad'); await ins.nth(1).fill('123 Main St, NY'); await ins.nth(2).fill('john@x.com'); await ins.nth(3).fill('USA'); await ins.nth(4).fill('X1234567');
  await page.getByRole('button',{name:/Complete|記入を完了/}).click(); await page.waitForTimeout(500); await record('checkin-done');
  // re-enter
  await page.getByText('記入をやり直す').click().catch(()=>{}); await page.waitForTimeout(400); await record('checkin-reenter');
  // submit again quickly (fields prefilled)
  await page.getByRole('button',{name:/Complete|記入を完了/}).click().catch(()=>{}); await page.waitForTimeout(500);
  // long-press return
  const btn = page.getByText(/スタッフ画面へ戻る/);
  const box = await btn.boundingBox().catch(()=>null);
  if(box){ await page.mouse.move(box.x+box.width/2, box.y+box.height/2); await page.mouse.down(); await page.waitForTimeout(950); await page.mouse.up(); await waitUrl(u=>/^\/guests\//.test(u),5000); }
  await record('checkin-return');

  // tasks: add + delete + toggle
  page.on('dialog', d=>d.accept());
  await page.goto(`${BASE}/tasks`,{waitUntil:'networkidle'}); await record('tasks');
  await page.getByPlaceholder('単発タスクを追加…').fill('スイープ削除テスト'); await page.getByRole('button',{name:'タスクを追加'}).click(); await page.waitForTimeout(400);
  await page.getByRole('button',{name:'タスクを削除'}).last().click(); await page.waitForTimeout(400);
  // toggle first task
  await page.locator('button:has-text("ドミトリーを清掃"), button:has-text("火の始末")').first().click().catch(()=>{}); await page.waitForTimeout(200);
  await record('tasks-after');

  // handover
  await page.goto(`${BASE}/handover`,{waitUntil:'networkidle'}); await record('handover');

  // manual hub + drill in
  await page.goto(`${BASE}/manual`,{waitUntil:'networkidle'}); await record('manual');
  // click a category link (knowledge kind)
  await page.locator('a[href^="/manual/k/"]').first().click().catch(()=>{}); await page.waitForTimeout(500); await record('manual-knowledge');
  await page.goto(`${BASE}/manual`,{waitUntil:'networkidle'}); await page.waitForTimeout(200);
  await page.locator('a[href^="/manual/c/"]').first().click().catch(()=>{}); await page.waitForTimeout(500); await record('manual-content');
  await visit('manual-grow','/manual/grow','育');
  await visit('manual-products','/manual/products','売価');

  // records
  await visit('records','/records');
  await visit('records-lost','/records/lost');
  // create a lost item if form present
  await page.locator('input,textarea').first().fill('忘れ物：黒い傘').catch(()=>{});
  await page.getByRole('button',{name:/追加|登録|記録|保存/}).first().click().catch(()=>{}); await page.waitForTimeout(300); await record('records-lost-added');
  await visit('records-equipment','/records/equipment');
  await page.locator('input,textarea').first().fill('設備：シャワーの水圧低下').catch(()=>{});
  await page.getByRole('button',{name:/追加|登録|記録|報告|保存/}).first().click().catch(()=>{}); await page.waitForTimeout(300); await record('records-equipment-added');

  // comms + worktime
  await visit('comms','/comms');
  await visit('worktime','/worktime','給与');

  // edge: bad ids
  await visit('guest-badid','/guests/does-not-exist','見つかりません');
  await visit('checkin-badid','/checkin/does-not-exist','見つかりません');

  // ===== summary =====
  console.log('\n===== ROUTE REPORT (owner) =====');
  for(const r of routeReport){
    const blank = r.bodyLen < 40 ? ' <<< NEAR-BLANK' : '';
    const exp = r.expectOk===false ? ' <<< EXPECT-MISSING' : '';
    console.log(`  ${r.label.padEnd(22)} ${String(r.url).padEnd(28)} len=${String(r.bodyLen).padEnd(5)}${blank}${exp}`);
  }
  console.log('\n===== CONSOLE/PAGE ERRORS ('+errors.length+') =====');
  for(const e of errors) console.log(`  [${e.label}] ${e.msg}`);
  console.log('\nDONE-OWNER');
  await browser.close();
})().catch(e=>{console.error('FATAL', e); process.exit(1);});
