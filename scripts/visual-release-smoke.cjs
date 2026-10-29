/* Full production UI, fake local account and intercepted services. No live user data. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const base=process.env.BCM_TEST_BASE||'http://127.0.0.1:8765';
let activePage;
const out='/tmp/bcm-visual-review';fs.mkdirSync(out,{recursive:true});
const fixture={collection:[
 {setNumber:'990001',name:'Stadthaus mit Dachterrasse – Beispiel',quantity:1,purchasePrice:149.99,currentValue:184.5,imageUrl:'https://images.example.invalid/wide.svg',addedAt:'2026-10-29',category:'Stadt',cityArea:'Innenstadt',tagsV547:['Favorit'],customCategoryV547:'Architektur',storageRoom:'Keller',storageShelf:'Regal 2',condition:'Neu / OVP'},
 {setNumber:'990002',name:'Bahnhof & Eisenbahn – Beispiel',quantity:2,purchasePrice:120,currentValue:160,imageUrl:'https://images.example.invalid/tall.svg',addedAt:'2026-10-28',category:'Züge',cityArea:'Bahnhof'},
 {setNumber:'990003',name:'Ein sehr langer Beispielname für ein Sammlerstück mit vielen Details und Sonderzeichen',quantity:1,purchasePrice:12500,currentValue:15000,imageUrl:'',addedAt:'2026-10-27',tagsV547:['Favorit'],condition:'Gebraucht vollständig'},
 {setNumber:'990004',name:'Set ohne erfasste Preise – Beispiel',quantity:1,purchasePrice:null,currentValue:null,imageUrl:'',addedAt:'2026-10-26'}
],wishlist:[],trackShopping:[],classifiedOffers:[],meta:{onboardingDone:true,cityLayoutVersion:'50.3'},modules:{}};
function fakeSupabase(fixture){
 const user={id:'00000000-0000-4000-8000-000000000001',email:'demo@example.invalid'};
 const client={auth:{getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc:async (name,args)=>name==='read_showcase'?window.__showcaseTest({action:'read',token:args.link_token}):({data:name==='my_subscription'?{plan:'free',status:'active'}:null,error:null}),
  functions:{invoke:async()=>({data:null,error:null})},
  from(table){
   if(table==='showcase_links'){
    let op='load',payload;
    const chain={select(){return chain},eq(){return chain},insert(x){op='insert';payload=x;return chain},update(x){op='update';payload=x;return chain},maybeSingle(){return window.__showcaseTest({action:op,payload})},single(){return window.__showcaseTest({action:op,payload})}};return chain;
   }
   let one=false;const result=()=>({data:table==='user_state'?(one?{state:structuredClone(fixture),updated_at:'2026-10-29T12:00:00Z'}:[{state:structuredClone(fixture),updated_at:'2026-10-29T12:00:00Z'}]):one?null:[],count:0,error:null});
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
  let shared=null;
  const backend=async ({action,payload,token})=>{
   if(action==='load')return {data:shared,error:null};
   if(action==='read')return {data:shared?.active&&shared.token===token?{sets:shared.items,updated_at:shared.updated_at}:null,error:null};
   shared={...shared,...payload,active:payload.active??true,token:shared?.token||'00000000-0000-4000-8000-000000000010'};
   return {data:shared,error:null};
  };
  await page.exposeFunction('__showcaseTest',backend);
  await page.emulateMedia({reducedMotion:'reduce'});
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
  // Let existing account migrations and scheduled price audits settle before measuring UI-only interactions.
  await page.waitForTimeout(1800);
  const collectionBefore=await page.evaluate(()=>JSON.stringify(state.collection));
  for(const width of [320,390,660,768,1366]){
   await page.setViewportSize({width,height:width>900?950:844});
   await page.locator('.tabsGroupedV550>[data-tab="home"]').click();
   await noOverflow(page,engine+' home '+width);
   const kpis=await page.locator('.homeKpisV549 > .card').count();assert.equal(kpis,4);
   assert.equal(await page.locator('#visibleVersionV553').isVisible(),false);
   assert.equal(await page.locator('#addTop').isVisible(),true);
   const geometry=await page.evaluate(()=>({kpi:document.querySelector('.homeKpisV549').getBoundingClientRect().y,plan:document.querySelector('.bcmTariffHero').getBoundingClientRect().y}));
   assert.ok(geometry.kpi<geometry.plan,'KPIs must precede the plan');
   if(width===390||width===1366)await page.screenshot({path:out+'/'+engine+'-home-'+width+'.png',fullPage:true,animations:'disabled'});
   await page.locator('.tabsGroupedV550>[data-tab="collection"]').click();
   await page.locator('#collection').waitFor({state:'visible'});
   await page.waitForFunction(()=>document.querySelectorAll('#emergencyCollectionV573 .emergencySetV573').length===4);
   await page.locator('.emergencySetV573').first().waitFor({state:'visible'});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await noOverflow(page,engine+' collection '+width);
   assert.equal(await page.locator('.emergencyPricesV573').first().innerText().then(t=>t.includes('Kaufpreis / Stück')&&t.includes('Marktwert / Stück')),true);
   await page.waitForFunction(()=>{const imgs=[...document.querySelectorAll('.emergencyVisualV573 img')];return imgs.length===2&&imgs.every(el=>getComputedStyle(el).objectFit==='contain')});
   const slots=await page.evaluate(()=>[...document.querySelectorAll('.emergencyVisualV573 img')].map(el=>{const r=el.parentElement.getBoundingClientRect();return {w:r.width,h:r.height}}));
   for(const slot of slots)assert.ok(slot.h<=slot.w+1,'Portrait images must not enlarge their slot');
   if(width===390||width===1366)await page.screenshot({path:out+'/'+engine+'-collection-'+width+'.png',fullPage:true,animations:'disabled'});
   if(width===390){
    const expectCount=count=>page.waitForFunction(n=>document.querySelectorAll('#emergencyCollectionV573 .emergencySetV573').length===n,count);
    const sortBefore=await page.locator('#collectionSortV557').inputValue();
    await page.getByRole('searchbox',{name:'Sammlung durchsuchen'}).fill('keller architektur');
    await expectCount(1);assert.equal(await page.evaluate(()=>filteredV3().length),1);
    await page.getByRole('button',{name:'Suchfeld leeren',exact:true}).click();await expectCount(4);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'search');
    await page.locator('#collectionMoreV564').click();
    await page.locator('#tagFilterV547').selectOption('Favorit');await expectCount(2);
    await page.locator('#filterKindV546').selectOption('sealed');await expectCount(1);
    await page.locator('#resetCollectionFilters').click();await expectCount(4);
    assert.equal(await page.locator('#tagFilterV547').inputValue(),'');
    assert.equal(await page.locator('#filterKindV546').inputValue(),'');
    for(const mode of ['price-asc','price-desc']){
     await page.locator('#collectionSortV557').selectOption(mode);
     await page.waitForFunction(()=>document.querySelector('#emergencyCollectionV573 .emergencySetV573:last-child .emergencyBodyV573 > small')?.textContent==='#990004');
    }
    await page.locator('#collectionSortV557').selectOption(sortBefore);
    await page.locator('#collectionMoreV564').click();
    await page.locator('#search').fill('Kein Treffer nirgendwo');await expectCount(0);
    await page.getByText('Keine passenden Sets gefunden. Versuche weniger Suchbegriffe oder setze die Filter zurück.').waitFor();
    await noOverflow(page,engine+' empty filtered collection');
    await page.locator('#resetCollectionFilters').click();await expectCount(4);
    await page.locator('#search').fill('stadthaus architektur');await expectCount(1);
    await page.screenshot({path:out+'/'+engine+'-filtered-collection.png',fullPage:true,animations:'disabled'});
    await page.locator('#resetCollectionFilters').click();await expectCount(4);
    await page.locator('.emergencySetV573').first().evaluate(el=>el.dataset.idleCheck='kept');
    await page.waitForTimeout(1400);
    assert.equal(await page.locator('.emergencySetV573').first().getAttribute('data-idle-check'),'kept');
    const originalName=await page.evaluate(()=>state.collection[0].name);
    await page.evaluate(()=>{state.collection[0].name='Live-Aktualisierung';renderCollection()});
    await page.locator('.emergencyTitleV573').filter({hasText:'Live-Aktualisierung'}).waitFor();
    await page.evaluate(name=>{state.collection[0].name=name;renderCollection()},originalName);
    await page.locator('.emergencyTitleV573').filter({hasText:originalName}).waitFor();
    await page.locator('#showcaseShare').click();
    const choices=page.locator('.showcaseChoices input');
    assert.equal(await page.locator('.showcaseChoices input:checked').count(),0);
    await choices.nth(0).check();await choices.nth(1).check();
    await page.locator('#showcaseCreate').click();
    assert.equal(await page.locator('#showcasePreview .showcaseCard').count(),2);
    await page.screenshot({path:out+'/'+engine+'-showcase-dialog.png',fullPage:true,animations:'disabled'});
    await page.locator('#showcasePublish').click();
    await page.getByText('Freigabe gespeichert. Der Link zeigt jetzt diese Auswahl.').waitFor();
    const link=await page.locator('#showcaseLink').inputValue();
    const visitor=await browser.newPage({viewport:{width:390,height:844}});
    await visitor.exposeFunction('__showcaseTest',backend);
    await visitor.route('**/vendor/supabase.js*',route=>route.fulfill({contentType:'application/javascript',body:'('+fakeSupabase.toString()+')('+JSON.stringify(fixture)+');'}));
    await visitor.goto(link);
    await visitor.waitForFunction(()=>document.querySelectorAll('.showcaseCard').length===2);
    await noOverflow(visitor,engine+' public showcase');
    assert.equal(await visitor.locator('input').count(),0);
    await visitor.screenshot({path:out+'/'+engine+'-showcase.png',fullPage:true,animations:'disabled'});
    await choices.nth(0).uncheck();await choices.nth(2).check();
    await page.locator('#showcaseCreate').click();await page.locator('#showcasePublish').click();
    await page.getByText('Freigabe gespeichert. Der Link zeigt jetzt diese Auswahl.').waitFor();
    assert.equal(await page.locator('#showcaseLink').inputValue(),link);
    await visitor.reload();await visitor.getByText(/Ein sehr langer Beispielname/).waitFor();
    await page.locator('#showcaseDeactivate').click();
    await page.getByText('Freigabe deaktiviert. Der Link zeigt keine Sets mehr.').waitFor();
    await visitor.reload();await visitor.getByText('Dieses Schaufenster ist nicht verfügbar oder wurde deaktiviert.').waitFor();
    assert.equal(await visitor.locator('.showcaseCard').count(),0);
    await visitor.close();await page.locator('#showcaseClose').click();
   }
   await page.locator('.tabsGroupedV550 summary').click();
   const menu=await page.locator('.navMenuV550').boundingBox();
   assert.ok(menu&&menu.x>=-1&&menu.x+menu.width<=width+1,engine+' menu outside viewport at '+width);
   await page.locator('.tabsGroupedV550 [data-tab="settings"]').click();
   assert.equal(await page.locator('#visualVersionV599').isVisible(),true);
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
  await page.screenshot({path:out+'/'+engine+'-registration.png',fullPage:true,animations:'disabled'});
  fs.writeFileSync(out+'/'+engine+'-console.json',JSON.stringify(errors,null,2));
  console.log(engine+': production UI at 320/390/660/768/1366px, four KPIs, image containment, price labels, settings version, authentication modes and unchanged collection passed. Console errors: '+JSON.stringify(errors));
  await browser.close();
 }
})().catch(async error=>{if(activePage)await activePage.screenshot({path:out+'/failure.png',fullPage:true,animations:'disabled'}).catch(()=>{});console.error(error);process.exit(1)});
