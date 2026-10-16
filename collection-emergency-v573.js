/* v50.73: resilient, read-only set display; diagnostics are visible to the user. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const euro=v=>{if(v===undefined||v===null||v==='')return '–';let n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n):'–'};
 let latestSignature='',lastPanel=false,busy=false;
 function show(){
  try{
   const panel=$('collection');if(!panel)return;
   const active=panel.classList.contains('active');
   if(!active){lastPanel=false;return}
   const collection=typeof state!=='undefined'&&Array.isArray(state?.collection)?state.collection:[];
   const query=String($('search')?.value||'').trim().toLocaleLowerCase('de');
   const area=$('areaFilter')?.value||'';
   const sort=$('collectionSortV557')?.value||'number-asc';
   const sig=[collection.length,collection[0]?.setNumber,collection[collection.length-1]?.setNumber,query,area,sort].join('|');
   const holder=$('emergencyCollectionV573')||document.createElement('section');
   if(!holder.id){
    holder.id='emergencyCollectionV573';
    holder.setAttribute('aria-label','Meine gespeicherten Sets');
    (panel.querySelector('.toolbar')||panel.firstElementChild)?.insertAdjacentElement('afterend',holder);
   }
   holder.style.setProperty('display','block','important');
   if(sig===latestSignature && lastPanel && holder.querySelector('.emergencyListV573'))return;
   lastPanel=true;latestSignature=sig;
   const list=collection.filter(x=>(!area||x.cityArea===area)&&(!query||[x.setNumber,x.name,x.cityArea,x.category,x.storage,x.module].some(v=>String(v||'').toLocaleLowerCase('de').includes(query))));
   const collator=new Intl.Collator('de',{numeric:true});
   list.sort((a,b)=>{const number=()=>collator.compare(String(a.setNumber),String(b.setNumber));if(sort==='added-desc'||sort==='added-asc'){const stamp=x=>{const values=[x.addedAt,x.createdAt,x.dateAdded,x.importedAt,x.created_at,x.addedDate].map(v=>v?Date.parse(v):NaN).filter(Number.isFinite);return values.length?Math.max(...values):null};const av=stamp(a),bv=stamp(b);if(av===null&&bv!==null)return 1;if(bv===null&&av!==null)return -1;if(av!==null&&bv!==null&&av!==bv)return (sort==='added-desc'?-1:1)*(av-bv);return (sort==='added-desc'?1:-1)*(collection.indexOf(a)-collection.indexOf(b))}if(sort==='number-desc')return -number();if(sort==='price-desc'||sort==='price-asc'){const av=Number(a.purchasePrice),bv=Number(b.purchasePrice);return (sort==='price-desc'?-1:1)*((Number.isFinite(av)?av:0)-(Number.isFinite(bv)?bv:0))||number()}if(sort==='date-desc'||sort==='date-asc'){const key=x=>Date.parse(x.purchaseDate||x.exemplars?.[0]?.date||'')||0;return (sort==='date-desc'?-1:1)*(key(a)-key(b))||number()}return number()});
   holder.replaceChildren();
   const info=document.createElement('p');info.className='emergencyInfoV573';info.textContent=list.length+' von '+collection.length+' gespeicherten Sets';holder.append(info);
   if(!collection.length){const note=document.createElement('p');note.textContent='Keine Sets für dieses Konto geladen. Bitte Cloud-Status unter Konto prüfen. Keine Daten erneut importieren.';holder.append(note);return}
   if(!list.length){const note=document.createElement('p');note.textContent='Keine Treffer – bitte Suchfeld und Filter zurücksetzen.';holder.append(note);return}
   const cards=document.createElement('div');cards.className='emergencyListV573';holder.append(cards);
   const fragment=document.createDocumentFragment();
   for(const x of list){
    const card=document.createElement('button');card.type='button';card.className='emergencySetV573';
    const visual=document.createElement('div');visual.className='emergencyVisualV573';
    const url=x.imageUrl||x.market?.imageUrl;
    if(typeof url==='string'&&/^https?:\/\//i.test(url)){
     const img=document.createElement('img');img.alt='Set '+String(x.setNumber||'');img.loading='lazy';img.src=url;img.onerror=()=>{img.remove();visual.textContent='Bild nicht verfügbar'};visual.append(img)
    }else visual.textContent='Bild nicht verfügbar';
    const body=document.createElement('div');body.className='emergencyBodyV573';
    const number=document.createElement('small');number.textContent='#'+String(x.setNumber||'');
    const title=document.createElement('strong');title.textContent=String(x.name||'LEGO Set');
    const prices=document.createElement('div');prices.className='emergencyPricesV573';
    const buy=document.createElement('span');buy.textContent='Kauf '+euro(x.purchasePrice);
    const val=document.createElement('span');val.textContent='Wert '+(Number(x.currentValue)>0?euro(x.currentValue):'Nicht erfasst');
    prices.append(buy,val);body.append(number,title,prices);card.append(visual,body);
    card.onclick=()=>{if(typeof showDetailV3==='function')showDetailV3(String(x.setNumber))};
    fragment.append(card)
   }
   cards.append(fragment);
  }catch(err){
   const holder=$('emergencyCollectionV573');
   if(holder)holder.textContent='Anzeigeproblem: '+String(err?.message||err);
  }
 }
 function init(){
  if(!$('collection'))return;
  ['search','areaFilter','collectionSortV557'].forEach(id=>{const node=$(id);if(node){node.addEventListener('input',show);node.addEventListener('change',show)}});
  document.querySelectorAll('[data-tab="collection"]').forEach(node=>node.addEventListener('click',()=>setTimeout(show,70)));
  setInterval(show,1200);
  show();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
