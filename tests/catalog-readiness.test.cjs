const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('catalog-resilience-v579.js','utf8');
function setup({local={},full={},remote=null}={}){
 const seen=[];
 const context={
  lookupSetOnlineV45:async()=>null,
  enrichmentV3:{sets:local},
  allSetsV46:{sets:full},
  allSetLegacyV46:(n,row)=>({rebrickableName:row[0],imageUrl:row[1]}),
  loadAllSetsV46:async()=>({sets:full}),
  cloudV3:{from:()=>({select:()=>({eq:(k,n)=>({maybeSingle:async()=>{seen.push(n);return {data:remote,error:null}}})})})},
  catalogRowToLegacyV45:r=>({rebrickableName:r.name,marketUsedEUR:r.market_used_eur,imageUrl:r.image_url}),
  navigator:{onLine:true},window:{},Map,Promise,setTimeout
 };
 vm.runInNewContext(source,context);
 return {lookup:context.lookupSetOnlineV45,seen};
}
test('lokaler Treffer verhindert nicht die spätere Cloud-Bewertung',async()=>{
 const {lookup,seen}=setup({local:{'7622':{rebrickableName:'Race',imageUrl:'lokal.jpg'}},remote:{name:'Race',market_used_eur:90}});
 const value=await lookup('7622');
 assert.equal(value.marketUsedEUR,90);assert.equal(value.rebrickableName,'Race');assert.deepEqual(seen,['7622']);
});
test('Katalog liefert Set trotz fehlender Cloud-Bewertung',async()=>{
 const {lookup}=setup({full:{'40529':['Children Amusement Park','bild.jpg']}});
 const value=await lookup('40529');assert.equal(value.rebrickableName,'Children Amusement Park');assert.equal(value.imageUrl,'bild.jpg');assert.equal(value.marketUsedEUR,undefined);
});
test('fehlender Set-Eintrag wird nicht erfunden',async()=>{const {lookup}=setup();assert.equal(await lookup('999999'),null)});
test('ungültige Eingabe führt zu keiner Online-Abfrage',async()=>{const {lookup,seen}=setup();assert.equal(await lookup('abc'),null);assert.equal(seen.length,0)});
test('Setnummer mit Rebrickable-Suffix wird normalisiert',async()=>{
 const {lookup,seen}=setup({remote:{name:'Race',market_used_eur:30}});assert.equal((await lookup('7622-1')).marketUsedEUR,30);assert.deepEqual(seen,['7622']);
});
test('lokale Kaufpreise und Sammlung werden in Suchlogik nicht geschrieben',()=>{
 assert.doesNotMatch(source,/localStorage\.setItem|\.from\(['"]user_state['"]\)|\.upsert\(/);
});
