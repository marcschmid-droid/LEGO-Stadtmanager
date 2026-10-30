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
   retry.onclick=async()=>{if(typeof cloudSaveV3!=='function')return;retry.disabled=true;try{await cloudSaveV3(true)}finally{retry.disabled=false}};
   bar.append(text,retry);const header=document.querySelector('body > header');if(header)header.insertAdjacentElement('afterend',bar);else document.body.prepend(bar);
  }
  bar.dataset.status=receipt.status;
  const text=bar.querySelector('span');if(text.textContent!==receipt.message)text.textContent=receipt.message;
  bar.querySelector('button').hidden=!owner()||!navigator.onLine||!['error','pending','storage-error'].includes(receipt.status);
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
