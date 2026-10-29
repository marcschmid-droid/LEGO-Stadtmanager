(function(){
'use strict';
const model=window.BrickShowcase;
function cards(host,sets){host.replaceChildren();for(const set of sets){const card=document.createElement('figure');card.className='showcaseCard';const picture=document.createElement('div');picture.className='picture';picture.textContent='Kein öffentliches Bild';if(set.imageUrl){const img=document.createElement('img');img.src=set.imageUrl;img.alt='Set '+set.setNumber;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();picture.append(img)}const caption=document.createElement('figcaption'),number=document.createElement('small'),name=document.createElement('strong');number.textContent='#'+set.setNumber;name.textContent=set.name;caption.append(number,name);card.append(picture,caption);host.append(card)}}
if(document.body.classList.contains('showcasePublic')){
 try{const sets=model.decode(location.hash.slice(1));cards(document.getElementById('showcaseSets'),sets);document.getElementById('showcaseStatus').textContent=sets.length+' ausgewählte Sets · Geteilte Momentaufnahme'}catch{document.getElementById('showcaseStatus').textContent='Dieser Link ist ungültig oder unvollständig. Bitte lass dir einen neuen Schaufenster-Link senden.'}
 return;
}
let dialog;
function open(){
 const collection=typeof state!=='undefined'?state.collection:[];
 if(!dialog){dialog=document.createElement('dialog');dialog.className='showcaseDialog';dialog.setAttribute('aria-labelledby','showcaseHeading');document.body.append(dialog)}
 dialog.innerHTML='<h2 id="showcaseHeading">Dein digitales Schaufenster</h2><p>Wähle bis zu 12 Sets. Geteilt werden nur Setnummer, Setname und verfügbare öffentliche Produktbilder. Preise, Belege, Notizen und Kontodaten bleiben privat.</p><p>Jeder mit dem Link kann die Auswahl ansehen und weitergeben. Der Link enthält eine feste Momentaufnahme; er lässt sich nach dem Teilen nicht zurückrufen. Änderungen an deiner Sammlung aktualisieren ihn nicht.</p><div class="showcaseChoices"></div><div class="showcaseActions"><button type="button" class="btn" id="showcaseCreate">Vorschau erstellen</button><button type="button" class="btn secondary" id="showcaseClose">Schließen</button></div><p id="showcaseFeedback" role="status"></p><div id="showcaseResult" hidden><div class="showcaseGrid" id="showcasePreview"></div><label for="showcaseLink">Dein Link</label><textarea id="showcaseLink" readonly rows="3"></textarea><div class="showcaseActions"><button class="btn" id="showcaseCopy">Link kopieren</button><a id="showcaseOpen" target="_blank" rel="noopener noreferrer">Schaufenster öffnen</a></div></div>';
 const choices=dialog.querySelector('.showcaseChoices'),feedback=dialog.querySelector('#showcaseFeedback'),result=dialog.querySelector('#showcaseResult');
 for(const [i,set] of collection.entries()){const label=document.createElement('label'),box=document.createElement('input'),text=document.createElement('span');box.type='checkbox';box.value=i;text.textContent=String(set.setNumber)+' · '+String(set.name||'LEGO Set');label.append(box,text);choices.append(label)}
 if(!collection.length)feedback.textContent='Füge zuerst ein Set zu deiner Sammlung hinzu.';
 choices.onchange=()=>{result.hidden=true;feedback.textContent=choices.querySelectorAll(':checked').length+' von 12 Sets ausgewählt.'};
 dialog.querySelector('#showcaseClose').onclick=()=>dialog.close();
 dialog.querySelector('#showcaseCreate').onclick=()=>{try{const selected=Array.from(choices.querySelectorAll(':checked'),box=>collection[Number(box.value)]),token=model.encode(selected),url=new URL('./schaufenster.html',location.href);url.hash=token;cards(dialog.querySelector('#showcasePreview'),model.decode(token));dialog.querySelector('#showcaseLink').value=url.href;dialog.querySelector('#showcaseOpen').href=url.href;result.hidden=false;feedback.textContent='Das ist deine öffentliche Vorschau. Erst durch Weitergeben des Links teilst du sie.'}catch(e){result.hidden=true;feedback.textContent=e.message}};
 dialog.querySelector('#showcaseCopy').onclick=async()=>{const field=dialog.querySelector('#showcaseLink');try{await navigator.clipboard.writeText(field.value);feedback.textContent='Link kopiert.'}catch{field.focus();field.select();feedback.textContent='Bitte kopiere den markierten Link.'}};
 dialog.showModal();
}
function init(){const toolbar=document.querySelector('#collection > .toolbar');if(!toolbar)return;const button=document.createElement('button');button.type='button';button.className='btn secondary';button.id='showcaseShare';button.textContent='Sammlung teilen';button.onclick=open;toolbar.append(button)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
