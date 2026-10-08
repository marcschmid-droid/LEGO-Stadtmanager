/* Brick City Manager v50.44 — daily reliability and planning */
const reliabilityV544={backupError:'',subscription:null,subscriptionUser:null,importRows:[],importUser:null};
function ownerV544(){return cloudUserV3?.id||'local'}
function backupKeyV544(){return 'brick-city-backups-v544-'+ownerV544()}
const backupCacheV544=new Map();
function backupRowsV544(){
 const key=backupKeyV544(),raw=localStorage.getItem(key)||'[]',cached=backupCacheV544.get(key);
 if(cached?.raw===raw)return cached.rows;
 try{const rows=JSON.parse(raw);backupCacheV544.set(key,{raw,rows});return rows}catch{return []}
}
function snapshotV544(reason='Automatische Sicherung',force=false){
 if(cloudApplyingV3)return false;
 const rows=[...backupRowsV544()],now=Date.now();
 if(!force&&rows.length&&now-Date.parse(rows[0].createdAt)<900000)return true;
 try{
  rows.unshift({createdAt:new Date(now).toISOString(),reason,state:structuredClone(state)});
  localStorage.setItem(backupKeyV544(),JSON.stringify(rows.slice(0,5)));
  reliabilityV544.backupError='';return true;
 }catch{reliabilityV544.backupError='Sicherung fehlgeschlagen: Gerätespeicher voll. Bitte eine Datei exportieren.';return false}
}
function validStateV544(s){return !!s&&Array.isArray(s.collection)&&Array.isArray(s.wishlist)&&s.collection.every(x=>x&&/^\d{4,7}(?:-\d+)?$/.test(String(x.setNumber))&&Number.isFinite(Number(x.quantity))&&Number(x.quantity)>0)}
function downloadBackupV544(){
 const blob=new Blob([JSON.stringify({version:'50.44',createdAt:new Date().toISOString(),state},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Brick-City-Backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function restoreBackupV544(s){
 if(!validStateV544(s))return alert('Ungültige Sicherungsdatei. Die Sammlung wurde nicht verändert.');
 if(!confirm('Sammlung durch diese Sicherung ersetzen? Zuvor wird der aktuelle Stand gesichert.'))return;
 if(!snapshotV544('Vor Wiederherstellung',true))return alert(reliabilityV544.backupError);
 state=structuredClone(s);migrate();migrateV3();persist();refresh();renderReliabilityV544();
}
function cardV544(panel,id,title){
 let box=$(id);if(box)return box;
 if(!$(panel))return null;
 box=document.createElement('div');box.id=id;box.className='card wide reliabilityV544';
 box.innerHTML='<h2>'+esc(title)+'</h2>';$(panel).prepend(box);return box;
}
function renderBackupsV544(){
 const box=cardV544('settings','backupsV544','Sicherung & Wiederherstellung');if(!box)return;
 const rows=backupRowsV544();
 box.innerHTML='<h2>Sicherung & Wiederherstellung</h2><p class="hint">Fünf lokale Wiederherstellungspunkte pro Konto. Automatisch bei Änderungen, höchstens alle 15 Minuten. Für eine unabhängige Sicherung exportiere eine Datei.</p><div class="actions"><button class="btn" id="backupNowV544">Jetzt sichern</button><button class="btn secondary" id="backupExportV544">Datei exportieren</button><label class="btn secondary">Datei wiederherstellen<input id="backupFileV544" type="file" accept=".json,application/json" hidden></label></div><p role="status">'+esc(reliabilityV544.backupError||(!navigator.onLine?'Offline · Änderungen werden lokal gespeichert.':'Online · Cloud-Status im Konto prüfen.'))+'</p><div class="backupRowsV544">'+rows.map((r,i)=>'<div><span>'+esc(new Date(r.createdAt).toLocaleString('de-DE')+' · '+r.reason)+'</span><button class="btn secondary" data-backup-v544="'+i+'">Wiederherstellen</button></div>').join('')+'</div>';
 $('backupNowV544').onclick=()=>{snapshotV544('Manuell',true);renderBackupsV544()};$('backupExportV544').onclick=downloadBackupV544;
 box.querySelectorAll('[data-backup-v544]').forEach(b=>b.onclick=()=>restoreBackupV544(rows[Number(b.dataset.backupV544)].state));
 $('backupFileV544').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());restoreBackupV544(data.state||data)}catch{alert('Datei konnte nicht gelesen werden.')}};
}
const persistBeforeV544=persist;
persist=function(){const r=persistBeforeV544();snapshotV544();return r};
// Always show success/failure, including automatic saves. Keep status scoped to the account.
cloudSaveV3=async function(show=false){
 const user=cloudUserV3?.id;if(!user||!cloudV3||cloudApplyingV3)return;
 cloudStatusV3(navigator.onLine?'Synchronisierung läuft…':'Offline · lokal gespeichert');
 try{
  const copy=structuredClone(state);
  localStorage.setItem(cloudCacheKeyV3(user),JSON.stringify(copy));
  if(!navigator.onLine)return;
  const {error}=await cloudV3.from('user_state').upsert({user_id:user,state:copy,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(cloudUserV3?.id===user)cloudStatusV3(error?'Synchronisierung fehlgeschlagen: '+error.message:'Synchronisiert: '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));
 }catch{if(cloudUserV3?.id===user)cloudStatusV3('Cloud nicht erreichbar · lokale Speicherung bitte prüfen. Erneut synchronisieren oder Datei exportieren.')}
};

function layoutStatsV544(modules,collection=state.collection){
 const known=new Set(collection.map(x=>String(x.setNumber))),used=new Set(),conflicts=[],unknown=[];
 for(const [m,ns] of Object.entries(modules||{})){
  const nums=[...new Set((Array.isArray(ns)?ns:[]).map(String))];
  if(nums.length)used.add(m);
  if(nums.length>1)conflicts.push(m);
  for(const n of nums)if(!known.has(n))unknown.push(n);
 }
 const assigned=new Set(Object.values(modules||{}).flat().map(String));
 const short=collection.filter(x=>assigned.has(String(x.setNumber))&&moduleNeedV528(x).known&&Object.values(modules).filter(a=>a.map(String).includes(String(x.setNumber))).length<moduleNeedV528(x).count);
 return {occupied:used.size,total:Object.keys(modules||{}).length,free:Object.keys(modules||{}).filter(m=>!used.has(m)),conflicts,unknown:[...new Set(unknown)],short};
}
function saveLayoutV544(){
 const name=$('layoutNameV544').value.trim();if(!name)return alert('Bitte einen Namen für die Variante eingeben.');
 state.meta=state.meta||{};state.meta.layoutsV544=state.meta.layoutsV544||[];
 if(state.meta.layoutsV544.length>=10)return alert('Maximal zehn Varianten. Lösche zuerst eine ältere Variante.');
 state.meta.layoutsV544.push({id:crypto.randomUUID(),name,createdAt:new Date().toISOString(),modules:structuredClone(state.modules||{}),instances:structuredClone(state.meta.instanceModulesV536||{}),sets:state.collection.map(x=>({setNumber:x.setNumber,module:x.module||'',modules:x.modules||[]}))});
 persist();renderLayoutsV544();
}
function restoreLayoutV544(id){
 const l=state.meta?.layoutsV544?.find(x=>x.id===id);if(!l)return;
 if(!confirm('Variante „'+l.name+'“ übernehmen? Der aktuelle Plan wird vorher gesichert.'))return;
 if(!snapshotV544('Vor Planwechsel',true))return alert(reliabilityV544.backupError);
 state.modules=structuredClone(l.modules);state.meta.instanceModulesV536=structuredClone(l.instances||{});
 for(const x of state.collection){const saved=l.sets.find(s=>String(s.setNumber)===String(x.setNumber));x.module=saved?.module||'';x.modules=structuredClone(saved?.modules||[])}
 persist();refresh();renderLayoutsV544();
}
function renderLayoutsV544(){
 const box=cardV544('city','layoutsV544','Stadtplanvarianten & Platzprüfung');if(!box)return;
 const s=layoutStatsV544(state.modules),layouts=state.meta?.layoutsV544||[];
 box.innerHTML='<h2>Stadtplanvarianten & Platzprüfung</h2><p><b>'+s.free.length+' freie Module</b> · '+s.occupied+' belegt · '+s.conflicts.length+' Mehrfachbelegungen · '+s.short.length+' Sets mit zu wenig Modulen</p><p class="hint">Mehrfachbelegungen sind mögliche Platzkonflikte. Die Prüfung erfolgt auf Modulebene; exakte geometrische Kollisionen benötigen verlässliche Stellflächen und Positionen.</p>'+(s.conflicts.length?'<p>Mehrfach belegt: '+esc(s.conflicts.join(', '))+'</p>':'')+(s.short.length?'<p>Platzbedarf prüfen: '+esc(s.short.map(x=>x.setNumber).join(', '))+'</p>':'')+'<details><summary>Freie Module anzeigen</summary><p>'+esc(s.free.join(', ')||'Keine')+'</p></details><div class="actions"><input id="layoutNameV544" maxlength="60" placeholder="Name der Variante" aria-label="Name der Stadtplanvariante"><button class="btn" id="layoutSaveV544">Plan speichern</button></div><div class="tablewrap"><table><thead><tr><th>Variante</th><th>Belegt</th><th>Frei</th><th>Mehrfach belegt</th><th>Aktion</th></tr></thead><tbody>'+layouts.map(l=>{const t=layoutStatsV544(l.modules);return '<tr><td>'+esc(l.name)+'</td><td>'+t.occupied+'</td><td>'+t.free.length+'</td><td>'+t.conflicts.length+'</td><td><button class="btn secondary" data-layout-v544="'+esc(l.id)+'">Übernehmen</button> <button class="btn secondary" data-delete-layout-v544="'+esc(l.id)+'">Löschen</button></td></tr>'}).join('')+'</tbody></table></div>';
 $('layoutSaveV544').onclick=saveLayoutV544;
 box.querySelectorAll('[data-layout-v544]').forEach(b=>b.onclick=()=>restoreLayoutV544(b.dataset.layoutV544));
 box.querySelectorAll('[data-delete-layout-v544]').forEach(b=>b.onclick=()=>{if(!confirm('Gespeicherte Variante löschen?'))return;state.meta.layoutsV544=layouts.filter(l=>l.id!==b.dataset.deleteLayoutV544);persist();renderLayoutsV544()});
}

function parseNumbersV544(text){
 const tokens=text.trim().split(/[\s,;]+/).filter(Boolean),counts=new Map(),invalid=[];
 for(const token of tokens){const n=token.replace(/-1$/,'');if(!/^\d{4,7}$/.test(n)){invalid.push(token);continue}counts.set(n,(counts.get(n)||0)+1)}
 return {counts,invalid};
}
async function previewImportV544(){
 const parsed=parseNumbersV544($('bulkNumbersV544').value),out=$('bulkPreviewV544'),btn=$('bulkPreviewButtonV544');
 if(parsed.invalid.length){out.textContent='Ungültige Eingaben: '+parsed.invalid.join(', ');reliabilityV544.importRows=[];return}
 if(!parsed.counts.size||parsed.counts.size>100){out.textContent='Bitte 1 bis 100 unterschiedliche Setnummern eingeben.';return}
 const user=ownerV544();reliabilityV544.importUser=user;reliabilityV544.importRows=[];btn.disabled=true;out.textContent='Setdaten werden geladen…';
 try{
 const all=await loadAllSetsV46(false),rows=[];
 for(const [n,qty] of parsed.counts){
  const existing=state.collection.find(x=>String(x.setNumber)===n),e=enrichmentV3?.sets?.[n]||allSetLegacyV46(n,all?.sets?.[n]);
  rows.push({n,qty,existing:!!existing,e,name:existing?.name||e?.brickeconomyName||e?.rebrickableName||'',found:!!existing||!!e});
 }
 if(ownerV544()!==user)return;
 reliabilityV544.importRows=rows;
 out.innerHTML='<div class="tablewrap"><table><thead><tr><th>Set</th><th>Anzahl</th><th>Ergebnis</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.n+' · '+(r.name||'Unbekannt'))+'</td><td>'+r.qty+'</td><td>'+esc(r.existing?'Bereits vorhanden · wird übersprungen':r.found?'Neues Set':'Nicht erkannt · wird übersprungen')+'</td></tr>').join('')+'</tbody></table></div><p class="hint">Wiederholte Nummern werden als mehrere Exemplare zusammengefasst. Kaufpreise bleiben unbekannt.</p><button class="btn" id="bulkApplyV544">Erkannte neue Sets übernehmen</button>';
 $('bulkApplyV544').onclick=applyImportV544;
 }catch{out.textContent='Katalog nicht erreichbar. Bitte später erneut versuchen.'}finally{btn.disabled=false}
}
function applyImportV544(){
 if(reliabilityV544.importUser!==ownerV544())return alert('Konto gewechselt. Bitte eine neue Vorschau erstellen.');
 const rows=reliabilityV544.importRows.filter(r=>r.found&&!state.collection.some(x=>String(x.setNumber)===r.n));
 if(!rows.length)return alert('Keine neuen erkannten Sets vorhanden.');
 const info=planInfoV519();if(Number.isFinite(info.limit)&&state.collection.length+rows.length>info.limit)return openPlanLimitV519();
 if(!snapshotV544('Vor Mehrfachimport',true))return alert(reliabilityV544.backupError);
 for(const r of rows){const e=r.e||{};state.collection.push({setNumber:r.n,name:r.name,quantity:r.qty,purchasePrice:0,currentValue:0,imageUrl:e.imageUrl||'',category:[e.theme,e.subtheme].filter(Boolean).join(' / '),condition:'Unbekannt',buildStatus:'Unbekannt',exemplars:[],market:e})}
 reliabilityV544.importRows=[];migrateV3();persist();refresh();$('bulkPreviewV544').textContent=rows.length+' neue Sets übernommen. Kaufpreis und Zustand bitte ergänzen.';
}
function renderImportV544(){
 const box=cardV544('collection','bulkImportV544','Mehrere Sets erfassen');if(!box||box.dataset.ready)return;box.dataset.ready='1';
 box.innerHTML='<details><summary>Mehrere Sets mit Vorschau erfassen</summary><p class="hint">Setnummern durch Leerzeichen, Komma oder neue Zeilen trennen. Vorhandene Sets werden übersprungen.</p><textarea id="bulkNumbersV544" rows="3" placeholder="10326, 10255, 21310" aria-label="Setnummern für Mehrfachimport"></textarea><button class="btn" id="bulkPreviewButtonV544">Vorschau erstellen</button><div id="bulkPreviewV544" role="status"></div></details>';
 $('bulkPreviewButtonV544').onclick=previewImportV544;
}
// Local lookup first; one shared enrichment fetch replaces one download per missing set.
const lookupBeforeV544=lookupSetOnlineV45;
lookupSetOnlineV45=async function(n){n=String(n||'').trim().replace(/-1$/,'');return enrichmentV3?.sets?.[n]||allSetLegacyV46(n,allSetsV46?.sets?.[n])||await lookupBeforeV544(n)};
const detailBeforeV544=detailTabsV38;
detailTabsV38=function(n){const r=detailBeforeV544(n),x=state.collection.find(x=>String(x.setNumber)===String(n));if(!x)return r;
 const root=$('detailContent');if(!root)return r;
 root.querySelector('#valueTransparencyV544')?.remove();const e=enrichmentForV536(x),sources=quoteSourcesV536(x),dates=sources.map(s=>s.updated).filter(Boolean),box=document.createElement('div');box.id='valueTransparencyV544';box.className='card wide';
 box.innerHTML='<h3>Bewertungsgrundlage</h3><p><b>Schätzwert, kein garantierter Verkaufspreis.</b></p><p>Zustand: '+esc(x.condition||'Unbekannt')+' · Originalkarton: '+esc(x.box||x.exemplars?.[0]?.box||'Unbekannt')+'</p><p>Datenstand: '+esc(dates.join(' · ')||e.updatedAt||e.updated_at||'Nicht bekannt')+'</p><p class="hint">Die vorhandene Bewertungsmethode bleibt erhalten. Ein unbekannter Zustand oder Datenstand verringert die Aussagekraft.</p>';root.appendChild(box);return r;
};
function freeBlockV544(x){
 const need=moduleNeedV528(x);if(!need.known)return null;
 if(need.count===1){const m=layoutStatsV544(state.modules).free[0];return m?{modules:[m]}:null}
 return findModuleBlockV531(x);
}
function renderWishFitV544(){
 const box=cardV544('wishlist','wishFitV544','Wunschliste & Stadtfläche');if(!box)return;
 box.innerHTML='<h2>Wunschliste & Stadtfläche</h2><p class="hint">Prüft zusammenhängende freie Modulblöcke anhand bekannter Stellflächen. Fehlende Maße erlauben keine sichere Platzzusage.</p>'+state.wishlist.map(w=>{const e=enrichmentV3?.sets?.[w.setNumber]||{},x={...e,...w},need=moduleNeedV528(x),owned=state.collection.some(y=>String(y.setNumber)===String(w.setNumber)),block=need.known?freeBlockV544(x):null;return '<p><b>'+esc(w.setNumber+' · '+w.name)+'</b><br>'+esc(owned?'Bereits in deiner Sammlung':!need.known?'Stellfläche unbekannt':block?'Passender freier Block: '+block.modules.join(', '):'Kein passender freier Block gefunden')+'</p>'}).join('');
}
function renderGettingStartedV544(){
 const box=cardV544('home','gettingStartedV544','Deine nächsten Schritte');if(!box)return;
 const steps=[['collection','Sammlung erfassen',state.collection.length>0],['collector','Serienfortschritt ansehen',!!state.meta?.visitedCollectorV544],['city','Erstes Set einplanen',state.collection.some(x=>Object.values(state.modules||{}).some(a=>a.map(String).includes(String(x.setNumber))))]];
 box.innerHTML='<h2>Deine nächsten Schritte</h2><div class="actions">'+steps.map(([tab,label,done])=>'<button class="btn secondary" data-step-v544="'+tab+'">'+(done?'✓ ':'')+label+'</button>').join('')+'</div>';
 box.hidden=steps.every(s=>s[2]);box.querySelectorAll('[data-step-v544]').forEach(b=>b.onclick=()=>switchTab(b.dataset.stepV544));
}
function billingChecksV544(){
 const cfg=window.BRICK_BILLING||{},valid=u=>{try{return new URL(u).protocol==='https:'}catch{return false}};
 return [ ['Anmeldung',!!cloudUserV3],['Vier Zahlungslinks',['collector','pro'].every(k=>['monthly','yearly'].every(p=>valid(cfg[k]?.[p]?.paymentLink)))],['Kundenportal für Tarifwechsel und Kündigung',valid(cfg.customerPortal)],['Tarif vom Server geladen',reliabilityV544.subscriptionUser===cloudUserV3?.id&&!!cloudUserV3],['Automatische Freischaltung nach Zahlung',false] ];
}
async function loadSubscriptionV544(){
 const user=cloudUserV3?.id;reliabilityV544.subscription=null;reliabilityV544.subscriptionUser=null;if(!user||!cloudV3){renderBillingV544();return}
 try{const {data,error}=await cloudV3.rpc('my_subscription');if(cloudUserV3?.id!==user)return;if(!error){reliabilityV544.subscription=Array.isArray(data)?data[0]||null:data;reliabilityV544.subscriptionUser=user;renderPlanStatusV519()}}catch{}
 renderBillingV544();
}
function renderBillingV544(){
 const box=cardV544('plans','billingReadinessV544','Abo & Freischaltung');if(!box)return;
 const checks=billingChecksV544(),sub=reliabilityV544.subscription;
 box.innerHTML='<h2>Abo & Freischaltung</h2><p>'+esc(sub?'Serverstatus: '+sub.status+' · Tarif: '+sub.plan:'Noch kein bestätigtes Abo vom Server geladen.')+'</p>'+checks.map(([label,ok])=>'<p>'+(ok?'✓ ':'○ ')+esc(label)+'</p>').join('')+'<p class="hint">Zahlungslinks, Kundenportal und Webhook für Verlängerung, fehlgeschlagene Zahlung und Kündigung müssen konfiguriert werden. Erst dann ist ein vollständiger Zahlungstest möglich.</p><div class="actions"><button class="btn secondary" id="billingReloadV544">Tarifstatus aktualisieren</button><button class="btn secondary" id="billingPortalV544">Abo verwalten / kündigen</button></div>';
 $('billingReloadV544').onclick=loadSubscriptionV544;$('billingPortalV544').disabled=!checks[2][1];$('billingPortalV544').onclick=()=>{if(checks[2][1])location.href=window.BRICK_BILLING.customerPortal};
}
// Confirmed server subscriptions take precedence; existing trial/local behavior remains while server setup is pending.
const planBeforeV544=planKeyV519;
planKeyV519=function(){if(reliabilityV544.subscriptionUser===cloudUserV3?.id&&cloudUserV3){const s=reliabilityV544.subscription;return s&&['active','trialing'].includes(s.status)&&['basic','premium'].includes(s.plan)?s.plan:'free'}return planBeforeV544()};
function renderReliabilityV544(){
 if($('settings')?.classList.contains('active'))renderBackupsV544();
 if($('city')?.classList.contains('active'))renderLayoutsV544();
 if($('collection')?.classList.contains('active'))renderImportV544();
 if($('wishlist')?.classList.contains('active'))renderWishFitV544();
 if($('home')?.classList.contains('active'))renderGettingStartedV544();
 if($('plans')?.classList.contains('active'))renderBillingV544();
 document.querySelectorAll('#collection img,#wishlist img').forEach(i=>{i.loading='lazy';i.decoding='async'});
}
const refreshBeforeV544=refresh;refresh=function(){const r=refreshBeforeV544();renderReliabilityV544();return r};
const tabBeforeV544=switchTab;switchTab=function(id){const r=tabBeforeV544(id);if(id==='collector'){state.meta=state.meta||{};if(!state.meta.visitedCollectorV544){state.meta.visitedCollectorV544=true;persist()}}if(id==='plans')loadSubscriptionV544();renderReliabilityV544();return r};
const sessionBeforeV544=cloudSessionV3;cloudSessionV3=async function(s){reliabilityV544.importRows=[];reliabilityV544.subscription=null;reliabilityV544.subscriptionUser=null;const r=await sessionBeforeV544(s);await loadSubscriptionV544();renderReliabilityV544();return r};
window.addEventListener('online',()=>{cloudSaveV3(true);renderBackupsV544()});window.addEventListener('offline',()=>{cloudStatusV3('Offline · Änderungen werden lokal gespeichert.');renderBackupsV544()});
setTimeout(()=>{snapshotV544('Startstand');renderReliabilityV544();if($('appVersion'))$('appVersion').textContent='v50.46'},400);
