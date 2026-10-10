/* v50.69: read-only UI repair. Do not mutate collection, cloud, backups or filters. */
(function(){
 'use strict';
 function refreshNumbers(){
   if(typeof state==='undefined'||!Array.isArray(state.collection))return;
   const records=state.collection;
   const text=(id,v)=>{const node=document.getElementById(id);if(node)node.textContent=v};
   text('kUnique',String(records.length));
   if(typeof totalsV3!=='function'||typeof euro!=='function')return;
   const totals=totalsV3();
   const hasVal=records.some(x=>Number(x.currentValue)>0);
   const hasInvest=Number(totals.inv)>0;
   text('kValue',hasVal?euro(totals.val):'Nicht erfasst');
   text('kInvest',hasInvest?euro(totals.inv):'Nicht erfasst');
   text('kGainPct',hasVal&&hasInvest&&Number.isFinite(totals.pct)?totals.pct.toFixed(1).replace('.',',')+' %':'–');
 }
 function fixCollection(){
   const panel=document.getElementById('collection');
   if(!panel?.classList.contains('active'))return;
   const grid=document.getElementById('collectionGrid');
   const table=panel.querySelector('.tablewrap');
   if(grid){grid.classList.remove('hidden');grid.style.display='grid'}
   if(table){table.classList.remove('showCompactV538');table.style.display='none'}
   // Render only if the grid is empty; do not repeatedly rebuild images.
   if(grid&&!grid.children.length&&typeof renderCollection==='function'){
     try{renderCollection()}catch(e){console.error('Sammlung konnte nicht angezeigt werden',e)}
   }
 }
 function apply(){refreshNumbers();fixCollection()}
 const prevSwitch=switchTab;
 switchTab=function(...args){const out=prevSwitch.apply(this,args);setTimeout(apply,0);return out};
 const prevRefresh=refresh;
 refresh=function(...args){const out=prevRefresh.apply(this,args);setTimeout(apply,0);return out};
 document.addEventListener('DOMContentLoaded',()=>{setTimeout(apply,250);setTimeout(apply,1800)});
 if(document.readyState!=='loading'){setTimeout(apply,250);setTimeout(apply,1800)}
})();
