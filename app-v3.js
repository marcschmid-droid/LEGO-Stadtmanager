
// LEGO Stadtmanager v3 enhancement layer
let collectionModeV3="list",purchaseFromWishV3=null,scanStreamV3=null;
const DEFAULT_MODULES_V3={M05:["75978"],M12:["21344","60051","10259"],M13:["76444"],M16:["76419"],M17:["10320"],M19:["43302"],M20:["10352"],M23:["71006"],M24:["71016"],M25:["21335"],M26:["10214"],M27:["10255"],M28:["10326"],M31:["21353"],M33:["21310"],M34:["10297"],M35:["10312"],M36:["10350"],M38:["10354"]};
const ZONES_V3=["winter","winter","winter","winter","hogwarts","hogwarts","hogwarts","hogwarts","winter","winter","winter","station","hogwarts","hogwarts","hogwarts","hogwarts","harbor","harbor","open","open","open","open","disney","disney","harbor","harbor","open","open","open","open","disney","disney","harbor","city","city","city","world","world","world","world","harbor","city","city","city","world","world","world","world"];
const ZONELABEL_V3={winter:"Weihnachtsdorf",hogwarts:"Hogwarts",station:"Hauptbahnhof",harbor:"Hafen & Piraten",disney:"Disney / Springfield",city:"Innenstadt",world:"Weltpark / Botanik",open:"Frei"};
function nV3(s){return String(s||"").toLowerCase()}
function pV3(v){return Number(v||0)}
function shortAreaV3(a){return String(a||"").replace("Innenstadt / Altstadt","Innenstadt").replace("Park & Botanischer Bereich","Botanik").replace("Weltpark / Miniatur-Ausstellung","Weltpark")}
function moduleForV3(n){for(const [m,a] of Object.entries(state.modules||{}))if(a.includes(String(n)))return m;return""}
function inferTrackV3(s=""){const t=nV3(s),g=r=>Number(t.match(r)?.[1]||0);return{straight:g(/(\d+)\s*(gerade|straights?)/),curve:g(/(\d+)\s*(kurven|curves?)/),flex:g(/(\d+)\s*flex/),switchL:g(/(\d+)\s*(linke|left)/),switchR:g(/(\d+)\s*(rechte|right)/)}}
function migrateV3(){
 state.modules=state.modules||structuredClone(DEFAULT_MODULES_V3);if(!Object.keys(state.modules).length)state.modules=structuredClone(DEFAULT_MODULES_V3);
 state.meta={version:"3.0",brickrInvestmentReference:18026.14,...(state.meta||{})};
 const keys=["straight","curve","flex","switchL","switchR"];state.trackShopping=(state.trackShopping||[]).map((x,i)=>({...x,key:x.key||keys[i]}));
 state.classifiedOffers=(state.classifiedOffers||[]).map(o=>({...o,trackQty:o.trackQty||inferTrackV3(o.details)}));
 state.collection.forEach(x=>{x.exemplars=x.exemplars||[];x.condition=x.condition||"Unbekannt";x.buildStatus=x.buildStatus||"Unbekannt";x.storage=x.storage||"";x.barcode=x.barcode||"";x.module=x.module||moduleForV3(x.setNumber)||""});
 state.wishlist.forEach(w=>{w.rrp=pV3(w.rrp);w.limit=pV3(w.limit);w.offer=pV3(w.offer)});
 persist();
}
function totalsV3(){const qty=state.collection.reduce((s,x)=>s+pV3(x.quantity),0),inv=state.collection.reduce((s,x)=>s+pV3(x.quantity)*pV3(x.purchasePrice),0),val=state.collection.reduce((s,x)=>s+pV3(x.quantity)*pV3(x.currentValue),0);return{qty,inv,val,gain:val-inv,pct:inv?(val-inv)/inv*100:0}}
function fillAreaFilterV3(){const el=$("areaFilter");if(!el)return;const old=el.value,arr=[...new Set(state.collection.map(x=>x.cityArea).filter(Boolean))].sort();el.innerHTML='<option value="">Alle Bereiche</option>'+arr.map(a=>'<option>'+esc(a)+'</option>').join("");el.value=arr.includes(old)?old:""}
function filteredV3(){const q=nV3($("search")?.value),a=nV3($("areaFilter")?.value);return state.collection.filter(x=>{const h=nV3([x.setNumber,x.name,x.category,x.cityArea,x.storage,x.module].join(" "));return(!q||h.includes(q))&&(!a||nV3(x.cityArea)===a)}).sort((a,b)=>String(a.setNumber).localeCompare(String(b.setNumber),undefined,{numeric:true}))}
renderCollection=function(){const data=filteredV3(),list=document.querySelector("#collection .tablewrap"),grid=$("collectionGrid");if(!grid)return;list.classList.toggle("hidden",collectionModeV3==="grid");grid.classList.toggle("hidden",collectionModeV3==="list");$("toggleView").textContent=collectionModeV3==="list"?"▦ Raster":"☷ Liste";$("collectionBody").innerHTML=data.length?data.map(x=>'<tr><td>'+(x.imageUrl?'<img class="thumb" src="'+esc(x.imageUrl)+'">':"")+'<br><b>'+esc(x.setNumber)+'</b></td><td><button class="linkbtn" onclick="showDetailV3(\''+esc(x.setNumber)+'\')">'+esc(x.name)+'</button></td><td>'+pV3(x.quantity)+'</td><td>'+euro(x.purchasePrice)+'</td><td>'+euro(x.currentValue)+'</td><td>'+esc(x.cityArea||"")+'<br><small>'+esc(x.module||"")+'</small></td><td><button class="rowbtn" onclick="showDetailV3(\''+esc(x.setNumber)+'\')">👁</button><button class="rowbtn" onclick="editSet(\''+esc(x.setNumber)+'\')">✏️</button></td></tr>').join(""):'<tr><td colspan="7">Keine Sets gefunden.</td></tr>';
 grid.innerHTML=data.length?data.map(x=>'<article class="setcard" onclick="showDetailV3(\''+esc(x.setNumber)+'\')"><div class="pic">'+(x.imageUrl?'<img src="'+esc(x.imageUrl)+'">':'<b>LEGO '+esc(x.setNumber)+'</b>')+'</div><div class="body"><div class="num">'+esc(x.setNumber)+'</div><div class="name">'+esc(x.name)+'</div><div class="chips"><span class="chip">× '+pV3(x.quantity)+'</span>'+(x.cityArea?'<span class="chip">'+esc(shortAreaV3(x.cityArea))+'</span>':"")+(x.module?'<span class="chip good">'+esc(x.module)+'</span>':"")+'</div></div></article>').join(""):'<p>Keine Sets gefunden.</p>';
}
function dealClassV3(w){if(pV3(w.offer)&&pV3(w.limit))return pV3(w.offer)<=pV3(w.limit)?"good":"bad";if(pV3(w.offer)&&pV3(w.price))return pV3(w.offer)<=pV3(w.price)*.85?"good":"warn";return""}
renderWishlist=function(){if(!$("wishCards"))return;$("wishCards").innerHTML=state.wishlist.length?state.wishlist.map(w=>'<article class="wishcard"><div class="sectionHead"><div><span class="chip">Prio '+esc(w.priority||"")+'</span><h3>'+esc(w.setNumber)+' · '+esc(w.name)+'</h3><small>'+esc(w.area||w.cityArea||"")+'</small></div>'+(w.imageUrl?'<img class="thumb" src="'+esc(w.imageUrl)+'">':"")+'</div><div class="wishprice"><div><small>UVP</small><b>'+euro(w.rrp)+'</b></div><div><small>Richtpreis</small><b>'+euro(w.price)+'</b></div><div><small>Kaufgrenze</small><b>'+euro(w.limit)+'</b></div><div><small>Angebot</small><b>'+euro(w.offer)+'</b></div></div><p class="deal '+dealClassV3(w)+'">'+(!pV3(w.offer)?"Noch kein Angebot":pV3(w.limit)?(pV3(w.offer)<=pV3(w.limit)?"🟢 unter Kaufgrenze":"🔴 über Kaufgrenze"):"Angebot erfasst")+'</p><p class="hint">'+esc(w.reason||"")+'</p><div class="actions"><button class="btn" onclick="buyWishV3(\''+esc(w.setNumber)+'\')">Kauf erfassen</button><button class="btn secondary" onclick="delWish(\''+esc(w.setNumber)+'\')">Löschen</button></div></article>').join(""):'<div class="card"><p>Keine Wünsche.</p></div>'}
function cityMatchV3(f,x){const h=nV3([x.cityArea,x.category,x.name].join(" ")),m={hauptbahnhof:["bahnhof","zug","eisenbahn","verkehr"],hogwarts:["hogwarts","harry potter","winkelgasse"],hafen:["hafen","piraten","küste","leuchtturm","angelladen"],disney:["disney","springfield","simpsons"],innenstadt:["innenstadt","stadtgebäude","altstadt"],weltpark:["weltpark","architecture","botanik","park"]};return(m[f]||[]).some(k=>h.includes(k))}
function renderCityV3(filter=""){let d=state.collection;if(filter){const f=nV3(filter);d=d.filter(x=>nV3([x.cityArea,x.category,x.name].join(" ")).includes(f)||cityMatchV3(f,x))}$("citySetResults").innerHTML=filter?'<b>'+esc(filter)+' · '+d.length+' Sets</b><div>'+d.slice(0,45).map(x=>'<button class="miniSet" onclick="showDetailV3(\''+esc(x.setNumber)+'\')">'+esc(x.setNumber)+' '+esc(x.name)+'</button>').join("")+'</div>':'<span class="hint">Bereich auf dem Bild antippen.</span>'}
function renderModulesV3(){const g=$("moduleGrid");if(!g)return;let n=0,h="";for(let i=0;i<48;i++){const z=ZONES_V3[i];if(z==="open"){h+='<div class="module open">FREI</div>';continue}n++;const m='M'+String(n).padStart(2,'0'),a=state.modules[m]||[];h+='<button class="module z-'+z+'" data-module="'+m+'" onclick="moduleClickV3(\''+m+'\')">'+m+'<small>'+(a.length?a.length+' Set'+(a.length>1?'s':''):ZONELABEL_V3[z])+'</small></button>'}g.innerHTML=h}
window.moduleClickV3=m=>{document.querySelectorAll(".module").forEach(e=>e.classList.toggle("active",e.dataset.module===m));const d=(state.modules[m]||[]).map(n=>state.collection.find(x=>x.setNumber===n)).filter(Boolean);$("moduleDetail").innerHTML='<b>'+m+'</b> · '+d.length+' zugeordnete Sets '+(d.length?'<div>'+d.map(x=>'<button class="miniSet" onclick="showDetailV3(\''+esc(x.setNumber)+'\')">'+esc(x.setNumber)+' '+esc(x.name)+'</button>').join("")+'</div>':'<p>Noch keine feste Set-Zuordnung.</p>')}
function reservedV3(key){return state.classifiedOffers.filter(o=>["Angefragt","Reserviert"].includes(o.status)).reduce((s,o)=>s+pV3(o.trackQty?.[key]),0)}
renderTracks=function(){let miss=0;const rows=state.trackShopping.map((x,i)=>{const r=reservedV3(x.key),m=Math.max(0,pV3(x.target)-pV3(x.confirmedOwned)-r);miss+=m;return'<tr><td><b>'+esc(x.item)+'</b><div class="trackNote">'+esc(x.note||"")+'</div></td><td><input type="number" min="0" value="'+pV3(x.target)+'" onchange="trackEdit('+i+',\'target\',this.value)"></td><td><input type="number" min="0" value="'+(x.confirmedOwned??"")+'" placeholder="?" onchange="trackEdit('+i+',\'confirmedOwned\',this.value)"></td><td>'+r+'</td><td><b class="'+(m?"badTxt":"goodTxt")+'">'+m+'</b></td></tr>'}).join("");$("trackTable").innerHTML='<table class="trackTable"><thead><tr><th>Teil</th><th>Planwert*</th><th>Bestätigt</th><th>Angefragt/reserviert</th><th>Fehlt</th></tr></thead><tbody>'+rows+'</tbody></table>';if($("trackSummary"))$("trackSummary").innerHTML='<div class="miniStat"><span>Offene Fehlmenge</span><b>'+miss+'</b></div><div class="miniStat"><span>Angebote</span><b>'+state.classifiedOffers.length+'</b></div>'}
renderOffers=function(){$("offerList").innerHTML=state.classifiedOffers.length?state.classifiedOffers.map((o,i)=>'<div class="offer"><div class="sectionHead"><div><h3>'+esc(o.title)+'</h3><div class="offerMeta">'+esc(o.location||"")+' · '+euro(o.price)+' '+esc(o.shipping||"")+'</div></div><span class="offerStatus">'+esc(o.status||"")+'</span></div><p>'+esc(o.details||"")+'</p><div class="chips"><span class="chip">Gerade '+pV3(o.trackQty?.straight)+'</span><span class="chip">Kurven '+pV3(o.trackQty?.curve)+'</span><span class="chip">Flex '+pV3(o.trackQty?.flex)+'</span><span class="chip">Weichen '+pV3(o.trackQty?.switchL)+'/'+pV3(o.trackQty?.switchR)+'</span></div><div class="trackNote">'+esc(o.note||"")+'</div><button class="rowbtn" onclick="deleteOffer('+i+')">🗑 Entfernen</button></div>').join(""):'<p>Keine Angebote gespeichert.</p>'}
function renderHomeV3(){const t=totalsV3();if($("kValue"))$("kValue").textContent=euro(t.val);if($("kGain"))$("kGain").textContent=euro(t.gain);if($("kGainPct"))$("kGainPct").textContent=t.pct.toFixed(1).replace(".",",")+" %";const g={};state.collection.forEach(x=>{const a=shortAreaV3(x.cityArea||"Ohne Bereich");g[a]=(g[a]||0)+pV3(x.quantity)});if($("homeCityStats"))$("homeCityStats").innerHTML=Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>'<div class="miniStat"><span>'+esc(k)+'</span><b>'+v+'</b></div>').join("");const miss=state.trackShopping.reduce((s,x)=>s+Math.max(0,pV3(x.target)-pV3(x.confirmedOwned)-reservedV3(x.key)),0);if($("homeTrackStats"))$("homeTrackStats").innerHTML='<div class="miniStat"><span>Offene Teile</span><b>'+miss+'</b></div><div class="miniStat"><span>Angefragte Angebote</span><b>'+state.classifiedOffers.filter(o=>o.status==="Angefragt").length+'</b></div>'}
function renderAnalysisV3(){const t=totalsV3(),valued=state.collection.filter(x=>pV3(x.currentValue)>0).length,sized=state.collection.filter(x=>pV3(x.width)>0&&pV3(x.depth)>0).length,area=state.collection.reduce((s,x)=>s+pV3(x.width)*pV3(x.depth)*pV3(x.quantity),0)/10000;if(!$("aValued"))return;$("aValued").textContent=valued;$("aSized").textContent=sized;$("aArea").textContent=area.toFixed(2).replace(".",",")+" m²";const g={};state.collection.forEach(x=>{const a=shortAreaV3(x.cityArea||"Ohne Bereich");g[a]=(g[a]||0)+pV3(x.quantity)});$("aZones").textContent=Object.keys(g).length;const mx=Math.max(...Object.values(g),1);$("areaAnalysis").innerHTML=Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div class="barrow"><span>'+esc(k)+'</span><div class="bar"><i style="width:'+(v/mx*100)+'%"></i></div><b>'+v+'</b></div>').join("");$("valueAnalysis").innerHTML='<div class="miniStats"><div class="miniStat"><span>Investment</span><b>'+euro(t.inv)+'</b></div><div class="miniStat"><span>Erfasster Wert</span><b>'+euro(t.val)+'</b></div><div class="miniStat"><span>Differenz</span><b>'+euro(t.gain)+'</b></div><div class="miniStat"><span>Rendite</span><b>'+t.pct.toFixed(1).replace(".",",")+' %</b></div></div><p class="hint">Aktuelle Werte sind nur für gepflegte Sets aussagekräftig.</p>';const q=[["Ohne Bild",state.collection.filter(x=>!x.imageUrl).length],["Ohne aktuellen Wert",state.collection.filter(x=>!pV3(x.currentValue)).length],["Ohne vollständige Maße",state.collection.filter(x=>!(pV3(x.width)&&pV3(x.depth)&&pV3(x.height))).length],["Ohne Modul",state.collection.filter(x=>!x.module).length],["Ohne Lagerort",state.collection.filter(x=>!x.storage).length]];$("qualityAnalysis").innerHTML='<div class="qualitylist">'+q.map(([k,v])=>'<div class="qualityitem"><span>'+k+'</span><b>'+v+'</b></div>').join("")+'</div>'}
const oldRefreshV3=refresh;refresh=function(){oldRefreshV3();fillAreaFilterV3();renderCollection();renderWishlist();renderCityV3();renderModulesV3();renderTracks();renderOffers();renderHomeV3();if(document.querySelector("#analysis.active"))renderAnalysisV3()}
function syncModuleV3(x){for(const m in state.modules)state.modules[m]=state.modules[m].filter(n=>n!==x.setNumber);if(x.module){state.modules[x.module]=state.modules[x.module]||[];if(!state.modules[x.module].includes(x.setNumber))state.modules[x.module].push(x.setNumber)}}
const oldOpenSetV3=openSet;openSet=function(x=null){oldOpenSetV3(x);if($("fModule"))$("fModule").value=x?.module||"";if($("fCondition"))$("fCondition").value=x?.condition||"Unbekannt";if($("fBuild"))$("fBuild").value=x?.buildStatus||"Unbekannt";if($("fStorage"))$("fStorage").value=x?.storage||"";if($("fBarcode"))$("fBarcode").value=x?.barcode||"";if($("fPurchaseDate"))$("fPurchaseDate").value=x?.purchaseDate||"";if($("fSeller"))$("fSeller").value=x?.seller||""}
const oldSaveSetV3=saveSet;saveSet=function(){const was=editing;oldSaveSetV3();const n=was||$("fSet")?.value?.trim();const x=state.collection.find(y=>y.setNumber===n);if(x){x.module=$("fModule")?.value.trim().toUpperCase()||x.module||"";x.condition=$("fCondition")?.value||x.condition||"Unbekannt";x.buildStatus=$("fBuild")?.value||x.buildStatus||"Unbekannt";x.storage=$("fStorage")?.value.trim()||x.storage||"";x.barcode=$("fBarcode")?.value.trim()||x.barcode||"";x.purchaseDate=$("fPurchaseDate")?.value||x.purchaseDate||"";x.seller=$("fSeller")?.value.trim()||x.seller||"";syncModuleV3(x);persist();refresh()}}
window.showDetailV3=n=>{const x=state.collection.find(y=>y.setNumber===n);if(!x)return;const gain=(pV3(x.currentValue)-pV3(x.purchasePrice))*pV3(x.quantity);$("detailTitle").textContent=x.setNumber+" · "+x.name;$("detailContent").innerHTML='<div class="detailHero"><div class="detailPic">'+(x.imageUrl?'<img src="'+esc(x.imageUrl)+'">':'<b>LEGO '+esc(x.setNumber)+'</b>')+'</div><div><div class="detailFacts"><div class="fact"><small>Anzahl</small><b>'+pV3(x.quantity)+'</b></div><div class="fact"><small>Kaufpreis</small><b>'+euro(x.purchasePrice)+'</b></div><div class="fact"><small>Aktueller Wert</small><b>'+euro(x.currentValue)+'</b></div><div class="fact"><small>Gewinn / Verlust</small><b>'+euro(gain)+'</b></div><div class="fact"><small>Stadtbereich</small><b>'+esc(x.cityArea||"–")+'</b></div><div class="fact"><small>Modul</small><b>'+esc(x.module||"–")+'</b></div><div class="fact"><small>Maße</small><b>'+(x.width??"–")+' × '+(x.depth??"–")+' × '+(x.height??"–")+' cm</b></div><div class="fact"><small>Zustand</small><b>'+esc(x.condition||"–")+'</b></div><div class="fact"><small>Bauzustand</small><b>'+esc(x.buildStatus||"–")+'</b></div><div class="fact"><small>Lagerort</small><b>'+esc(x.storage||"–")+'</b></div></div><div class="actions"><button class="btn" onclick="editSet(\''+esc(x.setNumber)+'\');document.getElementById(\'detailModal\').classList.remove(\'show\')">Bearbeiten</button><button class="btn secondary" onclick="purchaseSetV3(\''+esc(x.setNumber)+'\')">Weiteres Exemplar kaufen</button></div></div></div>'+(x.note?'<div class="card wide"><b>Notiz</b><p>'+esc(x.note)+'</p></div>':"")+'<div class="card wide marketCard">'+((x.market&&Object.keys(x.market).length)?'<h3>Online-Daten</h3><div class="detailFacts"><div class="fact"><small>Marktwert neu</small><b>'+euro(x.market.marketNewEUR)+'</b></div><div class="fact"><small>Marktwert gebraucht</small><b>'+euro(x.market.marketUsedEUR)+'</b></div><div class="fact"><small>UVP EU</small><b>'+euro(x.market.rrpEUR)+'</b></div><div class="fact"><small>12-Monats-Wachstum</small><b>'+(x.market.growth12mPct??'–')+' %</b></div></div>':'')+'</div><div class="exemplars"><h3>Einzel-Exemplare / Käufe</h3>'+((x.exemplars||[]).length?x.exemplars.map((e,i)=>'<div class="exemplar"><b>#'+(i+1)+'</b> · '+(e.date||"ohne Datum")+' · '+esc(e.condition||"Unbekannt")+' · '+esc(e.seller||"Quelle unbekannt")+' · '+euro(e.price)+'</div>').join(""):'<p class="hint">Noch keine Einzelkäufe separat erfasst.</p>')+'</div>';$("detailModal").classList.add("show")}
function openPurchaseV3(w=null,x=null){purchaseFromWishV3=w?.setNumber||null;$("pSet").value=x?.setNumber||w?.setNumber||"";$("pName").value=x?.name||w?.name||"";$("pQty").value=1;$("pPrice").value=w?.offer||w?.price||x?.purchasePrice||"";$("pShipping").value="";$("pDate").value=new Date().toLocaleDateString("sv-SE");$("pSeller").value="";$("pCondition").value=x?.condition||"Unbekannt";$("pArea").value=x?.cityArea||w?.area||w?.cityArea||"";$("pModule").value=x?.module||"";$("pBox").value="";$("pComplete").value="";$("pNote").value=w?.reason||"";$("purchaseModal").classList.add("show")}
window.buyWishV3=n=>{const w=state.wishlist.find(x=>x.setNumber===n);if(w)openPurchaseV3(w)};window.purchaseSetV3=n=>{const x=state.collection.find(y=>y.setNumber===n);$("detailModal").classList.remove("show");if(x)openPurchaseV3(null,x)}
function savePurchaseV3(){const n=$("pSet").value.trim(),name=$("pName").value.trim();if(!n||!name)return alert("Setnummer und Name fehlen.");const qty=Math.max(1,pV3($("pQty").value)||1),price=pV3($("pPrice").value),ship=pV3($("pShipping").value),unit=price+ship/qty;let x=state.collection.find(y=>y.setNumber===n);if(!x){x={setNumber:n,name,quantity:0,purchasePrice:0,currentValue:0,cityArea:$("pArea").value.trim(),category:"",module:$("pModule").value.trim().toUpperCase(),imageUrl:"",condition:$("pCondition").value,buildStatus:"Unbekannt",storage:"",barcode:"",note:"",exemplars:[]};state.collection.push(x)}const oq=pV3(x.quantity),tot=oq*pV3(x.purchasePrice)+qty*unit;x.quantity=oq+qty;x.purchasePrice=x.quantity?tot/x.quantity:unit;x.cityArea=$("pArea").value.trim()||x.cityArea;x.module=$("pModule").value.trim().toUpperCase()||x.module;x.condition=$("pCondition").value||x.condition;x.exemplars=x.exemplars||[];for(let i=0;i<qty;i++)x.exemplars.push({date:$("pDate").value,seller:$("pSeller").value.trim(),condition:$("pCondition").value,price:unit,shipping:ship,box:$("pBox").value,complete:$("pComplete").value,note:$("pNote").value.trim()});if(purchaseFromWishV3)state.wishlist=state.wishlist.filter(w=>w.setNumber!==purchaseFromWishV3);syncModuleV3(x);persist();refresh();$("purchaseModal").classList.remove("show");purchaseFromWishV3=null;switchTab("collection")}
async function scanV3(){
 $("scannerModal").classList.add("show");
 $("scannerStatus").textContent="Kamera wird vorbereitet…";
 try{
   if(!navigator.mediaDevices?.getUserMedia) throw new Error("Kamera-API nicht verfügbar");
   if(window.ZXing?.BrowserMultiFormatReader){
     const codeReader=new ZXing.BrowserMultiFormatReader();
     window._legoCodeReader=codeReader;
     $("scannerStatus").textContent="Kamera wird geöffnet…";
     const devices=await codeReader.listVideoInputDevices();
     const back=devices.find(d=>/back|rear|environment|rück/i.test(d.label))||devices[devices.length-1];
     $("scannerStatus").textContent="Barcode vor die Kamera halten…";
     await codeReader.decodeFromVideoDevice(back?.deviceId||undefined,$("scannerVideo"),(result,err)=>{
       if(result){
         const value=typeof result.getText==="function"?result.getText():String(result.text||result);
         stopScanV3();
         handleBarcodeV3(value);
       }
     });
     return;
   }
   if("BarcodeDetector" in window){
     scanStreamV3=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}});
     $("scannerVideo").srcObject=scanStreamV3;await $("scannerVideo").play();
     const d=new BarcodeDetector({formats:["ean_13","ean_8","upc_a","upc_e","code_128","qr_code"]});
     $("scannerStatus").textContent="Barcode vor die Kamera halten…";
     const loop=async()=>{if(!scanStreamV3)return;try{const c=await d.detect($("scannerVideo"));if(c.length){const v=c[0].rawValue;stopScanV3();handleBarcodeV3(v);return}}catch{}requestAnimationFrame(loop)};loop();return;
   }
   throw new Error("Scannerbibliothek nicht geladen");
 }catch(e){
   $("scannerStatus").textContent="Live-Kamera ist in diesem iPhone-Kontext nicht freigegeben. Nutze „Barcode fotografieren“ – das öffnet die Kamera über iOS und liest das Foto danach automatisch.";
 }
}
function stopScanV3(close=true){
 try{window._legoCodeReader?.reset?.()}catch{}
 window._legoCodeReader=null;
 scanStreamV3?.getTracks?.().forEach(t=>t.stop());scanStreamV3=null;
 if($("scannerVideo"))$("scannerVideo").srcObject=null;
 if(close)$("scannerModal").classList.remove("show");
}
async function decodePhotoV3(file){
 if(!file)return;
 $("scannerModal").classList.add("show");
 $("scannerStatus").textContent="Foto wird gelesen…";
 try{
   if(!window.ZXing?.BrowserMultiFormatReader)throw new Error("Scannerbibliothek nicht geladen");
   const reader=new ZXing.BrowserMultiFormatReader();
   const url=URL.createObjectURL(file);
   try{
     const img=new Image();
     img.src=url;
     await img.decode();
     let result;
     if(typeof reader.decodeFromImageElement==="function") result=await reader.decodeFromImageElement(img);
     else if(typeof reader.decodeFromImageUrl==="function") result=await reader.decodeFromImageUrl(url);
     else throw new Error("Foto-Erkennung wird von dieser Browser-Version nicht unterstützt");
     const value=typeof result?.getText==="function"?result.getText():String(result?.text||"");
     if(!value)throw new Error("Kein Barcode erkannt");
     stopScanV3();
     handleBarcodeV3(value);
   } finally { URL.revokeObjectURL(url); }
 }catch(e){
   $("scannerStatus").textContent="Auf dem Foto wurde kein lesbarer Barcode erkannt. Bitte näher herangehen, scharf fotografieren oder manuell eingeben.";
 }
}
function handleBarcodeV3(c){const x=state.collection.find(s=>String(s.barcode||"")===String(c));if(x)showDetailV3(x.setNumber);else{openSet();$("fBarcode").value=c}}
function bindV3(){fillAreaFilterV3();$("toggleView").onclick=()=>{collectionModeV3=collectionModeV3==="list"?"grid":"list";renderCollection()};$("areaFilter").onchange=renderCollection;$("quickBuy").onclick=()=>openPurchaseV3();$("quickExport").onclick=()=>$("exportJson").click();$("purchaseGeneral").onclick=()=>openPurchaseV3();$("savePurchase").onclick=savePurchaseV3;$("cancelPurchase").onclick=$("closePurchaseX").onclick=()=>{$("purchaseModal").classList.remove("show");purchaseFromWishV3=null};$("closeDetail").onclick=()=>$("detailModal").classList.remove("show");document.querySelectorAll(".hotspot").forEach(b=>b.onclick=()=>renderCityV3(b.dataset.area));$("clearCityFilter").onclick=()=>renderCityV3();$("resetModules").onclick=()=>{state.modules=structuredClone(DEFAULT_MODULES_V3);state.collection.forEach(x=>x.module=moduleForV3(x.setNumber)||x.module||"");persist();refresh()};$("scanTop").onclick=$("scanSettings").onclick=scanV3;$("closeScanner").onclick=stopScanV3;$("barcodePhoto").onchange=e=>{const f=e.target.files?.[0];if(f)decodePhotoV3(f);e.target.value=""};$("manualBarcode").onclick=()=>{const c=prompt("Barcode / EAN eingeben:");if(c){stopScanV3();handleBarcodeV3(c)}};if($("reloadEnrichment"))$("reloadEnrichment").onclick=()=>loadEnrichmentV3(true);const oldSwitch=switchTab;switchTab=function(id){oldSwitch(id);if(id==="analysis")renderAnalysisV3()};$("saveWish").onclick=()=>{const n=$("wSet").value.trim(),name=$("wName").value.trim();if(!n||!name)return alert("Setnummer und Name fehlen.");const o={priority:$("wPrio").value,setNumber:n,name,area:$("wArea").value.trim(),rrp:pV3($("wRrp").value),price:pV3($("wPrice").value),limit:pV3($("wLimit").value),offer:pV3($("wOffer").value),imageUrl:$("wImage").value.trim(),reason:$("wReason").value.trim()},ex=state.wishlist.find(x=>x.setNumber===n);if(ex)Object.assign(ex,o);else state.wishlist.push(o);persist();refresh();$("wishModal").classList.remove("show")};$("saveOffer").onclick=()=>{const title=$("oTitle").value.trim();if(!title)return alert("Titel fehlt.");const sw=String($("oSwitches").value||"").split("/").map(x=>pV3(x.trim()));state.classifiedOffers.push({title,location:$("oLocation").value.trim(),price:pV3($("oPrice").value),status:$("oStatus").value,details:$("oDetails").value.trim(),note:$("oNote").value.trim(),trackQty:{straight:pV3($("oStraight").value),curve:pV3($("oCurve").value),flex:pV3($("oFlex").value),switchL:sw[0]||0,switchR:sw[1]||0}});persist();refresh();$("offerModal").classList.remove("show")}}
migrateV3();bindV3();refresh();loadEnrichmentV3();

