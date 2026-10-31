const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {BrickCollectionMetrics:m}=require('../collection-metrics-v570.js');
test('partial value counts priced copies inside mixed incomplete sets',()=>{
 const s={collection:[{setNumber:'1',quantity:3,condition:'Unbekannt',purchasePrice:30,market:{marketNewEUR:25,marketUsedEUR:10},exemplars:[{condition:'Neu / OVP'},{condition:'Gebraucht'},{condition:'Unbekannt'}]}]};
 const x=m.metrics(s);assert.equal(x.value,null);assert.equal(x.partialValue,35);assert.equal(x.pricedCopies,2);assert.equal(x.missingCopies,1);assert.equal(x.returnPct,null);assert.deepEqual(x.issues,[{setNumber:'1',index:2,reason:'Zustand fehlt'}]);
});
test('missing prices are actionable and never converted to zero',()=>{
 const x=m.metrics({collection:[{setNumber:'2',quantity:1,condition:'Neu / OVP'}]});
 assert.equal(x.partialValue,null);assert.equal(x.pricedCopies,0);assert.equal(x.missingCopies,1);assert.equal(x.issues[0].reason,'Marktwert fehlt');
});
test('complete manual copy prices produce full value and correct return',()=>{
 const x=m.metrics({collection:[{setNumber:'3',quantity:2,purchasePrice:40,exemplars:[{currentValue:25},{currentValue:35}]}]});
 assert.equal(x.count,1);assert.equal(x.copies,2);assert.equal(x.value,60);assert.equal(x.partialValue,60);assert.equal(x.returnPct,50);assert.equal(x.issues.length,0);
});
test('copy count mismatch excludes questionable subtotal and opens set correction',()=>{
 const x=m.metrics({collection:[{setNumber:'4',quantity:1,currentValue:25,exemplars:[{},{}]}]});assert.equal(x.value,null);assert.equal(x.partialValue,null);assert.equal(x.issues[0].index,null);
});
function snapshotSetup(maxRows=2){
 let rows=[{state:{collection:['old1']}},{state:{collection:['old2']}},{state:{collection:['old3']}}];
 const c={cloudApplyingV3:false,state:{collection:['current']},structuredClone,Date,JSON,reliabilityV544:{},backupRowsV544:()=>rows,backupKeyV544:()=>'backups',localStorage:{setItem:(key,raw)=>{const next=JSON.parse(raw);if(next.length>maxRows)throw Object.assign(Error('quota'),{name:'QuotaExceededError'});rows=next}}};
 const source=fs.readFileSync('improvements-v544.js','utf8').split("function snapshotV544")[1].split('function validStateV544')[0];vm.createContext(c);vm.runInContext('function snapshotV544'+source,c);return {c,rows:()=>rows};
}
test('rotating checkpoints retain current state and one previous state',()=>{const x=snapshotSetup();assert.equal(x.c.snapshotV544('Manual',true),true);assert.equal(x.rows().length,2);assert.deepEqual(x.rows()[0].state.collection,['current']);assert.deepEqual(x.rows()[1].state.collection,['old1'])});
test('quota retries a smaller checkpoint atomically',()=>{const x=snapshotSetup(1);assert.equal(x.c.snapshotV544('Manual',true),true);assert.equal(x.rows().length,1);assert.deepEqual(x.rows()[0].state.collection,['current'])});
test('persistent quota reports failure and preserves prior checkpoints',()=>{const x=snapshotSetup(0);assert.equal(x.c.snapshotV544('Manual',true),false);assert.equal(x.rows().length,3);assert.match(x.c.reliabilityV544.backupError,/Speicher|speicher/)});

test('existing checkpoint compaction affects only the active backup key',()=>{
 const storage=new Map([['backups:a',JSON.stringify([1,2,3,4,5])],['cache:a','active collection'],['backups:b','other account']]);
 const c={cloudUserV3:{id:'a'},JSON,backupRowsV544:()=>JSON.parse(storage.get('backups:a')),backupKeyV544:()=>'backups:a',localStorage:{setItem:(k,v)=>storage.set(k,v)}};
 const source=fs.readFileSync('improvements-v544.js','utf8').split('function compactCheckpointsV605')[1].split('function snapshotV544')[0];vm.createContext(c);vm.runInContext('function compactCheckpointsV605'+source,c);c.compactCheckpointsV605();
 assert.deepEqual(JSON.parse(storage.get('backups:a')),[1,2]);assert.equal(storage.get('cache:a'),'active collection');assert.equal(storage.get('backups:b'),'other account');
});
