const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('instant-set-lookup-v582.js','utf8');
function setup(response,{catalog=null,connected=true}={}){
 const calls=[];
 const ctx={lookupSetOnlineV45:async()=>catalog,cloudV3:connected?{functions:{invoke:async(path,opts)=>{calls.push({path,opts});return response}}}:null,window:{},navigator:{onLine:true},Map,Promise,setTimeout,encodeURIComponent,String,Object};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 return {lookup:ctx.lookupSetOnlineV45,calls};
}
test('Live-Set 21373 liefert Name und Bild sofort',async()=>{
 const x=setup({data:{name:'Downton Abbey',image_url:'https://example.org/21373.jpg',year:2026,pieces:4711}});
 const data=await x.lookup('21373');
 assert.equal(data.rebrickableName,'Downton Abbey');assert.equal(data.imageUrl,'https://example.org/21373.jpg');
 assert.equal(x.calls[0].path,'set-lookup?set=21373');
});
test('fehlende Live-Daten zerstören bestehende Katalogdaten nicht',async()=>{
 const x=setup({error:{message:'source_not_configured'}},{catalog:{rebrickableName:'Vorhandenes Set',marketNewEUR:55}});
 const data=await x.lookup('40529');assert.equal(data.marketNewEUR,55);assert.equal(data.rebrickableName,'Vorhandenes Set');
});
test('Live-Stammdaten überschreiben keine Marktpreise',async()=>{
 const x=setup({data:{name:'Aktuell',image_url:'https://example.org/new.jpg'}},{catalog:{marketUsedEUR:77,rebrickableName:'Alt'}});
 const data=await x.lookup('7622');assert.equal(data.marketUsedEUR,77);assert.equal(data.rebrickableName,'Aktuell');
});
test('ungültige Setnummer löst keinen Netzwerkabruf aus',async()=>{const x=setup({data:{name:'x'}});assert.equal(await x.lookup('abc'),null);assert.equal(x.calls.length,0)});
