const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const {BrickCollectionMetrics}=require('../collection-metrics-v570.js');
test('173 Sets werden nicht auf 36 abgeschnitten',()=>{
 const s={collection:Array.from({length:173},(_,i)=>({setNumber:String(10000+i),quantity:1,purchasePrice:20,currentValue:30})),meta:{}};
 const k=BrickCollectionMetrics.metrics(s);assert.equal(k.count,173);assert.equal(k.value,5190);assert.equal(k.investment,3460);assert.equal(k.returnPct,50);
});
test('fehlende Preise werden nicht als Nullwert interpretiert',()=>{
 const m=BrickCollectionMetrics.metrics({collection:[{setNumber:'1234',quantity:1}]});
 assert.equal(m.count,1);assert.equal(m.value,null);assert.equal(m.investment,null);assert.equal(m.returnPct,null);
});
test('Basisinvestition hat Vorrang vor unvollständigen Einzelpreisen',()=>{
 const m=BrickCollectionMetrics.metrics({meta:{investmentBaseline:1200},collection:[{quantity:1,currentValue:1500}]});
 assert.equal(m.investment,1200);assert.equal(m.value,1500);assert.equal(m.returnPct,25);
});
test('Sammlung im Code darf nicht auf 36 Sets beschränkt sein',()=>{
 const s=fs.readFileSync('customer-experience-v548.js','utf8');
 assert.match(s,/renderLimit=Number\.MAX_SAFE_INTEGER/);
});
test('Startseite hat vier gewünschte Kennzahlen',()=>{
 const s=fs.readFileSync('index.html','utf8');
 for(const k of ['kValue','kInvest','kUnique','kGainPct'])assert.match(s,new RegExp('id="'+k+'"'));
 assert.match(s,/ui-repair-v569\.js/);
});
