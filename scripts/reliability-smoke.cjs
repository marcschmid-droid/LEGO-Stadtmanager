/* Production UI with isolated in-memory accounts. No live accounts or database writes. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const base=process.env.BCM_TEST_BASE||'http://127.0.0.1:8765',out='/tmp/bcm-visual-review';
fs.mkdirSync(out,{recursive:true});
const fixture={collection:[{setNumber:'990011',name:'Gemischter Beispielbestand',quantity:3,purchasePrice:40,currentValue:25,condition:'Unbekannt',imageUrl:'',addedAt:'2026-10-30',
 market:{marketNewEUR:25,marketUsedEUR:15,manualMarketNewEstimate:{value:25,currency:'EUR',basis:'asking-prices',recordedAt:'2026-10-30T12:00:00Z'}},
 exemplars:[{condition:'Neu / OVP',price:12},{condition:'Neu / OVP',price:12},{condition:'Gebraucht vollständig',price:16}]}],wishlist:[],trackShopping:[],classifiedOffers:[],meta:{onboardingDone:true,cityLayoutVersion:'50.3'},modules:{}};
function fakeClient(){
 const user={id:'00000000-0000-4000-8000-000000000001',email:'demo@example.invalid'};
 const client={auth:{getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc:async name=>({data:name==='my_subscription'?{plan:'free',status:'active'}:null,error:null}),functions:{invoke:async()=>({data:null,error:null})},
  from(table){let operation='read',payload,owner,revision;
   const run=()=>!navigator.onLine?Promise.resolve({error:{message:'offline'}}):window.__reliabilityBackend({table,operation,payload,owner,revision});
   const chain={select(){return chain},eq(key,value){if(key==='user_id')owner=value;if(key==='updated_at')revision=value;return chain},
    update(value){operation='update';payload=value;return chain},insert(value){operation='insert';payload=value;owner=value.user_id;return chain},
    maybeSingle:run,single:run,then:(resolve,reject)=>run().then(resolve,reject),order(){return chain},limit(){return chain},in(){return chain}};
   return chain;
  }};
 window.supabase={createClient:()=>client};
}
(async()=>{
 for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(20000);let remote={state:structuredClone(fixture),updated_at:'2026-10-30T10:00:00Z'},writes=0,errors=[],dialogs=[];
  await page.exposeFunction('__reliabilityBackend',async request=>{
   if(request.table!=='user_state')return {data:request.table==='showcase_links'?null:[],error:null};
   if(request.operation!=='read'){
    if(request.owner!=='00000000-0000-4000-8000-000000000001')throw Error('Unexpected account write');
    if(request.operation==='update'&&request.revision!==remote.updated_at)return {data:null,error:null};
    writes++;remote={...remote,...structuredClone(request.payload)};
   }
   return {data:structuredClone(remote),error:null};
  });
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss()});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==base)return route.abort();
   if(url.pathname==='/vendor/supabase.js')return route.fulfill({contentType:'application/javascript',body:'('+fakeClient.toString()+')();'});
   return route.continue();
  });
  await page.addInitScript(()=>{sessionStorage.setItem('brick-login-entry-5096','allow');sessionStorage.setItem('skipOnboardingV38','1')});
  const signIn=async()=>{
   await page.waitForFunction(()=>typeof opsV547!=='undefined'&&typeof cloudSessionV3==='function');
   await page.evaluate(async()=>{await cloudSessionV3({user:{id:'00000000-0000-4000-8000-000000000001',email:'demo@example.invalid'}});switchTab('collection')});
   await page.locator('.emergencySetV573').waitFor({state:'visible'});
  };
  await page.goto(base+'/index.html');await signIn();await page.waitForTimeout(1800);console.log(engine+': signed in');
  assert.equal(await page.locator('.conditionChipV603').textContent(),'Gemischter Zustand');
  assert.match(await page.locator('.emergencyPricesV573').textContent(),/65,00/);
  assert.match(await page.locator('.priceSourceV603').textContent(),/Manuell/);
  assert.equal(await page.evaluate(()=>state.collection[0].condition),'Unbekannt');
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const size=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
   if(size.scroll>size.viewport+1){
    console.error(engine+' overflow '+width,JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(el=>({tag:el.tagName,id:el.id,cls:el.className,right:el.getBoundingClientRect().right})))));
    await page.screenshot({path:out+'/'+engine+'-overflow-'+width+'.png',fullPage:true});
   }
   assert.ok(size.scroll<=size.viewport+1,engine+' overflow '+JSON.stringify(size));
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.emergencySetV573').click();
  assert.match(await page.locator('.valuationDetailV532').textContent(),/65,00/);
  await page.evaluate(()=>editExemplarV28('990011',2));
  await page.locator('#exMarketValueV603').fill('18.50');await page.locator('#saveExemplarV37').click();
  await page.waitForFunction(()=>setValuationV603(state.collection[0]).total===68.5);
  assert.equal(await page.evaluate(()=>state.collection[0].purchasePrice),40);
  assert.equal(await page.evaluate(()=>state.collection[0].quantity),3);
  await page.locator('#closeDetail').click();
  await page.screenshot({path:out+'/'+engine+'-copy-valuation-390.png',fullPage:true,animations:'disabled'});
  // An edited set closes without a success alert. Its receipt is based on verified cloud contents.
  await page.evaluate(()=>editSet('990011'));await page.locator('#fName').fill('Vor Offline-Test');
  await page.locator('#saveSet').click();await page.locator('#setModal').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.BrickSaveStatus.get().status==='confirmed');console.log(engine+': cloud confirmed');
  assert.equal(remote.state.collection[0].name,'Vor Offline-Test');
  assert.equal(dialogs.length,0,'successful edits must not show blocking alerts');
  await context.setOffline(true);const beforeWrites=writes;
  await page.evaluate(()=>editSet('990011'));await page.locator('#fName').fill('Offline geändert');await page.locator('#saveSet').click();
  await page.locator('#setModal').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.BrickSaveStatus.get().status==='offline');
  assert.equal(writes,beforeWrites);assert.equal(remote.state.collection[0].name,'Vor Offline-Test');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(cloudCacheKeyV3(cloudUserV3.id))).collection[0].name),'Offline geändert');
  await page.screenshot({path:out+'/'+engine+'-pending-offline-390.png',fullPage:true,animations:'disabled'});
  await context.setOffline(false);await page.reload();await signIn();
  await page.waitForFunction(()=>window.BrickSaveStatus.get().status==='confirmed');console.log(engine+': cloud confirmed');
  assert.equal(remote.state.collection[0].name,'Offline geändert');
  assert.equal(remote.state.collection[0].quantity,3);assert.equal(remote.state.collection[0].purchasePrice,40);
  assert.equal(dialogs.length,0);assert.deepEqual(errors,[]);
  // Partial valuation and direct copy editor use the actual production dashboard.
  await page.evaluate(()=>{state.collection[0].exemplars[0].condition='Unbekannt';refresh();switchTab('home')});
  await page.waitForFunction(()=>document.getElementById('kValueCoverageV605').textContent.includes('2 von 3'));
  assert.match(await page.locator('#kValue').textContent(),/44/);
  assert.equal(await page.locator('#kGainPct').textContent(),'–');
  assert.match(await page.locator('#kCopiesV605').textContent(),/1 Set · 3 Exemplare/);
  await page.locator('#missingValuesV605').click();await page.locator('#missingDialogV605').waitFor({state:'visible'});
  assert.equal(await page.locator('.missingRowV605').count(),1);
  await page.locator('.missingRowV605 button').click();
  assert.equal(await page.locator('#exConditionV37').inputValue(),'Unbekannt');
  await page.evaluate(()=>closeExemplarV37());
  await page.evaluate(()=>switchTab('users'));
  assert.equal(await page.locator('#accountBackupsV605').getAttribute('open'),null);
  assert.equal(await page.locator('#saveProtectionV559').evaluate(el=>el.parentElement.id),'accountBackupsV605');
  for(const width of [320,390]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const accountSize=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   if(accountSize.scroll>accountSize.width+1){
    console.error(engine+' account overflow '+width,JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().width&&el.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(el=>({id:el.id,tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right})))));
    await page.screenshot({path:out+'/'+engine+'-account-overflow-'+width+'.png',fullPage:true,animations:'disabled'});
   }
   assert.ok(accountSize.scroll<=accountSize.width+1,engine+' account overflow '+JSON.stringify(accountSize));
  }
  await page.screenshot({path:out+'/'+engine+'-account-605.png',fullPage:true,animations:'disabled'});
  await page.route('**/release-version.json',route=>route.fulfill({contentType:'application/json',body:'{"build":606}'}));
  await page.evaluate(()=>window.BrickExperienceV605.checkUpdates());
  await page.locator('#updateNoticeV605').waitFor({state:'visible'});
  assert.match(await page.locator('#updateNoticeV605').textContent(),/Sicher neu laden/);
  // Actual conflict button recovers with confirmed external export, without a cloud write.
  const writesBeforeAdoption=writes;
  await page.evaluate(()=>{
   const sync=syncInfoV547();sync.conflict={remote:structuredClone(state),revision:sync.revision};
   snapshotV544=()=>false;window.__exportedV605=0;downloadValueV545=()=>window.__exportedV605++;
   window.confirm=()=>true;renderSyncConflictV547();
  });
  await page.locator('#syncRemoteV547').click();
  await page.waitForFunction(()=>syncInfoV547().conflict===null);
  assert.equal(await page.evaluate(()=>window.__exportedV605),1);
  assert.equal(writes,writesBeforeAdoption,'cloud adoption must not write user_state');
  assert.equal(await page.evaluate(()=>state.collection[0].exemplars[0].condition),'Neu / OVP');
  assert.deepEqual(errors,[]);
  console.log(engine+': copy values, visible sources, explicit conditions, popup-free saves, offline edits and reconnect verified');
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exit(1)});
