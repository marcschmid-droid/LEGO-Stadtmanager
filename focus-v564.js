/* v50.64: progressive disclosure without removing functionality or changing storage. */
(function(){
 function init(){
  const collection=document.getElementById('collection'),city=document.getElementById('city');
  if(!collection||!city)return;
  if(!document.getElementById('collectionEssentialsV564')){
   const bar=document.createElement('div');bar.id='collectionEssentialsV564';
   bar.innerHTML='<strong>Meine LEGO-Sets</strong><button class="btn secondary" type="button" id="collectionMoreV564" aria-expanded="false">Weitere Sammlungsfunktionen anzeigen</button>';
   collection.insertBefore(bar,collection.firstChild);
   bar.querySelector('button').onclick=()=>{const open=collection.classList.toggle('bcm-expanded');bar.querySelector('button').textContent=open?'Zusatzfunktionen ausblenden':'Weitere Sammlungsfunktionen anzeigen';bar.querySelector('button').setAttribute('aria-expanded',String(open))};
  }
  if(!document.getElementById('cityEssentialsV564')){
   const cityCard=city.querySelector(':scope > .card');
   const planner=city.querySelector(':scope > .cityPlannerCardV49');
   if(cityCard)cityCard.classList.add('bcm-primary-city');
   if(planner)planner.classList.add('bcm-primary-city');
   const bar=document.createElement('div');bar.id='cityEssentialsV564';
   bar.innerHTML='<strong>Stadtbild & Planung</strong><button class="btn secondary" type="button" id="cityMoreV564" aria-expanded="false">Weitere Stadtfunktionen anzeigen</button>';
   city.insertBefore(bar,city.firstChild);
   bar.querySelector('button').onclick=()=>{const open=city.classList.toggle('bcm-expanded');bar.querySelector('button').textContent=open?'Zusatzfunktionen ausblenden':'Weitere Stadtfunktionen anzeigen';bar.querySelector('button').setAttribute('aria-expanded',String(open))};
  }
  // Display the visual collection by default only when currently in table view.
  const grid=document.getElementById('collectionGrid'),toggle=document.getElementById('toggleView');
  if(grid?.classList.contains('hidden')&&toggle)toggle.click();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,800));else setTimeout(init,800);
})();
