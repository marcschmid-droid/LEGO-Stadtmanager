/* v50.71: standalone, read-only collection renderer. Never writes to state, storage or cloud. */
(function(){
 'use strict';
 const el=id=>document.getElementById(id);
 const money=n=>{const v=Number(n);return Number.isFinite(v)?new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(v):'–'};
 const norm=s=>String(s??'').toLocaleLowerCase('de').trim();
 function run(){
  const panel=el('collection');if(!panel?.classList.contains('active'))return;
  const items=typeof state!=='undefined'&&Array.isArray(state.collection)?state.collection:[];
  let root=el('stableCollectionV571');
  if(!root){root=document.createElement('div');root.id='stableCollectionV571';panel.querySelector('.toolbar')?.after(root)}
  if(!root)return;
  const search=norm(el('search')?.value),area=el('areaFilter')?.value||'';
  const filtered=items.filter(x=>(!search||norm([x.setNumber,x.name,x.category,x.cityArea,x.storage,x.module].join(' ')).includes(search))&&(!area||x.cityArea===area));
  const sort=el('collectionSortV557')?.value||'number-asc';
  filtered.sort((a,b)=>{
   const number=()=>String(a.setNumber||'').localeCompare(String(b.setNumber||''),'de',{numeric:true});
   const numeric=(field,sign)=>{const aV=Number(a[field]),bV=Number(b[field]);return sign*((Number.isFinite(aV)?aV:0)-(Number.isFinite(bV)?bV:0))||number()};
   if(sort==='number-desc')return -number();
   if(sort==='price-desc')return numeric('purchasePrice',-1);
   if(sort==='price-asc')return numeric('purchasePrice',1);
   if(sort==='added-desc'||sort==='added-asc'){const key=x=>Date.parse(x.addedAt||x.createdAt||x.dateAdded||x.importedAt||'')||0;return (sort==='added-desc'?-1:1)*(key(a)-key(b))||number()}
   if(sort==='date-desc'||sort==='date-asc'){const key=x=>Date.parse(x.purchaseDate||x.exemplars?.[0]?.date||'')||0;return (sort==='date-desc'?-1:1)*(key(a)-key(b))||number()}
   return number();
  });
  root.replaceChildren();
  const count=document.createElement('p');count.className='stableCountV571';count.textContent=filtered.length+' von '+items.length+' Sets angezeigt';root.append(count);
  if(!items.length){const warning=document.createElement('p');warning.textContent='In diesem angemeldeten Bestand sind derzeit keine Sets geladen. Bitte unter Konto den Cloud-Status prüfen. Keine Daten neu importieren.';root.append(warning);return}
  if(!filtered.length){const warning=document.createElement('p');warning.textContent='Keine Treffer. Bitte Suchfeld und Bereichsfilter zurücksetzen.';root.append(warning);return}
  const list=document.createElement('div');list.className='stableGridV571';root.append(list);
  for(const x of filtered){
   const card=document.createElement('button');card.type='button';card.className='stableCardV571';
   const imgWrap=document.createElement('div');imgWrap.className='stableImageV571';
   const source=x.imageUrl||x.market?.imageUrl||'';
   if(source&&/^https?:\/\//i.test(source)){const img=document.createElement('img');img.loading='lazy';img.decoding='async';img.alt='LEGO Set '+String(x.setNumber||'');img.src=source;img.onerror=()=>{img.remove();imgWrap.textContent='Kein Bild'};imgWrap.append(img)}
   else imgWrap.textContent='Kein Bild';
   const body=document.createElement('div');body.className='stableBodyV571';
   const n=document.createElement('small');n.textContent='Set '+String(x.setNumber||'');
   const title=document.createElement('strong');title.textContent=String(x.name||'Ohne Namen');
   const price=document.createElement('div');price.className='stablePricesV571';
   const purchase=document.createElement('span');purchase.textContent='Kauf: '+money(x.purchasePrice);
   const current=document.createElement('span');current.textContent='Wert: '+money(x.currentValue);
   price.append(purchase,current);body.append(n,title,price);card.append(imgWrap,body);
   card.addEventListener('click',()=>{if(typeof showDetailV3==='function')showDetailV3(String(x.setNumber))});
   list.append(card);
  }
 }
 function schedule(){setTimeout(run,0)}
 const originalSwitch=switchTab;
 switchTab=function(...args){const out=originalSwitch.apply(this,args);schedule();return out};
 const originalRefresh=refresh;
 refresh=function(...args){const out=originalRefresh.apply(this,args);schedule();return out};
 document.addEventListener('DOMContentLoaded',()=>{
  for(const id of ['search','areaFilter','collectionSortV557'])el(id)?.addEventListener('input',schedule);
  el('collection')?.addEventListener('change',schedule);
  document.querySelectorAll('[data-tab="collection"]').forEach(x=>x.addEventListener('click',()=>setTimeout(run,30)));
  setTimeout(run,600);
 });
})();
