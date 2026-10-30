/* v50.73: resilient, read-only set display; diagnostics are visible to the user. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const euro=v=>{if(v===undefined||v===null||v==='')return '–';let n=Number(v);return Number.isFinite(n)?moneyFormat.format(n):'–'};
 let latestSignature='',queued=false;
 const moneyFormat=new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;show()})}
 function options(){return {query:$('search')?.value||'',area:$('areaFilter')?.value||'',sort:$('collectionSortV557')?.value||'number-asc',tag:typeof opsV547!=='undefined'?opsV547.tag:'',filter:typeof workflowV546!=='undefined'?workflowV546.filter:null,activityLog:typeof state!=='undefined'?state.activityLog:[]}}
 function resetFilters(){
  for(const id of ['search','areaFilter','tagFilterV547','savedSelectV546','filterKindV546'])if($(id))$(id).value='';
  if(typeof opsV547!=='undefined')opsV547.tag='';
  if(typeof workflowV546!=='undefined')workflowV546.filter=null;
  if(typeof renderCollection==='function')renderCollection();else schedule();
  $('search')?.focus();
 }
 function placeholder(visual,label){
  const empty=document.createElement('span');empty.className='emergencyImageEmptyV601';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','bcmIcon');svg.setAttribute('width','34');svg.setAttribute('height','34');svg.setAttribute('aria-hidden','true');
  const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','./assets/ui-icons.svg?v=graphic-1#box');svg.append(use);
  const caption=document.createElement('span');caption.textContent=label;empty.append(svg,caption);visual.append(empty);
 }
 function show(){
  try{
   const panel=$('collection');if(!panel)return;
   const active=panel.classList.contains('active');
   if(!active)return;
   const collection=typeof state!=='undefined'&&Array.isArray(state?.collection)?state.collection:[];
   const settings=options(),queryModel=window.BrickCollectionQuery;
   const valuations=new Map(collection.map(x=>[x,setValuationV603(x)]));
   const sig=JSON.stringify([collection.map(x=>[x.setNumber,x.name,x.quantity,x.purchasePrice,x.currentValue,x.valueSource,x.valueCheckedAt,valuations.get(x),x.imageUrl||x.market?.imageUrl,x.cityArea,x.category,x.storage,x.storageRoom,x.storageShelf,x.storageBin,x.module,x.customCategoryV547,x.tagsV547,x.condition,x.box,x.forSaleV546,x.purchaseDate,x.exemplars,x.addedAt,x.createdAt,x.dateAdded,x.importedAt,x.created_at,x.addedDate]),settings]);
   if($('clearCollectionSearch'))$('clearCollectionSearch').hidden=!settings.query;
   const holder=$('emergencyCollectionV573')||document.createElement('section');
   if(!holder.id){
    holder.id='emergencyCollectionV573';
    holder.setAttribute('aria-label','Meine gespeicherten Sets');
    (panel.querySelector('.toolbar')||panel.firstElementChild)?.insertAdjacentElement('afterend',holder);
   }
   holder.style.setProperty('display','block','important');
   if(sig===latestSignature && holder.childElementCount)return;
   latestSignature=sig;
   const list=filteredV3();
   let summary=holder.querySelector('.collectionResultsV600');
   if(!summary){
    summary=document.createElement('div');summary.className='collectionResultsV600';
    const info=document.createElement('p');info.className='emergencyInfoV573';info.setAttribute('role','status');info.setAttribute('aria-live','polite');summary.append(info);
    const reset=document.createElement('button');reset.type='button';reset.id='resetCollectionFilters';reset.className='btn secondary';reset.textContent='Filter zurücksetzen';reset.onclick=resetFilters;summary.append(reset);holder.append(summary);
   }
   summary.querySelector('.emergencyInfoV573').textContent=list.length+' von '+collection.length+' gespeicherten Sets';
   summary.querySelector('#resetCollectionFilters').hidden=!(queryModel?.hasFilters(settings)??!!(settings.query.trim()||settings.area||settings.tag||settings.filter?.query||settings.filter?.area||settings.filter?.kind));
   let content=holder.querySelector('.collectionContentV600');
   if(!content){content=document.createElement('div');content.className='collectionContentV600';holder.append(content)}
   content.replaceChildren();
   if(!collection.length){
    const empty=document.createElement('div');empty.className='collectionEmptyV599';
    const heading=document.createElement('h3');heading.textContent='Deine Sammlung beginnt hier.';
    const note=document.createElement('p');note.textContent='Hier erscheinen deine gespeicherten Sets. Füge dein erstes Set hinzu. Wenn du bereits eine Sammlung hast, prüfe unter „Mein Konto“ den Cloud-Status.';
    const button=document.createElement('button');button.className='btn';button.type='button';button.textContent='Set hinzufügen';button.onclick=()=>{if(typeof openSet==='function')openSet()};
    empty.append(heading,note,button);content.append(empty);return;
   }
   if(!list.length){const note=document.createElement('p');note.className='collectionNoResultsV600';note.textContent='Keine passenden Sets gefunden. Versuche weniger Suchbegriffe oder setze die Filter zurück.';content.append(note);return}
   const cards=document.createElement('div');cards.className='emergencyListV573';content.append(cards);
   const fragment=document.createDocumentFragment();
   for(const x of list){
    const card=document.createElement('button');card.type='button';card.className='emergencySetV573';
    card.setAttribute('aria-label','Set '+String(x.setNumber||'')+' – '+String(x.name||'LEGO Set')+' – Details öffnen');
    const visual=document.createElement('div');visual.className='emergencyVisualV573';
    const url=x.imageUrl||x.market?.imageUrl;
    if(typeof url==='string'&&/^https?:\/\//i.test(url)){
     const img=document.createElement('img');img.alt='Set '+String(x.setNumber||'');img.loading='lazy';img.src=url;img.onerror=()=>{img.remove();placeholder(visual,'Bild nicht verfügbar')};visual.append(img)
    }else placeholder(visual,'Kein Bild hinterlegt');
    const quantity=Number(x.quantity);
    if(Number.isInteger(quantity)&&quantity>1){const badge=document.createElement('span');badge.className='emergencyQuantityV601';badge.textContent=quantity+'×';badge.setAttribute('aria-label',quantity+' Exemplare in deiner Sammlung');card.setAttribute('aria-label','Set '+String(x.setNumber||'')+' – '+String(x.name||'LEGO Set')+' – '+quantity+' Exemplare – Details öffnen');visual.append(badge)}
    const body=document.createElement('div');body.className='emergencyBodyV573';
    const number=document.createElement('small');number.textContent='#'+String(x.setNumber||'');
    const title=document.createElement('strong');title.className='emergencyTitleV573';title.textContent=String(x.name||'LEGO Set');
    const prices=document.createElement('div');prices.className='emergencyPricesV573';
    const priceCell=(label,value)=>{const cell=document.createElement('span'),caption=document.createElement('small'),amount=document.createElement('b');caption.textContent=label;amount.textContent=value;cell.append(caption,amount);return cell};
    const valuation=valuations.get(x);
    const buy=priceCell('Kaufpreis / Stück',x.purchasePrice===null||x.purchasePrice===undefined?'–':euro(Number(x.purchasePrice)/valuation.quantity));
    const totalPrice=valuation.mixed||valuation.variedPrices;
    const val=priceCell(valuation.priceLabel,valuation.complete?euro(totalPrice?valuation.total:valuation.average):'Werte fehlen');
    const condition=document.createElement('span');condition.className='conditionChipV603';condition.textContent=valuation.conditionLabel;
    condition.dataset.kind=valuation.mixed?'mixed':window.BrickCollectionValuation.conditionType(valuation.conditionLabel);
    const provenance=document.createElement('small');provenance.className='priceSourceV603';
    const source=valuation.manual?'Manuell geschätzt':valuation.source||'Quelle offen';
    const date=valuation.at?new Date(valuation.at).toLocaleDateString('de-DE'):'Stand offen';
    provenance.textContent=source+' · '+date;
    provenance.title=(valuation.source||'Keine Preisquelle hinterlegt')+(valuation.complete?'':' · '+valuation.knownCount+' von '+valuation.quantity+' Exemplaren bewertet');
    if(!valuation.complete)provenance.textContent=valuation.knownCount+' von '+valuation.quantity+' bewertet · '+provenance.textContent;
    prices.append(buy,val);body.append(number,title,condition,prices,provenance);card.append(visual,body);
    card.setAttribute('aria-label',card.getAttribute('aria-label')+' · '+valuation.conditionLabel+' · '+valuation.priceLabel+': '+(valuation.complete?euro(totalPrice?valuation.total:valuation.average):'Werte fehlen'));
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
  const originalFiltered=filteredV3;
  filteredV3=function(){return window.BrickCollectionQuery?window.BrickCollectionQuery.select(state.collection,options()):originalFiltered.apply(this,arguments)};
  $('clearCollectionSearch')?.addEventListener('click',()=>{if($('search'))$('search').value='';if(typeof renderCollection==='function')renderCollection();else schedule();$('search')?.focus()});
  ['search','areaFilter','collectionSortV557'].forEach(id=>{const node=$(id);if(node){node.addEventListener('input',schedule);node.addEventListener('change',schedule)}});
  for(const name of ['refresh','switchTab','persist','renderCollection']){
   const original=window[name];
   if(typeof original==='function')window[name]=function(...args){const out=original.apply(this,args);schedule();return out};
  }
  new MutationObserver(schedule).observe($('collection'),{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
  show();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