let enrichmentV3={meta:{},sets:{}};
function chooseMarketV3(x,e){
 const c=nV3(x.condition||x.buildStatus);
 if(c.includes("neu")||c.includes("ovp"))return pV3(e.marketNewEUR);
 return pV3(e.marketUsedEUR)||pV3(e.marketNewEUR);
}
function applyEnrichmentV3(){
 let changed=false;
 for(const x of state.collection){
   const e=enrichmentV3.sets?.[String(x.setNumber)];
   if(!e)continue;
   if(!x.imageUrl&&e.imageUrl){x.imageUrl=e.imageUrl;changed=true}
   if(!x.barcode&&(e.ean||e.upc)){x.barcode=e.ean||e.upc;changed=true}
   const mv=chooseMarketV3(x,e);
   if(mv>0&&x.marketAuto!==false&&pV3(x.currentValue)!==mv){x.currentValue=mv;x.valueSource="BrickEconomy";changed=true}
   x.market={...(x.market||{}),...e};
 }
 for(const w of state.wishlist){
   const e=enrichmentV3.sets?.[String(w.setNumber)];
   if(!e)continue;
   if(!w.imageUrl&&e.imageUrl){w.imageUrl=e.imageUrl;changed=true}
   if(!pV3(w.rrp)&&pV3(e.rrpEUR)){w.rrp=pV3(e.rrpEUR);changed=true}
   w.market={...(w.market||{}),...e};
 }
 if(changed)persist();
}
function renderEnrichmentStatusV3(){
 if(!$("catalogSyncStatus"))return;
 const m=enrichmentV3.meta||{},sets=enrichmentV3.sets||{},vals=Object.values(sets);
 const img=vals.filter(x=>x.imageUrl).length,prices=vals.filter(x=>pV3(x.marketNewEUR)||pV3(x.marketUsedEUR)).length;
 $("catalogSyncStatus").innerHTML=
   '<div class="miniStat"><span>Bilder</span><b>'+img+'</b></div>'+
   '<div class="miniStat"><span>Marktwerte</span><b>'+prices+'</b></div>'+
   '<div class="miniStat"><span>Letzte Aktualisierung</span><b class="syncDate">'+(m.lastUpdated?new Date(m.lastUpdated).toLocaleDateString("de-DE"):"–")+'</b></div>';
 const ready=m.rebrickableEnabled||m.brickeconomyEnabled;
 $("catalogSyncNote").textContent=ready
   ? 'Automatik aktiv. Marktwerte werden je nach Zustand als Neu- oder Gebrauchtwert übernommen.'
   : 'Automatik ist vorbereitet. Für den ersten Lauf müssen einmalig die GitHub-Secrets REBRICKABLE_API_KEY und BRICKECONOMY_API_KEY hinterlegt werden.';
}
async function loadEnrichmentV3(force=false){
 try{
   const r=await fetch('./data/set-enrichment.json'+(force?'?t='+Date.now():''),{cache:force?'no-store':'default'});
   if(!r.ok)throw new Error('HTTP '+r.status);
   enrichmentV3=await r.json();
   applyEnrichmentV3();
   renderEnrichmentStatusV3();
   refresh();
 }catch(e){
   if($("catalogSyncNote"))$("catalogSyncNote").textContent='Online-Daten konnten gerade nicht geladen werden.';
 }
}
