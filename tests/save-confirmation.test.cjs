const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {build,matches}=require('../set-save-model.js');
test('Speichern erhält Zusatzfelder, Kaufdaten und Hinzufügedatum',()=>{
 const previous={setNumber:'10255',name:'Alt',addedAt:'2026-01-01',purchases:[{price:12}],quantity:1};
 const fields={fSet:'10255',fName:'Stadt',fQty:'2',fPrice:'12,50',fCondition:'Gebraucht vollständig',fStorageRoom:'Keller',fPurchaseDate:'2026-10-29'};
 const item=build(id=>fields[id],previous);
 assert.equal(item.condition,'Gebraucht vollständig');assert.equal(item.storageRoom,'Keller');
 assert.equal(item.purchasePrice,12.5);assert.equal(item.purchaseDate,'2026-10-29');
 assert.equal(item.addedAt,previous.addedAt);assert.deepEqual(item.purchases,previous.purchases);
 assert.equal(item.currentValue,null);
});
test('ungültige Stückzahlen und Preise werden vor Änderung der Sammlung abgelehnt',()=>{
 for(const fields of [{fQty:'abc'},{fQty:'1.5'},{fQty:'0'},{fPrice:'-3'},{fWidth:'NaN'}])
   assert.throws(()=>build(id=>({fSet:'10255',fName:'Stadt',...fields})[id]));
});
test('Cloud-Bestätigung prüft auch Zustand, Notiz und Lagerort',()=>{
 const item={setNumber:'10255',name:'Stadt',condition:'Neu',note:'Neu',storage:'B',purchases:[{x:1,y:2}]};
 assert.equal(matches({...item,note:'Alt'},item),false);
 assert.equal(matches({...item,condition:'Gebraucht'},item),false);
 assert.equal(matches({...item,purchases:[{y:2,x:1}]},item),true);
});
function setup({remote=[],pause=false,readError=false}={}){
 let unblock,writeCount=0,active=0,maxActive=0;
 const gate=new Promise(resolve=>unblock=resolve);
 const sync={revision:'2026-10-01',dirty:true};
 const context={state:{collection:[{setNumber:'10255',name:'Stadt'}],meta:{}},cloudUserV3:{id:'one'},cloudApplyingV3:false,
   navigator:{onLine:true},snapshotV544:()=>true,structuredClone,console,Date,JSON,Set,
   syncInfoV547:()=>sync,storeSyncV547:()=>{},persistBaseV3:()=>{},renderSyncConflictV547:()=>{},queueCloudSaveV3:()=>{},
   cloudSessionV3:async()=>{sync.revision=null},cloudStatusV3:text=>context.message=text,
   cloudV3:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{state:{collection:structuredClone(remote)},updated_at:'2026-10-01'},error:readError?{message:'offline'}:null})})})})},
   cloudSaveV3:async()=>{writeCount++;active++;maxActive=Math.max(maxActive,active);if(pause&&writeCount===1)await gate;remote=structuredClone(context.state.collection);active--;return {error:null}}
 };
 const source=fs.readFileSync('save-protection-v559.js','utf8');
 vm.createContext(context);vm.runInContext(source.slice(0,source.indexOf('  // Recover pending writes'))+'})();',context);
 return {context,sync,unblock,writeCount:()=>writeCount,maxActive:()=>maxActive};
}
test('manuelles Speichern wartet auf laufendes Autosave und bestätigt erst danach',async()=>{
 const x=setup({pause:true});const first=x.context.cloudSaveV3(false);
 await new Promise(setImmediate);let secondDone=false;
 const second=x.context.cloudSaveV3(true).then(()=>secondDone=true);
 await new Promise(setImmediate);assert.equal(secondDone,false);assert.equal(x.writeCount(),1);
 x.unblock();await Promise.all([first,second]);assert.equal(x.maxActive(),1);assert.match(x.context.message,/Cloud-Bestand bestätigt/);
});
test('Cloud mit zusätzlichen Sets wird nicht überschrieben',async()=>{
 const x=setup({remote:[{setNumber:'99999'}]});await x.context.cloudSaveV3(true);
 assert.equal(x.writeCount(),0);assert.ok(x.sync.conflict);assert.match(x.context.message,/STOPP/);
});
test('Leseausfall meldet keine erfolgreiche Speicherung',async()=>{
 const x=setup({readError:true});await x.context.cloudSaveV3(true);
 assert.equal(x.writeCount(),0);assert.match(x.context.message,/nicht lesbar/);
});
test('fehlende Anfangsversion wird bei manuellem Speichern erneut geladen',async()=>{
 const x=setup();x.sync.revision=undefined;await x.context.cloudSaveV3(true);
 assert.equal(x.writeCount(),1);assert.match(x.context.message,/bestätigt/);
});
