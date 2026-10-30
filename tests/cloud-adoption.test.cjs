const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('collection-ops-v547.js','utf8').split('// Cloud adoption never writes the local collection back to the server.\n')[1].split('function renderSyncConflictV547()')[0];
function setup({quota=true,accept=true,revision='r1',readError=false,switchAccount=false,exportError=false,fullAfterCleanup=false}={}){
 const previous={collection:[{setNumber:'1',name:'local'}]},remote={collection:[{setNumber:'1',name:'cloud'}]};
 const storage=new Map([['backups:a','old'],['bcm-recovery-v559:a','old'],['cache:b','other account']]);
 const sync={revision:'r0',dirty:true,conflict:{remote,revision:'r1'}};let exported=0,removed=[],alerts=[];
 const c={cloudUserV3:{id:'a'},state:structuredClone(previous),JSON,structuredClone,window:{BrickSaveStatus:{set(){}}},
 readRemoteV547:async()=>{if(switchAccount)c.cloudUserV3.id='b';return {data:{state:remote,updated_at:revision},error:readError}},
 syncInfoV547:()=>sync,snapshotV544:()=>!quota,backupKeyV544:()=>'backups:a',cloudCacheKeyV3:u=>'cache:'+u,
 downloadValueV545:()=>{if(exportError)throw Error('export');exported++},confirm:()=>accept,alert:x=>alerts.push(x),
 localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>{if(fullAfterCleanup)throw Error('quota');storage.set(k,v)},removeItem:k=>{removed.push(k);storage.delete(k)}},
 applyCloudStateV547:x=>{c.state=structuredClone(x)},storeSyncV547:()=>{},refresh(){},renderSyncConflictV547(){},cloudStatusV3(){}
 };vm.createContext(c);vm.runInContext(source,c);
 return {c,sync,storage,previous,remote,alerts,removed,exports:()=>exported,run:()=>c.adoptCloudConflictV604('a',sync.conflict)};
}
test('quota recovery requires external backup confirmation and preserves other account',async()=>{const x=setup();assert.equal(await x.run(),true);assert.equal(x.exports(),1);assert.equal(x.storage.get('cache:b'),'other account');assert.deepEqual(x.removed,['backups:a','bcm-recovery-v559:a']);assert.equal(x.sync.conflict,null);assert.deepEqual(x.c.state,x.remote)});
test('declining export confirmation retains current state and backups',async()=>{const x=setup({accept:false});assert.equal(await x.run(),false);assert.deepEqual(x.c.state,x.previous);assert.equal(x.removed.length,0);assert.ok(x.sync.conflict)});
test('fresh remote revision refreshes conflict without adopting stale snapshot',async()=>{const x=setup({revision:'r2'});assert.equal(await x.run(),false);assert.equal(x.sync.conflict.revision,'r2');assert.deepEqual(x.c.state,x.previous);assert.equal(x.exports(),0)});
test('network failure and account switch cannot adopt',async()=>{for(const opts of [{readError:true},{switchAccount:true}]){const x=setup(opts);assert.equal(await x.run(),false);assert.deepEqual(x.c.state,x.previous);assert.equal(x.exports(),0)}});
test('failed export never cleans backups',async()=>{const x=setup({exportError:true});assert.equal(await x.run(),false);assert.equal(x.removed.length,0);assert.deepEqual(x.c.state,x.previous)});
test('persistent quota retains visible local state and unresolved conflict',async()=>{const x=setup({fullAfterCleanup:true});assert.equal(await x.run(),false);assert.deepEqual(x.c.state,x.previous);assert.ok(x.sync.conflict)});
test('normal adoption does not export or remove backups',async()=>{const x=setup({quota:false});assert.equal(await x.run(),true);assert.equal(x.exports(),0);assert.equal(x.removed.length,0)});
