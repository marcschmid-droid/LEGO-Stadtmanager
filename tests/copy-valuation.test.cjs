const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {summarize,editManual}=require('../collection-valuation.js');
const {BrickCollectionMetrics}=require('../collection-metrics-v570.js');
const {build}=require('../set-save-model.js');
const item={setNumber:'990001',quantity:3,purchasePrice:40,currentValue:25,condition:'Gebraucht',exemplars:[{condition:'Neu / OVP',price:12},{condition:'Neu / OVP',price:12},{condition:'Gebraucht vollständig',price:16}]};
test('mixed copies use their own condition and agree with dashboard totals',()=>{
 const source=structuredClone(item),market={marketNewEUR:25,marketUsedEUR:15};
 const value=summarize(source,market);
 assert.equal(value.total,65);assert.equal(value.conditionLabel,'Gemischter Zustand');
 assert.deepEqual(value.rows.map(x=>x.value),[25,25,15]);
 assert.equal(BrickCollectionMetrics.metrics({collection:[{...source,market}]}).value,65);
 assert.deepEqual(source,item);
});
test('a missing used quote keeps a mixed valuation incomplete instead of reusing the new price',()=>{
 const result=summarize(item,{marketNewEUR:25});
 assert.equal(result.total,null);assert.equal(result.knownTotal,50);assert.equal(result.knownCount,2);
 assert.equal(result.rows[2].value,null);
 assert.equal(BrickCollectionMetrics.metrics({collection:[{...item,market:{marketNewEUR:25}}]}).value,null);
});
test('explicit per-copy values survive catalog refreshes and can be cleared',()=>{
 const original={condition:'Gebraucht',price:12,note:'Behalten'};
 const manual=editManual(original,'18,50','2026-10-30T12:00:00Z');
 const result=summarize({...item,exemplars:[item.exemplars[0],item.exemplars[1],manual]},{marketNewEUR:30,marketUsedEUR:15});
 assert.equal(result.total,78.5);assert.equal(result.rows[2].source,'Manuell erfasst · einzelnes Exemplar');
 assert.deepEqual(editManual(manual,''),original);
 assert.throws(()=>editManual(original,'-1'));assert.equal(original.price,12);
});
test('unknown conditions remain unknown during the former automatic migration',()=>{
 const source=fs.readFileSync('app-v3.js','utf8');
 const start=source.indexOf('function fillMissingConditionV529'),end=source.indexOf('/* v50.30',start);
 const c={state:{collection:[{condition:'Unbekannt'},{condition:'Neu / OVP'},{}]}};
 vm.createContext(c);vm.runInContext(source.slice(start,end),c);
 const before=JSON.stringify(c.state);assert.equal(c.fillMissingConditionV529(),0);assert.equal(JSON.stringify(c.state),before);
 assert.equal(summarize({quantity:1,condition:'Unbekannt'},{marketNewEUR:25,marketUsedEUR:15}).total,null);
});
test('applying the parent condition to copies requires explicit selection',()=>{
 const fields={fSet:'990001',fName:'Beispiel',fQty:'3',fCondition:'Neu / OVP'};
 const preserved=build(id=>fields[id],item);
 assert.equal(preserved.exemplars[2].condition,'Gebraucht vollständig');
 const changed=build(id=>({...fields,fApplyConditionAllV603:true})[id],item);
 assert.ok(changed.exemplars.every(x=>x.condition==='Neu / OVP'));
 assert.equal(changed.purchasePrice,40);assert.deepEqual(changed.exemplars.map(x=>x.price),[12,12,16]);
});
test('excess copies and malformed large quantities require review',()=>{
 assert.equal(summarize({...item,quantity:2},{marketNewEUR:25,marketUsedEUR:15}).complete,false);
 assert.equal(summarize({quantity:1e9,currentValue:20}).complete,false);
});
