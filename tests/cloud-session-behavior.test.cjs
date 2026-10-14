const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app-v3.js','utf8');
const fn=source.slice(source.indexOf('let cloudLoadEpochV584=0;'),source.indexOf('async function cloudSaveV3(show=false)'));
function setup({remote=[],cached=null,defer=false}={}){
 let resolveFetch;
 const pending=new Promise(resolve=>resolveFetch=resolve);
 const store=new Map();
 if(cached)store.set('cache-user1',JSON.stringify({collection:cached}));
 const context={
   cloudUserV3:null,cloudV3:{from:()=>({select:()=>({eq:()=>({maybeSingle:()=>defer?pending:Promise.resolve({data:{state:{collection:remote}},error:null})})})})},
   cloudApplyingV3:false,state:{collection:[]},
   cloudCacheKeyV3:()=> 'cache-user1',localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
   $:()=>null,updateAccountBadgeV3:()=>{},cloudStatusV3:s=>context.message=s,
   migrate:()=>{},migrateV3:()=>{},refresh:()=>{},persistBaseV3:()=>{},switchTab:()=>{},
   blankStateV3:()=>({collection:[]}),STORE:'legacy',cloudSaveV3:async()=>{},
   JSON,Set,String,Array,Promise,setTimeout,clearTimeout
 };
 vm.createContext(context);vm.runInContext(fn,context);
 const session={user:{id:'user1',email:'test@example.com'}};
 return {context,session,resolveFetch,store};
}
test('173 Cloud-Sets werden vollständig geladen, nicht auf 166 gekürzt',async()=>{
 const ids=Array.from({length:173},(_,i)=>({setNumber:String(10000+i)}));
 const x=setup({remote:ids});await x.context.cloudSessionV3(x.session);
 assert.equal(x.context.state.collection.length,173);assert.match(x.context.message,/173 Sets/);
});
test('zusätzliche lokale Sets werden nicht durch kleinere Cloud überschrieben',async()=>{
 const remote=Array.from({length:166},(_,i)=>({setNumber:String(10000+i)}));
 const cached=Array.from({length:173},(_,i)=>({setNumber:String(10000+i)}));
 const x=setup({remote,cached});await x.context.cloudSessionV3(x.session);
 assert.equal(x.context.state.collection.length,0);
 assert.match(x.context.message,/STOPP/);
 assert.equal(JSON.parse(x.store.get('cache-user1')).collection.length,173);
});
test('bei größerem Cloud-Bestand wird alter Cache ersetzt',async()=>{
 const remote=Array.from({length:173},(_,i)=>({setNumber:String(10000+i)}));
 const cached=remote.slice(0,166);const x=setup({remote,cached});
 await x.context.cloudSessionV3(x.session);
 assert.equal(x.context.state.collection.length,173);
 assert.equal(JSON.parse(x.store.get('cache-user1')).collection.length,173);
});
test('verspätete Antwort darf nach Abmeldung nicht laden',async()=>{
 const x=setup({defer:true});const old=x.context.cloudSessionV3(x.session);
 await x.context.cloudSessionV3(null);
 x.resolveFetch({data:{state:{collection:[{setNumber:'7622'}]}},error:null});
 await old;
 assert.equal(x.context.state.collection.length,0);
});
