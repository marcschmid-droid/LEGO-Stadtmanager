/* Collection guidance, account layout and opt-in updates. No automatic user-data writes. */
(function(){
 'use strict';
 const BUILD='605',byId=id=>document.getElementById(id);
 const button=(label,action)=>{const b=document.createElement('button');b.type='button';b.className='btn secondary';b.textContent=label;b.onclick=action;return b};
 function metrics(){return window.BrickCollectionMetrics.metrics(state,typeof setValuationV603==='function'?setValuationV603:undefined)}
 function missingValues(){
  let dialog=byId('missingDialogV605');if(dialog)dialog.remove();
  dialog=document.createElement('dialog');dialog.id='missingDialogV605';dialog.className='missingDialogV605';
  const h=document.createElement('h2');h.textContent='Fehlende Bewertungen';
  const p=document.createElement('p');p.textContent='Ergänze den tatsächlichen Zustand oder einen eigenen Marktwert. Bereits erfasste Angaben bleiben erhalten.';
  const close=button('Schließen',()=>dialog.close());dialog.append(h,p,close);
  const issues=metrics().issues;
  if(!issues.length){const text=document.createElement('p');text.textContent='Alle Exemplare sind bewertet.';dialog.append(text)}
  for(const issue of issues){
   const item=state.collection.find(x=>String(x.setNumber)===issue.setNumber);if(!item)continue;
   const row=document.createElement('div');row.className='missingRowV605';
   const text=document.createElement('span');text.textContent=item.setNumber+' · '+(item.name||'Set')+(issue.index===null?'':' · Exemplar '+(issue.index+1))+' — '+issue.reason;
   const edit=button('Bearbeiten',()=>{
    dialog.close();
    if(issue.index!==null&&item.exemplars?.[issue.index])window.editExemplarV28(issue.setNumber,issue.index);
    else openSet(item);
   });row.append(text,edit);dialog.append(row);
  }
  document.body.append(dialog);dialog.showModal();
 }
 function organizeAccount(){
  const panel=byId('users');if(!panel)return;
  const groups=[['accountBackupsV605','Sicherungen & Wiederherstellung',['saveProtectionV559']],['accountSharedV605','Gemeinsame Sammlungen',['sharedCollectionsV547']]];
  for(const [id,title,children] of groups){
   let group=byId(id);if(!group){group=document.createElement('details');group.id=id;group.className='accountGroupV605';const summary=document.createElement('summary');summary.textContent=title;group.append(summary);panel.append(group)}
   for(const childId of children){const child=byId(childId);if(child&&child.parentElement!==group)group.append(child)}
  }
  // Keep routine account and sync actions above advanced functions.
  const desired=['cloudAccountCard','planStatusV519','syncConflictV547','accountBackupsV605','accountSharedV605'];
  let previous=null;for(const id of desired){const el=byId(id);if(!el)continue;const expected=previous?previous.nextElementSibling:panel.firstElementChild;if(expected!==el)panel.insertBefore(el,expected||null);previous=el}
  const signedIn=byId('cloudSignedIn');
  if(signedIn&&!byId('accountDangerV605')){
   const danger=document.createElement('details');danger.id='accountDangerV605';danger.className='accountGroupV605';const summary=document.createElement('summary');summary.textContent='Konto & Daten löschen';danger.append(summary);
   for(const id of ['cloudDeleteData','cloudDeleteAccount']){const b=byId(id);if(b)danger.append(b)}signedIn.append(danger);
  }
 }
 let queued=false;
 function paint(){queued=false;organizeAccount();const b=byId('missingValuesV605');if(b)b.onclick=missingValues}
 function schedule(){if(!queued){queued=true;queueMicrotask(paint)}}
 let checking=false;
 async function checkUpdates(){
  if(checking||!navigator.onLine)return;checking=true;
  try{
   const response=await fetch('./release-version.json',{cache:'no-store'});if(!response.ok)return;
   const version=await response.json();if(!/^\d+$/.test(String(version.build))||Number(version.build)<=Number(BUILD))return;
   let bar=byId('updateNoticeV605');if(bar)return;
   bar=document.createElement('aside');bar.id='updateNoticeV605';bar.className='updateNoticeV605';
   const text=document.createElement('span');text.textContent='Eine neue Version ist verfügbar.';text.setAttribute('role','status');
   const reload=button('Sicher neu laden',()=>{
    if(document.querySelector('.modal.show')){alert('Bitte zuerst die offene Bearbeitung speichern oder schließen.');return}
    const user=typeof cloudUserV3!=='undefined'?cloudUserV3?.id:null;
    const sync=user&&typeof syncInfoV547==='function'?syncInfoV547(user):null;
    if(sync?.dirty||sync?.conflict){
     try{downloadValueV545(JSON.stringify({local:state,remote:sync.conflict?.remote||null},null,2),'Brick-City-vor-Update.json','application/json')}
     catch(_){alert('Die Sicherung konnte nicht exportiert werden. Bitte zuerst synchronisieren.');return}
     if(!confirm('Es gibt unbestätigte Änderungen. Speichere die exportierte Datei unter Dateien. Ist die Sicherung dort gespeichert und möchtest du jetzt neu laden?'))return;
    }
    const url=new URL(location.href);url.searchParams.set('update',String(version.build));location.replace(url.href);
   });bar.append(text,reload);const header=document.querySelector('body > header');if(header)header.insertAdjacentElement('afterend',bar);else document.body.prepend(bar);
  }catch(_){/* Offline or unavailable release metadata never interrupts collecting. */}finally{checking=false}
 }
 function init(){
  const oldRefresh=refresh;refresh=function(...args){const result=oldRefresh.apply(this,args);schedule();return result};
  const oldSwitch=switchTab;switchTab=function(...args){const result=oldSwitch.apply(this,args);schedule();return result};
  const panel=byId('users');if(panel)new MutationObserver(schedule).observe(panel,{childList:true});
  paint();checkUpdates();setInterval(checkUpdates,300000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkUpdates()});window.addEventListener('online',checkUpdates);
  const about=byId('aboutAppV599');if(about&&!byId('buildV605')){const small=document.createElement('p');small.id='buildV605';small.className='hint';small.textContent='Aktualisierungsstand '+BUILD;about.append(small)}
 }
 window.BrickExperienceV605={checkUpdates,missingValues};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
