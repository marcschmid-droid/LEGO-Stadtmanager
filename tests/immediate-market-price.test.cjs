const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync('app-v3.js','utf8');
test('newly saved sets invoke secure set-lookup immediately',()=>{assert.match(s,/functions\.invoke\("set-lookup"/);assert.match(s,/immediateMarketPriceV584/);assert.match(s,/bind\("saveSet","fSet"\)/);assert.match(s,/bind\("savePurchase","pSet"\)/)});
test('immediate lookup never changes purchase price',()=>{const start=s.indexOf('async function immediateMarketPriceV584');const end=s.indexOf('function bindImmediateMarketPriceV584',start);const block=s.slice(start,end);assert.doesNotMatch(block,/purchasePrice\s*=/)});
