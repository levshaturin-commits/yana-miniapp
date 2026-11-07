const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const content=require('../second-test-content.js');
const {interpret}=require('../second-test-engine.js');
const root=path.resolve(__dirname,'..');
const baseline=cp.execFileSync('git',['show','19cf6a7:index.html'],{cwd:root,encoding:'utf8'});
const out=process.env.QA_OUTPUT_DIR;
const errors=[];
const server=http.createServer((req,res)=>{
  if(req.url==='/baseline.html'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(baseline);}
  const pathname=new URL(req.url,'http://localhost').pathname;
  const name=pathname==='/'?'index.html':pathname.slice(1);
  if(!/^[\w.-]+$/.test(name)){res.statusCode=404;return res.end();}
  try {res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,name)));}
  catch {res.statusCode=404;res.end();}
});
async function noOverflow(page){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');}
async function complete(page,answers) {
  for(let i=0;i<10;i++){
    assert.equal(await page.locator('#secondTest legend').innerText(),content.questions[i].title);
    assert.deepEqual(await page.locator('#secondTest label span').allTextContents(),content.questions[i].answers);
    await page.locator(`input[value="${answers[i]}"]`).check();
    await noOverflow(page);
    await page.getByRole('button',{name:i===9?'Посмотреть результат':'Далее',exact:true}).click();
  }
  assert.deepEqual(await page.locator('#secondTest .result-body h2').allTextContents(),interpret([...answers]).sections.map(s=>s.title));
  assert.deepEqual(await page.locator('#secondTest .result-body section').evaluateAll(nodes=>nodes.map(node=>Array.from(node.querySelectorAll('p')).map(p=>p.textContent).join(' '))),interpret([...answers]).sections.map(s=>s.paragraphs.join(' ')));
  assert.equal(await page.locator('#secondTest .result-summary strong').count(),4);
  assert.equal(await page.getByRole('button',{name:'К выбору теста',exact:true}).count(),0);
  await noOverflow(page);
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({headless:true});
  try {
    for(const entry of [
      {query:'?tgWebAppStartParam=second',second:true},
      {query:'',sdk:'second',second:true},
      {query:'',second:false},
      {query:'?tgWebAppStartParam=other',second:false},
      {query:'?tgWebAppStartParam=second#first',first:true}
    ]) {
      const page=await browser.newPage();
      await page.route('https://telegram.org/**',r=>r.fulfill({body:'',contentType:'text/javascript'}));
      if(entry.sdk) await page.addInitScript(value=>{
        window.Telegram={WebApp:{ready(){},expand(){},initDataUnsafe:{start_param:value}}};
      },entry.sdk);
      await page.goto(base+'/'+entry.query);
      await page.locator(entry.second?'#secondTest':entry.first?'#start':'#testChooser').waitFor({state:'visible'});
      if(entry.second) {
        assert.equal(await page.getByRole('button',{name:'К выбору теста',exact:true}).count(),0);
        await page.evaluate(()=>location.hash='');
        await page.locator('#chooseFirst').click();await page.locator('#start').waitFor({state:'visible'});
      }
      await page.close();
    }
    console.log('PASS direct Telegram launch: SDK/query, chooser return, ordinary/unknown entry, explicit first route');
    for(const [width,colorScheme] of [[320,'light'],[375,'dark'],[390,'light'],[1280,'dark']]) {
      const ctx=await browser.newContext({viewport:{width,height:812},colorScheme,reducedMotion:'reduce'});
      // Offline SDK represents a plain browser; no Telegram/account interaction occurs.
      await ctx.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
      const page=await ctx.newPage();page.on('pageerror',error=>errors.push(error.message));
      await page.goto(base);await page.locator('#chooseFirst').click();await page.locator('#start').waitFor({state:'visible'});
      const first=await page.locator('main.app:not([id])').screenshot({animations:'disabled'});
      const old=await ctx.newPage();await old.goto(base+'/baseline.html');
      assert.deepEqual(first,await old.locator('main.app').screenshot({animations:'disabled'}),'first screen visual regression');await old.close();
      for(let points=1;points<=5;points++) {
        await page.locator('#startBtn').click();
        for(let i=0;i<7;i++) {
          const option=await page.evaluate(({i,points})=>questions[i].answers.findIndex(a=>a[1]===points),{i,points});
          await page.locator('#answers button').nth(option).click();await noOverflow(page);
        }
        const expected=await page.evaluate(points=>results.find(r=>points*7>=r.min&&points*7<=r.max),points);
        assert.equal(await page.locator('#resultTitle').innerText(),expected.title);
        await noOverflow(page);await page.locator('#restartBtn').click();
      }
      await page.evaluate(()=>location.hash='');await page.locator('#chooseSecond').click();
      await page.getByRole('button',{name:'Начать',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Далее',exact:true}).isDisabled(),true);
      await page.locator('input[value="B"]').check();await page.getByRole('button',{name:'Далее',exact:true}).click();
      await page.getByRole('button',{name:'Назад',exact:true}).click();assert.ok(await page.locator('input[value="B"]').isChecked());
      await complete(page,'BBACAAADAB');
      assert.equal(await page.locator('#secondTest a.primary').getAttribute('href'),'https://t.me/Yana_Shaturina/573');
      assert.equal(await page.locator('#secondTest a.primary').innerText(),'В ЭТОМ ПОСТЕ');
      assert.equal(await page.locator('#secondTest .funnel > p').count(),3);
      assert.ok((await page.locator('#secondTest .funnel > p').nth(1).innerText()).startsWith('Для более подробного разбора'));
      assert.ok((await page.locator('#secondTest .funnel > p strong').innerText()).startsWith('Подробнее обо мне'));
      if(out && width===375) await page.screenshot({path:path.join(out,'second-result-dark.png'),fullPage:true});
      assert.equal(await page.getByRole('button',{name:'Изменить ответы',exact:true}).count(),0);
      assert.equal(await page.locator('#secondTest .question-jump').count(),0);
      for(const answers of ['CCCBBCBCDB','DDBDCDDADC','AADCDBCBBD']) {
        await page.getByRole('button',{name:'Пройти ещё раз',exact:true}).click();
        await page.getByRole('button',{name:'Начать заново',exact:true}).click();
        assert.equal(await page.locator('input:checked').count(),0);await complete(page,answers);
      }
      // Switch through the chooser while both tests have meaningful state.
      await page.evaluate(()=>location.hash='');await page.locator('#chooseFirst').click();
      await page.locator('#startBtn').click();await page.locator('#answers button').first().click();
      const firstState=await page.evaluate(()=>({current,score}));
      await page.evaluate(()=>location.hash='');await page.locator('#chooseSecond').click();
      assert.equal(await page.locator('#secondTest .result-body section').count(),4);
      await page.getByRole('button',{name:'Пройти ещё раз',exact:true}).click();await page.getByRole('button',{name:'Начать заново',exact:true}).click();
      assert.deepEqual(await page.evaluate(()=>({current,score})),firstState);
      if(out && width===320) await page.screenshot({path:path.join(out,'second-question-320.png'),fullPage:true});
      console.log(`PASS ${width}px ${colorScheme}: legacy visual, 5 outcomes, 4 new scenarios, back navigation, clean result, reset/isolation, overflow`);
      await ctx.close();
    }
    // Instrumented Telegram API: proves dispatched URLs and fallbacks, not native access.
    const ctx=await browser.newContext();
    await ctx.route('https://telegram.org/**',route=>route.fulfill({body:'',contentType:'text/javascript'}));
    await ctx.addInitScript(()=>{window.calls=[];window.Telegram={WebApp:{ready(){},expand(){},BackButton:{show(){},hide(){},onClick(fn){window.telegramBack=fn;}},openTelegramLink(url){window.calls.push(url);if(window.failTelegram)throw Error('simulated');}}};});
    const page=await ctx.newPage();await page.goto(base);await page.locator('#chooseFirst').click();await page.locator('#startBtn').click();
    for(let i=0;i<7;i++)await page.locator('#answers button').first().click();
    await page.locator('#workBtn').click();await page.locator('#contactBtn').click();
    assert.deepEqual(await page.evaluate(()=>window.calls),['https://t.me/c/1990809606/1061','https://t.me/YanaShaturina']);
    await page.evaluate(()=>window.telegramBack());await page.locator('#chooseSecond').click();
    // Exercise the approved funnel configuration, without opening a real Telegram session.
    await page.getByRole('button',{name:'Начать',exact:true}).click();await complete(page,'DDBDCDDADC');
    await page.locator('#secondTest a.primary').click();assert.equal((await page.evaluate(()=>window.calls)).length,3);
    assert.equal((await page.evaluate(()=>window.calls)).at(-1),'https://t.me/Yana_Shaturina/573');
    assert.equal(await page.locator('#secondTest .funnel .technical-note').count(),0);
    assert.equal(await page.locator('#secondTest .funnel a').count(),1);
    await page.route('https://t.me/**',route=>route.fulfill({body:'navigation fixture'}));
    await page.evaluate(()=>window.failTelegram=true);await page.locator('#secondTest a.primary').click();
    await page.waitForURL('https://t.me/Yana_Shaturina/573');
    console.log('PASS Telegram mock: exact legacy/new URLs, only the approved CTA, navigation after API exception');
    await ctx.close();
    assert.deepEqual(errors,[]);console.log('PASS no JavaScript errors');
  } finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
