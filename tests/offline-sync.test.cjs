const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({storage=new Map(),backend=new Map([['a',{state:{collection:[{setNumber:'990001',name:'Beispiel',condition:'Unbekannt'}],meta:{}},updated_at:'2026-10-30T10:00:00Z'}]])}={}){
 let clock=0,id=0,writes=0,readFails=false,verifyFails=false,quota=false;
 const timers=new Map(),listeners=new Map(),receipts=[];
 const c={state:{collection:[],meta:{}},cloudUserV3:null,cloudApplyingV3:false,cloudSaveTimerV3:null,
  navigator:{onLine:true},structuredClone,console,Date,JSON,Set,Map,
  window:{addEventListener:(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn]),BrickSaveStatus:{set:(status,message,user)=>receipts.push({status,message,user})}},
  document:{hidden:false,addEventListener:()=>{},querySelectorAll:()=>[]},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(quota)throw Object.assign(Error('quota'),{name:'QuotaExceededError'});storage.set(key,value)},removeItem:key=>storage.delete(key)},
  setTimeout:(fn,delay)=>{timers.set(++id,{fn,at:clock+delay});return id},clearTimeout:key=>timers.delete(key),
  persist:()=>{},persistBaseV3:()=>{},snapshotV544:()=>true,switchTab:()=>{},renderSyncConflictV547:()=>{},
  cloudSaveV3:async()=>{},cloudSessionV3:async()=>{},queueCloudSaveV3:()=>{},
  cloudCacheKeyV3:user=>'cache:'+user,cloudStatusV3:message=>c.message=message,
  workflowV546:{suspended:false},baselineV546:()=>{},blankStateV3:()=>({collection:[],meta:{}}),
  migrate:()=>{},migrateV3:()=>{},refresh:()=>{},updateAccountBadgeV3:()=>{},loadSubscriptionV544:async()=>{},deepLinkV545:()=>{},
  $:()=>null,cardV544:()=>null,
  cloudV3:{from(){let op='read',payload,owner,revision;const chain={
   select(){return chain},eq(key,value){if(key==='user_id')owner=value;if(key==='updated_at')revision=value;return chain},
   insert(value){op='insert';payload=value;owner=value.user_id;return chain},update(value){op='update';payload=value;return chain},
   async maybeSingle(){
    if(!c.navigator.onLine||readFails||(verifyFails&&writes>0&&op==='read'))return {error:{message:'network unavailable'}};
    const row=backend.get(owner);
    if(op!=='read'){
     if(op==='update'&&row?.updated_at!==revision)return {data:null,error:null};
     if(op==='insert'&&row)return {error:{code:'23505'}};
     writes++;backend.set(owner,structuredClone(payload));return {data:structuredClone(payload),error:null};
    }
    return {data:row?structuredClone(row):null,error:null};
   }
  };return chain}}
 };
 vm.createContext(c);
 const ops=fs.readFileSync('collection-ops-v547.js','utf8');vm.runInContext(ops.slice(0,ops.indexOf('function renderSyncConflictV547()')),c);
 vm.runInContext(fs.readFileSync('save-protection-v559.js','utf8'),c);
 return {c,storage,backend,receipts,writes:()=>writes,setReadFailure:value=>readFails=value,setVerifyFailure:value=>verifyFails=value,setQuota:value=>quota=value,
  async event(name){for(const fn of listeners.get(name)||[])await fn()},
  async advance(ms){clock+=ms;for(const [key,timer] of [...timers])if(timers.has(key)&&timer.at<=clock){timers.delete(key);await timer.fn()}},
  sync:()=>c.syncInfoV547(c.cloudUserV3.id)};
}
const session=user=>({user:{id:user,email:user+'@example.invalid'}});
test('offline edit survives reload and synchronizes after reconnect',async()=>{
 const first=setup();await first.c.cloudSessionV3(session('a'));
 first.c.navigator.onLine=false;first.c.state.collection[0].condition='Neu / OVP';first.c.persist();
 assert.equal((await first.c.cloudSaveV3(true)).status,'offline');assert.equal(first.writes(),0);
 const second=setup({storage:first.storage,backend:first.backend});second.c.navigator.onLine=false;
 await second.c.cloudSessionV3(session('a'));
 assert.equal(second.c.state.collection[0].condition,'Neu / OVP');
 second.c.navigator.onLine=true;await second.event('online');await second.advance(500);
 assert.equal(second.backend.get('a').state.collection[0].condition,'Neu / OVP');
 assert.equal(second.sync().dirty,false);assert.equal(second.receipts.at(-1).status,'confirmed');
});
test('failed verification remains pending and is never reported as confirmed',async()=>{
 const x=setup();await x.c.cloudSessionV3(session('a'));x.c.state.collection[0].name='Neu';x.c.persist();x.setVerifyFailure(true);
 assert.equal((await x.c.cloudSaveV3(true)).status,'error');assert.equal(x.sync().dirty,true);
 assert.notEqual(x.receipts.at(-1).status,'confirmed');
 x.setVerifyFailure(false);assert.equal((await x.c.cloudSaveV3(true)).status,'confirmed');
});
test('switching accounts never uploads another account pending copy',async()=>{
 const x=setup();await x.c.cloudSessionV3(session('a'));x.c.navigator.onLine=false;
 x.c.state.collection[0].name='Privat A';x.c.persist();await x.c.cloudSaveV3(true);
 await x.c.cloudSessionV3(session('b'));assert.equal(x.c.state.collection.length,0);
 x.c.navigator.onLine=true;await x.event('online');await x.advance(500);
 assert.equal(x.writes(),0);assert.equal(x.backend.has('b'),false);
 assert.equal(JSON.parse(x.storage.get('cache:a')).collection[0].name,'Privat A');
});
test('remote revision conflicts preserve the pending device copy',async()=>{
 const x=setup();await x.c.cloudSessionV3(session('a'));x.c.navigator.onLine=false;x.c.state.collection[0].name='Gerät';x.c.persist();
 x.backend.get('a').updated_at='2026-10-30T11:00:00Z';x.c.navigator.onLine=true;
 assert.equal((await x.c.cloudSaveV3(true)).status,'conflict');assert.equal(x.writes(),0);
 assert.equal(x.c.state.collection[0].name,'Gerät');assert.ok(x.sync().conflict);
});
test('storage quota does not produce a local-save success receipt',async()=>{
 const x=setup();await x.c.cloudSessionV3(session('a'));x.setQuota(true);
 assert.equal(x.c.persist(),false);assert.equal(x.receipts.at(-1).status,'storage-error');
});
