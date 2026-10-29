/* Full production UI, fake local account and intercepted services. No live user data. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const base=process.env.BCM_TEST_BASE||'http://127.0.0.1:8765';
let activePage;
const out='/tmp/bcm-visual-review';fs.mkdirSync(out,{recursive:true});
const fixture={collection:[
 {setNumber:'990001',name:'Stadthaus mit Dachterrasse – Beispiel',quantity:1,purchasePrice:149.99,currentValue:184.5,imageUrl:'https://images.example.invalid/wide.svg',addedAt:'2026-10-29',category:'Stadt',cityArea:'Innenstadt'},
 {setNumber:'990002',name:'Bahnhof & Eisenbahn – Beispiel',quantity:2,purchasePrice:120,currentValue:160,imageUrl:'https://images.example.invalid/tall.svg',addedAt:'2026-10-28',category:'Züge',cityArea:'Bahnhof'},
 {setNumber:'990003',name:'Ein sehr langer Beispielname für ein Sammlerstück mit vielen Details und Sonderzeichen',quantity:1,purchasePrice:12500,currentValue:15000,imageUrl:'',addedAt:'2026-10-27'},
 {setNumber:'990004',name:'Set ohne erfasste Preise – Beispiel',quantity:1,purchasePrice:null,currentValue:null,imageUrl:'',addedAt:'2026-10-26'}
],wishlist:[],trackShopping:[],classifiedOffers:[],meta:{onboardingDone:true},modules:{}};
function fakeSupabase(fixture){
 const user={id:'00000000-0000-4000-8000-000000000001',email:'demo@example.invalid'};
 const client={auth:{getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc:async name=>({data:name==='my_subscription'?{plan:'free',status:'active'}:null,error:null}),
  functions:{invoke:async()=>({data:null,error:null})},
  from(table){let one=false;const result=()=>({data:table==='user_state'?(one?{state:structuredClone(fixture),updated_at:'2026-10-29T12:00:00Z'}:[{state:structuredClone(fixture),updated_at:'2026-10-29T12:00:00Z'}]):one?null:[],count:0,error:null});
   const query=new Proxy({}, {get(_target,key){
    if(key==='then')return (resolve,reject)=>Promise.resolve(result()).then(resolve,reject);
    if(key==='maybeSingle'||key==='single')return ()=>{one=true;return Promise.resolve(result())};
    if(['insert','upsert','update','delete'].includes(key))return ()=>{throw Error('Test UI must not write remote data')};
    return ()=>query;
   }});return query;
  }};
 window.supabase={createClient:()=>client};
}
async function noOverflow(page,label){
 const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
 assert.ok(sizes.scroll<=sizes.width+1,label+': horizontal overflow '+JSON.stringify(sizes));
}
(async()=>{
 for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  activePage=page;
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin===base){
    if(url.pathname==='/vendor/supabase.js')return route.fulfill({contentType:'application/javascript',body:'('+fakeSupabase.toString()+')('+JSON.stringify(fixture)+');'});
    return route.continue();
   }
   if(url.hostname==='images.example.invalid'){
    const wide=url.pathname.includes('wide');
    return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${wide?900:300}" height="${wide?300:900}" viewBox="0 0 ${wide?900:300} ${wide?300:900}"><rect width="100%" height="100%" rx="18" fill="#f3b94b"/><rect x="15" y="15" width="${wide?870:270}" height="${wide?270:870}" rx="12" fill="#c91919"/><text x="50%" y="50%" text-anchor="middle" fill="white" font-size="40" font-family="sans-serif">BEISPIEL</text></svg>`});
   }
   return route.abort();
  });
  await page.addInitScript(()=>{sessionStorage.setItem('brick-login-entry-5096','allow');sessionStorage.setItem('skipOnboardingV38','1')});
  await page.goto(base+'/index.html');
  await page.waitForFunction(()=>typeof cloudSessionV3==='function'&&typeof opsV547!=='undefined');
  await page.evaluate(async()=>{await cloudSessionV3({user:{id:'00000000-0000-4000-8000-000000000001',email:'demo@example.invalid'}});switchTab('home')});
  await page.waitForFunction(()=>document.getElementById('kUnique')?.textContent==='4');
  const collectionBefore=await page.evaluate(()=>JSON.stringify(state.collection));
  for(const width of [320,390,768,1366]){
   await page.setViewportSize({width,height:width>900?950:844});
   await page.locator('.tabsGroupedV550>[data-tab="home"]').click();
   await noOverflow(page,engine+' home '+width);
   const kpis=await page.locator('.homeKpisV549 > .card').count();assert.equal(kpis,4);
   assert.equal(await page.locator('#visibleVersionV553').isVisible(),false);
   const geometry=await page.evaluate(()=>({kpi:document.querySelector('.homeKpisV549').getBoundingClientRect().y,plan:document.querySelector('.bcmTariffHero').getBoundingClientRect().y}));
   assert.ok(geometry.kpi<geometry.plan,'KPIs must precede the plan');
   if(width===390||width===1366)await page.screenshot({path:out+'/'+engine+'-home-'+width+'.png',fullPage:true});
   await page.locator('.tabsGroupedV550>[data-tab="collection"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('#emergencyCollectionV573 .emergencySetV573').length===4);
   await noOverflow(page,engine+' collection '+width);
   assert.equal(await page.locator('.emergencyPricesV573').first().innerText().then(t=>t.includes('Kaufpreis / Stück')&&t.includes('Marktwert / Stück')),true);
   for(const img of await page.locator('.emergencyVisualV573 img').all()){
    await img.waitFor({state:'visible'});
    assert.equal(await img.evaluate(el=>getComputedStyle(el).objectFit),'contain');
   }
   if(width===390||width===1366)await page.screenshot({path:out+'/'+engine+'-collection-'+width+'.png',fullPage:true});
   await page.locator('.tabsGroupedV550 summary').click();
   const menu=await page.locator('.navMenuV550').boundingBox();
   assert.ok(menu&&menu.x>=-1&&menu.x+menu.width<=width+1,engine+' menu outside viewport at '+width);
   await page.locator('.tabsGroupedV550 summary').click();
  }
  await page.locator('.tabsGroupedV550 summary').click();
  await page.locator('.tabsGroupedV550 [data-tab="settings"]').click();
  assert.equal(await page.locator('#visualVersionV599').isVisible(),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(state.collection)),collectionBefore,'Visual changes must not modify the collection');
  // Show both authentication states with the real auth-entry UI and no submission.
  await page.goto(base+'/anmelden.html');
  assert.equal(await page.locator('#passwordHint').isVisible(),false);
  assert.equal(await page.locator('#sessionPanel').isVisible(),false);
  await page.getByRole('button',{name:'Noch kein Konto? Kostenlos registrieren'}).click();
  assert.equal(await page.locator('#passwordHint').isVisible(),true);
  await page.screenshot({path:out+'/'+engine+'-registration.png',fullPage:true});
  fs.writeFileSync(out+'/'+engine+'-console.json',JSON.stringify(errors,null,2));
  console.log(engine+': production UI at 320/390/768/1366px, four KPIs, image containment, price labels, settings version, authentication modes and unchanged collection passed. Console errors: '+JSON.stringify(errors));
  await browser.close();
 }
})().catch(async error=>{if(activePage)await activePage.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});console.error(error);process.exit(1)});
