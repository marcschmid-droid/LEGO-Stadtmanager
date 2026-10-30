const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app-v3.js','utf8');
function setup(){
 const c={pV3:x=>Number(x)||0,nV3:x=>String(x||'').toLowerCase(),valuationModeV532:()=> 'collector'};
 vm.createContext(c);
 vm.runInContext(source.slice(source.indexOf('function manualNewEstimateV602('),source.indexOf('function priceAuditCheckV532(')),c);
 vm.runInContext(source.slice(source.indexOf('const marketChoiceBaseV533='),source.indexOf('function migrateCollectorModeV533(')),c);
 const start=source.indexOf('collectorValueV533=function');
 vm.runInContext(source.slice(start,source.indexOf('function migrateValuationV535(',start)),c);
 return c;
}
const quote={marketNewEUR:25,manualMarketNewEstimate:{value:25,currency:'EUR',basis:'asking-prices'}};
test('manual new/sealed reference is labelled as an asking-price estimate',()=>{
 const c=setup(),choice=c.marketChoiceV532({condition:'Neu / OVP'},quote,'collector');
 assert.equal(choice.value,25);assert.match(choice.source,/Manuelle Schätzung/);assert.match(choice.source,/Angebotspreise/);
});
test('manual new estimate is not converted into a used valuation',()=>{
 const c=setup();
 for(const mode of ['condition','collector','used']){
  assert.equal(c.marketChoiceV532({condition:'Gebraucht'},quote,mode).value,0);
 }
 assert.equal(c.marketChoiceV532({condition:'Gebraucht',currentValue:17},quote,'manual').value,17);
 assert.equal(c.marketChoiceV532({condition:'Gebraucht'},quote,'new').value,25);
 assert.equal(c.marketChoiceV532({condition:'Gebraucht'},{...quote,marketUsedEUR:18},'collector').value,18);
});
test('a later different market price no longer uses the old estimate label',()=>{
 const c=setup(),updated={...quote,marketNewEUR:30};
 assert.equal(c.manualNewEstimateV602(updated),null);
 assert.doesNotMatch(c.marketSourceV532(updated,'new'),/Manuelle Schätzung/);
});
test('40909 retains the approved estimate provenance independently of later API prices',()=>{
 const row=JSON.parse(fs.readFileSync('data/set-enrichment.json')).sets['40909'];
 assert.equal(row.manualMarketNewEstimate.value,25);
 assert.equal(row.manualMarketNewEstimate.currency,'EUR');
 assert.ok(Number.isFinite(Date.parse(row.manualMarketNewEstimate.recordedAt)));
 assert.equal(row.manualMarketNewEstimate.basis,'asking-prices');
 assert.ok(row.manualMarketNewEstimate.sources.length>=2);
});
