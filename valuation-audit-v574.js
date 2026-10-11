/* v50.74: read-only valuation audit; zero prices are unknown, not automatically replaced. */
(function(){
 'use strict';
 const byId=id=>document.getElementById(id);
 const number=v=>v===null||v===undefined||String(v).trim()===''?null:(Number.isFinite(Number(v))?Number(v):null);
 const euro=v=>v===null?'–':new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(v);
 function audit(){
  const data=(typeof state!=='undefined'&&Array.isArray(state.collection))?state.collection:[];
  const rows=data.map(x=>{
   const current=number(x.currentValue),paid=number(x.purchasePrice);
   let reason='';
   if(current===null||current<=0)reason='Marktwert fehlt oder 0 €';
   else if(paid===null||paid<0)reason='Kaufpreis fehlt';
   else if(paid>0&&current>paid*8)reason='Wert auffällig hoch – prüfen';
   return {x,current,paid,reason};
  }).filter(row=>row.reason);
  return {total:data.length,rows};
 }
 function paint(){
  const panel=byId('collection');if(!panel)return;
  let section=byId('valueAuditV574');
  if(!section){
   section=document.createElement('section');section.id='valueAuditV574';section.className='card';
   const anchor=panel.querySelector('.toolbar');if(anchor)anchor.insertAdjacentElement('beforebegin',section);else panel.append(section);
  }
  const result=audit();
  section.replaceChildren();
  const summary=document.createElement('div');summary.className='valueAuditTopV574';
  const heading=document.createElement('strong');heading.textContent='Marktwerte prüfen';
  const tally=document.createElement('span');tally.textContent=result.rows.length+' auffällige von '+result.total+' Sets';
  const button=document.createElement('button');button.type='button';button.className='btn secondary';button.textContent='Prüfliste '+(section.dataset.expanded==='yes'?'schließen':'öffnen');
  button.onclick=()=>{section.dataset.expanded=section.dataset.expanded==='yes'?'no':'yes';paint()};
  summary.append(heading,tally,button);section.append(summary);
  if(section.dataset.expanded!=='yes')return;
  const note=document.createElement('p');note.className='hint';note.textContent='Nur Prüfung: Es werden keine gespeicherten Werte, Kaufpreise oder Cloud-Daten geändert. 0 € ist kein bestätigter Marktwert.';section.append(note);
  if(!result.rows.length){const ok=document.createElement('p');ok.textContent='Keine fehlenden oder auffälligen Werte anhand dieser Regeln gefunden.';section.append(ok);return}
  const list=document.createElement('div');list.className='valueAuditListV574';section.append(list);
  for(const {x,paid,current,reason} of result.rows){
   const entry=document.createElement('div');entry.className='valueAuditRowV574';
   const details=document.createElement('div');const title=document.createElement('strong');title.textContent=String(x.setNumber||'')+' · '+String(x.name||'Ohne Namen');
   const desc=document.createElement('small');desc.textContent=reason+' · Kauf '+euro(paid)+' · Wert '+euro(current);
   details.append(title,desc);
   const open=document.createElement('button');open.type='button';open.className='btn secondary';open.textContent='Set öffnen';open.onclick=()=>{if(typeof showDetailV3==='function')showDetailV3(String(x.setNumber))};
   entry.append(details,open);list.append(entry)
  }
 }
 const originalSwitch=switchTab;switchTab=function(...a){const out=originalSwitch.apply(this,a);if(a[0]==='collection')setTimeout(paint,80);return out};
 const originalRefresh=refresh;refresh=function(...a){const out=originalRefresh.apply(this,a);setTimeout(()=>{if(byId('collection')?.classList.contains('active'))paint()},0);return out};
 document.addEventListener('DOMContentLoaded',()=>{setTimeout(paint,350)});
})();
