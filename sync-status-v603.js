/* A visible save receipt. Only the verified cloud path may report confirmation. */
(function(){
 'use strict';
 let receipt={status:'loading',message:'Cloud wird geprüft…',user:null};
 const owner=()=>typeof cloudUserV3!=='undefined'?cloudUserV3?.id||null:null;
 function paint(){
  let bar=document.getElementById('saveStatusV603');
  if(!bar){
   bar=document.createElement('aside');bar.id='saveStatusV603';bar.className='saveStatusV603';
   const text=document.createElement('span');text.id='saveStatusTextV603';text.setAttribute('role','status');text.setAttribute('aria-live','polite');text.setAttribute('aria-atomic','true');
   const retry=document.createElement('button');retry.type='button';retry.id='retrySaveV603';retry.className='btn secondary';retry.textContent='Erneut versuchen';
   retry.onclick=async()=>{
    if(['conflict','storage-error'].includes(receipt.status)){
     if(typeof switchTab==='function')switchTab('users');
     const target=document.getElementById(receipt.status==='conflict'?'syncConflictV547':'saveProtectionV559');
     if(target){const group=target.closest('details');if(group)group.open=true;target.scrollIntoView({block:'start',behavior:'smooth'})}return;
    }
    if(typeof cloudSaveV3!=='function')return;retry.disabled=true;try{await cloudSaveV3(true)}finally{retry.disabled=false}};
   bar.append(text,retry);const header=document.querySelector('body > header');if(header)header.insertAdjacentElement('afterend',bar);else document.body.prepend(bar);
  }
  bar.dataset.status=receipt.status;
  const text=bar.querySelector('span');if(text.textContent!==receipt.message)text.textContent=receipt.message;
  bar.querySelector('button').textContent=receipt.status==='conflict'?'Konflikt prüfen':receipt.status==='storage-error'?'Speicher prüfen':'Erneut versuchen';
  bar.querySelector('button').hidden=!owner()||!navigator.onLine||!['error','pending','storage-error','conflict'].includes(receipt.status);
 }
 function set(status,message,user=owner()){
  if(user!==owner())return;
  receipt={status,message,user};if(document.body)paint();
 }
 window.BrickSaveStatus={set,get:()=>({...receipt})};
 window.addEventListener('offline',()=>set('offline','Offline · Cloud nicht erreichbar.'));
 window.addEventListener('online',()=>{if(owner())set('pending','Verbindung wieder da · ausstehende Änderungen werden geprüft.')});
 document.addEventListener('DOMContentLoaded',paint);
})();
