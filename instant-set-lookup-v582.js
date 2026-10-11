/* v50.82 – immediate live metadata request on set-number lookup. No collection writes. */
(function(){
'use strict';
const previous=lookupSetOnlineV45, active=new Map(),fresh=new Map();
async function live(n){
 let client=typeof cloudV3!=='undefined'?cloudV3:null;
 if(!client)try{const c=window.LEGO_SUPABASE;if(window.supabase?.createClient&&c?.url&&c?.publishableKey)client=window.supabase.createClient(c.url,c.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}catch(_){}
 if(!client||!navigator.onLine)return null;
 try{
   const res=await Promise.race([
     client.functions.invoke('set-lookup',{method:'GET',headers:{},body:undefined,query:{set:n}}),
     new Promise(resolve=>setTimeout(()=>resolve({error:{message:'timeout'}}),6500))
   ]);
   if(res?.error||!res?.data?.name)return null;
   const d=res.data;
   return {rebrickableName:d.name,brickeconomyName:d.name,imageUrl:d.image_url||'',year:d.year||null,pieces:d.pieces||null,liveSourceV582:'Rebrickable'};
 }catch(_){return null}
}
lookupSetOnlineV45=async function(input){
 const n=String(input||'').trim().replace(/-1$/,'');
 if(!/^\d{4,7}$/.test(n))return null;
 if(active.has(n))return active.get(n);
 const job=(async()=>{
   const [catalog,updated]=await Promise.all([previous(n).catch(()=>null),live(n)]);
   if(updated){
     const result={...(catalog||{}),...Object.fromEntries(Object.entries(updated).filter(([k,v])=>v!==null&&v!==''))};
     return result;
   }
   return catalog;
 })();
 active.set(n,job);
 try{return await job}finally{active.delete(n)}
};
})();
