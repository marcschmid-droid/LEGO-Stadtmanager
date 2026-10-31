/* Stabilization preview only: read-only dashboard and collection UI. */
(function(){
 'use strict';
 function paint(){
  if(typeof state==='undefined'||!window.BrickCollectionMetrics)return;
  const m=window.BrickCollectionMetrics.metrics(state,typeof setValuationV603==='function'?setValuationV603:undefined);
  const fmt=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
  const show=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  show('kUnique',String(m.count));
  show('kValue',m.value===null?(m.partialValue===null?'Noch keine Bewertung':fmt(m.partialValue)):fmt(m.value));
  show('kValueCoverageV605',m.value===null?(m.pricedCopies+' von '+m.copies+' Exemplaren bewertet · Teilbetrag'):'Alle Exemplare bewertet');
  show('kCopiesV605',(m.count===1?'1 Set':m.count+' verschiedene Sets')+' · '+m.copies+(m.copies===1?' Exemplar':' Exemplare'));
  const missing=document.getElementById('missingValuesV605');
  if(missing){missing.hidden=!m.issues.length;missing.textContent=m.missingCopies+(m.missingCopies===1?' Exemplar prüfen →':' Exemplare prüfen →')}
  show('kInvest',m.investment===null?'Kaufpreise fehlen':fmt(m.investment));
  document.getElementById('kInvest')?.setAttribute('data-valuation-state',m.investment===null?'missing':'known');
  document.getElementById('kValue')?.setAttribute('data-valuation-state',m.value===null&&m.partialValue===null?'missing':'known');
  show('kGainPct',m.returnPct===null?'–':new Intl.NumberFormat('de-DE',{maximumFractionDigits:1}).format(m.returnPct)+' %');

 }
 const prevRefresh=refresh; refresh=function(...args){const r=prevRefresh.apply(this,args);queueMicrotask(paint);return r};
 const prevSwitch=switchTab;switchTab=function(...args){const r=prevSwitch.apply(this,args);queueMicrotask(paint);return r};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(paint,200));else setTimeout(paint,200);
})();
