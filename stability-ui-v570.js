/* Stabilization preview only: read-only dashboard and collection UI. */
(function(){
 'use strict';
 function paint(){
  if(typeof state==='undefined'||!window.BrickCollectionMetrics)return;
  const m=window.BrickCollectionMetrics.metrics(state);
  const fmt=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
  const show=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  show('kUnique',String(m.count));
  show('kValue',m.value===null?'Werte fehlen':fmt(m.value));
  show('kInvest',m.investment===null?'Kaufpreise fehlen':fmt(m.investment));
  show('kGainPct',m.returnPct===null?'–':new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(m.returnPct)+' %');
  const collection=document.getElementById('collection');
  if(collection?.classList.contains('active')){
    const grid=document.getElementById('collectionGrid');
    const list=collection.querySelector('.tablewrap');
    if(list)list.style.display='none';
    if(grid){grid.classList.remove('hidden');grid.style.display='grid'}
    if(grid && !grid.children.length && m.count){
      const notice=document.getElementById('collectionRenderWarningV570')||document.createElement('p');
      notice.id='collectionRenderWarningV570';
      notice.setAttribute('role','status');
      notice.textContent=m.count+' Sets gespeichert, aber die Anzeige konnte nicht aufgebaut werden. Bitte die Daten nicht erneut importieren.';
      grid.before(notice);
    } else document.getElementById('collectionRenderWarningV570')?.remove();
  }
 }
 const prevRefresh=refresh; refresh=function(...args){const r=prevRefresh.apply(this,args);queueMicrotask(paint);return r};
 const prevSwitch=switchTab;switchTab=function(...args){const r=prevSwitch.apply(this,args);queueMicrotask(paint);return r};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(paint,200));else setTimeout(paint,200);
})();
