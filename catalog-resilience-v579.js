/* v50.79 - resilient read-only set lookup: local catalog first, cloud optional.
   Does not mutate existing collections or manufacture market prices. */
(function(){
'use strict';
const oldLookup=lookupSetOnlineV45;
const jobs=new Map();
function clean(value){return String(value||'').trim().replace(/-1$/,'')}
function lookupLocal(n){
 try{const row=typeof enrichmentV3!=='undefined'&&enrichmentV3?.sets?.[n];if(row)return {...row,sourceV579:'local-prices'}}catch(_){}
 try{const row=typeof allSetsV46!=='undefined'&&allSetsV46?.sets?.[n];if(row)return {...allSetLegacyV46(n,row),sourceV579:'full-index'}}catch(_){}
 return null;
}
async function online(n){
 let client=typeof cloudV3!=='undefined'?cloudV3:null;
 if(!client){
  const cfg=window.LEGO_SUPABASE;
  try{if(cfg?.url&&cfg?.publishableKey&&window.supabase?.createClient)client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}catch(_){}
 }
 if(!client||!navigator.onLine)return null;
 try{
  const {data,error}=await Promise.race([
   client.from('catalog_sets').select('*').eq('set_number',n).maybeSingle(),
   new Promise(resolve=>setTimeout(()=>resolve({data:null,error:{message:'timeout'}}),4500))
  ]);
  if(data&&!error&&typeof catalogRowToLegacyV45==='function')return {...catalogRowToLegacyV45(data),sourceV579:'cloud'};
 }catch(_){}
 return null;
}
async function completeCatalog(n){
 try{
  const catalog=await loadAllSetsV46(false);
  if(catalog?.sets?.[n])return {...allSetLegacyV46(n,catalog.sets[n]),sourceV579:'full-index'};
 }catch(_){}
 return null;
}
lookupSetOnlineV45=async function(input){
 const n=clean(input);if(!/^\d{4,7}$/.test(n))return null;
 const local=lookupLocal(n);
 if(jobs.has(n))return jobs.get(n);
 const task=(async()=>{
  const [full,remote]=await Promise.all([completeCatalog(n),online(n)]);
  // Prefer authenticated or independent cloud pricing when available, but always retain full catalog metadata.
  const metadata=local||full;
  if(remote&&metadata)return {...metadata,...Object.fromEntries(Object.entries(remote).filter(([k,v])=>v!==null&&v!==undefined&&v!=='')),sourceV579:'full+cloud'};
  if(remote)return remote;
  if(metadata)return metadata;
  try{return await oldLookup(n)}catch(_){return null}
 })();
 jobs.set(n,task);
 try{return await task}finally{jobs.delete(n)}
};
})();
