const fs=require('fs'),vm=require('vm'),assert=require('assert');
const {JSDOM}=require('jsdom');
const root=require('path').resolve(__dirname,'..'),testOutput=fs.mkdtempSync(require('path').join(require('os').tmpdir(),'bcm-validation-')),html=fs.readFileSync(root+'/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
const dom=new JSDOM(html,{url:'https://example.com/',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window,ctx=dom.getInternalVMContext(),errors=[];
w.structuredClone=structuredClone;w.jspdf=require(root+'/vendor/jspdf.js');w.qrcode=require(root+'/vendor/qrcode.js');w.indexedDB=require('fake-indexeddb').indexedDB;w.alert=()=>{};w.confirm=()=>true;w.prompt=()=>null;w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};
w.fetch=async url=>{const p=String(url).replace(/^\.\//,'').split('?')[0];try{const data=JSON.parse(fs.readFileSync(root+'/'+p));return {ok:true,json:async()=>data}}catch{return {ok:false,json:async()=>({})}}};
w.addEventListener('error',e=>{errors.push(e.error?.message||e.message);e.preventDefault()});w.HTMLCanvasElement.prototype.getContext=()=>null;
for(const file of ['seed-data.js','app.js','app-v3.js','improvements-v544.js','customer-value-v545.js','usability-v546.js','collection-ops-v547.js','shared-collections-v547.js']){try{vm.runInContext(fs.readFileSync(root+'/'+file,'utf8'),ctx,{filename:file})}catch(e){errors.push(file+': '+e.stack)}}
const ev=s=>vm.runInContext(s,ctx);
(async()=>{await new Promise(r=>setTimeout(r,1100));
assert.equal(ev("parseNumbersV544('10326,10326 10255-1').counts.get('10326')"),2);assert.equal(ev("parseNumbersV544('abc').invalid.length"),1);
assert.equal(ev("layoutStatsV544({M01:['10326','10255'],M02:[]},[{setNumber:'10326'},{setNumber:'10255'}]).conflicts.length"),1);
assert.equal(ev("snapshotV544('Test',true)"),true);assert(ev('backupRowsV544().length')>0);
ev("cloudUserV3={id:'other-user'}");assert.equal(ev('backupRowsV544().length'),0);ev('cloudUserV3=null');
ev("switchTab('city');$('layoutNameV544').value='Plan A';saveLayoutV544()");assert.equal(ev('state.meta.layoutsV544.at(-1).name'),'Plan A');
ev("state.modules.M01=['99999'];restoreLayoutV544(state.meta.layoutsV544.at(-1).id)");assert.notEqual(ev('state.modules.M01?.[0]'),'99999');
ev("switchTab('collection');allSetsV46={sets:{'99999':['Testset',2026,42,'','99999-1']}};state.meta.subscriptionPlan='premium';$('bulkNumbersV544').value='99999,99999'");await ev('previewImportV544()');ev('applyImportV544()');assert.equal(ev("state.collection.find(x=>x.setNumber==='99999').quantity"),2);
await ev('previewImportV544()');assert.equal(ev('reliabilityV544.importRows[0].existing'),true);const count=ev('state.collection.length');ev('applyImportV544()');assert.equal(ev('state.collection.length'),count);
assert.equal(ev("validStateV544({collection:[{setNumber:'bad',quantity:1}],wishlist:[]})"),false);
ev("cloudUserV3={id:'account'};reliabilityV544.subscriptionUser='account';reliabilityV544.subscription={status:'canceled',plan:'premium'}");assert.equal(ev('planKeyV519()'),'free');ev("reliabilityV544.subscription.status='active'");assert.equal(ev('planKeyV519()'),'premium');ev('cloudUserV3=null');
assert.equal(ev("billingChecksV544()[1][1]"),false);
ev("state.collection.push({setNumber:'88888',name:'Test',quantity:1,width:10,depth:10});state.wishlist=[{setNumber:'77777',name:'Wunsch',width:10,depth:10}];renderWishFitV544()");assert(!w.document.getElementById('wishFitV544').textContent.includes('Kein passender'));

assert.equal(ev("offerSignalV545({offer:50,limit:60,offerShippingV545:'',offerConditionV545:'Neu / OVP'}).eligible"),false);
assert.equal(ev("offerSignalV545({offer:50,limit:60,offerShippingV545:12,offerConditionV545:'Neu / OVP'}).hit"),false);
assert.equal(ev("offerSignalV545({offer:50,limit:60,offerShippingV545:5,offerConditionV545:'Neu / OVP'}).hit"),true);
assert.equal(ev("offerSignalV545({offer:50,limit:60,offerShippingV545:0,offerConditionV545:'Neu / OVP',alertConditionV545:'Gebraucht vollständig'}).hit"),false);
ev("state.collection[0].missingPartsV545=[{part:'3001',color:'Rot',qty:2}];state.collection[1].missingPartsV545=[{part:'3001',color:'Rot',qty:3}]");assert.equal(ev("partsShoppingV545().find(x=>x.part==='3001').qty"),5);
assert(ev("saleTextV545(state.collection[0])").includes('Vollständigkeit:'));
assert(ev("instructionsV545('10326')").includes('/building-instructions/10326'));
assert(ev("csvValueV545('=CMD()')").startsWith('"\''));
await ev("receiptActionV545('put','test-account:receipt',new Blob(['test']))");assert(await ev("receiptActionV545('get','test-account:receipt')"));assert.equal(await ev("receiptActionV545('get','other-account:receipt')"),undefined);
ev("switchTab('collection')");assert(w.document.getElementById('pdfCreateV545'));assert(w.document.getElementById('buildSuggestV545'));
w.fixtureData='data:image/png;base64,'+'iVBORw0KGgoAAAANSUhEUgAAAoAAAAFoCAIAAABIUN0GAAAFw0lEQVR4nO3XwQnCABBFQSM2FND+C4hgLduBHagH8amZqeCzl8cuM3MAAD7rWA8AgD0SYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABA41QP4Xtf1Uk94yfm21ROecMl3cUn+iQ8YAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAALLzNQbeOK6XuoJwO8537Z6Ao/4gAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAgWVm6g0AsDs+YAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAAEBBoCAAANAQIABICDAABAQYAAICDAABAQYAAICDAABAQaAgAADQECAASAgwAAQEGAACAgwAAQEGAACAgwAAQEGgIAAA0BAgAEgIMAAEBBgAAgIMAAEBBgAAgIMAIE7HX4XSbQ1MAwAAAAASUVORK5CYII=';
ev("state.collection=[{setNumber:'10326',name:'Naturhistorisches Museum',quantity:2,purchasePrice:299.99,currentValue:320,condition:'Gebraucht vollständig',buildStatus:'Unbekannt',width:40,depth:30,pieces:4000,imageUrl:'fixture',storageRoom:'Arbeitszimmer',storageShelf:'Regal 2',storageBin:'Box 4',receiptsV545:[{id:'receipt',name:'Kaufbeleg.jpg'}],exemplars:[],missingPartsV545:[{part:'3001',color:'Rot',qty:2}]},{setNumber:'10255',name:'Ein ungewöhnlich langer Setname mit Sonderzeichen ÄÖÜß und mehreren Zusatzinformationen für die Prüfung des Seitenumbruchs',quantity:1,purchasePrice:0,currentValue:0,condition:'Unbekannt',exemplars:Array.from({length:16},(_,i)=>({id:'EX'+i,seller:'Ein langer Verkäufername mit Zusatzinformationen zur Dokumentation',date:'2026-10-07',price:123.45,shipping:4.99,box:'Ja',complete:'Nein'}))}]");
ev("state.collection[0].buildProgressV546={stage:'Beutel 3',page:10};state.collection[1].exemplars[0].photosV546=[{id:'photo-test',name:'Exemplarfoto.png'}]");
const pdf=await ev("createPortfolioV545(structuredClone(state),{owner:'Testsammlung - PDF-Prüfung'},async()=>fixtureData,async()=>new Blob([Uint8Array.from(atob(fixtureData.split(',')[1]),c=>c.charCodeAt(0))],{type:'image/png'}))");
fs.writeFileSync(testOutput+'/map-test.pdf',Buffer.from(pdf.doc.output('arraybuffer')));assert.equal(pdf.missingPhotos,0);assert.equal(pdf.missingReceipts,0);
const compact=await ev("createPortfolioV545({collection:Array.from({length:200},(_,i)=>({...state.collection[1],setNumber:String(10000+i)}))},{details:false,photos:false,receipts:false,locations:false})");fs.writeFileSync(testOutput+'/compact-test.pdf',Buffer.from(compact.doc.output('arraybuffer')));
const labels=await ev('exportLabelsV545(false)');assert(labels);fs.writeFileSync(testOutput+'/labels-test.pdf',Buffer.from(labels.output('arraybuffer')));
assert.equal(ev("buildOptionsV545(1500,100,100).length"),1);

ev("switchTab('collection');opsV547.selected=new Set(['10326','10255']);$('batchStorageV547').value='Neues Regal';$('batchTagsV547').value='Stadt, Stadt, Selten';batchEditV547()");
assert.equal(ev('state.collection[0].storage'),'Neues Regal');assert.equal(ev('state.collection[0].tagsV547.length'),2);
ev('compareSelectedV547()');assert(w.document.getElementById('compareV547').textContent.includes('Naturhistorisches Museum'));
ev('startInventoryV547()');await ev("inventoryScanV547('10326')");assert.equal(ev('inventoryRowsV547()[0].delta'),-1);
await ev("inventoryScanV547('https://example.com/?set=10326')");assert.equal(ev('inventoryRowsV547()[0].delta'),0);
ev("renderDetailOpsV547('10326');$('loanToV547').value='Test';$('loanQtyV547').value='2';$('loanAddV547').click()");assert.equal(ev('availableLoansV547(state.collection[0])'),0);
ev("$('loanToV547').value='Noch jemand';$('loanQtyV547').value='1';$('loanAddV547').click()");assert.equal(ev('state.collection[0].loansV547.length'),1);
ev("document.querySelector('[data-loan-return]').click()");assert.equal(ev('availableLoansV547(state.collection[0])'),2);
assert.equal(ev('sharedCopyV547().collection[0].purchasePrice'),undefined);assert.equal(ev('sharedCopyV547().collection[0].loansV547'),undefined);
ev("cloudUserV3={id:'sync-test'};syncInfoV547().revision='2026-01-01T00:00:00Z';syncInfoV547().dirty=true;globalThis.syncPredicates=[];cloudV3={from:()=>({update:()=>({eq:function(k,v){syncPredicates.push([k,v]);return this},select:function(){return this},maybeSingle:async()=>({data:{updated_at:'2026-10-08T00:00:00Z'}})})})}");
await ev('cloudSaveV3()');assert.equal(ev('syncInfoV547().dirty'),false);assert.equal(ev('syncPredicates[1][0]'),'updated_at');
ev("cloudV3={from:()=>({update:()=>({eq:function(){return this},select:function(){return this},maybeSingle:async()=>({data:null})}),select:()=>({eq:function(){return this},maybeSingle:async()=>({data:{state:blankStateV3(),updated_at:'new-remote'}})})})};syncInfoV547().dirty=true");
const beforeConflict=ev('JSON.stringify(state.collection)');await ev('cloudSaveV3()');assert.equal(ev('JSON.stringify(state.collection)'),beforeConflict);assert.equal(ev('syncInfoV547().conflict.revision'),'new-remote');ev("globalThis.resolveSessionV547=null;cloudV3={from:()=>({select:()=>({eq:function(){return this},maybeSingle:()=>new Promise(resolve=>resolveSessionV547=resolve)})})};localStorage.setItem(cloudCacheKeyV3('switch-test'),JSON.stringify({...state,collection:[{setNumber:'10326',name:'Cached',quantity:3}]}));syncInfoV547('switch-test').dirty=true;syncInfoV547('switch-test').revision='old'");
const sessionTask=ev("cloudSessionV3({user:{id:'switch-test',email:'test@example.com'}})");assert.equal(ev('state.collection[0].quantity'),3);
ev('state.collection[0].quantity=4;persist()');await ev('cloudSaveV3()');assert.equal(ev('opsV547.saving.size'),0);
ev("resolveSessionV547({data:null,error:new Error('Offline')})");await sessionTask;assert.equal(ev('state.collection[0].quantity'),4);
ev('cloudUserV3=null;cloudV3=null;clearTimeout(cloudSaveTimerV3)');


ev("state.collection=[{setNumber:'10326',name:'Naturhistorisches Museum',quantity:2},{setNumber:'10255',name:'Assembly Square',quantity:1}];refresh()");
ev('baselineV546()');const oldQty=ev('state.collection[0].quantity');ev('state.collection[0].quantity+=1;persist()');assert.equal(ev('workflowV546.sessions.get(ownerV544()).undo.length'),1);assert(ev('state.collection[0].updatedAtV546'));ev('undoV546()');assert.equal(ev('state.collection[0].quantity'),oldQty);
assert.equal(ev("matchesFilterV546({name:'A',condition:'Neu / OVP'},{kind:'sealed'})"),true);
assert.equal(ev("matchesFilterV546({box:'Unbekannt'},{kind:'nobox'})"),false);
assert.equal(ev("matchesFilterV546({forSaleV546:true},{kind:'sale'})"),true);
assert.equal(ev("pdfAuditV546({collection:[{purchasePrice:0,condition:'Unbekannt'}]})[0].issues.length"),3);
ev("state.wishlist=[{setNumber:'1',name:'A',offer:60,offerShippingV545:5,priority:1},{setNumber:'2',name:'B',offer:50,offerShippingV545:5,priority:2}]");assert.equal(ev('budgetSummaryV546(100).filter(r=>r.fit).length'),1);
ev("switchTab('collection');$('filterNameV546').value='Testansicht';$('filterKindV546').value='sealed';$('saveFilterV546').click();$('savedSelectV546').value=state.meta.savedFiltersV546.at(-1).id;$('savedSelectV546').onchange()");assert.equal(ev('filteredV3().length'),0);ev("$('clearFilterV546').click()");assert.equal(ev('filteredV3().length'),2);
ev("showDetailV3('10326');$('buildPageV546').value='15';$('buildStageV546').value='Beutel 4';$('progressSaveV546').click()");assert.equal(ev("state.collection[0].buildProgressV546.page"),15);
console.log('Workflow checks: undo, filters, batch edit, comparison, inventory, loan limits, sharing privacy and cloud CAS/conflict passed.');

console.log('Validation files:',testOutput);console.log('PDF pages:',pdf.doc.getNumberOfPages(),'QR pages:',labels.getNumberOfPages());

console.log(JSON.stringify({checks:28,errors,sets:ev('state.collection.length'),backupCount:ev('backupRowsV544().length'),version:w.document.getElementById('appVersion').textContent},null,2));dom.window.close();if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
