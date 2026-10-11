/* v50.83 – read-only integrity check, no automatic collection replacement. */
(function(){
 'use strict';
 const el=id=>document.getElementById(id);
 let running=false,lastUser='',lastChecked=0;
 function panel(){
  const root=el('collection');if(!root)return;
  let p=el('collectionIntegrityV583');
  if(!p){p=document.createElement('section');p.id='collectionIntegrityV583';p.setAttribute('role','status');p.style.cssText='padding:10px 12px;margin:10px 0;border:1px solid #d3d8df;border-radius:10px;font-size:13px';const bar=root.querySelector('.toolbar');if(bar)bar.insertAdjacentElement('beforebegin',p);else root.prepend(p)}
  return p;
 }
 async function check(force=false){
  const box=panel();if(!box)return;
  const local=typeof state!=='undefined'&&Array.isArray(state?.collection)?state.collection.length:0;
  const id=typeof cloudUserV3!=='undefined'?cloudUserV3?.id:null;
  if(!id||typeof cloudV3==='undefined'||!cloudV3){box.textContent='Sammlung: '+local+' Sets geladen · Cloud-Abgleich nur nach Anmeldung möglich.';return}
  if(running)return;
  if(!force&&lastUser===id&&Date.now()-lastChecked<90000)return;
  running=true;box.textContent='Sammlung: '+local+' Sets geladen · Cloud-Bestand wird geprüft…';
  try{
   const result=await cloudV3.from('user_state').select('state').eq('user_id',id).maybeSingle();
   if(cloudUserV3?.id!==id)return;
   if(result.error){box.textContent='Sammlung: '+local+' Sets · Cloud-Prüfung nicht möglich. Keine Daten verändert.';return}
   const remote=result.data?.state?.collection;
   if(!Array.isArray(remote)){box.textContent='Sammlung: '+local+' Sets · Cloud hat keinen lesbaren Sammlungsbestand. Keine Daten verändert.';return}
   const missing=remote.filter(x=>!(state?.collection||[]).some(y=>String(y.setNumber)===String(x.setNumber)));
   const diff=remote.length!==local||missing.length>0;
   box.textContent=diff?'ACHTUNG: Anzeige '+local+' Sets, Cloud '+remote.length+' Sets. '+missing.length+' Cloud-Sets fehlen lokal. Bitte nicht synchronisieren. Daten wurden nicht verändert.':'Bestand geprüft: '+local+' Sets in der App und '+remote.length+' Sets in der Cloud.';
   if(diff){box.style.borderColor='#b45309';box.style.fontWeight='600'}else{box.style.borderColor='#d3d8df';box.style.fontWeight='normal'}
  }catch(_){box.textContent='Cloud-Bestandsprüfung fehlgeschlagen · keine Änderungen vorgenommen.'}
  finally{lastUser=id;lastChecked=Date.now();running=false}
 }
 function start(){
  document.querySelectorAll('[data-tab="collection"]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>check(true),250)));
  check(true);
  // Read-only, throttled verification when returning to the collection.
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&el('collection')?.classList.contains('active'))check(false)});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
