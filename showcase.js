(function(){
'use strict';
const model=window.BrickShowcase;
function cards(host,sets){host.replaceChildren();for(const set of sets){const card=document.createElement('figure');card.className='showcaseCard';const picture=document.createElement('div');picture.className='picture';picture.textContent='Kein öffentliches Bild';if(set.imageUrl){const img=document.createElement('img');img.src=set.imageUrl;img.alt='Set '+set.setNumber;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();picture.append(img)}const caption=document.createElement('figcaption'),number=document.createElement('small'),name=document.createElement('strong');number.textContent='#'+set.setNumber;name.textContent=set.name;caption.append(number,name);card.append(picture,caption);host.append(card)}}
function publicClient(){const config=window.LEGO_SUPABASE;if(!config||!window.supabase)throw Error('Verbindung nicht verfügbar.');return window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}
if(document.body.classList.contains('showcasePublic')){
 const status=document.getElementById('showcaseStatus'),host=document.getElementById('showcaseSets');
 async function load(){
  host.replaceChildren();status.textContent='Schaufenster wird geladen …';
  try{
   const hash=location.hash.slice(1);
   if(hash.startsWith('link=')){
    const shared=await window.BrickShowcaseService.create(publicClient(),model).read(hash.slice(5));
    if(!shared){status.textContent='Dieses Schaufenster ist nicht verfügbar oder wurde deaktiviert.';return}
    cards(host,shared.sets);status.textContent=shared.sets.length+' ausgewählte Sets · Verwaltete Freigabe';
   }else{const sets=model.decode(hash);cards(host,sets);status.textContent=sets.length+' ausgewählte Sets · Älterer Momentaufnahme-Link: Dieser Link kann nicht aktualisiert oder deaktiviert werden.'}
  }catch{host.replaceChildren();status.textContent='Das Schaufenster konnte nicht geladen werden. Bitte prüfe den Link und deine Verbindung und versuche es erneut.'}
 }
 document.getElementById('showcaseReload').onclick=load;
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
 load();return;
}
let dialog,opening=0;
async function open(){
 const generation=++opening;
 const collection=typeof state!=='undefined'?(state.collection||[]):[];
 if(!dialog){dialog=document.createElement('dialog');dialog.className='showcaseDialog';dialog.setAttribute('aria-labelledby','showcaseHeading');document.body.append(dialog)}
 dialog.innerHTML='<h2 id="showcaseHeading">Dein digitales Schaufenster</h2><p>Wähle bis zu 12 Sets. Geteilt werden nur Setnummer, Setname und verfügbare öffentliche Produktbilder. Preise, Belege, Notizen und Kontodaten bleiben privat.</p><p>Neue Freigaben kannst du hier aktualisieren und deaktivieren. Jeder mit dem Link kann sie ansehen und weitergeben. Bereits kopierte Inhalte lassen sich nicht zurückholen. Alte Momentaufnahme-Links bleiben unveränderbar.</p><div class="showcaseChoices"></div><div class="showcaseActions"><button type="button" class="btn" id="showcaseCreate">Vorschau erstellen</button><button type="button" class="btn secondary" id="showcaseClose">Schließen</button><button type="button" class="btn secondary" id="showcaseDeactivate" hidden>Freigabe deaktivieren</button></div><p id="showcaseFeedback" role="status"></p><div id="showcaseResult" hidden><div class="showcaseGrid" id="showcasePreview"></div><button type="button" class="btn" id="showcasePublish">Freigabe erstellen</button><div id="showcaseSaved" hidden><label for="showcaseLink">Dein Link</label><textarea id="showcaseLink" readonly rows="3"></textarea><div class="showcaseActions"><button type="button" class="btn" id="showcaseCopy">Link kopieren</button><a id="showcaseOpen" target="_blank" rel="noopener noreferrer">Schaufenster öffnen</a></div></div></div>';
 const choices=dialog.querySelector('.showcaseChoices'),feedback=dialog.querySelector('#showcaseFeedback'),result=dialog.querySelector('#showcaseResult'),saved=dialog.querySelector('#showcaseSaved'),publish=dialog.querySelector('#showcasePublish'),deactivate=dialog.querySelector('#showcaseDeactivate');
 const account=typeof cloudUserV3!=='undefined'?cloudUserV3?.id:null;
 let current=null,preview=null,service,loading=true,pending=false;
 const sameAccount=()=>account&&typeof cloudUserV3!=='undefined'&&cloudUserV3?.id===account&&generation===opening;
 function link(){const url=new URL('./schaufenster.html',location.href);url.hash='link='+current.token;dialog.querySelector('#showcaseLink').value=url.href;dialog.querySelector('#showcaseOpen').href=url.href;saved.hidden=!current.active;deactivate.hidden=!current.active}
 function editable(value){choices.querySelectorAll('input').forEach(x=>x.disabled=!value);dialog.querySelector('#showcaseCreate').disabled=!value;publish.disabled=!value;deactivate.disabled=!value}
 for(const [i,set] of collection.entries()){const label=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');box.type='checkbox';box.value=i;text.textContent=String(set.setNumber)+' · '+String(set.name||'LEGO Set');label.append(box,text);choices.append(label)}
 choices.onchange=()=>{preview=null;result.hidden=true;saved.hidden=true;feedback.textContent=choices.querySelectorAll(':checked').length+' von 12 Sets ausgewählt.'};
 dialog.querySelector('#showcaseClose').onclick=()=>{++opening;dialog.close()};
 dialog.querySelector('#showcaseCreate').onclick=()=>{try{if(loading||pending||!sameAccount())throw Error('Bitte warte auf dein Konto oder melde dich erneut an.');preview=model.clean(Array.from(choices.querySelectorAll(':checked'),box=>collection[Number(box.value)]));cards(dialog.querySelector('#showcasePreview'),preview);result.hidden=false;saved.hidden=true;publish.hidden=false;publish.textContent=current?(current.active?'Auswahl veröffentlichen':'Freigabe wieder aktivieren'):'Freigabe erstellen';feedback.textContent='Vorschau: Erst mit dem nächsten Schritt veröffentlichst du diese Auswahl.'}catch(e){result.hidden=true;feedback.textContent=e.message}};
 async function change(action){if(pending||loading)return;if(!sameAccount()){feedback.textContent='Das Konto hat sich geändert. Bitte öffne die Freigabe erneut.';return}pending=true;editable(false);try{const response=await action();if(!sameAccount())return;current=response;link()}catch(e){if(sameAccount())feedback.textContent=e.message}finally{pending=false;if(sameAccount())editable(true)}}
 publish.onclick=()=>change(async()=>{if(!preview)throw Error('Bitte erstelle zuerst eine Vorschau.');const response=await service.save(preview,current);if(sameAccount()){feedback.textContent='Freigabe gespeichert. Der Link zeigt jetzt diese Auswahl.';publish.hidden=true}return response});
 deactivate.onclick=()=>change(async()=>{const response=await service.deactivate();if(sameAccount()){result.hidden=true;feedback.textContent='Freigabe deaktiviert. Der Link zeigt keine Sets mehr.'}return response});
 dialog.querySelector('#showcaseCopy').onclick=async()=>{const field=dialog.querySelector('#showcaseLink');try{await navigator.clipboard.writeText(field.value);feedback.textContent='Link kopiert.'}catch{field.focus();field.select();feedback.textContent='Bitte kopiere den markierten Link.'}};
 editable(false);feedback.textContent='Deine Freigabe wird geladen …';dialog.showModal();
 try{
  if(!sameAccount()||typeof cloudV3==='undefined'||!cloudV3)throw Error('Bitte melde dich erneut an.');
  service=window.BrickShowcaseService.create(cloudV3,model,account);current=await service.load();
  if(!sameAccount())return;
  if(current){const numbers=new Set(model.clean(current.items).map(x=>x.setNumber));choices.querySelectorAll('input').forEach(box=>box.checked=numbers.has(String(collection[Number(box.value)].setNumber)));cards(dialog.querySelector('#showcasePreview'),model.clean(current.items));result.hidden=false;publish.hidden=true;link();feedback.textContent=current.active?'Deine aktive Freigabe. Ändere die Auswahl und prüfe die Vorschau, um sie zu aktualisieren.':'Deine Freigabe ist deaktiviert. Wähle Sets und prüfe die Vorschau, um sie wieder zu aktivieren.'}
  else feedback.textContent=collection.length?'Wähle die Sets für dein Schaufenster.':'Füge zuerst ein Set zu deiner Sammlung hinzu.';
  loading=false;editable(true);
 }catch(e){if(generation===opening)feedback.textContent=e.message}
}
function init(){const toolbar=document.querySelector('#collection > .toolbar');if(!toolbar)return;const button=document.createElement('button');button.type='button';button.className='btn secondary';button.id='showcaseShare';button.textContent='Sammlung teilen';button.onclick=open;toolbar.append(button)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
