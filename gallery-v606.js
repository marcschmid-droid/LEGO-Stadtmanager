/* Read-only gallery presentation. Selection never changes collection order or storage. */
(function(){
 'use strict';
 const imageFor=item=>{const url=item?.imageUrl||item?.market?.imageUrl;return typeof url==='string'&&/^https?:\/\//i.test(url)?url:null};
 function selectHighlight(collection,favorites=[]){
  if(!Array.isArray(collection)||!collection.length)return null;
  const wanted=new Set((Array.isArray(favorites)?favorites:[]).map(String));
  return collection.find(item=>wanted.has(String(item.setNumber)))||collection.find(item=>imageFor(item))||collection[0];
 }
 if(typeof module==='object'&&module.exports){module.exports={selectHighlight,imageFor};return}
 let signature='',scheduled=false;
 function draw(){
  scheduled=false;
  const home=document.getElementById('home');if(!home||typeof state==='undefined')return;
  const favorites=Array.isArray(state.meta?.favoriteSets)?state.meta.favoriteSets:[];
  const item=selectHighlight(state.collection,favorites),favorite=item&&favorites.map(String).includes(String(item.setNumber));
  let box=document.getElementById('collectionHighlightV606');
  if(!item){if(box)box.remove();signature='';return}
  const url=imageFor(item),condition=typeof setValuationV603==='function'?setValuationV603(item).conditionLabel:item.condition||'Zustand offen';
  const next=JSON.stringify([String(item.setNumber),item.name,url,condition,favorite]);
  if(next===signature&&box)return;signature=next;
  if(!box){box=document.createElement('section');box.id='collectionHighlightV606';box.className='collectionHighlightV606';box.setAttribute('aria-labelledby','highlightTitleV606');home.append(box)}
  box.replaceChildren();
  const visual=document.createElement('div');visual.className='highlightVisualV606';
  const fallback=document.createElement('span');fallback.className='highlightFallbackV606';fallback.textContent='Dein Sammlerstück';visual.append(fallback);
  if(url){const image=document.createElement('img');image.alt='Set '+String(item.setNumber)+' – '+(item.name||'Sammlerstück');image.loading='lazy';image.decoding='async';image.src=url;image.onload=()=>{fallback.hidden=true};image.onerror=()=>{image.remove();fallback.hidden=false};visual.append(image)}
  const content=document.createElement('div');content.className='highlightContentV606';
  const eyebrow=document.createElement('small');eyebrow.textContent=favorite?'AUS DEINEN FAVORITEN':'AUS DEINER SAMMLUNG';
  const heading=document.createElement('h2');heading.id='highlightTitleV606';heading.textContent=item.name||'Dein Sammlungs-Highlight';
  const caption=document.createElement('p');caption.textContent='#'+String(item.setNumber)+' · '+condition;
  const open=document.createElement('button');open.type='button';open.className='btn secondary';open.textContent='Set entdecken →';open.onclick=()=>{if(state.collection.some(x=>String(x.setNumber)===String(item.setNumber)))showDetailV3(String(item.setNumber))};
  content.append(eyebrow,heading,caption,open);box.append(visual,content);
 }
 function schedule(){if(!scheduled){scheduled=true;queueMicrotask(draw)}}
 function init(){
  for(const name of ['refresh','switchTab','toggleFavoriteV521']){const previous=window[name];if(typeof previous==='function')window[name]=function(...args){const result=previous.apply(this,args);schedule();return result}}
  draw();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
