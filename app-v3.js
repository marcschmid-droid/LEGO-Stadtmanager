/* v21 Supabase account + private per-user cloud state */
let cloudV3=null,cloudUserV3=null,cloudSaveTimerV3=null,cloudApplyingV3=false;
const CLOUD_CACHE_PREFIX_V3="lego-stadtmanager-cloud-cache-v21-";
function blankStateV3(){return {collection:[],wishlist:[],trackShopping:JSON.parse(JSON.stringify(DEFAULT_TRACKS||[])),classifiedOffers:[],meta:{}}}
function cloudStatusV3(t){if($("cloudStatus"))$("cloudStatus").textContent=t||""}
function cloudCacheKeyV3(id){return CLOUD_CACHE_PREFIX_V3+id}
function updateAccountBadgeV3(){
 if(!$("userTop"))return;
 const e=cloudUserV3?.email||"";
 $("userTop").textContent=e?e.charAt(0).toUpperCase():"👤";
 $("userTop").title=e?"Konto: "+e:"Anmelden";
}
async function initCloudV3(){
 const cfg=window.LEGO_SUPABASE;if(!cfg||!window.supabase)return;
 cloudV3=window.supabase.createClient(cfg.url,cfg.publishableKey);
 if($("userTop"))$("userTop").onclick=()=>switchTab("users");
 if($("cloudLogin"))$("cloudLogin").onclick=async()=>{const email=$("cloudEmail").value.trim(),password=$("cloudPassword").value;const {error}=await cloudV3.auth.signInWithPassword({email,password});if(error)alert(error.message)};
 if($("cloudRegister"))$("cloudRegister").onclick=async()=>{const email=$("cloudEmail").value.trim(),password=$("cloudPassword").value;if(!email||password.length<6)return alert("Bitte E-Mail und mindestens 6 Zeichen Passwort eingeben.");const {data,error}=await cloudV3.auth.signUp({email,password,options:{emailRedirectTo:"https://marcschmid-droid.github.io/LEGO-Stadtmanager/"}});if(error)return alert(error.message);alert(data.session?"Konto erstellt und angemeldet.":"Konto erstellt. Bitte bestätige die E-Mail und melde dich danach an.")};
 if($("cloudLogout"))$("cloudLogout").onclick=async()=>{await cloudV3.auth.signOut()};
 if($("cloudDeleteData"))$("cloudDeleteData").onclick=async()=>{
   if(!cloudUserV3)return;
   if(!confirm("Wirklich alle Cloud-Daten dieses Kontos löschen? Diese Aktion kann nicht rückgängig gemacht werden."))return;
   const {error}=await cloudV3.from("user_state").delete().eq("user_id",cloudUserV3.id);
   if(error)return alert("Löschen fehlgeschlagen: "+error.message);
   localStorage.removeItem(cloudCacheKeyV3(cloudUserV3.id));
   cloudApplyingV3=true;state=blankStateV3();migrate();migrateV3();refresh();cloudApplyingV3=false;
   cloudStatusV3("Cloud-Daten gelöscht.");
 };
 if($("cloudDeleteAccount"))$("cloudDeleteAccount").onclick=async()=>{
   if(!cloudUserV3)return;
   if(!confirm("Konto wirklich vollständig löschen? Dabei werden Konto und Cloud-Daten endgültig gelöscht."))return;
   const {error}=await cloudV3.rpc("delete_own_account");
   if(error)return alert("Kontolöschung ist noch nicht freigeschaltet: "+error.message);
   localStorage.removeItem(cloudCacheKeyV3(cloudUserV3.id));
   await cloudV3.auth.signOut();alert("Konto wurde gelöscht.");
 };
 if($("cloudSync"))$("cloudSync").onclick=()=>cloudSaveV3(true);
 const {data}=await cloudV3.auth.getSession();await cloudSessionV3(data.session);
 cloudV3.auth.onAuthStateChange((_e,s)=>setTimeout(()=>cloudSessionV3(s),0));
}
async function cloudSessionV3(session){
 cloudUserV3=session?.user||null;
 $("cloudSignedOut")?.classList.toggle("hidden",!!cloudUserV3);
 $("cloudSignedIn")?.classList.toggle("hidden",!cloudUserV3);
 if($("cloudUserEmail"))$("cloudUserEmail").textContent=cloudUserV3?.email||"";
 updateAccountBadgeV3();
 if(!cloudUserV3){
   cloudApplyingV3=true;
   state=blankStateV3();migrate();migrateV3();refresh();
   cloudApplyingV3=false;
   cloudStatusV3("");
   switchTab("users");
   return;
 }
 cloudStatusV3("Cloud-Daten werden geladen…");
 const cacheKey=cloudCacheKeyV3(cloudUserV3.id);
 const {data,error}=await cloudV3.from("user_state").select("state").eq("user_id",cloudUserV3.id).maybeSingle();
 if(error){
   const cached=localStorage.getItem(cacheKey);
   if(cached){try{cloudApplyingV3=true;state=JSON.parse(cached);migrate();migrateV3();refresh();cloudApplyingV3=false;cloudStatusV3("Offline-Kopie geladen. Cloud aktuell nicht erreichbar.");return}catch{}}
   cloudStatusV3("Cloud-Daten konnten nicht geladen werden: "+error.message);return;
 }
 if(data?.state){
   cloudApplyingV3=true;state=data.state;migrate();migrateV3();refresh();cloudApplyingV3=false;
   localStorage.setItem(cacheKey,JSON.stringify(state));persistBaseV3();cloudStatusV3("Cloud-Daten geladen.");
 }else{
   // First login: import the existing pre-v21 local collection once.
   const legacy=localStorage.getItem(STORE);
   if(legacy){try{const old=JSON.parse(legacy);if((old.collection||[]).length){cloudApplyingV3=true;state=old;migrate();migrateV3();cloudApplyingV3=false;}}catch{}}
   await cloudSaveV3(true);cloudStatusV3("Deine bestehende Sammlung wurde diesem Konto zugeordnet.");
 }
 refresh();
}
async function cloudSaveV3(show=false){
 if(!cloudV3||!cloudUserV3||cloudApplyingV3)return;
 localStorage.setItem(cloudCacheKeyV3(cloudUserV3.id),JSON.stringify(state));
 const {error}=await cloudV3.from("user_state").upsert({user_id:cloudUserV3.id,state,updated_at:new Date().toISOString()},{onConflict:"user_id"});
 if(show)cloudStatusV3(error?"Synchronisierung fehlgeschlagen: "+error.message:"Synchronisiert: "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}));
}
function queueCloudSaveV3(){if(!cloudUserV3||cloudApplyingV3)return;clearTimeout(cloudSaveTimerV3);cloudSaveTimerV3=setTimeout(()=>cloudSaveV3(false),700)}
const persistBaseV3=persist;
persist=function(){persistBaseV3();queueCloudSaveV3()};

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
 state.meta={version:"3.0",brickrInvestmentReference:18026.14,investmentBaseline:18026.14,investmentBaselineQty:245,...(state.meta||{})};
 const keys=["straight","curve","flex","switchL","switchR"];state.trackShopping=(state.trackShopping||[]).map((x,i)=>({...x,key:x.key||keys[i]}));
 state.classifiedOffers=(state.classifiedOffers||[]).map(o=>({...o,trackQty:o.trackQty||inferTrackV3(o.details)}));
 state.collection.forEach(x=>{
   if(String(x.setNumber)==="10390"&&nV3(x.name).includes("vielsaft"))x.setNumber="76386";
   x.exemplars=x.exemplars||[];x.condition=x.condition||"Unbekannt";x.buildStatus=x.buildStatus||"Unbekannt";x.storage=x.storage||"";x.barcode=x.barcode||"";x.module=x.module||moduleForV3(x.setNumber)||""
 });
 state.wishlist.forEach(w=>{w.rrp=pV3(w.rrp);w.limit=pV3(w.limit);w.offer=pV3(w.offer)});
 persist();
}
function totalsV3(){const qty=state.collection.reduce((s,x)=>s+pV3(x.quantity),0),baseline=pV3(state.meta?.investmentBaseline||state.meta?.brickrInvestmentReference||18026.14),added=state.collection.reduce((s,x)=>s+(x.exemplars||[]).filter(e=>e.addedAfterBaseline).reduce((a,e)=>a+pV3(e.price),0),0),inv=baseline+added,val=state.collection.reduce((s,x)=>s+pV3(x.quantity)*pV3(x.currentValue),0);return{qty,inv,val,gain:val-inv,pct:inv?(val-inv)/inv*100:0}}
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
function renderHomeV3(){const t=totalsV3();if($("kInvest"))$("kInvest").textContent=euro(t.inv);if($("investRef"))$("investRef").textContent="Bestätigte Basis: "+euro(state.meta?.investmentBaseline||18026.14);if($("kValue"))$("kValue").textContent=euro(t.val);if($("kGain"))$("kGain").textContent=euro(t.gain);if($("kGainPct"))$("kGainPct").textContent=t.pct.toFixed(1).replace(".",",")+" %";const g={};state.collection.forEach(x=>{const a=shortAreaV3(x.cityArea||"Ohne Bereich");g[a]=(g[a]||0)+pV3(x.quantity)});if($("homeCityStats"))$("homeCityStats").innerHTML=Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([k,v])=>'<div class="miniStat"><span>'+esc(k)+'</span><b>'+v+'</b></div>').join("");const miss=state.trackShopping.reduce((s,x)=>s+Math.max(0,pV3(x.target)-pV3(x.confirmedOwned)-reservedV3(x.key)),0);if($("homeTrackStats"))$("homeTrackStats").innerHTML='<div class="miniStat"><span>Offene Teile</span><b>'+miss+'</b></div><div class="miniStat"><span>Angefragte Angebote</span><b>'+state.classifiedOffers.filter(o=>o.status==="Angefragt").length+'</b></div>'}
function renderAnalysisV3(){const t=totalsV3(),valued=state.collection.filter(x=>pV3(x.currentValue)>0).length,sized=state.collection.filter(x=>(pV3(x.width)>0&&pV3(x.depth)>0)||(Array.isArray(x.modelDimensions)&&x.modelDimensions.filter(v=>pV3(v)>0).length===3)).length,area=state.collection.reduce((s,x)=>s+footprintAreaCm2V526(x),0)/10000;if(!$("aValued"))return;$("aValued").textContent=valued;$("aSized").textContent=sized;$("aArea").textContent=area.toFixed(2).replace(".",",")+" m²";const g={};state.collection.forEach(x=>{const a=shortAreaV3(x.cityArea||"Ohne Bereich");g[a]=(g[a]||0)+pV3(x.quantity)});$("aZones").textContent=Object.keys(g).length;const mx=Math.max(...Object.values(g),1);$("areaAnalysis").innerHTML=Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div class="barrow"><span>'+esc(k)+'</span><div class="bar"><i style="width:'+(v/mx*100)+'%"></i></div><b>'+v+'</b></div>').join("");$("valueAnalysis").innerHTML='<div class="miniStats"><div class="miniStat"><span>Investment</span><b>'+euro(t.inv)+'</b></div><div class="miniStat"><span>Erfasster Wert</span><b>'+euro(t.val)+'</b></div><div class="miniStat"><span>Differenz</span><b>'+euro(t.gain)+'</b></div><div class="miniStat"><span>Rendite</span><b>'+t.pct.toFixed(1).replace(".",",")+' %</b></div></div><p class="hint">Aktuelle Werte sind nur für gepflegte Sets aussagekräftig.</p>';const q=[["Ohne Bild",state.collection.filter(x=>!x.imageUrl).length],["Ohne aktuellen Wert",state.collection.filter(x=>!pV3(x.currentValue)).length],["Ohne vollständige Maße",state.collection.filter(x=>!(pV3(x.width)&&pV3(x.depth)&&pV3(x.height))&&!(Array.isArray(x.modelDimensions)&&x.modelDimensions.filter(v=>pV3(v)>0).length===3)).length],["Ohne Modul",state.collection.filter(x=>!x.module).length],["Ohne Lagerort",state.collection.filter(x=>!x.storage).length]];$("qualityAnalysis").innerHTML='<div class="qualitylist">'+q.map(([k,v])=>'<div class="qualityitem"><span>'+k+'</span><b>'+v+'</b></div>').join("")+'</div>'}
const oldRefreshV3=refresh;refresh=function(){oldRefreshV3();fillAreaFilterV3();renderCollection();renderWishlist();renderCityV3();renderModulesV3();renderTracks();renderOffers();renderHomeV3();if(document.querySelector("#analysis.active"))renderAnalysisV3()}
function syncModuleV3(x){for(const m in state.modules)state.modules[m]=state.modules[m].filter(n=>n!==x.setNumber);if(x.module){state.modules[x.module]=state.modules[x.module]||[];if(!state.modules[x.module].includes(x.setNumber))state.modules[x.module].push(x.setNumber)}}
const oldOpenSetV3=openSet;openSet=function(x=null){oldOpenSetV3(x);if($("fModule"))$("fModule").value=x?.module||"";if($("fCondition"))$("fCondition").value=x?.condition||"Unbekannt";if($("fBuild"))$("fBuild").value=x?.buildStatus||"Unbekannt";if($("fStorage"))$("fStorage").value=x?.storage||"";if($("fBarcode"))$("fBarcode").value=x?.barcode||"";if($("fPurchaseDate"))$("fPurchaseDate").value=x?.purchaseDate||"";if($("fSeller"))$("fSeller").value=x?.seller||""}
const oldSaveSetV3=saveSet;saveSet=function(){const was=editing;oldSaveSetV3();const n=was||$("fSet")?.value?.trim();const x=state.collection.find(y=>y.setNumber===n);if(x){x.module=$("fModule")?.value.trim().toUpperCase()||x.module||"";x.condition=$("fCondition")?.value||x.condition||"Unbekannt";x.buildStatus=$("fBuild")?.value||x.buildStatus||"Unbekannt";x.storage=$("fStorage")?.value.trim()||x.storage||"";x.barcode=$("fBarcode")?.value.trim()||x.barcode||"";x.purchaseDate=$("fPurchaseDate")?.value||x.purchaseDate||"";x.seller=$("fSeller")?.value.trim()||x.seller||"";syncModuleV3(x);persist();refresh()}}
window.showDetailV3=n=>{const x=state.collection.find(y=>y.setNumber===n);if(!x)return;const gain=(pV3(x.currentValue)-pV3(x.purchasePrice))*pV3(x.quantity);$("detailTitle").textContent=x.setNumber+" · "+x.name;$("detailContent").innerHTML='<div class="detailHero"><div class="detailPic">'+(x.imageUrl?'<img src="'+esc(x.imageUrl)+'">':'<b>LEGO '+esc(x.setNumber)+'</b>')+'</div><div><div class="detailFacts"><div class="fact"><small>Anzahl</small><b>'+pV3(x.quantity)+'</b></div><div class="fact"><small>Kaufpreis</small><b>'+euro(x.purchasePrice)+'</b></div><div class="fact"><small>Aktueller Wert</small><b>'+euro(x.currentValue)+'</b></div><div class="fact"><small>Gewinn / Verlust</small><b>'+euro(gain)+'</b></div><div class="fact"><small>Stadtbereich</small><b>'+esc(x.cityArea||"–")+'</b></div><div class="fact"><small>Modul</small><b>'+esc(x.module||"–")+'</b></div><div class="fact"><small>Maße</small><b>'+((pV3(x.width)&&pV3(x.depth)&&pV3(x.height))?((x.width??"–")+' × '+(x.depth??"–")+' × '+(x.height??"–")+' cm'):(Array.isArray(x.modelDimensions)&&x.modelDimensions.filter(v=>pV3(v)>0).length===3?(x.modelDimensions.join(" × ")+' cm · '+esc(x.modelDimensionsSource||"Modellmaße")):"–"))+'</b></div><div class="fact"><small>Zustand</small><b>'+esc(x.condition||"–")+'</b></div><div class="fact"><small>Bauzustand</small><b>'+esc(x.buildStatus||"–")+'</b></div><div class="fact"><small>Lagerort</small><b>'+esc(x.storage||"–")+'</b></div></div><div class="actions"><button class="btn" onclick="editSet(\''+esc(x.setNumber)+'\');document.getElementById(\'detailModal\').classList.remove(\'show\')">Bearbeiten</button><button class="btn secondary" onclick="purchaseSetV3(\''+esc(x.setNumber)+'\')">Weiteres Exemplar kaufen</button></div></div></div>'+(x.note?'<div class="card wide"><b>Notiz</b><p>'+esc(x.note)+'</p></div>':"")+'<div class="card wide marketCard">'+((x.market&&Object.keys(x.market).length)?'<h3>Online-Daten</h3><div class="detailFacts"><div class="fact"><small>Marktwert neu</small><b>'+euro(x.market.marketNewEUR)+'</b></div><div class="fact"><small>Marktwert gebraucht</small><b>'+euro(x.market.marketUsedEUR)+'</b></div><div class="fact"><small>UVP EU</small><b>'+euro(x.market.rrpEUR)+'</b></div><div class="fact"><small>12-Monats-Wachstum</small><b>'+(x.market.growth12mPct??'–')+' %</b></div></div>':'')+'</div><div class="exemplars"><h3>Einzel-Exemplare / Käufe</h3>'+((x.exemplars||[]).length?x.exemplars.map((e,i)=>'<div class="exemplar"><b>#'+(i+1)+'</b> · '+(e.date||"ohne Datum")+' · '+esc(e.condition||"Unbekannt")+' · '+esc(e.seller||"Quelle unbekannt")+' · '+euro(e.price)+'</div>').join(""):'<p class="hint">Noch keine Einzelkäufe separat erfasst.</p>')+'</div>';$("detailModal").classList.add("show")}
function openPurchaseV3(w=null,x=null){purchaseFromWishV3=w?.setNumber||null;$("pSet").value=x?.setNumber||w?.setNumber||"";$("pName").value=x?.name||w?.name||"";$("pQty").value=1;$("pPrice").value=w?.offer||w?.price||x?.purchasePrice||"";$("pShipping").value="";$("pDate").value=new Date().toLocaleDateString("sv-SE");$("pSeller").value="";$("pCondition").value=x?.condition||"Unbekannt";$("pArea").value=x?.cityArea||w?.area||w?.cityArea||"";$("pModule").value=x?.module||"";$("pBox").value="";$("pComplete").value="";$("pNote").value=w?.reason||"";$("purchaseModal").classList.add("show")}
window.buyWishV3=n=>{const w=state.wishlist.find(x=>x.setNumber===n);if(w)openPurchaseV3(w)};window.purchaseSetV3=n=>{const x=state.collection.find(y=>y.setNumber===n);$("detailModal").classList.remove("show");if(x)openPurchaseV3(null,x)}
function savePurchaseV3(){const n=$("pSet").value.trim(),name=$("pName").value.trim();if(!n||!name)return alert("Setnummer und Name fehlen.");const qty=Math.max(1,pV3($("pQty").value)||1),price=pV3($("pPrice").value),ship=pV3($("pShipping").value),unit=price+ship/qty;let x=state.collection.find(y=>y.setNumber===n);if(!x){x={setNumber:n,name,quantity:0,purchasePrice:0,currentValue:0,cityArea:$("pArea").value.trim(),category:"",module:$("pModule").value.trim().toUpperCase(),imageUrl:"",condition:$("pCondition").value,buildStatus:"Unbekannt",storage:"",barcode:"",note:"",exemplars:[]};state.collection.push(x)}const oq=pV3(x.quantity),tot=oq*pV3(x.purchasePrice)+qty*unit;x.quantity=oq+qty;x.purchasePrice=x.quantity?tot/x.quantity:unit;x.cityArea=$("pArea").value.trim()||x.cityArea;x.module=$("pModule").value.trim().toUpperCase()||x.module;x.condition=$("pCondition").value||x.condition;x.exemplars=x.exemplars||[];for(let i=0;i<qty;i++)x.exemplars.push({date:$("pDate").value,seller:$("pSeller").value.trim(),condition:$("pCondition").value,price:unit,shipping:ship,box:$("pBox").value,complete:$("pComplete").value,note:$("pNote").value.trim(),addedAfterBaseline:true});if(purchaseFromWishV3)state.wishlist=state.wishlist.filter(w=>w.setNumber!==purchaseFromWishV3);syncModuleV3(x);persist();refresh();$("purchaseModal").classList.remove("show");purchaseFromWishV3=null;switchTab("collection")}
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
const BARCODE_OVERRIDES_V42={
 "5702017166421":{setNumber:"40529",name:"Children's Amusement Park"}
};
async function handleBarcodeV3(c){
 const code=String(c||"").trim();
 let x=state.collection.find(s=>String(s.barcode||"").trim()===code);
 if(x){showDetailV3(x.setNumber);return}

 const central=await lookupBarcodeCentralV43(code);
 if(central){
   const e={set_name:central.set_name,image_url:central.image_url};
   await useBarcodeSetV43(code,central.set_number,e);
   return;
 }

 try{
   const r=await fetch('./data/set-enrichment.json?t='+Date.now(),{cache:'no-store'});
   if(r.ok)enrichmentV3=await r.json();
 }catch{}
 let hit=Object.entries(enrichmentV3?.sets||{}).find(([n,e])=>[e.ean,e.upc].filter(Boolean).some(v=>String(v).trim()===code));
 if(!hit&&BARCODE_OVERRIDES_V42[code]){
   const o=BARCODE_OVERRIDES_V42[code],e=enrichmentV3?.sets?.[o.setNumber]||{brickeconomyName:o.name,rebrickableName:o.name,ean:code};
   hit=[o.setNumber,e];
 }
 if(hit){
   const [setNumber,e]=hit;
   await learnBarcodeV43(code,setNumber,e.brickeconomyName||e.rebrickableName||"",e.imageUrl||"");
   await useBarcodeSetV43(code,setNumber,e);
   return;
 }
 await handleUnknownBarcodeV43(code);
}
function bindV3(){fillAreaFilterV3();$("toggleView").onclick=()=>{collectionModeV3=collectionModeV3==="list"?"grid":"list";renderCollection()};$("areaFilter").onchange=renderCollection;$("quickBuy").onclick=()=>openPurchaseV3();$("quickExport").onclick=()=>$("exportJson").click();$("purchaseGeneral").onclick=()=>openPurchaseV3();$("savePurchase").onclick=savePurchaseV3;$("cancelPurchase").onclick=$("closePurchaseX").onclick=()=>{$("purchaseModal").classList.remove("show");purchaseFromWishV3=null};$("closeDetail").onclick=()=>$("detailModal").classList.remove("show");document.querySelectorAll(".hotspot").forEach(b=>b.onclick=()=>renderCityV3(b.dataset.area));$("clearCityFilter").onclick=()=>renderCityV3();$("resetModules").onclick=()=>{state.modules=structuredClone(DEFAULT_MODULES_V3);state.collection.forEach(x=>x.module=moduleForV3(x.setNumber)||x.module||"");persist();refresh()};$("scanTop").onclick=$("scanSettings").onclick=scanV3;$("closeScanner").onclick=stopScanV3;$("barcodePhoto").onchange=e=>{const f=e.target.files?.[0];if(f)decodePhotoV3(f);e.target.value=""};$("manualBarcode").onclick=()=>{const c=prompt("Barcode / EAN eingeben:");if(c){stopScanV3();handleBarcodeV3(c)}};if($("reloadEnrichment"))$("reloadEnrichment").onclick=()=>loadEnrichmentV3(true);const oldSwitch=switchTab;switchTab=function(id){oldSwitch(id);if(id==="analysis")renderAnalysisV3()};$("saveWish").onclick=()=>{const n=$("wSet").value.trim(),name=$("wName").value.trim();if(!n||!name)return alert("Setnummer und Name fehlen.");const o={priority:$("wPrio").value,setNumber:n,name,area:$("wArea").value.trim(),rrp:pV3($("wRrp").value),price:pV3($("wPrice").value),limit:pV3($("wLimit").value),offer:pV3($("wOffer").value),imageUrl:$("wImage").value.trim(),reason:$("wReason").value.trim()},ex=state.wishlist.find(x=>x.setNumber===n);if(ex)Object.assign(ex,o);else state.wishlist.push(o);persist();refresh();$("wishModal").classList.remove("show")};$("saveOffer").onclick=()=>{const title=$("oTitle").value.trim();if(!title)return alert("Titel fehlt.");const sw=String($("oSwitches").value||"").split("/").map(x=>pV3(x.trim()));state.classifiedOffers.push({title,location:$("oLocation").value.trim(),price:pV3($("oPrice").value),status:$("oStatus").value,details:$("oDetails").value.trim(),note:$("oNote").value.trim(),trackQty:{straight:pV3($("oStraight").value),curve:pV3($("oCurve").value),flex:pV3($("oFlex").value),switchL:sw[0]||0,switchR:sw[1]||0}});persist();refresh();$("offerModal").classList.remove("show")}}
migrateV3();bindV3();refresh();loadEnrichmentV3();
refresh();

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
   const onlineName=e.brickeconomyName||e.rebrickableName||"";
   if(onlineName&&(/^Set\s+\d+\s*·\s*Daten werden nachgeladen$/i.test(String(x.name||""))||!x.name)){x.name=onlineName;changed=true}
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
 const ready=m.rebrickableEnabled||m.brickeconomyEnabled||m.bricksetEnabled||m.bricklinkEnabled;
 $("catalogSyncNote").textContent=ready
   ? 'Automatik aktiv. Quellen: Rebrickable/Bilder, BrickEconomy/Marktwerte, Brickset/Maße und BrickLink als Preis-Fallback – jeweils soweit Zugangsdaten vorhanden.'
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

initCloudV3();


/* v28 feature bundle: recovery/profile, sync status, exemplar tools, planner, price history */
let plannerSelectedSetV28="";
function todayV28(){return new Date().toISOString().slice(0,10)}
function ensureV28State(){
 state.meta=state.meta||{};
 state.meta.profileName=state.meta.profileName||"";
 state.meta.moduleWidth=Number(state.meta.moduleWidth||25.6);
 state.meta.moduleDepth=Number(state.meta.moduleDepth||25.6);
 state.priceHistory=state.priceHistory||{};
 state.collection=(state.collection||[]).map(x=>{
   x.exemplars=x.exemplars||[];
   const q=Math.max(1,pV3(x.quantity)||1);
   while(x.exemplars.length<q)x.exemplars.push({legacy:true,date:x.purchaseDate||"",seller:x.seller||"",condition:x.condition||"Unbekannt",price:pV3(x.purchasePrice),shipping:0,box:"",complete:"",note:"Historischer Bestand"});
   return x;
 });
}
const migrateBaseV28=migrateV3;
migrateV3=function(){migrateBaseV28();ensureV28State()};

function accountEnhanceV28(){
 const card=$("cloudAccountCard"); if(!card||$("profileNameV28"))return;
 const status=document.createElement("div"); status.className="syncbox"; status.innerHTML='<b id="syncStateV28">Synchronisation</b><span id="syncTextV28">wird geprüft…</span>'; card.appendChild(status);
 const signedOut=$("cloudSignedOut");
 if(signedOut){
   const b=document.createElement("button");b.className="btn secondary";b.id="cloudForgotV28";b.textContent="Passwort vergessen";signedOut.querySelector(".actions")?.appendChild(b);
   b.onclick=async()=>{const email=$("cloudEmail")?.value.trim()||prompt("E-Mail-Adresse:")||"";if(!email)return;const {error}=await cloudV3.auth.resetPasswordForEmail(email,{redirectTo:"https://marcschmid-droid.github.io/LEGO-Stadtmanager/"});alert(error?error.message:"E-Mail zum Zurücksetzen wurde versendet.")};
 }
 const signedIn=$("cloudSignedIn");
 if(signedIn){
   const box=document.createElement("div");box.className="profilebox";box.innerHTML='<label>Profilname<input id="profileNameV28" maxlength="40" placeholder="z. B. Marc"></label><button class="btn secondary" id="saveProfileV28">Profil speichern</button>';signedIn.insertBefore(box,signedIn.querySelector(".actions"));
   $("profileNameV28").value=state.meta?.profileName||"";
   $("saveProfileV28").onclick=()=>{state.meta.profileName=$("profileNameV28").value.trim();persist();updateAccountBadgeV3();alert("Profil gespeichert.")};
 }
 updateSyncV28();
}
function updateSyncV28(msg){
 const a=$("syncStateV28"),b=$("syncTextV28");if(!a||!b)return;
 if(!navigator.onLine){a.textContent="Offline";b.textContent="Änderungen werden lokal gespeichert.";return}
 a.textContent=cloudUserV3?"Cloud verbunden":"Nicht angemeldet";
 b.textContent=msg||(cloudUserV3?"Daten werden automatisch synchronisiert.":"Bitte anmelden, um geräteübergreifend zu synchronisieren.");
}
window.addEventListener("online",()=>updateSyncV28("Verbindung wiederhergestellt."));
window.addEventListener("offline",()=>updateSyncV28());

const cloudSaveBaseV28=cloudSaveV3;
cloudSaveV3=async function(show=false){updateSyncV28("Synchronisiere…");const r=await cloudSaveBaseV28(show);updateSyncV28("Cloud aktuell · "+new Date().toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"}));return r};
const badgeBaseV28=updateAccountBadgeV3;
updateAccountBadgeV3=function(){badgeBaseV28();if($("userTop")&&cloudUserV3&&state.meta?.profileName){$("userTop").textContent=state.meta.profileName.charAt(0).toUpperCase();$("userTop").title=state.meta.profileName+" · "+cloudUserV3.email}if($("profileNameV28"))$("profileNameV28").value=state.meta?.profileName||""};

function bindRecoveryV28(){
 const wait=()=>{if(!cloudV3){setTimeout(wait,250);return}cloudV3.auth.onAuthStateChange(async(e)=>{if(e==="PASSWORD_RECOVERY"){const p=prompt("Neues Passwort (mindestens 6 Zeichen):");if(!p)return;if(p.length<6)return alert("Passwort ist zu kurz.");const {error}=await cloudV3.auth.updateUser({password:p});alert(error?error.message:"Passwort wurde geändert.")}setTimeout(accountEnhanceV28,50)});accountEnhanceV28()};wait();
}

const saveSetBaseV28=saveSet;
saveSet=function(){
 const n=$("fSet")?.value.trim();
 if(!editing&&n&&state.collection.some(x=>String(x.setNumber)===String(n))){
   if(!confirm("Dieses Set ist bereits vorhanden. Als weiteres Exemplar zum vorhandenen Set hinzufügen?"))return;
 }
 const r=saveSetBaseV28();ensureV28State();persist();refresh();return r;
};

window.editExemplarV28=(setNumber,index)=>{
 const x=state.collection.find(y=>String(y.setNumber)===String(setNumber)),e=x?.exemplars?.[index];if(!e)return;
 const price=prompt("Kaufpreis (€):",String(e.price??""));if(price===null)return;
 const date=prompt("Kaufdatum (JJJJ-MM-TT):",e.date||"")??e.date;
 const seller=prompt("Verkäufer / Quelle:",e.seller||"")??e.seller;
 const condition=prompt("Zustand:",e.condition||"Unbekannt")??e.condition;
 const note=prompt("Notiz:",e.note||"")??e.note;
 Object.assign(e,{price:pV3(String(price).replace(",",".")),date,seller,condition,note});
 const vals=x.exemplars.map(v=>pV3(v.price)).filter(v=>v>0);if(vals.length)x.purchasePrice=vals.reduce((a,b)=>a+b,0)/vals.length;
 persist();refresh();showDetailV3(setNumber);
};
window.deleteExemplarV28=(setNumber,index)=>{
 const x=state.collection.find(y=>String(y.setNumber)===String(setNumber));if(!x||!confirm("Dieses einzelne Exemplar wirklich löschen?"))return;
 x.exemplars.splice(index,1);x.quantity=Math.max(0,pV3(x.quantity)-1);
 if(x.quantity===0){state.collection=state.collection.filter(y=>y!==x);$("detailModal")?.classList.remove("show")}else showDetailV3(setNumber);
 persist();refresh();
};
const detailBaseV28=showDetailV3;
showDetailV3=function(n){
 detailBaseV28(n);const x=state.collection.find(y=>String(y.setNumber)===String(n));if(!x)return;
 const ex=$("detailContent")?.querySelector(".exemplars");if(!ex)return;
 ex.innerHTML='<h3>Einzel-Exemplare / Käufe</h3>'+x.exemplars.map((e,i)=>'<div class="exemplar"><div><b>#'+(i+1)+'</b> · '+esc(e.date||"ohne Datum")+' · '+esc(e.condition||"Unbekannt")+' · '+esc(e.seller||"Quelle unbekannt")+' · '+euro(e.price)+(e.legacy?' <span class="chip">Bestandsimport</span>':'')+'</div><div class="actions"><button class="rowbtn" onclick="editExemplarV28(\''+esc(x.setNumber)+'\','+i+')">✏️ Bearbeiten</button><button class="rowbtn" onclick="deleteExemplarV28(\''+esc(x.setNumber)+'\','+i+')">🗑 Löschen</button></div></div>').join("");
};

function fitWarningV28(x){
 const mw=pV3(state.meta.moduleWidth)||25.6,md=pV3(state.meta.moduleDepth)||25.6,f=footprintV526(x);
 if(!f)return "Keine eindeutig zugeordnete Stellfläche – Passform kann nicht verlässlich geprüft werden.";
 const w=f.w,d=f.d;
 if((w<=mw&&d<=md)||(d<=mw&&w<=md))return "Passt in ein Standardmodul ("+mw+" × "+md+" cm).";
 return "⚠️ Größer als ein Standardmodul ("+mw+" × "+md+" cm).";
}
function setupPlannerV28(){
 const panel=$("city");
 // v50.15: the modern City Planner Pro replaces the old second planner card.
 if(panel?.querySelector(".cityPlannerCardV49")){$("plannerV28")?.remove();return}
 if(!panel||$("plannerV28"))return;
 const card=document.createElement("div");card.className="card wide";card.id="plannerV28";
 card.innerHTML='<div class="sectionHead"><div><h2>Drag-&-Drop Stadtplan</h2><p class="hint">Am Computer ein Set auf ein Modul ziehen. Auf dem iPhone: Set auswählen, Modul antippen und „Zuordnen“ drücken.</p></div></div><div class="plannerControls"><label>Modulbreite (cm)<input id="moduleWV28" type="number" step="0.1"></label><label>Modultiefe (cm)<input id="moduleDV28" type="number" step="0.1"></label><label>Set<select id="plannerSetV28"></select></label><button class="btn" id="assignModuleV28">Ausgewähltem Modul zuordnen</button></div><p id="fitV28" class="hint"></p><div id="dragSetsV28" class="dragSets"></div>';
 panel.appendChild(card);
 $("moduleWV28").value=state.meta.moduleWidth;$("moduleDV28").value=state.meta.moduleDepth;
 const saveDims=()=>{state.meta.moduleWidth=pV3($("moduleWV28").value)||25.6;state.meta.moduleDepth=pV3($("moduleDV28").value)||25.6;persist();renderPlannerV28()};$("moduleWV28").onchange=saveDims;$("moduleDV28").onchange=saveDims;
 $("plannerSetV28").onchange=e=>{plannerSelectedSetV28=e.target.value;renderPlannerV28()};
 $("assignModuleV28").onclick=()=>{const m=document.querySelector(".module.active")?.dataset.module;if(!plannerSelectedSetV28)return alert("Bitte zuerst ein Set auswählen.");if(!m)return alert("Bitte zuerst ein Modul antippen.");assignModuleV28(plannerSelectedSetV28,m)};
 renderPlannerV28();
}
function renderPlannerV28(){
 if(!$("plannerSetV28"))return;
 const sets=state.collection.filter(x=>String(x.setNumber));
 $("plannerSetV28").innerHTML='<option value="">Set auswählen…</option>'+sets.map(x=>'<option value="'+esc(x.setNumber)+'" '+(String(x.setNumber)===String(plannerSelectedSetV28)?'selected':'')+'>'+esc(x.setNumber)+' · '+esc(x.name)+'</option>').join("");
 const x=sets.find(y=>String(y.setNumber)===String(plannerSelectedSetV28));$("fitV28").textContent=x?fitWarningV28(x):"";
 $("dragSetsV28").innerHTML=sets.slice(0,80).map(x=>'<div class="dragSet" draggable="true" data-set="'+esc(x.setNumber)+'"><b>'+esc(x.setNumber)+'</b><span>'+esc(x.name)+'</span></div>').join("");
 document.querySelectorAll(".dragSet").forEach(el=>el.ondragstart=e=>e.dataTransfer.setData("text/plain",el.dataset.set));
 document.querySelectorAll(".module[data-module]").forEach(el=>{el.ondragover=e=>e.preventDefault();el.ondrop=e=>{e.preventDefault();assignModuleV28(e.dataTransfer.getData("text/plain"),el.dataset.module)}});
}
function assignModuleV28(setNumber,module){
 const x=state.collection.find(y=>String(y.setNumber)===String(setNumber));if(!x)return;
 x.module=module;syncModuleV3(x);persist();refresh();renderPlannerV28();$("fitV28").textContent=fitWarningV28(x)+" Zugeordnet zu "+module+".";
}
const renderModulesBaseV28=renderModulesV3;
renderModulesV3=function(){renderModulesBaseV28();setTimeout(renderPlannerV28,0)};

function recordPriceV28(setNumber,e,current){
 state.priceHistory=state.priceHistory||{};const a=state.priceHistory[setNumber]=state.priceHistory[setNumber]||[],day=todayV28();
 const row={date:day,newEUR:pV3(e.marketNewEUR),usedEUR:pV3(e.marketUsedEUR),currentEUR:pV3(current)};
 const last=a[a.length-1];if(!last||last.date!==day||last.newEUR!==row.newEUR||last.usedEUR!==row.usedEUR||last.currentEUR!==row.currentEUR){a.push(row);if(a.length>180)a.splice(0,a.length-180)}
}
function checkWishAlertsV28(){
 const hits=[];
 for(const w of state.wishlist||[]){const e=enrichmentV3.sets?.[String(w.setNumber)];if(!e||!pV3(w.limit))continue;const market=pV3(e.marketNewEUR)||pV3(e.marketUsedEUR);if(market&&market<=pV3(w.limit))hits.push({w,market})}
 state.meta.wishAlerts=hits.map(h=>({setNumber:h.w.setNumber,name:h.w.name,market:h.market,limit:pV3(h.w.limit),date:todayV28()}));
 renderWishAlertsV28();
}
function renderWishAlertsV28(){
 let box=$("wishAlertsV28");if(!box){const home=$("home");if(!home)return;box=document.createElement("div");box.id="wishAlertsV28";box.className="card wide";home.appendChild(box)}
 const h=state.meta?.wishAlerts||[];box.innerHTML='<div class="sectionHead"><div><h2>Marktwert-Hinweise</h2><p class="hint">Vergleich von geschätzten Marktwerten mit deiner Kaufgrenze. Diese Werte sind keine Händlerangebote.</p></div><button class="btn secondary" id="notifyV28">Benachrichtigungen aktivieren</button></div>'+(h.length?h.map(x=>'<div class="alertRow"><b>'+esc(x.setNumber)+' · '+esc(x.name)+'</b><span>'+euro(x.market)+' ≤ '+euro(x.limit)+'</span></div>').join(""):'<p class="hint">Aktuell kein Set unter deiner Kaufgrenze.</p>');
 if($("notifyV28"))$("notifyV28").onclick=async()=>{if(!("Notification" in window))return alert("Benachrichtigungen werden von diesem Gerät nicht unterstützt.");const p=await Notification.requestPermission();alert(p==="granted"?"Benachrichtigungen aktiviert.":"Benachrichtigungen wurden nicht freigegeben.")};
 if(h.length&&("Notification" in window)&&Notification.permission==="granted"&&!sessionStorage.getItem("priceNoticeV28")){new Notification("Brick City Manager",{body:h.length+" Wunschlisten-Set"+(h.length>1?"s":"")+" unter deiner Kaufgrenze."});sessionStorage.setItem("priceNoticeV28","1")}
}
const applyEnrichmentBaseV28=applyEnrichmentV3;
applyEnrichmentV3=function(){applyEnrichmentBaseV28();for(const x of state.collection){const e=enrichmentV3.sets?.[String(x.setNumber)];if(e)recordPriceV28(String(x.setNumber),e,x.currentValue)}checkWishAlertsV28();persist()};
const analysisBaseV28=renderAnalysisV3;
renderAnalysisV3=function(){analysisBaseV28();let box=$("priceHistoryV28");if(!box){box=document.createElement("div");box.id="priceHistoryV28";box.className="card wide";$("analysis")?.appendChild(box)}const entries=Object.entries(state.priceHistory||{}).filter(([,a])=>a.length);box.innerHTML='<h2>Wertverlauf</h2><p class="hint">Historie wird ab v28 bei jedem neuen Online-Marktstand gespeichert.</p>'+entries.slice(0,20).map(([n,a])=>{const first=a[0],last=a[a.length-1];return '<div class="alertRow"><b>'+esc(n)+'</b><span>'+euro(first.currentEUR||first.newEUR)+' → '+euro(last.currentEUR||last.newEUR)+' · '+a.length+' Messpunkt'+(a.length===1?'':'e')+'</span></div>'}).join("")};
const refreshBaseV28=refresh;
refresh=function(){refreshBaseV28();setupPlannerV28();renderPlannerV28();renderWishAlertsV28();accountEnhanceV28()};

ensureV28State();bindRecoveryV28();setTimeout(()=>{setupPlannerV28();renderWishAlertsV28();accountEnhanceV28();refresh()},300);


/* v31 wishlist catalog autofill + price comparison */
async function ensureCatalogV31(setNumber=""){
 const wanted=String(setNumber||"").replace(/-1$/,"");
 if(enrichmentV3?.sets&&(!wanted||enrichmentV3.sets[wanted]))return true;
 try{
  const r=await fetch('./data/set-enrichment.json?t='+Date.now(),{cache:'no-store'});
  if(!r.ok)return false;
  enrichmentV3=await r.json();
  return !wanted||!!enrichmentV3.sets?.[wanted];
 }catch{return false}
}
async function fillWishFromCatalogV31(){
 const n=$("wSet")?.value.trim();if(!n)return;
 await ensureCatalogV31(n);
 const e=enrichmentV3.sets?.[n]||enrichmentV3.sets?.[n.replace(/-1$/,"")];
 if(!e){return}
 if($("wName")&&!$("wName").value.trim())$("wName").value=e.brickeconomyName||e.rebrickableName||"";
 if($("wRrp")&&!pV3($("wRrp").value)&&pV3(e.rrpEUR))$("wRrp").value=pV3(e.rrpEUR).toFixed(2);
 const market=pV3(e.marketNewEUR)||pV3(e.marketUsedEUR);
 if($("wPrice")&&!pV3($("wPrice").value)&&market)$("wPrice").value=market.toFixed(2);
 if($("wImage")&&!$("wImage").value.trim()&&e.imageUrl)$("wImage").value=e.imageUrl;
}
function bindWishAutofillV31(){
 const el=$("wSet");if(!el||el.dataset.autofillV31)return;el.dataset.autofillV31="1";
 el.addEventListener("change",fillWishFromCatalogV31);
 el.addEventListener("blur",fillWishFromCatalogV31);
 el.addEventListener("input",()=>{clearTimeout(window._wishFillTimerV31);window._wishFillTimerV31=setTimeout(()=>{if(el.value.trim().length>=4)fillWishFromCatalogV31()},450)});
 if($("wishAdd")){const old=$("wishAdd").onclick;$("wishAdd").onclick=()=>{if(old)old();setTimeout(()=>{$("wSet")?.focus()},50)}}
}
function priceRowsV31(){
 const rows=[];
 for(const x of state.collection||[]){
  const e=enrichmentV3.sets?.[String(x.setNumber)]||x.market||{};
  rows.push({kind:"collection",setNumber:x.setNumber,name:x.name,own:pV3(x.currentValue),newv:pV3(e.marketNewEUR),used:pV3(e.marketUsedEUR),limit:0});
 }
 for(const w of state.wishlist||[]){
  const e=enrichmentV3.sets?.[String(w.setNumber)]||w.market||{};
  rows.push({kind:"wishlist",setNumber:w.setNumber,name:w.name,own:pV3(w.offer)||pV3(w.price),newv:pV3(e.marketNewEUR),used:pV3(e.marketUsedEUR),limit:pV3(w.limit)});
 }
 return rows;
}
function renderPricesV31(){
 const body=$("priceTableV30");if(!body)return;
 const q=nV3($("priceSearchV30")?.value),mode=$("priceModeV30")?.value||"all";
 const rows=priceRowsV31().filter(r=>(mode==="all"||r.kind===mode)&&(!q||nV3(r.setNumber+" "+r.name).includes(q)));
 const withMarket=rows.filter(r=>r.newv||r.used).length,alerts=rows.filter(r=>r.kind==="wishlist"&&r.limit&&(r.newv||r.used)&&Math.min(...[r.newv,r.used].filter(Boolean))<=r.limit).length;
 if($("priceSummaryV30"))$("priceSummaryV30").innerHTML='<div class="miniStat"><span>Einträge</span><b>'+rows.length+'</b></div><div class="miniStat"><span>mit Marktwert</span><b>'+withMarket+'</b></div><div class="miniStat"><span>unter Kaufgrenze</span><b>'+alerts+'</b></div>';
 body.innerHTML=rows.length?rows.map(r=>{
  const m=r.newv||r.used,status=!m?'Keine Marktdaten':r.kind==="wishlist"&&r.limit?(m<=r.limit?'🟢 unter Kaufgrenze':'🔴 über Kaufgrenze'):(r.own&&m?(r.own<m?'Markt höher':'Markt niedriger'):'–');
  return '<tr><td><b>'+esc(r.setNumber)+'</b><br><small>'+(r.kind==="collection"?'Bestand':'Wunsch')+'</small></td><td>'+esc(r.name)+'</td><td>'+euro(r.own)+'</td><td>'+euro(r.newv)+'</td><td>'+euro(r.used)+'</td><td>'+(r.limit?euro(r.limit):'–')+'</td><td>'+esc(status)+'</td></tr>'
 }).join(""):'<tr><td colspan="7">Keine Einträge gefunden.</td></tr>';
}
function bindPricesV31(){
 if($("priceSearchV30"))$("priceSearchV30").oninput=renderPricesV31;
 if($("priceModeV30"))$("priceModeV30").onchange=renderPricesV31;
 if($("refreshPricesV30"))$("refreshPricesV30").onclick=async()=>{await loadEnrichmentV3(true);renderPricesV31()};
 const oldSwitchV31=switchTab;switchTab=function(id){oldSwitchV31(id);if(id==="prices")renderPricesV31()};
}
bindWishAutofillV31();bindPricesV31();renderPricesV31();


/* v32 set-form catalog autofill */
async function fillSetFromCatalogV32(){
 const n=$("fSet")?.value.trim();if(!n)return;
 await ensureCatalogV31(n);
 const e=enrichmentV3.sets?.[n]||enrichmentV3.sets?.[n.replace(/-1$/,"")];
 if(!e)return;
 if($("fName")&&!$("fName").value.trim())$("fName").value=e.brickeconomyName||e.rebrickableName||"";
 const market=pV3(e.marketUsedEUR)||pV3(e.marketNewEUR);
 if($("fValue")&&!pV3($("fValue").value)&&market)$("fValue").value=market.toFixed(2);
 if($("fImage")&&!$("fImage").value.trim()&&e.imageUrl)$("fImage").value=e.imageUrl;
 if($("fBarcode")&&!$("fBarcode").value.trim()&&(e.ean||e.upc))$("fBarcode").value=e.ean||e.upc;
 if($("fCat")&&!$("fCat").value.trim())$("fCat").value=[e.theme,e.subtheme].filter(Boolean).join(" / ");
 if($("fWidth")&&!pV3($("fWidth").value)&&pV3(e.width))$("fWidth").value=e.width;
 if($("fDepth")&&!pV3($("fDepth").value)&&pV3(e.depth))$("fDepth").value=e.depth;
 if($("fHeight")&&!pV3($("fHeight").value)&&pV3(e.height))$("fHeight").value=e.height;
}
function bindSetAutofillV32(){
 const el=$("fSet");if(!el||el.dataset.autofillV32)return;el.dataset.autofillV32="1";
 el.addEventListener("change",fillSetFromCatalogV32);
 el.addEventListener("blur",fillSetFromCatalogV32);
 el.addEventListener("input",()=>{clearTimeout(window._setFillTimerV32);window._setFillTimerV32=setTimeout(()=>{if(el.value.trim().length>=4)fillSetFromCatalogV32()},450)});
}
bindSetAutofillV32();


/* v35 catalog search, data quality assistant, richer prices and visual city modules */
function catalogNameV35(e){return e?.brickeconomyName||e?.rebrickableName||""}
function updateCatalogSuggestionsV35(){
 const dl=$("catalogSuggestionsV35");if(!dl)return;
 const rows=Object.entries(enrichmentV3?.sets||{}).sort((a,b)=>String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true}));
 dl.innerHTML=rows.map(([n,e])=>'<option value="'+esc(n)+'">'+esc(catalogNameV35(e))+'</option>').join("");
}
async function lookupCatalogV35(n,statusId){
 n=String(n||"").trim().replace(/-1$/,"");const s=$(statusId);if(!n)return null;
 if(s)s.textContent="Online-Katalog wird durchsucht…";
 await ensureCatalogV31(n);
 const e=enrichmentV3.sets?.[n]||null;
 if(s)s.textContent=e?"✓ Online-Daten gefunden":"Noch keine Online-Daten für dieses Set vorhanden.";
 updateCatalogSuggestionsV35();
 return e;
}
async function autofillSetV35(){
 const n=$("fSet")?.value.trim();if(!n)return;
 const e=await lookupCatalogV35(n,"fCatalogStatusV35");if(!e)return;
 if($("fName")&&!$("fName").value.trim())$("fName").value=catalogNameV35(e);
 const market=pV3(e.marketUsedEUR)||pV3(e.marketNewEUR);
 if($("fValue")&&!pV3($("fValue").value)&&market)$("fValue").value=market.toFixed(2);
 if($("fImage")&&!$("fImage").value.trim()&&e.imageUrl)$("fImage").value=e.imageUrl;
 if($("fBarcode")&&!$("fBarcode").value.trim()&&(e.ean||e.upc))$("fBarcode").value=e.ean||e.upc;
 if($("fCat")&&!$("fCat").value.trim())$("fCat").value=[e.theme,e.subtheme].filter(Boolean).join(" / ");
 if($("fWidth")&&!pV3($("fWidth").value)&&pV3(e.width))$("fWidth").value=e.width;
 if($("fDepth")&&!pV3($("fDepth").value)&&pV3(e.depth))$("fDepth").value=e.depth;
 if($("fHeight")&&!pV3($("fHeight").value)&&pV3(e.height))$("fHeight").value=e.height;
}
async function autofillWishV35(){
 const n=$("wSet")?.value.trim();if(!n)return;
 const e=await lookupCatalogV35(n,"wCatalogStatusV35");if(!e)return;
 if($("wName")&&!$("wName").value.trim())$("wName").value=catalogNameV35(e);
 if($("wRrp")&&!pV3($("wRrp").value)&&pV3(e.rrpEUR))$("wRrp").value=pV3(e.rrpEUR).toFixed(2);
 const market=pV3(e.marketNewEUR)||pV3(e.marketUsedEUR);
 if($("wPrice")&&!pV3($("wPrice").value)&&market)$("wPrice").value=market.toFixed(2);
 if($("wImage")&&!$("wImage").value.trim()&&e.imageUrl)$("wImage").value=e.imageUrl;
}
function bindCatalogSearchV35(){
 const bind=(id,fn,key)=>{const el=$(id);if(!el||el.dataset[key])return;el.dataset[key]="1";el.addEventListener("change",fn);el.addEventListener("blur",fn);el.addEventListener("input",()=>{clearTimeout(el._v35t);el._v35t=setTimeout(()=>{if(el.value.trim().length>=4)fn()},350)})};
 bind("fSet",autofillSetV35,"v35set");bind("wSet",autofillWishV35,"v35wish");updateCatalogSuggestionsV35();
}

function qualityIssuesV35(x){
 const a=[];
 if(!pV3(x.currentValue))a.push("value");
 if(!x.imageUrl)a.push("image");
 if(!(pV3(x.width)&&pV3(x.depth)&&pV3(x.height))&&!(Array.isArray(x.modelDimensions)&&x.modelDimensions.filter(v=>pV3(v)>0).length===3))a.push("dims");
 if(!x.barcode)a.push("barcode");
 if(!pV3(x.purchasePrice))a.push("price");
 if(!x.condition||x.condition==="Unbekannt")a.push("condition");
 return a;
}
const qualityLabelsV35={value:"Marktwert",image:"Bild",dims:"Maße",barcode:"Barcode",price:"Kaufpreis",condition:"Zustand"};
async function autoEnrichOneV35(n){
 const x=state.collection.find(y=>String(y.setNumber)===String(n));if(!x)return;
 const e=await lookupCatalogV35(n,null);
 if(!e)return alert("Für dieses Set sind im zentralen Katalog noch keine Daten vorhanden.");
 let changed=false;
 if(!x.imageUrl&&e.imageUrl){x.imageUrl=e.imageUrl;changed=true}
 if(!x.barcode&&(e.ean||e.upc)){x.barcode=e.ean||e.upc;changed=true}
 const mv=chooseMarketV3(x,e);if(!pV3(x.currentValue)&&mv){x.currentValue=mv;changed=true}
 if(!pV3(x.width)&&pV3(e.width)){x.width=e.width;changed=true}
 if(!pV3(x.depth)&&pV3(e.depth)){x.depth=e.depth;changed=true}
 if(!pV3(x.height)&&pV3(e.height)){x.height=e.height;changed=true}
 if(!(Array.isArray(x.modelDimensions)&&x.modelDimensions.length===3)&&pV3(e.modelDimension1)&&pV3(e.modelDimension2)&&pV3(e.modelDimension3)){
   x.modelDimensions=[pV3(e.modelDimension1),pV3(e.modelDimension2),pV3(e.modelDimension3)];
   x.modelDimensionsSource=e.modelDimensionsSource||"Brickset";changed=true
 }
 if(!pV3(x.footprintWidth)&&pV3(e.footprintWidth)&&pV3(e.footprintDepth)){
   x.footprintWidth=pV3(e.footprintWidth);x.footprintDepth=pV3(e.footprintDepth);
   x.footprintSource=e.footprintSource||"Brickset/LEGO-Beschreibung";changed=true
 }
 if(changed){persist();refresh();renderQualityAssistantV35();alert("Verfügbare Online-Daten wurden ergänzt.")}else alert("Online-Daten gefunden, aber für die noch fehlenden Felder liegen aktuell keine Werte vor.");
}
window.autoEnrichOneV35=autoEnrichOneV35;
function renderQualityAssistantV35(){
 const box=$("qualityAssistantV35");if(!box)return;
 const filter=$("qualityFilterV35")?.value||"all";
 const rows=state.collection.map(x=>({x,issues:qualityIssuesV35(x)})).filter(r=>r.issues.length&&(filter==="all"||r.issues.includes(filter)));
 box.innerHTML=rows.length?rows.slice(0,80).map(({x,issues})=>'<div class="qualityRowV35"><div><b>'+esc(x.setNumber)+' · '+esc(x.name)+'</b><div class="chips">'+issues.map(k=>'<span class="chip warn">'+esc(qualityLabelsV35[k])+'</span>').join("")+'</div></div><div class="actions"><button class="btn secondary" onclick="autoEnrichOneV35(\''+esc(x.setNumber)+'\')">Auto ergänzen</button><button class="btn" onclick="editSet(\''+esc(x.setNumber)+'\')">Bearbeiten</button></div></div>').join(""):'<p class="hint">Für diesen Filter sind keine fehlenden Angaben vorhanden.</p>';
}
function bindQualityV35(){
 if($("qualityFilterV35"))$("qualityFilterV35").onchange=renderQualityAssistantV35;
 if($("qualityReloadV35"))$("qualityReloadV35").onclick=async()=>{await loadEnrichmentV3(true);renderQualityAssistantV35()};
}

priceRowsV31=function(){
 const rows=[];
 for(const x of state.collection||[]){
  const e=enrichmentV3.sets?.[String(x.setNumber)]||x.market||{};
  const market=chooseMarketV3(x,e);
  rows.push({kind:"collection",setNumber:x.setNumber,name:x.name,purchase:pV3(x.purchasePrice),own:pV3(x.currentValue),newv:pV3(e.marketNewEUR),used:pV3(e.marketUsedEUR),market,limit:0});
 }
 for(const w of state.wishlist||[]){
  const e=enrichmentV3.sets?.[String(w.setNumber)]||w.market||{};
  const market=pV3(e.marketNewEUR)||pV3(e.marketUsedEUR);
  rows.push({kind:"wishlist",setNumber:w.setNumber,name:w.name,purchase:0,own:pV3(w.offer)||pV3(w.price),newv:pV3(e.marketNewEUR),used:pV3(e.marketUsedEUR),market,limit:pV3(w.limit)});
 }
 return rows;
};
renderPricesV31=function(){
 const body=$("priceTableV30");if(!body)return;
 const q=nV3($("priceSearchV30")?.value),mode=$("priceModeV30")?.value||"all";
 const rows=priceRowsV31().filter(r=>(mode==="all"||r.kind===mode)&&(!q||nV3(r.setNumber+" "+r.name).includes(q)));
 const withMarket=rows.filter(r=>r.market).length,alerts=rows.filter(r=>r.kind==="wishlist"&&r.limit&&r.market&&r.market<=r.limit).length;
 if($("priceSummaryV30"))$("priceSummaryV30").innerHTML='<div class="miniStat"><span>Einträge</span><b>'+rows.length+'</b></div><div class="miniStat"><span>mit Marktwert</span><b>'+withMarket+'</b></div><div class="miniStat"><span>unter Kaufgrenze</span><b>'+alerts+'</b></div>';
 body.innerHTML=rows.length?rows.map(r=>{
  const diff=r.kind==="collection"&&r.purchase&&r.market?r.market-r.purchase:0,pct=r.purchase&&diff?diff/r.purchase*100:0;
  let status="–";if(!r.market)status="Keine Marktdaten";else if(r.kind==="wishlist"&&r.limit)status=r.market<=r.limit?"🟢 unter Kaufgrenze":"🔴 über Kaufgrenze";else if(r.kind==="collection"&&r.purchase)status=diff>=0?"🟢 über Kaufpreis":"🔴 unter Kaufpreis";
  return '<tr><td><b>'+esc(r.setNumber)+'</b><br><small>'+(r.kind==="collection"?'Bestand':'Wunsch')+'</small></td><td>'+esc(r.name)+'</td><td>'+(r.purchase?euro(r.purchase):'–')+'</td><td>'+euro(r.own)+'</td><td>'+euro(r.newv)+'</td><td>'+euro(r.used)+'</td><td>'+(diff?euro(diff):'–')+'</td><td>'+(diff?(pct>=0?'+':'')+pct.toFixed(1).replace(".",",")+' %':'–')+'</td><td>'+(r.limit?euro(r.limit):'–')+'</td><td>'+esc(status)+'</td></tr>'
 }).join(""):'<tr><td colspan="10">Keine Einträge gefunden.</td></tr>';
};

function moduleFitsV35(x){
 const mw=pV3(state.meta?.moduleWidth)||25.6,md=pV3(state.meta?.moduleDepth)||25.6,f=footprintV526(x);
 if(!f)return null;const w=f.w,d=f.d;return (w<=mw&&d<=md)||(d<=mw&&w<=md);
}
renderModulesV3=function(){
 const g=$("moduleGrid");if(!g)return;let n=0,h="",filter=$("moduleZoneFilterV35")?.value||"";
 for(let i=0;i<48;i++){
  const z=ZONES_V3[i];
  if(z==="open"){h+='<div class="module open '+(filter?'moduleDimV35':'')+'">FREI</div>';continue}
  n++;const m='M'+String(n).padStart(2,'0'),a=state.modules[m]||[],sets=a.map(s=>state.collection.find(x=>String(x.setNumber)===String(s))).filter(Boolean),first=sets[0];
  const tooBig=sets.some(x=>moduleFitsV35(x)===false),dim=filter&&filter!==z;
  h+='<button class="module z-'+z+(tooBig?' moduleTooBigV35':'')+(dim?' moduleDimV35':'')+'" data-module="'+m+'" data-zone="'+z+'" onclick="moduleClickV3(\''+m+'\')">'+(first?.imageUrl?'<img class="moduleImgV35" src="'+esc(first.imageUrl)+'" alt="">':'')+'<span class="moduleCodeV35">'+m+'</span><small>'+(sets.length?sets.length+' Set'+(sets.length>1?'s':''):ZONELABEL_V3[z])+'</small>'+(tooBig?'<em>⚠ zu groß</em>':'')+'</button>'
 }
 g.innerHTML=h;setTimeout(renderPlannerV28,0);
};
function bindModuleFilterV35(){if($("moduleZoneFilterV35"))$("moduleZoneFilterV35").onchange=renderModulesV3}

const loadEnrichmentBaseV35=loadEnrichmentV3;
loadEnrichmentV3=async function(force=false){const r=await loadEnrichmentBaseV35(force);updateCatalogSuggestionsV35();renderQualityAssistantV35();renderPricesV31();return r};

bindCatalogSearchV35();bindQualityV35();bindModuleFilterV35();renderQualityAssistantV35();renderPricesV31();renderModulesV3();


/* v36 statistics + operator admin */
const ADMIN_EMAIL_V36="marcschmid@t-online.de";
function renderStatsV36(){
 const topV=$("topValueV36"),topG=$("topGainV36"),areaBox=$("areaValueV36"),cov=$("coverageV36");
 if(!(topV&&topG&&areaBox&&cov))return;
 const rows=(state.collection||[]).map(x=>{
   const qty=pV3(x.quantity),market=pV3(x.currentValue),purchase=pV3(x.purchasePrice),value=qty*market,gain=qty*(market-purchase);
   return {...x,qty,market,purchase,value,gain,pct:purchase?((market-purchase)/purchase*100):0};
 });
 const bestValue=[...rows].sort((a,b)=>b.value-a.value).slice(0,10);
 const bestGain=[...rows].filter(x=>x.market&&x.purchase).sort((a,b)=>b.gain-a.gain).slice(0,10);
 const maxValue=Math.max(...bestValue.map(x=>x.value),1),maxGain=Math.max(...bestGain.map(x=>Math.max(x.gain,0)),1);
 topV.innerHTML=bestValue.length?'<div class="top10ListV47">'+bestValue.map((x,i)=>'<button class="top10RowV47" onclick="showDetailV3(\''+esc(x.setNumber)+'\')"><div class="top10RankV47">'+(i+1)+'</div><div class="top10ThumbV47">'+(x.imageUrl?'<img src="'+esc(x.imageUrl)+'" alt="">':'<span>◻</span>')+'</div><div class="top10MainV47"><div class="top10TitleV47"><b>'+esc(x.setNumber)+'</b><span>'+esc(x.name)+'</span></div><div class="top10BarV47"><i style="width:'+Math.max(4,x.value/maxValue*100)+'%"></i></div><small>'+x.qty+' Exemplar'+(x.qty===1?'':'e')+' · '+euro(x.market)+' je Set</small></div><div class="top10ValueV47">'+euro(x.value)+'</div></button>').join("")+'</div>':'<p class="hint">Keine Werte vorhanden.</p>';
 topG.innerHTML=bestGain.length?'<div class="top10ListV47">'+bestGain.map((x,i)=>'<button class="top10RowV47" onclick="showDetailV3(\''+esc(x.setNumber)+'\')"><div class="top10RankV47">'+(i+1)+'</div><div class="top10ThumbV47">'+(x.imageUrl?'<img src="'+esc(x.imageUrl)+'" alt="">':'<span>◻</span>')+'</div><div class="top10MainV47"><div class="top10TitleV47"><b>'+esc(x.setNumber)+'</b><span>'+esc(x.name)+'</span></div><div class="top10BarV47 gain"><i style="width:'+Math.max(4,Math.max(x.gain,0)/maxGain*100)+'%"></i></div><small>Kauf '+euro(x.purchase)+' → Wert '+euro(x.market)+'</small></div><div class="top10ValueV47 '+(x.gain>=0?'goodTxt':'badTxt')+'"><strong>'+(x.gain>=0?'+':'')+euro(x.gain)+'</strong><small>'+(x.pct>=0?'+':'')+x.pct.toFixed(1).replace(".",",")+' %</small></div></button>').join("")+'</div>':'<p class="hint">Noch keine vergleichbaren Werte vorhanden.</p>';
 const areas={};
 rows.forEach(x=>{const a=shortAreaV3(x.cityArea||"Ohne Bereich");areas[a]=(areas[a]||0)+x.value});
 const mx=Math.max(...Object.values(areas),1);
 areaBox.innerHTML=Object.entries(areas).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div class="barrow"><span>'+esc(k)+'</span><div class="bar"><i style="width:'+(v/mx*100)+'%"></i></div><b>'+euro(v)+'</b></div>').join("");
 const total=state.collection.length||1;
 const q=[
   ["Marktwert",state.collection.filter(x=>pV3(x.currentValue)).length],
   ["Bild",state.collection.filter(x=>x.imageUrl).length],
   ["Maße",state.collection.filter(x=>pV3(x.width)&&pV3(x.depth)&&pV3(x.height)).length],
   ["Barcode",state.collection.filter(x=>x.barcode).length],
   ["Kaufpreis",state.collection.filter(x=>pV3(x.purchasePrice)).length],
   ["Zustand",state.collection.filter(x=>x.condition&&x.condition!=="Unbekannt").length]
 ];
 cov.innerHTML=q.map(([k,v])=>'<div class="coverageRowV36"><span>'+k+'</span><div class="bar"><i style="width:'+(v/total*100)+'%"></i></div><b>'+v+'/'+total+'</b></div>').join("");
}
const analysisBaseV36=renderAnalysisV3;
renderAnalysisV3=function(){analysisBaseV36();renderStatsV36()};

function isAdminV36(){return String(cloudUserV3?.email||"").toLowerCase()===ADMIN_EMAIL_V36}
function updateAdminVisibilityV36(){
 if($("adminTabV36"))$("adminTabV36").classList.toggle("hidden",!isAdminV36());
 if(!isAdminV36()&&document.querySelector("#admin.active"))switchTab("home");
}
async function renderAdminV36(){
 if(!$("adminSummaryV36")||!isAdminV36())return;
 const vals=Object.values(enrichmentV3?.sets||{}),meta=enrichmentV3?.meta||{};
 const withPrice=vals.filter(x=>pV3(x.marketNewEUR)||pV3(x.marketUsedEUR)).length;
 const withImage=vals.filter(x=>x.imageUrl).length;
 const withBarcode=vals.filter(x=>x.ean||x.upc).length;
 let users=null,lastCloud=null,rpcError="";
 try{
   if(cloudV3){
     const {data,error}=await cloudV3.rpc("admin_metrics");
     if(error)rpcError=error.message; else if(data){const r=Array.isArray(data)?data[0]:data;users=r?.user_count??null;lastCloud=r?.last_state_update??null}
   }
 }catch(e){rpcError=String(e?.message||e)}
 $("adminSummaryV36").innerHTML=
  '<div class="miniStat"><span>Registrierte Nutzer</span><b>'+(users??"–")+'</b></div>'+
  '<div class="miniStat"><span>Katalog-Sets</span><b>'+vals.length+'</b></div>'+
  '<div class="miniStat"><span>mit Marktwert</span><b>'+withPrice+'</b></div>'+
  '<div class="miniStat"><span>mit Bild</span><b>'+withImage+'</b></div>'+
  '<div class="miniStat"><span>mit Barcode</span><b>'+withBarcode+'</b></div>';
 $("adminCatalogV36").innerHTML='<h3>Katalogstatus</h3><div class="qualitylist"><div class="qualityitem"><span>Letzte Katalogaktualisierung</span><b>'+(meta.lastUpdated?new Date(meta.lastUpdated).toLocaleString("de-DE"):"–")+'</b></div><div class="qualityitem"><span>Letzte Cloud-Aktivität</span><b>'+(lastCloud?new Date(lastCloud).toLocaleString("de-DE"):"–")+'</b></div><div class="qualityitem"><span>Rebrickable</span><b>'+(meta.rebrickableEnabled?"aktiv":"–")+'</b></div><div class="qualityitem"><span>BrickEconomy</span><b>'+(meta.brickeconomyEnabled?"aktiv":"–")+'</b></div></div>';
 const errs=meta.errors||[];
 $("adminErrorsV36").innerHTML='<h3>Letzte Katalogfehler</h3>'+(errs.length?'<div class="adminErrorsV36">'+errs.slice(-10).map(e=>'<div>'+esc(e)+'</div>').join("")+'</div>':'<p class="hint">Keine gespeicherten Katalogfehler.</p>');
 $("adminNoteV36").textContent=rpcError?'Nutzerzahl noch nicht verfügbar: '+rpcError:"Admin-Metriken aktiv. Fremde Sammlungsinhalte werden nicht angezeigt.";
}
function bindAdminV36(){
 if($("adminRefreshV36"))$("adminRefreshV36").onclick=async()=>{await loadEnrichmentV3(true);await renderAdminV36()};
 const oldSwitchV36=switchTab;switchTab=function(id){oldSwitchV36(id);if(id==="analysis")renderStatsV36();if(id==="admin")renderAdminV36()};
 updateAdminVisibilityV36();
}
const cloudSessionBaseV36=cloudSessionV3;
cloudSessionV3=async function(session){const r=await cloudSessionBaseV36(session);updateAdminVisibilityV36();if(isAdminV36())renderAdminV36();return r};
const refreshBaseV36=refresh;
refresh=function(){refreshBaseV36();renderStatsV36();updateAdminVisibilityV36()};
bindAdminV36();renderStatsV36();


/* v37 targeted lookups, charts, history/trash and exemplar editor */
let exemplarEditV37={setNumber:"",index:-1};
function ensureV37State(){
 state.trash=state.trash||[];
 state.activityLog=state.activityLog||[];
 state.collectionValueHistory=state.collectionValueHistory||[];
 const cutoff=Date.now()-30*24*60*60*1000;
 state.trash=state.trash.filter(x=>!x.deletedAt||new Date(x.deletedAt).getTime()>=cutoff);
}
function logV37(type,text,setNumber=""){
 ensureV37State();
 state.activityLog.unshift({at:new Date().toISOString(),type,text,setNumber:String(setNumber||"")});
 if(state.activityLog.length>150)state.activityLog.length=150;
}
function renderHistoryV37(){
 const trash=$("trashV37"),hist=$("historyV37");if(!(trash&&hist))return;ensureV37State();
 trash.innerHTML=state.trash.length?state.trash.map((r,i)=>'<div class="historyRowV37"><div><b>'+esc(r.item?.setNumber||"")+' · '+esc(r.item?.name||"")+'</b><small>gelöscht '+new Date(r.deletedAt).toLocaleString("de-DE")+'</small></div><button class="btn secondary" onclick="restoreTrashV37('+i+')">Wiederherstellen</button></div>').join(""):'<p class="hint">Papierkorb leer.</p>';
 hist.innerHTML=state.activityLog.length?state.activityLog.slice(0,40).map(r=>'<div class="historyRowV37"><div><b>'+esc(r.text)+'</b><small>'+new Date(r.at).toLocaleString("de-DE")+'</small></div></div>').join(""):'<p class="hint">Noch keine Änderungen protokolliert.</p>';
}
window.restoreTrashV37=i=>{
 ensureV37State();const r=state.trash[i];if(!r)return;
 if(state.collection.some(x=>String(x.setNumber)===String(r.item.setNumber)))return alert("Dieses Set ist bereits wieder im Bestand.");
 state.collection.push(r.item);state.trash.splice(i,1);logV37("restore","Set "+r.item.setNumber+" wiederhergestellt",r.item.setNumber);persist();refresh();renderHistoryV37();
};
window.softDeleteSetV37=n=>{
 const x=state.collection.find(y=>String(y.setNumber)===String(n));if(!x)return;
 if(!confirm("Set "+x.setNumber+" wirklich in den Papierkorb verschieben?"))return;
 ensureV37State();state.trash.unshift({deletedAt:new Date().toISOString(),item:structuredClone(x)});
 state.collection=state.collection.filter(y=>y!==x);
 for(const m in state.modules||{})state.modules[m]=(state.modules[m]||[]).filter(s=>String(s)!==String(n));
 logV37("delete","Set "+x.setNumber+" in den Papierkorb verschoben",x.setNumber);persist();refresh();$("detailModal")?.classList.remove("show");renderHistoryV37();
};
window.delSet=window.softDeleteSetV37;

function bindHistoryV37(){
 if($("purgeTrashV37"))$("purgeTrashV37").onclick=()=>{if(!state.trash?.length)return;if(confirm("Papierkorb endgültig leeren?")){state.trash=[];logV37("purge","Papierkorb geleert");persist();renderHistoryV37()}};
 renderHistoryV37();
}

const saveSetCoreV37=saveSet;
function saveSetLoggedV37(){
 const setNo=$("fSet")?.value.trim(),wasEditing=!!editing,before=wasEditing?structuredClone(state.collection.find(x=>String(x.setNumber)===String(editing))||null):null;
 const r=saveSetCoreV37();
 const after=state.collection.find(x=>String(x.setNumber)===String(setNo||before?.setNumber));
 if(after){logV37(wasEditing?"edit":"add",(wasEditing?"Set geändert: ":"Set hinzugefügt: ")+after.setNumber,after.setNumber);persist();renderHistoryV37()}
 return r;
}
if($("saveSet"))$("saveSet").onclick=saveSetLoggedV37;

const savePurchaseCoreV37=savePurchaseV3;
function savePurchaseLoggedV37(){
 const n=$("pSet")?.value.trim(),q=Math.max(1,pV3($("pQty")?.value)||1);
 const r=savePurchaseCoreV37();
 const x=state.collection.find(y=>String(y.setNumber)===String(n));
 if(x&&$("pStorage")){const newest=(x.exemplars||[]).slice(-q);newest.forEach(e=>e.storage=$("pStorage").value.trim())}
 if(x){logV37("purchase","Kauf erfasst: "+q+" × "+n,n);persist();refresh();renderHistoryV37()}
 return r;
}
if($("savePurchase"))$("savePurchase").onclick=savePurchaseLoggedV37;
const openPurchaseCoreV37=openPurchaseV3;
openPurchaseV3=function(w=null,x=null){const r=openPurchaseCoreV37(w,x);if($("pStorage"))$("pStorage").value=x?.storage||"";return r};

window.editExemplarV28=(setNumber,index)=>{
 const x=state.collection.find(y=>String(y.setNumber)===String(setNumber)),e=x?.exemplars?.[index];if(!e)return;
 exemplarEditV37={setNumber:String(setNumber),index};
 $("exDateV37").value=e.date||"";$("exPriceV37").value=e.price??"";$("exSellerV37").value=e.seller||"";$("exStorageV37").value=e.storage||x.storage||"";
 $("exConditionV37").value=e.condition||"Unbekannt";$("exBoxV37").value=e.box||"";$("exCompleteV37").value=e.complete||"";$("exNoteV37").value=e.note||"";
 $("exemplarModalV37").classList.add("show");
};
function closeExemplarV37(){$("exemplarModalV37")?.classList.remove("show");exemplarEditV37={setNumber:"",index:-1}}
function bindExemplarV37(){
 if($("closeExemplarV37"))$("closeExemplarV37").onclick=closeExemplarV37;if($("cancelExemplarV37"))$("cancelExemplarV37").onclick=closeExemplarV37;
 if($("saveExemplarV37"))$("saveExemplarV37").onclick=()=>{
   const x=state.collection.find(y=>String(y.setNumber)===exemplarEditV37.setNumber),e=x?.exemplars?.[exemplarEditV37.index];if(!e)return;
   Object.assign(e,{date:$("exDateV37").value,price:pV3($("exPriceV37").value),seller:$("exSellerV37").value.trim(),storage:$("exStorageV37").value.trim(),condition:$("exConditionV37").value,box:$("exBoxV37").value,complete:$("exCompleteV37").value,note:$("exNoteV37").value.trim(),legacy:false});
   const priced=x.exemplars.map(v=>pV3(v.price)).filter(v=>v>0);if(priced.length)x.purchasePrice=priced.reduce((a,b)=>a+b,0)/priced.length;
   logV37("exemplar","Exemplar #"+(exemplarEditV37.index+1)+" von "+x.setNumber+" geändert",x.setNumber);persist();refresh();closeExemplarV37();showDetailV3(x.setNumber);
 };
}
const deleteExemplarCoreV37=window.deleteExemplarV28;
window.deleteExemplarV28=(setNumber,index)=>{
 const x=state.collection.find(y=>String(y.setNumber)===String(setNumber));if(!x)return;
 if(!confirm("Dieses einzelne Exemplar wirklich löschen?"))return;
 const removed=x.exemplars?.[index]?structuredClone(x.exemplars[index]):null;
 x.exemplars.splice(index,1);x.quantity=Math.max(0,pV3(x.quantity)-1);
 logV37("exemplar-delete","Exemplar #"+(index+1)+" von "+setNumber+" gelöscht",setNumber);
 if(x.quantity===0){state.trash.unshift({deletedAt:new Date().toISOString(),item:structuredClone(x)});state.collection=state.collection.filter(y=>y!==x);$("detailModal")?.classList.remove("show")}else showDetailV3(setNumber);
 persist();refresh();renderHistoryV37();
};

function svgLineV37(points,width=620,height=180){
 if(!points?.length)return '<p class="hint">Noch nicht genug historische Messpunkte.</p>';
 const vals=points.map(p=>p.value).filter(Number.isFinite);if(!vals.length)return '<p class="hint">Keine Werte vorhanden.</p>';
 const min=Math.min(...vals),max=Math.max(...vals),span=Math.max(1,max-min),pad=18;
 const coords=points.map((p,i)=>{const x=pad+(points.length===1?0:i/(points.length-1)*(width-pad*2));const y=height-pad-((p.value-min)/span)*(height-pad*2);return{x,y,p}});
 const line=coords.map((p,i)=>(i?'L':'M')+p.x.toFixed(1)+' '+p.y.toFixed(1)).join(' ');
 return '<svg class="priceChartV37" viewBox="0 0 '+width+' '+height+'" role="img"><path d="'+line+'" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'+coords.map(p=>'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="4" fill="currentColor"><title>'+esc(p.p.date)+' · '+euro(p.p.value)+'</title></circle>').join('')+'</svg><div class="chartLegendV37"><span>'+esc(points[0].date)+' · '+euro(points[0].value)+'</span><span>'+esc(points[points.length-1].date)+' · '+euro(points[points.length-1].value)+'</span></div>';
}
function recordCollectionValueV37(){
 ensureV37State();const day=todayV28(),value=state.collection.reduce((s,x)=>s+pV3(x.quantity)*pV3(x.currentValue),0),a=state.collectionValueHistory;
 const last=a[a.length-1];if(!last||last.date!==day){a.push({date:day,value});if(a.length>365)a.splice(0,a.length-365)}else last.value=value;
}
function renderCollectionChartV37(){
 const box=$("collectionChartV37");if(!box)return;ensureV37State();box.innerHTML=svgLineV37(state.collectionValueHistory.slice(-90));
}
const detailChartCoreV37=showDetailV3;
showDetailV3=function(n){
 detailChartCoreV37(n);const x=state.collection.find(y=>String(y.setNumber)===String(n));if(!x)return;
 const d=$("detailContent");if(!d)return;
 const hist=(state.priceHistory?.[String(n)]||[]).map(r=>({date:r.date,value:pV3(r.currentEUR)||pV3(r.newEUR)||pV3(r.usedEUR)})).filter(r=>r.value);
 const card=document.createElement("div");card.className="card wide";card.innerHTML='<div class="sectionHead"><h3>Preisverlauf</h3><button class="btn danger" onclick="softDeleteSetV37(\''+esc(n)+'\')">Set löschen</button></div>'+svgLineV37(hist.slice(-90));d.appendChild(card);
};

const applyEnrichmentCoreV37=applyEnrichmentV3;
applyEnrichmentV3=function(){const r=applyEnrichmentCoreV37();recordCollectionValueV37();persist();renderCollectionChartV37();return r};
const renderAnalysisCoreV37=renderAnalysisV3;
renderAnalysisV3=function(){renderAnalysisCoreV37();renderCollectionChartV37()};

async function enqueueCatalogRequestV37(n,statusId){
 n=String(n||"").trim().replace(/-1$/,"");if(!n||!cloudV3||!cloudUserV3)return false;
 const status=$(statusId||"catalogRequestStatusV37");
 try{
   const {error}=await cloudV3.from("catalog_requests").insert({set_number:n,requested_by:cloudUserV3.id,status:"pending"});
   if(error&&error.code!=="23505"){if(status)status.textContent="Server-Nachschlagefunktion noch nicht eingerichtet.";return false}
   if(status)status.textContent="Set "+n+" wurde zur serverseitigen Nachpflege vorgemerkt.";
   return true;
 }catch{if(status)status.textContent="Server-Nachschlagefunktion noch nicht eingerichtet.";return false}
}
const lookupCatalogCoreV37=lookupCatalogV35;
lookupCatalogV35=async function(n,statusId){
 const e=await lookupCatalogCoreV37(n,statusId);
 if(!e){await enqueueCatalogRequestV37(n,statusId);const s=$(statusId);if(s)s.textContent="Noch keine Daten vorhanden – serverseitige Nachpflege wurde vorgemerkt."}
 return e;
};

const refreshCoreV37=refresh;
refresh=function(){ensureV37State();const r=refreshCoreV37();recordCollectionValueV37();renderHistoryV37();renderCollectionChartV37();return r};
ensureV37State();recordCollectionValueV37();bindHistoryV37();bindExemplarV37();renderHistoryV37();renderCollectionChartV37();


/* v38 detail tabs, quality score, onboarding, complete export and alert inbox */
function qualityScoreV38(x){
 const checks=[
   !!x.imageUrl,
   !!pV3(x.currentValue),
   !!(pV3(x.width)&&pV3(x.depth)&&pV3(x.height)),
   !!x.barcode,
   !!pV3(x.purchasePrice),
   !!(x.condition&&x.condition!=="Unbekannt"),
   !!x.cityArea,
   !!x.category
 ];
 return Math.round(checks.filter(Boolean).length/checks.length*100);
}
const renderQualityCoreV38=renderQualityAssistantV35;
renderQualityAssistantV35=function(){
 const box=$("qualityAssistantV35");if(!box)return;
 const filter=$("qualityFilterV35")?.value||"all";
 const rows=state.collection.map(x=>({x,issues:qualityIssuesV35(x),score:qualityScoreV38(x)})).filter(r=>r.issues.length&&(filter==="all"||r.issues.includes(filter))).sort((a,b)=>a.score-b.score);
 box.innerHTML=rows.length?rows.slice(0,100).map(({x,issues,score})=>'<div class="qualityRowV35"><div><b>'+esc(x.setNumber)+' · '+esc(x.name)+'</b><div><span class="qualityScoreV38">'+score+' % vollständig</span></div><div class="chips">'+issues.map(k=>'<span class="chip warn">'+esc(qualityLabelsV35[k])+'</span>').join("")+'</div></div><div class="actions"><button class="btn secondary" onclick="autoEnrichOneV35(\''+esc(x.setNumber)+'\')">Auto ergänzen</button><button class="btn" onclick="editSet(\''+esc(x.setNumber)+'\')">Bearbeiten</button></div></div>').join(""):'<p class="hint">Für diesen Filter sind keine fehlenden Angaben vorhanden.</p>';
};

function detailTabsV38(n){
 const d=$("detailContent"),x=state.collection.find(y=>String(y.setNumber)===String(n));if(!d||!x||d.querySelector(".detailTabsV38"))return;
 const hero=d.querySelector(".detailHero"),ex=d.querySelector(".exemplars"),market=d.querySelector(".marketCard"),chart=[...d.children].find(el=>el.querySelector?.(".priceChartV37"));
 const other=[...d.children].filter(el=>el!==hero&&el!==ex&&el!==market&&el!==chart);
 const bar=document.createElement("div");bar.className="detailTabsV38";
 const views={};
 [["stock","Bestand"],["ex","Exemplare"],["price","Preisverlauf"],["city","Stadtplanung"],["online","Online-Daten"]].forEach(([id,label])=>{
   const b=document.createElement("button");b.className="detailTabBtnV38"+(id==="stock"?" active":"");b.textContent=label;b.dataset.view=id;bar.appendChild(b);
   const v=document.createElement("div");v.className="detailViewV38"+(id==="stock"?" active":"");v.dataset.view=id;views[id]=v;
 });
 if(hero)views.stock.appendChild(hero);other.forEach(el=>views.stock.appendChild(el));
 if(ex)views.ex.appendChild(ex); else views.ex.innerHTML='<p class="hint">Keine Exemplare separat erfasst.</p>';
 if(chart)views.price.appendChild(chart); else views.price.innerHTML='<p class="hint">Noch keine Preisverlauf-Daten.</p>';
 views.city.innerHTML='<div class="detailFacts"><div class="fact"><small>Stadtbereich</small><b>'+esc(x.cityArea||"–")+'</b></div><div class="fact"><small>Modul</small><b>'+esc(x.module||"–")+'</b></div><div class="fact"><small>Stellfläche</small><b>'+esc(footprintTextV526(x))+'</b></div><div class="fact"><small>Passform</small><b>'+esc(fitWarningV28(x))+'</b></div><div class="fact"><small>Datenqualität</small><b>'+qualityScoreV38(x)+' %</b></div></div>';
 if(market)views.online.appendChild(market); else views.online.innerHTML='<p class="hint">Für dieses Set liegen noch keine Online-Daten vor.</p>';
 d.prepend(bar);
 Object.values(views).forEach(v=>d.appendChild(v));
 bar.querySelectorAll("button").forEach(b=>b.onclick=()=>{bar.querySelectorAll("button").forEach(z=>z.classList.toggle("active",z===b));Object.values(views).forEach(v=>v.classList.toggle("active",v.dataset.view===b.dataset.view))});
}
const detailCoreV38=showDetailV3;
showDetailV3=function(n){detailCoreV38(n);detailTabsV38(n)};

function csvFullExportV38(){
 ensureV37State();ensureV28State();
 const H=["Datentyp","Setnummer","Name","Anzahl","Exemplar","Kaufpreis","Aktueller Wert","Markt neu","Markt gebraucht","Breite","Tiefe","Höhe","Kategorie","Stadtbereich","Modul","Zustand","Bauzustand","Lagerort","Barcode","Kaufdatum","Verkäufer","OVP","Vollständig","Priorität","UVP","Kaufgrenze","Angebot","Bild URL","Notiz","Zusatzdaten"];
 const rows=[H];
 for(const x of state.collection||[]){
   const e=enrichmentV3.sets?.[String(x.setNumber)]||x.market||{};
   rows.push(["Set",x.setNumber,x.name,x.quantity,"",x.purchasePrice,x.currentValue,e.marketNewEUR,e.marketUsedEUR,x.width,x.depth,x.height,x.category,x.cityArea,x.module,x.condition,x.buildStatus,x.storage,x.barcode,x.purchaseDate,x.seller,"","","","","",x.imageUrl,x.note,JSON.stringify({valueSource:x.valueSource||"",quality:qualityScoreV38(x)})]);
   (x.exemplars||[]).forEach((z,i)=>rows.push(["Exemplar",x.setNumber,x.name,1,i+1,z.price,"","","","","","","",x.cityArea,x.module,z.condition||x.condition,"",z.storage||x.storage,"",z.date,z.seller,z.box,z.complete,"","","","",z.note,JSON.stringify({shipping:z.shipping||0,legacy:!!z.legacy,addedAfterBaseline:!!z.addedAfterBaseline})]));
 }
 for(const w of state.wishlist||[])rows.push(["Wunsch",w.setNumber,w.name,"","","",w.price,w.market?.marketNewEUR,w.market?.marketUsedEUR,"","","","",w.area||w.cityArea,"","","","","","","","","",w.priority,w.rrp,w.limit,w.offer,w.imageUrl,w.reason,""]);
 for(const [m,sets] of Object.entries(state.modules||{}))rows.push(["Modul",sets.join(","),"","","","","","","","","","","","",m,"","","","","","","","","","","","","","",""]);
 for(const t of state.trackShopping||[])rows.push(["Schiene","","",t.target,"","","","","","","","","","","","","","","","","","","","","","","","","",JSON.stringify(t)]);
 for(const o of state.classifiedOffers||[])rows.push(["Angebot","",o.title,"","","",o.price,"","","","","","","","","","","","","","","","","","","","","",o.note,JSON.stringify(o)]);
 const txt="\ufeff"+rows.map(r=>r.map(csvEsc).join(";")).join("\n");
 dl(new Blob([txt],{type:"text/csv;charset=utf-8"}),"Brick_City_Manager_Vollstaendig_"+todayV28()+".csv");
}
if($("exportCsv"))$("exportCsv").onclick=csvFullExportV38;

function maybeShowOnboardingV38(){
 if(!cloudUserV3||state.meta?.onboardingDone||sessionStorage.getItem("skipOnboardingV38"))return;
 const m=$("onboardingV38");if(!m)return;
 $("onboardNameV38").value=state.meta?.profileName||"";
 m.classList.add("show");
}
function bindOnboardingV38(){
 if($("onboardLaterV38"))$("onboardLaterV38").onclick=()=>{sessionStorage.setItem("skipOnboardingV38","1");$("onboardingV38").classList.remove("show")};
 if($("onboardDoneV38"))$("onboardDoneV38").onclick=()=>{state.meta=state.meta||{};state.meta.profileName=$("onboardNameV38").value.trim();state.meta.onboardingDone=true;persist();updateAccountBadgeV3();$("onboardingV38").classList.remove("show");switchTab("home")};
}
const cloudSessionCoreV38=cloudSessionV3;
cloudSessionV3=async function(session){const r=await cloudSessionCoreV38(session);setTimeout(maybeShowOnboardingV38,80);setTimeout(loadServerAlertsV38,120);return r};

let lastSyncEventV38=0;
async function logSyncEventV38(){
 if(!cloudV3||!cloudUserV3)return;
 const now=Date.now();if(now-lastSyncEventV38<15*60*1000)return;lastSyncEventV38=now;
 try{await cloudV3.from("sync_events").insert({user_id:cloudUserV3.id,event_type:"sync"})}catch{}
}
const cloudSaveCoreV38=cloudSaveV3;
cloudSaveV3=async function(show=false){const r=await cloudSaveCoreV38(show);logSyncEventV38();return r};

async function loadServerAlertsV38(){
 if(!cloudV3||!cloudUserV3)return;
 try{
   const {data,error}=await cloudV3.from("price_alert_events").select("id,set_number,set_name,market_price,limit_price,created_at,read_at").eq("user_id",cloudUserV3.id).order("created_at",{ascending:false}).limit(20);
   if(error||!data)return;
   state.meta=state.meta||{};state.meta.serverPriceAlerts=data;renderWishAlertsV28();
 }catch{}
}
const renderWishAlertsCoreV38=renderWishAlertsV28;
renderWishAlertsV28=function(){
 renderWishAlertsCoreV38();
 const root=$("wishAlertsV28");
 if(root&&!$("emailAlertsToggleV38")){
   const b=document.createElement("button");b.id="emailAlertsToggleV38";b.className="btn secondary";b.style.marginTop="10px";
   const paint=()=>b.textContent="E-Mail-Preisalarme: "+(state.meta?.emailPriceAlerts?"AN":"AUS");
   paint();b.onclick=()=>{state.meta=state.meta||{};state.meta.emailPriceAlerts=!state.meta.emailPriceAlerts;persist();paint();alert(state.meta.emailPriceAlerts?"E-Mail-Preisalarme aktiviert. Versand erfolgt, sobald ein Mail-Absender serverseitig eingerichtet ist.":"E-Mail-Preisalarme deaktiviert.")};root.appendChild(b);
 }
 const box=$("wishAlertsV28");if(!box)return;const alerts=state.meta?.serverPriceAlerts||[];
 if(alerts.length){const div=document.createElement("div");div.className="serverAlertsV38";div.innerHTML='<h3>Server-Preishinweise</h3>'+alerts.slice(0,8).map(a=>'<div class="alertRow"><b>'+esc(a.set_number)+' · '+esc(a.set_name||"")+'</b><span>'+euro(a.market_price)+' ≤ '+euro(a.limit_price)+'</span></div>').join("");box.appendChild(div)}
};

async function renderAdminV38(){
 if(!isAdminV36()||!cloudV3)return;
 let data=null,err="";
 try{const r=await cloudV3.rpc("admin_metrics_v38");if(r.error)err=r.error.message;else data=Array.isArray(r.data)?r.data[0]:r.data}catch(e){err=String(e?.message||e)}
 let box=$("adminExtraV38");if(!box){box=document.createElement("div");box.id="adminExtraV38";$("adminSummaryV36")?.after(box)}
 if(!box)return;
 box.innerHTML=data?'<div class="miniStats"><div class="miniStat"><span>Aktiv 7 Tage</span><b>'+pV3(data.active_7d)+'</b></div><div class="miniStat"><span>Aktiv 30 Tage</span><b>'+pV3(data.active_30d)+'</b></div><div class="miniStat"><span>Syncs 24h</span><b>'+pV3(data.syncs_24h)+'</b></div><div class="miniStat"><span>Datenbankgröße</span><b>'+((pV3(data.db_bytes)/1024/1024).toFixed(2).replace(".",","))+' MB</b></div><div class="miniStat"><span>Offene Kataloganfragen</span><b>'+pV3(data.pending_catalog_requests)+'</b></div></div>':'<p class="hint">Erweiterte Admin-Metriken noch nicht freigeschaltet'+(err?": "+esc(err):".")+'</p>';
 const m=enrichmentV3?.meta||{},api=[];
 if(m.rebrickableRequestsThisRun!=null)api.push("Rebrickable-Aufrufe letzter Lauf: "+m.rebrickableRequestsThisRun);
 if(m.brickeconomyRequestsThisRun!=null)api.push("BrickEconomy-Aufrufe letzter Lauf: "+m.brickeconomyRequestsThisRun);
 if(m.rateLimited)api.push("⚠ API-Limit beim letzten Lauf erreicht");
 if(api.length)box.innerHTML+='<p class="hint">'+api.map(esc).join(" · ")+'</p>';
}
const adminCoreV38=renderAdminV36;
renderAdminV36=async function(){const r=await adminCoreV38();await renderAdminV38();return r};

bindOnboardingV38();setTimeout(()=>{if(cloudUserV3){maybeShowOnboardingV38();loadServerAlertsV38()}},500);


/* v37 online catalog requests, charts, recycle bin and exemplar editor */

function ensureV37(){
 state.trash=state.trash||[];
 state.meta=state.meta||{};
 state.meta.portfolioHistory=state.meta.portfolioHistory||[];
 const cutoff=Date.now()-30*24*60*60*1000;
 state.trash=state.trash.filter(x=>new Date(x.deletedAt||0).getTime()>=cutoff);
 for(const x of state.collection||[]){
   x.exemplars=x.exemplars||[];
   for(const e of x.exemplars){if(e.storage===undefined)e.storage=x.storage||""}
 }
}
function recordPortfolioV37(){
 const day=new Date().toISOString().slice(0,10);
 const value=(state.collection||[]).reduce((s,x)=>s+pV3(x.quantity)*pV3(x.currentValue),0);
 const investment=totalsV3().inv;
 const h=state.meta.portfolioHistory=state.meta.portfolioHistory||[];
 const last=h[h.length-1];
 const row={date:day,value,investment};
 if(!last||last.date!==day)h.push(row);else Object.assign(last,row);
 if(h.length>365)h.splice(0,h.length-365);
}
function sparklineV37(points,width=520,height=150){
 const vals=points.map(p=>Number(p||0)).filter(Number.isFinite);
 if(!vals.length)return '<p class="hint">Noch keine Verlaufsdaten.</p>';
 const min=Math.min(...vals),max=Math.max(...vals),span=(max-min)||1,pad=12;
 const coords=points.map((v,i)=>{
   const x=pad+(width-2*pad)*(points.length===1?0.5:i/(points.length-1));
   const y=height-pad-(height-2*pad)*((Number(v||0)-min)/span);
   return x.toFixed(1)+','+y.toFixed(1)
 }).join(' ');
 return '<svg class="priceChartV37" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Preisverlauf"><polyline fill="none" stroke="currentColor" stroke-width="3" points="'+coords+'"></polyline><text x="'+pad+'" y="'+(height-2)+'">'+esc(euro(min))+'</text><text x="'+(width-120)+'" y="14">'+esc(euro(max))+'</text></svg>';
}

async function requestCatalogV37(n){
 n=String(n||"").trim().replace(/-1$/,"");if(!n||!cloudV3||!cloudUserV3)return false;
 try{
   const {error}=await cloudV3.from("catalog_requests").upsert({set_number:n,requested_at:new Date().toISOString()},{onConflict:"set_number"});
   return !error;
 }catch{return false}
}
const lookupCatalogBaseV37=lookupCatalogV35;
lookupCatalogV35=async function(n,statusId){
 const e=await lookupCatalogBaseV37(n,statusId);
 if(e)return e;
 const queued=await requestCatalogV37(n);
 const s=$(statusId);
 if(s&&queued)s.textContent="Noch keine Daten vorhanden · automatische Online-Nachladung angefordert.";
 return null;
};

window.delSet=n=>{
 const i=state.collection.findIndex(x=>String(x.setNumber)===String(n));if(i<0)return;
 if(!confirm("Set in den Papierkorb verschieben? Es kann 30 Tage wiederhergestellt werden."))return;
 const [item]=state.collection.splice(i,1);
 state.trash=state.trash||[];state.trash.unshift({deletedAt:new Date().toISOString(),item});
 persist();refresh();
};
window.restoreTrashV37=i=>{
 const row=state.trash?.[i];if(!row)return;
 const x=row.item,existing=state.collection.find(y=>String(y.setNumber)===String(x.setNumber));
 if(existing){existing.quantity=pV3(existing.quantity)+pV3(x.quantity);existing.exemplars=[...(existing.exemplars||[]),...(x.exemplars||[])]}
 else state.collection.push(x);
 state.trash.splice(i,1);persist();refresh();
};
window.deleteTrashV37=i=>{if(!confirm("Endgültig löschen?"))return;state.trash.splice(i,1);persist();refresh()};
function renderTrashV37(){
 const box=$("trashListV37");if(!box)return;
 ensureV37();
 box.innerHTML=state.trash.length?state.trash.map((r,i)=>'<div class="trashRowV37"><div><b>'+esc(r.item?.setNumber||"")+' · '+esc(r.item?.name||"")+'</b><small>gelöscht '+new Date(r.deletedAt).toLocaleDateString("de-DE")+'</small></div><div class="actions"><button class="btn secondary" onclick="restoreTrashV37('+i+')">Wiederherstellen</button><button class="rowbtn" onclick="deleteTrashV37('+i+')">🗑 endgültig</button></div></div>').join(""):'<p class="hint">Papierkorb ist leer.</p>';
 if($("emptyTrashV37"))$("emptyTrashV37").onclick=()=>{if(state.trash.length&&confirm("Papierkorb endgültig leeren?")){state.trash=[];persist();refresh()}};
}

window.editExemplarV28=(setNumber,index)=>{
 const x=state.collection.find(y=>String(y.setNumber)===String(setNumber)),e=x?.exemplars?.[index];if(!e)return;
 exemplarEditV37={setNumber:String(setNumber),index};
 $("exemplarTitleV37").textContent="Exemplar #"+(index+1)+" bearbeiten";
 $("exDateV37").value=e.date||"";$("exSellerV37").value=e.seller||"";$("exConditionV37").value=e.condition||"Unbekannt";
 $("exPriceV37").value=e.price??"";$("exShippingV37").value=e.shipping??"";$("exBoxV37").value=e.box||"";$("exCompleteV37").value=e.complete||"";
 $("exStorageV37").value=e.storage||x.storage||"";$("exNoteV37").value=e.note||"";$("exemplarModalV37").classList.add("show");
};
function closeExemplarV37(){$("exemplarModalV37")?.classList.remove("show");exemplarEditV37={setNumber:"",index:-1}}
function bindExemplarV37(){
 if($("closeExemplarV37"))$("closeExemplarV37").onclick=closeExemplarV37;
 if($("cancelExemplarV37"))$("cancelExemplarV37").onclick=closeExemplarV37;
 if($("saveExemplarV37"))$("saveExemplarV37").onclick=()=>{
  const x=state.collection.find(y=>String(y.setNumber)===exemplarEditV37.setNumber),e=x?.exemplars?.[exemplarEditV37.index];if(!e)return closeExemplarV37();
  Object.assign(e,{date:$("exDateV37").value,seller:$("exSellerV37").value.trim(),condition:$("exConditionV37").value,price:pV3($("exPriceV37").value),shipping:pV3($("exShippingV37").value),box:$("exBoxV37").value,complete:$("exCompleteV37").value,storage:$("exStorageV37").value.trim(),note:$("exNoteV37").value.trim(),legacy:false});
  const vals=(x.exemplars||[]).map(v=>pV3(v.price)).filter(v=>v>0);if(vals.length)x.purchasePrice=vals.reduce((a,b)=>a+b,0)/vals.length;
  persist();refresh();closeExemplarV37();showDetailV3(x.setNumber);
 };
}

const detailBaseV37=showDetailV3;
showDetailV3=function(n){
 detailBaseV37(n);
 const x=state.collection.find(y=>String(y.setNumber)===String(n));if(!x)return;
 const history=(state.priceHistory?.[String(n)]||[]);
 const card=document.createElement("div");card.className="card wide";
 card.innerHTML='<h3>Preisverlauf</h3>'+sparklineV37(history.map(r=>pV3(r.currentEUR)||pV3(r.newEUR)||pV3(r.usedEUR)))+'<p class="hint">'+(history.length?history.length+' Messpunkt'+(history.length===1?'':'e'):'Historie startet, sobald neue Marktstände geladen werden.')+'</p>';
 $("detailContent")?.appendChild(card);
 const ex=$("detailContent")?.querySelector(".exemplars");
 if(ex){ex.innerHTML='<h3>Einzel-Exemplare / Käufe</h3>'+((x.exemplars||[]).length?x.exemplars.map((e,i)=>'<div class="exemplar"><div><b>#'+(i+1)+'</b> · '+esc(e.date||"ohne Datum")+' · '+esc(e.condition||"Unbekannt")+' · '+esc(e.seller||"Quelle unbekannt")+' · '+euro(e.price)+' · '+esc(e.storage||x.storage||"kein Lagerort")+'</div><div class="actions"><button class="rowbtn" onclick="editExemplarV28(\''+esc(x.setNumber)+'\','+i+')">✏️ Bearbeiten</button><button class="rowbtn" onclick="deleteExemplarV28(\''+esc(x.setNumber)+'\','+i+')">🗑 Löschen</button></div></div>').join(""):'<p class="hint">Noch keine Einzelkäufe separat erfasst.</p>')}
};

const renderAnalysisBaseV37=renderAnalysisV3;
renderAnalysisV3=function(){
 renderAnalysisBaseV37();
 let box=$("portfolioChartV37");if(!box){box=document.createElement("div");box.id="portfolioChartV37";box.className="card wide";$("analysis")?.appendChild(box)}
 const h=state.meta?.portfolioHistory||[];
 box.innerHTML='<h2>Sammlungswert im Zeitverlauf</h2>'+sparklineV37(h.map(r=>r.value))+'<p class="hint">'+(h.length?h[0].date+' bis '+h[h.length-1].date:'Noch keine historischen Gesamtwerte.')+'</p>';
};

const persistBaseV37=persist;
persist=function(){ensureV37();recordPortfolioV37();persistBaseV37()};
const refreshBaseV37=refresh;
refresh=function(){ensureV37();recordPortfolioV37();refreshBaseV37();renderTrashV37();if(document.querySelector("#analysis.active"))renderAnalysisV3()};

ensureV37();bindExemplarV37();renderTrashV37();recordPortfolioV37();


/* v40 robust account navigation and login */
async function ensureCloudReadyV40(){
 if(cloudV3)return true;
 const cfg=window.LEGO_SUPABASE;
 if(!cfg||!window.supabase){
   cloudStatusV3("Anmeldung kann gerade nicht gestartet werden. Bitte App neu laden.");
   return false;
 }
 try{
   cloudV3=window.supabase.createClient(cfg.url,cfg.publishableKey);
   return true;
 }catch(e){
   cloudStatusV3("Cloud-Verbindung konnte nicht gestartet werden.");
   return false;
 }
}
async function loginV40(){
 const email=$("cloudEmail")?.value.trim()||"",password=$("cloudPassword")?.value||"";
 if(!email||!password)return alert("Bitte E-Mail und Passwort eingeben.");
 if(!(await ensureCloudReadyV40()))return;
 cloudStatusV3("Anmeldung läuft…");
 try{
   const {data,error}=await cloudV3.auth.signInWithPassword({email,password});
   if(error){cloudStatusV3("Anmeldung fehlgeschlagen.");return alert(error.message)}
   if(data?.session){await cloudSessionV3(data.session);cloudStatusV3("Erfolgreich angemeldet.");switchTab("home")}
 }catch(e){
   cloudStatusV3("Anmeldung fehlgeschlagen.");
   alert("Anmeldung fehlgeschlagen: "+(e?.message||e));
 }
}
function bindAccountV40(){
 document.addEventListener("click",e=>{
   const tab=e.target.closest?.(".tab[data-tab]");
   if(tab){e.preventDefault();switchTab(tab.dataset.tab)}
 });
 if($("userTop"))$("userTop").onclick=()=>switchTab("users");
 if($("cloudLogin"))$("cloudLogin").onclick=loginV40;
 if($("cloudPassword"))$("cloudPassword").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loginV40()}});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bindAccountV40);else bindAccountV40();


/* v43 central barcode learning */
async function lookupBarcodeCentralV43(code){
 if(!cloudV3||!cloudUserV3)return null;
 try{
   const {data,error}=await cloudV3.from("barcode_mappings").select("barcode,set_number,set_name,image_url,status").eq("barcode",String(code)).maybeSingle();
   if(error||!data||data.status==="rejected"||data.status==="conflict")return null;
   return data;
 }catch{return null}
}
async function learnBarcodeV43(code,setNumber,name,imageUrl=""){
 if(!cloudV3||!cloudUserV3)return false;
 try{
   const {data,error}=await cloudV3.rpc("learn_barcode_mapping",{
     p_barcode:String(code),p_set_number:String(setNumber),p_set_name:String(name||""),p_image_url:String(imageUrl||"")
   });
   return !error&&data!==false;
 }catch{return false}
}
async function useBarcodeSetV43(code,setNumber,e={}){
 const name=e.brickeconomyName||e.rebrickableName||e.set_name||"";
 let x=state.collection.find(s=>String(s.setNumber)===String(setNumber));
 if(x){
   if(!x.barcode)x.barcode=code;
   if(!x.imageUrl&&(e.imageUrl||e.image_url))x.imageUrl=e.imageUrl||e.image_url;
   persist();refresh();showDetailV3(x.setNumber);return true;
 }
 openSet();
 $("fSet").value=setNumber;
 $("fName").value=name;
 $("fBarcode").value=code;
 if($("fImage")&&(e.imageUrl||e.image_url))$("fImage").value=e.imageUrl||e.image_url;
 if(name||e.imageUrl||e.image_url)setTimeout(()=>fillSetFromCatalogV32?.(),50);
 return true;
}
async function handleUnknownBarcodeV43(code){
 const setNumber=(prompt("Barcode "+code+" ist noch unbekannt. Welche LEGO-Setnummer gehört dazu?")||"").trim().replace(/-1$/,"");
 if(!setNumber){openSet();$("fBarcode").value=code;return}
 if(!/^\d{4,7}$/.test(setNumber)){alert("Bitte eine gültige LEGO-Setnummer eingeben.");openSet();$("fBarcode").value=code;return}

 await ensureCatalogV31(setNumber);
 const e=enrichmentV3?.sets?.[setNumber]||{};
 let name=e.brickeconomyName||e.rebrickableName||"";

 if(!name){
   const entered=(prompt("Set "+setNumber+" ist noch nicht im Online-Katalog. Optional den Namen eingeben:")||"").trim();
   name=entered||("Set "+setNumber+" · Daten werden nachgeladen");
 }

 await learnBarcodeV43(code,setNumber,name,e.imageUrl||"");
 try{await requestCatalogV37(setNumber)}catch{}

 openSet();
 $("fSet").value=setNumber;
 $("fName").value=name;
 $("fBarcode").value=code;
 if($("fImage")&&e.imageUrl)$("fImage").value=e.imageUrl;
 if($("fCatalogStatusV35"))$("fCatalogStatusV35").textContent=e.brickeconomyName||e.rebrickableName
   ?"✓ Online-Daten gefunden"
   :"Online-Daten wurden angefordert und werden später automatisch ergänzt.";

 if(e.brickeconomyName||e.rebrickableName) setTimeout(()=>fillSetFromCatalogV32?.(),50);

 alert("Barcode und Setnummer wurden gespeichert. Fehlende Online-Daten werden automatisch nachgeladen.");
}
async function loadBarcodeAdminV43(){
 if(!isAdminV36()||!cloudV3||!$("barcodeAdminListV43"))return;
 try{
   const {data,error}=await cloudV3.from("barcode_mappings").select("barcode,set_number,set_name,status,report_count,updated_at").order("updated_at",{ascending:false}).limit(100);
   if(error)throw error;
   const rows=data||[],pending=rows.filter(r=>r.status==="pending"||r.status==="conflict");
   $("barcodeAdminStatsV43").innerHTML='<div class="miniStat"><span>Bekannte Barcodes</span><b>'+rows.length+'</b></div><div class="miniStat"><span>Zu prüfen</span><b>'+pending.length+'</b></div><div class="miniStat"><span>Bestätigt</span><b>'+rows.filter(r=>r.status==="verified").length+'</b></div>';
   $("barcodeAdminListV43").innerHTML=pending.length?pending.map(r=>'<div class="barcodeReviewV43"><div><b>'+esc(r.barcode)+'</b><span>'+esc(r.set_number)+' · '+esc(r.set_name||"")+'</span><small>'+esc(r.status)+' · Meldungen: '+pV3(r.report_count)+'</small></div><div class="actions"><button class="btn" onclick="approveBarcodeV43(\''+esc(r.barcode)+'\')">Bestätigen</button><button class="btn secondary" onclick="rejectBarcodeV43(\''+esc(r.barcode)+'\')">Ablehnen</button></div></div>').join(""):'<p class="hint">Keine offenen Barcode-Zuordnungen.</p>';
 }catch(e){$("barcodeAdminListV43").innerHTML='<p class="hint">Barcode-Datenbank noch nicht eingerichtet: '+esc(e.message||e)+'</p>'}
}
window.approveBarcodeV43=async code=>{
 const {error}=await cloudV3.rpc("admin_set_barcode_status",{p_barcode:code,p_status:"verified"});
 if(error)return alert(error.message);loadBarcodeAdminV43();
};
window.rejectBarcodeV43=async code=>{
 const {error}=await cloudV3.rpc("admin_set_barcode_status",{p_barcode:code,p_status:"rejected"});
 if(error)return alert(error.message);loadBarcodeAdminV43();
};

if($("barcodeAdminRefreshV43"))$("barcodeAdminRefreshV43").onclick=loadBarcodeAdminV43;
const renderAdminCoreV43=renderAdminV36;
renderAdminV36=async function(){const r=await renderAdminCoreV43();await loadBarcodeAdminV43();return r};


/* v45 fast Supabase set catalog by set number */
function catalogRowToLegacyV45(r={}){
 return {
  brickeconomyName:r.name||"",
  rebrickableName:r.name||"",
  imageUrl:r.image_url||"",
  theme:r.theme||"",
  subtheme:r.subtheme||"",
  year:r.year,
  pieces:r.pieces,
  minifigs:r.minifigs,
  ean:r.ean||"",
  upc:r.upc||"",
  rrpEUR:pV3(r.rrp_eur),
  marketNewEUR:pV3(r.market_new_eur),
  marketUsedEUR:pV3(r.market_used_eur),
  marketUsedLowEUR:pV3(r.market_used_low_eur),
  marketUsedHighEUR:pV3(r.market_used_high_eur),
  growth12mPct:r.growth_12m_pct,
  width:r.width,
  depth:r.depth,
  height:r.height,
  updatedAt:r.source_updated_at||null,
  marketSource:r.market_source||"Online-Katalog",
  retired:r.retired,
  onlineDb:true
 };
}
async function lookupSetOnlineV45(n){
 n=String(n||"").trim().replace(/-1$/,"");
 if(!/^\d{4,7}$/.test(n))return null;
 await ensureCloudReadyV40();
 if(cloudV3){
   try{
     const {data,error}=await cloudV3.from("catalog_sets").select("*").eq("set_number",n).maybeSingle();
     if(!error&&data)return catalogRowToLegacyV45(data);
   }catch{}
 }
 const local=enrichmentV3?.sets?.[n];
 if(local)return local;
 try{
   const r=await fetch('./data/set-enrichment.json?t='+Date.now(),{cache:'no-store'});
   if(r.ok){
     enrichmentV3=await r.json();
     if(enrichmentV3?.sets?.[n])return enrichmentV3.sets[n];
   }
 }catch{}
 if(cloudUserV3){try{await requestCatalogV37(n)}catch{}}
 return null;
}
function fillSetFieldsV45(e){
 if(!e)return;
 if($("fName")&&!$("fName").value.trim())$("fName").value=e.brickeconomyName||e.rebrickableName||"";
 const market=pV3(e.marketUsedEUR)||pV3(e.marketNewEUR);
 if($("fValue")&&!pV3($("fValue").value)&&market)$("fValue").value=market.toFixed(2);
 if($("fImage")&&!$("fImage").value.trim()&&e.imageUrl)$("fImage").value=e.imageUrl;
 if($("fBarcode")&&!$("fBarcode").value.trim()&&(e.ean||e.upc))$("fBarcode").value=e.ean||e.upc;
 if($("fCat")&&!$("fCat").value.trim())$("fCat").value=[e.theme,e.subtheme].filter(Boolean).join(" / ");
 if($("fWidth")&&!pV3($("fWidth").value)&&pV3(e.width))$("fWidth").value=e.width;
 if($("fDepth")&&!pV3($("fDepth").value)&&pV3(e.depth))$("fDepth").value=e.depth;
 if($("fHeight")&&!pV3($("fHeight").value)&&pV3(e.height))$("fHeight").value=e.height;
}
fillSetFromCatalogV32=async function(){
 const n=$("fSet")?.value.trim();if(!n)return;
 const s=$("fCatalogStatusV35");if(s)s.textContent="Setdaten werden online geladen…";
 const e=await lookupSetOnlineV45(n);
 if(e){fillSetFieldsV45(e);if(s)s.textContent=e.onlineDb?"✓ Sofort aus Online-Datenbank geladen":"✓ Daten gefunden";}
 else if(s)s.textContent="Noch nicht gefunden · automatische Nachladung wurde angefordert.";
};
fillWishFromCatalogV31=async function(){
 const n=$("wSet")?.value.trim();if(!n)return;
 const s=$("wCatalogStatusV35");if(s)s.textContent="Setdaten werden online geladen…";
 const e=await lookupSetOnlineV45(n);
 if(!e){if(s)s.textContent="Noch nicht gefunden · automatische Nachladung wurde angefordert.";return}
 if($("wName")&&!$("wName").value.trim())$("wName").value=e.brickeconomyName||e.rebrickableName||"";
 if($("wRrp")&&!pV3($("wRrp").value)&&pV3(e.rrpEUR))$("wRrp").value=pV3(e.rrpEUR).toFixed(2);
 const market=pV3(e.marketNewEUR)||pV3(e.marketUsedEUR);
 if($("wPrice")&&!pV3($("wPrice").value)&&market)$("wPrice").value=market.toFixed(2);
 if($("wImage")&&!$("wImage").value.trim()&&e.imageUrl)$("wImage").value=e.imageUrl;
 if(s)s.textContent=e.onlineDb?"✓ Sofort aus Online-Datenbank geladen":"✓ Daten gefunden";
};
lookupCatalogV35=async function(n,statusId){
 const e=await lookupSetOnlineV45(n);
 const s=$(statusId);
 if(s)s.textContent=e?(e.onlineDb?"✓ Sofort aus Online-Datenbank geladen":"✓ Daten gefunden"):"Noch nicht gefunden · automatische Nachladung wurde angefordert.";
 return e;
};

function catalogRowsForSyncV45(){
 return Object.entries(enrichmentV3?.sets||{}).map(([n,e])=>({
  set_number:String(n),
  name:e.brickeconomyName||e.rebrickableName||"",
  image_url:e.imageUrl||"",
  theme:e.theme||"",
  subtheme:e.subtheme||"",
  year:e.year??null,
  pieces:e.pieces??null,
  minifigs:e.minifigs??null,
  ean:e.ean||"",
  upc:e.upc||"",
  rrp_eur:e.rrpEUR||null,
  market_new_eur:e.marketNewEUR||null,
  market_used_eur:e.marketUsedEUR||null,
  market_used_low_eur:e.marketUsedLowEUR||null,
  market_used_high_eur:e.marketUsedHighEUR||null,
  growth_12m_pct:e.growth12mPct??null,
  width:e.width??null,
  depth:e.depth??null,
  height:e.height??null,
  retired:e.retired??null,
  source_updated_at:e.brickeconomyUpdated||e.rebrickableUpdated||e.manualUpdated||enrichmentV3?.meta?.lastUpdated||new Date().toISOString()
 }));
}
async function syncFastCatalogV45(force=false){
 const note=$("fastCatalogNoteV45");
 if(!cloudV3||!cloudUserV3){if(note)note.textContent="Zum Synchronisieren bitte anmelden.";return false}
 if(!isAdminV36()){if(note)note.textContent="Die zentrale Datenbank wird vom Betreiber synchronisiert.";return false}
 if(!Object.keys(enrichmentV3?.sets||{}).length)await loadEnrichmentV3(true);
 const stamp=enrichmentV3?.meta?.lastUpdated||"";
 if(!force&&stamp&&localStorage.getItem("fastCatalogSyncV45")===stamp)return true;
 const rows=catalogRowsForSyncV45();
 if(note)note.textContent="Online-Datenbank wird synchronisiert…";
 try{
   const {data,error}=await cloudV3.rpc("admin_upsert_catalog_batch",{p_rows:rows});
   if(error)throw error;
   if(stamp)localStorage.setItem("fastCatalogSyncV45",stamp);
   if(note)note.textContent="Synchronisiert: "+data+" Sets.";
   await renderFastCatalogStatusV45();
   return true;
 }catch(e){
   if(note)note.textContent="Online-Datenbank noch nicht eingerichtet: "+(e?.message||e);
   return false;
 }
}
async function renderFastCatalogStatusV45(){
 const box=$("fastCatalogStatusV45");if(!box)return;
 await ensureCloudReadyV40();
 let count="–",withPrice="–",withBarcode="–";
 try{
  if(cloudV3){
   const [a,b,d]=await Promise.all([
    cloudV3.from("catalog_sets").select("set_number",{count:"exact",head:true}),
    cloudV3.from("catalog_sets").select("set_number",{count:"exact",head:true}).or("market_new_eur.not.is.null,market_used_eur.not.is.null"),
    cloudV3.from("catalog_sets").select("set_number",{count:"exact",head:true}).or("ean.not.is.null,upc.not.is.null")
   ]);
   if(!a.error)count=a.count??0;if(!b.error)withPrice=b.count??0;if(!d.error)withBarcode=d.count??0;
  }
 }catch{}
 box.innerHTML='<div class="miniStat"><span>Online-Sets</span><b>'+count+'</b></div><div class="miniStat"><span>mit Marktwert</span><b>'+withPrice+'</b></div><div class="miniStat"><span>mit Barcode</span><b>'+withBarcode+'</b></div>';
}
function bindFastCatalogV45(){
 if($("syncFastCatalogV45"))$("syncFastCatalogV45").onclick=()=>syncFastCatalogV45(true);
 renderFastCatalogStatusV45();
 setTimeout(()=>{if(isAdminV36())syncFastCatalogV45(false)},800);
}
bindFastCatalogV45();


function bindFastSetInputsV45(){
 const set=$("fSet"),wish=$("wSet");
 if(set&&!set.dataset.fastV45){
   set.dataset.fastV45="1";
   const run=()=>fillSetFromCatalogV32();
   set.addEventListener("change",run);set.addEventListener("blur",run);
   set.addEventListener("input",()=>{clearTimeout(set._fastV45);set._fastV45=setTimeout(()=>{if(set.value.trim().length>=4)run()},250)});
 }
 if(wish&&!wish.dataset.fastV45){
   wish.dataset.fastV45="1";
   const run=()=>fillWishFromCatalogV31();
   wish.addEventListener("change",run);wish.addEventListener("blur",run);
   wish.addEventListener("input",()=>{clearTimeout(wish._fastV45);wish._fastV45=setTimeout(()=>{if(wish.value.trim().length>=4)run()},250)});
 }
}
bindFastSetInputsV45();


/* v46 full Rebrickable set-number index */
let allSetsV46=null,allSetsPromiseV46=null;
async function loadAllSetsV46(force=false){
 if(allSetsV46&&!force)return allSetsV46;
 if(allSetsPromiseV46&&!force)return allSetsPromiseV46;
 allSetsPromiseV46=(async()=>{
   try{
     const r=await fetch('./data/all-sets.json'+(force?'?t='+Date.now():''),{cache:force?'no-store':'default'});
     if(!r.ok)return null;
     allSetsV46=await r.json();
     if($("fastCatalogNoteV45")&&allSetsV46?.meta?.uniqueSetNumbers){
       $("fastCatalogNoteV45").textContent="Gesamtkatalog geladen: "+allSetsV46.meta.uniqueSetNumbers+" Setnummern.";
     }
     return allSetsV46;
   }catch{return null}
 })();
 const out=await allSetsPromiseV46;allSetsPromiseV46=null;return out;
}
function allSetLegacyV46(n,row){
 if(!row)return null;
 return {
   rebrickableName:row[0]||"",
   brickeconomyName:row[0]||"",
   year:row[1]||null,
   pieces:row[2]||null,
   imageUrl:row[3]||"",
   rebrickableSetNum:row[4]||"",
   bulkIndex:true
 };
}
const lookupSetOnlineBaseV46=lookupSetOnlineV45;
lookupSetOnlineV45=async function(n){
 n=String(n||"").trim().replace(/-1$/,"");
 const direct=await lookupSetOnlineBaseV46(n);
 if(direct)return direct;
 const all=await loadAllSetsV46(false);
 const row=all?.sets?.[n];
 if(row)return allSetLegacyV46(n,row);
 if(cloudUserV3){try{await requestCatalogV37(n)}catch{}}
 return null;
};
const renderFastCatalogStatusBaseV46=renderFastCatalogStatusV45;
renderFastCatalogStatusV45=async function(){
 await renderFastCatalogStatusBaseV46();
 const all=await loadAllSetsV46(false);
 const box=$("fastCatalogStatusV45");
 if(box&&all?.meta?.uniqueSetNumbers&&!$("allSetsCountV46")){
   const d=document.createElement("div");d.className="miniStat";d.id="allSetsCountV46";d.innerHTML='<span>Alle Setnummern</span><b>'+all.meta.uniqueSetNumbers+'</b>';box.appendChild(d);
 }
};
/* v50.42 performance: Gesamtkatalog erst beim Sammler/Lookup laden */


/* v49 iPhone-first city planner */
let citySelectedModuleV49="";
function cityAssignedSetNumbersV49(){
 const out=new Set();
 for(const a of Object.values(state.modules||{}))for(const n of (a||[]))out.add(String(n));
 return out;
}
function cityUnplannedSetsV49(){
 const assigned=cityAssignedSetNumbersV49();
 return (state.collection||[]).filter(x=>!assigned.has(String(x.setNumber)));
}
function renderCityPlannerV49(){
 const stats=$("cityPlannerStatsV49"),select=$("citySetSelectV49"),list=$("cityUnplannedV49");
 if(!(stats&&select&&list))return;
 const modules=Object.keys(state.modules||{}),occupied=modules.filter(m=>(state.modules[m]||[]).length).length;
 const unplanned=cityUnplannedSetsV49();
 const oversized=(state.collection||[]).filter(x=>cityAssignedSetNumbersV49().has(String(x.setNumber))&&typeof moduleFitsV35==="function"&&moduleFitsV35(x)===false).length;
 const area=(state.collection||[]).reduce((s,x)=>s+pV3(x.width)*pV3(x.depth)*pV3(x.quantity),0)/10000;
 stats.innerHTML=
   '<div class="miniStat"><span>Belegte Module</span><b>'+occupied+' / '+modules.length+'</b></div>'+
   '<div class="miniStat"><span>Noch ohne Platz</span><b>'+unplanned.length+'</b></div>'+
   '<div class="miniStat"><span>Zu groß für 1 Modul</span><b>'+oversized+'</b></div>'+
   '<div class="miniStat"><span>Bekannte Setfläche</span><b>'+area.toFixed(2).replace(".",",")+' m²</b></div>';

 const previous=select.value;
 const sorted=[...(state.collection||[])].sort((a,b)=>{
   const au=unplanned.includes(a)?0:1,bu=unplanned.includes(b)?0:1;
   return au-bu||String(a.setNumber).localeCompare(String(b.setNumber),undefined,{numeric:true});
 });
 select.innerHTML='<option value="">Set auswählen…</option>'+sorted.map(x=>'<option value="'+esc(x.setNumber)+'">'+(unplanned.includes(x)?'● ':'')+esc(x.setNumber)+' · '+esc(x.name)+'</option>').join("");
 if(sorted.some(x=>String(x.setNumber)===String(previous)))select.value=previous;

 if($("citySelectedModuleV49"))$("citySelectedModuleV49").textContent=citySelectedModuleV49||"Noch keines";
 if($("cityUnplannedCountV49"))$("cityUnplannedCountV49").textContent=String(unplanned.length);
 list.innerHTML=unplanned.length?unplanned.slice(0,100).map(x=>
   '<button class="cityUnplannedItemV49" onclick="selectCitySetV49(\''+esc(x.setNumber)+'\')">'+
   '<span class="cityUnplannedPicV49">'+(x.imageUrl?'<img src="'+esc(x.imageUrl)+'" alt="">':'◻')+'</span>'+
   '<span class="cityUnplannedTextV49"><b>'+esc(x.setNumber)+'</b><span>'+esc(x.name)+'</span><small>'+esc(shortAreaV3(x.cityArea||"Ohne Bereich"))+'</small></span>'+
   '<span class="cityUnplannedActionV49">Planen ›</span></button>'
 ).join(""):'<div class="cityAllPlannedV49">✓ Alle Sets haben einen festen Platz in der Stadt.</div>';

 document.querySelectorAll("#moduleGrid .module[data-module]").forEach(el=>{
   const m=el.dataset.module,sets=(state.modules?.[m]||[]).map(n=>state.collection.find(x=>String(x.setNumber)===String(n))).filter(Boolean);
   if(sets.length){
     const first=sets[0];
     el.insertAdjacentHTML("beforeend",'<span class="moduleSetNameV49">'+esc(first.setNumber)+' · '+esc(first.name)+(sets.length>1?' <b>+'+(sets.length-1)+'</b>':'')+'</span>');
   }
 });
}
window.selectCitySetV49=n=>{
 const select=$("citySetSelectV49");if(select)select.value=String(n);
 const x=state.collection.find(y=>String(y.setNumber)===String(n));
 if(x&&$("fitV28"))$("fitV28").textContent=typeof fitWarningV28==="function"?fitWarningV28(x):"";
 $("citySetSelectV49")?.scrollIntoView({behavior:"smooth",block:"center"});
};
window.removeCitySetV49=n=>{
 const x=state.collection.find(y=>String(y.setNumber)===String(n));if(!x)return;
 x.module="";syncModuleV3(x);persist();refresh();renderCityPlannerV49();
};
const moduleClickBaseV49=window.moduleClickV3;
window.moduleClickV3=m=>{
 citySelectedModuleV49=m;
 moduleClickBaseV49(m);
 if($("citySelectedModuleV49"))$("citySelectedModuleV49").textContent=m;
 const d=(state.modules?.[m]||[]).map(n=>state.collection.find(x=>String(x.setNumber)===String(n))).filter(Boolean);
 const detail=$("moduleDetail");
 if(detail&&d.length){
   detail.insertAdjacentHTML("beforeend",'<div class="cityModuleManageV49">'+d.map(x=>'<div><span>'+esc(x.setNumber)+' · '+esc(x.name)+'</span><button class="rowbtn" onclick="removeCitySetV49(\''+esc(x.setNumber)+'\')">Vom Modul lösen</button></div>').join("")+'</div>');
 }
};
function bindCityPlannerV49(){
 const assign=$("cityAssignV49"),select=$("citySetSelectV49");
 if(select)select.onchange=()=>{const x=state.collection.find(y=>String(y.setNumber)===String(select.value));if(x&&$("fitV28"))$("fitV28").textContent=fitWarningV28(x)};
 if(assign)assign.onclick=()=>{
   const setNumber=select?.value||"";
   if(!citySelectedModuleV49)return alert("Bitte zuerst auf dem Stadtplan ein Modul antippen.");
   if(!setNumber)return alert("Bitte ein Set auswählen.");
   assignModuleV28(setNumber,citySelectedModuleV49);
   renderCityPlannerV49();
 };
}
const renderModulesBaseV49=renderModulesV3;
renderModulesV3=function(){renderModulesBaseV49();setTimeout(renderCityPlannerV49,0)};
const refreshBaseV49=refresh;
refresh=function(){const r=refreshBaseV49();renderCityPlannerV49();return r};
bindCityPlannerV49();
renderCityPlannerV49();


/* v50 milestone: City Command Center + Planner Pro */
let citySuggestionV50=null;
function assignedCountV50(){
 const s=new Set();
 for(const a of Object.values(state.modules||{}))for(const n of (a||[]))s.add(String(n));
 return s.size;
}
function dataQualityV50(){
 const rows=state.collection||[];if(!rows.length)return 0;
 let got=0,total=rows.length*6;
 for(const x of rows){
  if(x.imageUrl)got++;
  if(pV3(x.currentValue)>0)got++;
  if(pV3(x.width)>0&&pV3(x.depth)>0)got++;
  if(x.cityArea)got++;
  if(x.condition&&x.condition!=="Unbekannt")got++;
  if(x.barcode)got++;
 }
 return Math.round(got/total*100);
}
function inferZoneV50(x){
 const t=nV3([x.cityArea,x.category,x.name].join(" "));
 if(/weihnacht|winter|christmas/.test(t))return "winter";
 if(/bahnhof|zug|eisenbahn|train|station/.test(t))return "station";
 if(/hogwarts|harry potter|winkelgasse/.test(t))return "hogwarts";
 if(/hafen|pirat|küste|leuchtturm|fischer|harbor/.test(t))return "harbor";
 if(/disney|springfield|simpson/.test(t))return "disney";
 if(/botanik|weltpark|architecture|park|garten/.test(t))return "world";
 if(/innenstadt|altstadt|modular|city|stadtgebäude/.test(t))return "city";
 return "city";
}
function moduleZonesV50(){
 const out={};let n=0;
 for(const z of ZONES_V3){
  if(z==="open")continue;
  n++;out["M"+String(n).padStart(2,"0")]=z;
 }
 return out;
}
function pickSuggestionV50(force=false){
 const unplanned=typeof cityUnplannedSetsV49==="function"?cityUnplannedSetsV49():(state.collection||[]).filter(x=>!x.module);
 if(!unplanned.length){citySuggestionV50=null;renderSuggestionV50();return null}
 const zones=moduleZonesV50();
 const candidates=[...unplanned].sort((a,b)=>{
  const am=(pV3(a.width)&&pV3(a.depth)?0:1),bm=(pV3(b.width)&&pV3(b.depth)?0:1);
  return am-bm||String(a.setNumber).localeCompare(String(b.setNumber),undefined,{numeric:true});
 });
 let chosen=candidates[0];
 if(force&&candidates.length>1){
  const old=citySuggestionV50?.setNumber;
  chosen=candidates.find(x=>String(x.setNumber)!==String(old))||candidates[0];
 }
 const zone=inferZoneV50(chosen);
 const mods=Object.keys(state.modules||{}).filter(m=>zones[m]===zone);
 const ordered=(mods.length?mods:Object.keys(state.modules||{})).sort((a,b)=>(state.modules[a]?.length||0)-(state.modules[b]?.length||0)||a.localeCompare(b));
 const module=ordered[0]||"";
 citySuggestionV50={setNumber:String(chosen.setNumber),module,zone,fit:typeof moduleFitsV35==="function"?moduleFitsV35(chosen):null};
 renderSuggestionV50();
 return citySuggestionV50;
}
function renderSuggestionV50(){
 const title=$("citySuggestionTitleV50"),txt=$("citySuggestionTextV50"),apply=$("citySuggestionApplyV50");
 if(!(title&&txt&&apply))return;
 if(!citySuggestionV50){title.textContent="Stadt vollständig geplant";txt.textContent="Aktuell haben alle Sets einen festen Platz.";apply.disabled=true;return}
 const x=state.collection.find(y=>String(y.setNumber)===citySuggestionV50.setNumber);
 if(!x){citySuggestionV50=null;return}
 title.textContent=x.setNumber+" · "+x.name+" → "+citySuggestionV50.module;
 const fit=citySuggestionV50.fit===false?" Das Set ist größer als ein Standardmodul – bitte Platzbedarf prüfen.":citySuggestionV50.fit===null?" Maße fehlen; die Passform kann noch nicht geprüft werden.":" Größe passt in ein Standardmodul.";
 txt.textContent="Vorgeschlagener Bereich: "+(ZONELABEL_V3[citySuggestionV50.zone]||citySuggestionV50.zone)+"."+fit;
 apply.disabled=false;
}
function renderCommandCenterV50(){
 const total=(state.collection||[]).length,assigned=assignedCountV50(),pct=total?Math.round(assigned/total*100):0,unplanned=Math.max(0,total-assigned),q=dataQualityV50();
 if($("v50CityPct"))$("v50CityPct").textContent=pct+" %";
 if($("v50CityBar"))$("v50CityBar").style.width=pct+"%";
 if($("v50CityText"))$("v50CityText").textContent=assigned+" von "+total+" Sets haben einen festen Stadtplatz.";
 if($("v50Unplanned"))$("v50Unplanned").textContent=unplanned;
 if($("v50Quality"))$("v50Quality").textContent=q+" %";
 if($("v50QualityText"))$("v50QualityText").textContent=q>=90?"Sehr gut gepflegt":q>=70?"Guter Stand – einzelne Daten fehlen":"Datenqualität kann verbessert werden";
 let label="Sammlung ansehen",tab="collection";
 const wishHit=(state.wishlist||[]).find(w=>pV3(w.offer)>0&&pV3(w.limit)>0&&pV3(w.offer)<=pV3(w.limit));
 if(unplanned>0){label=unplanned+" Set"+(unplanned===1?"":"s")+" einplanen";tab="city"}
 else if(wishHit){label="Kaufchance: "+wishHit.setNumber;tab="wishlist"}
 else if(q<85){label="Fehlende Setdaten ergänzen";tab="analysis"}
 else {label="Stadt & Sammlung sind gut gepflegt";tab="home"}
 if($("v50NextAction"))$("v50NextAction").textContent=label;
 const b=$("v50NextActionBtn");if(b)b.onclick=()=>switchTab(tab);
}
function enterShowcaseV50(){
 document.body.classList.add("showcaseV50");switchTab("home");
 let x=$("showcaseExitV50");
 if(!x){x=document.createElement("button");x.id="showcaseExitV50";x.className="showcaseExitV50";x.textContent="Showcase beenden";x.onclick=()=>{document.body.classList.remove("showcaseV50");x.remove()};document.body.appendChild(x)}
}
function showWhatsNewV50(){
 if(localStorage.getItem("brick-city-manager-v50-welcome"))return;
 const m=document.createElement("div");m.className="v50WelcomeOverlay";m.innerHTML='<div class="v50Welcome"><span class="eyebrowV50">MEILENSTEIN · VERSION 50</span><div class="v50Big50">50</div><h2>Willkommen im City Command Center</h2><p>Version 50 bringt eine neue Startzentrale, automatische Planungsvorschläge, Stadtfortschritt und einen Showcase-Modus.</p><div class="v50WelcomeFeatures"><span>✓ Command Center</span><span>✓ Planner Pro</span><span>✓ Planungsvorschläge</span><span>✓ Showcase</span></div><button class="btn" id="closeV50Welcome">Version 50 starten</button></div>';
 document.body.appendChild(m);
 $("closeV50Welcome").onclick=()=>{localStorage.setItem("brick-city-manager-v50-welcome","1");m.remove()};
}
function bindV50(){
 if($("v50PlanNext"))$("v50PlanNext").onclick=()=>{switchTab("city");setTimeout(()=>{if(!citySuggestionV50)pickSuggestionV50();$("citySuggestionTitleV50")?.scrollIntoView({behavior:"smooth",block:"center"})},100)};
 if($("v50Scan"))$("v50Scan").onclick=()=>scanV3();
 if($("v50Showcase"))$("v50Showcase").onclick=enterShowcaseV50;
 if($("v50OpenCity"))$("v50OpenCity").onclick=()=>switchTab("city");
 if($("citySuggestionRefreshV50"))$("citySuggestionRefreshV50").onclick=()=>pickSuggestionV50(true);
 if($("citySuggestionApplyV50"))$("citySuggestionApplyV50").onclick=()=>{
   if(!citySuggestionV50)return pickSuggestionV50();
   const s=citySuggestionV50;
   citySelectedModuleV49=s.module;
   assignModuleV28(s.setNumber,s.module);
   citySuggestionV50=null;pickSuggestionV50();
 };
}
function renderV50(){
 renderCommandCenterV50();
 if(!citySuggestionV50||!state.collection.some(x=>String(x.setNumber)===String(citySuggestionV50.setNumber)&&!x.module))pickSuggestionV50();
 else renderSuggestionV50();
}
const refreshBaseV50=refresh;
refresh=function(){const r=refreshBaseV50();renderV50();return r};
bindV50();
renderV50();
setTimeout(showWhatsNewV50,450);


/* v50.2 automatic city capacity */
function baseModuleZoneMapV502(){
 const out={};let n=0;
 for(const z of ZONES_V3){
  if(z==="open")continue;
  n++;out["M"+String(n).padStart(2,"0")]=z;
 }
 return out;
}
function dynamicModuleCapacityV502(){
 const uniqueSets=(state.collection||[]).filter(x=>String(x.setNumber||"").trim()).length;
 const highestExisting=Math.max(0,...Object.keys(state.modules||{}).map(k=>Number(String(k).replace(/^M/i,""))||0));
 const reserve=8;
 const needed=Math.max(40,uniqueSets+reserve,highestExisting);
 return Math.ceil(needed/8)*8;
}
function ensureDynamicModulesV502(){
 state.modules=state.modules||{};
 const capacity=dynamicModuleCapacityV502();
 for(let i=1;i<=capacity;i++){
  const m="M"+String(i).padStart(2,"0");
  if(!Array.isArray(state.modules[m]))state.modules[m]=[];
 }
 state.meta=state.meta||{};
 const old=Number(state.meta.moduleCapacity||0);
 state.meta.moduleCapacity=capacity;
 if(old!==capacity)persist();
 return capacity;
}
function dynamicZoneForModuleV502(m){
 const base=baseModuleZoneMapV502();
 if(base[m])return base[m];
 const cycle=["city","world","harbor","disney","winter","hogwarts","station","city"];
 const n=Number(String(m).replace(/^M/i,""))||41;
 return cycle[(n-41)%cycle.length];
}
function moduleZonesV50(){
 const out={};
 const capacity=ensureDynamicModulesV502();
 for(let i=1;i<=capacity;i++){
  const m="M"+String(i).padStart(2,"0");
  out[m]=dynamicZoneForModuleV502(m);
 }
 return out;
}
function renderDynamicModulesV502(){
 const g=$("moduleGrid");if(!g)return;
 const capacity=ensureDynamicModulesV502();
 const filter=$("moduleZoneFilterV35")?.value||"";
 const baseMap=baseModuleZoneMapV502();
 let h="",n=0;
 for(let i=0;i<ZONES_V3.length;i++){
  const z=ZONES_V3[i];
  if(z==="open"){
   h+='<div class="module open '+(filter?'moduleDimV35':'')+'">FREI</div>';
   continue;
  }
  n++;
  const m="M"+String(n).padStart(2,"0"),a=state.modules[m]||[],sets=a.map(s=>state.collection.find(x=>String(x.setNumber)===String(s))).filter(Boolean),first=sets[0];
  const tooBig=sets.some(x=>typeof moduleFitsV35==="function"&&moduleFitsV35(x)===false),dim=filter&&filter!==z;
  h+='<button class="module z-'+z+(tooBig?' moduleTooBigV35':'')+(dim?' moduleDimV35':'')+'" data-module="'+m+'" data-zone="'+z+'" onclick="moduleClickV3(\''+m+'\')">'+(first?.imageUrl?'<img class="moduleImgV35" src="'+esc(first.imageUrl)+'" alt="">':'')+'<span class="moduleCodeV35">'+m+'</span><small>'+(sets.length?sets.length+' Set'+(sets.length>1?'s':''):ZONELABEL_V3[z])+'</small>'+(tooBig?'<em>⚠ zu groß</em>':'')+'</button>';
 }
 for(let i=41;i<=capacity;i++){
  const m="M"+String(i).padStart(2,"0"),z=dynamicZoneForModuleV502(m),a=state.modules[m]||[],sets=a.map(s=>state.collection.find(x=>String(x.setNumber)===String(s))).filter(Boolean),first=sets[0],dim=filter&&filter!==z,tooBig=sets.some(x=>typeof moduleFitsV35==="function"&&moduleFitsV35(x)===false);
  h+='<button class="module z-'+z+' moduleExtendedV502'+(tooBig?' moduleTooBigV35':'')+(dim?' moduleDimV35':'')+'" data-module="'+m+'" data-zone="'+z+'" onclick="moduleClickV3(\''+m+'\')">'+(first?.imageUrl?'<img class="moduleImgV35" src="'+esc(first.imageUrl)+'" alt="">':'')+'<span class="moduleCodeV35">'+m+'</span><small>'+(sets.length?sets.length+' Set'+(sets.length>1?'s':''):'Erweiterung')+'</small>'+(tooBig?'<em>⚠ zu groß</em>':'')+'</button>';
 }
 g.innerHTML=h;
 const rows=6+Math.ceil(Math.max(0,capacity-40)/8);
 if($("cityGridSizeV502"))$("cityGridSizeV502").textContent="8 × "+rows;
 const totalSets=(state.collection||[]).length,free=Math.max(0,capacity-totalSets);
 if($("cityCapacityV502"))$("cityCapacityV502").textContent=capacity+" Plätze";
 if($("cityCapacityTextV502"))$("cityCapacityTextV502").textContent=totalSets+" Sets · "+free+" Reserveplätze · wächst automatisch";
 setTimeout(()=>{if(typeof renderPlannerV28==="function")renderPlannerV28();if(typeof renderCityPlannerV49==="function")renderCityPlannerV49()},0);
}
renderModulesV3=renderDynamicModulesV502;
const refreshBaseV502=refresh;
refresh=function(){
 ensureDynamicModulesV502();
 const r=refreshBaseV502();
 renderDynamicModulesV502();
 renderV50();
 return r;
};
ensureDynamicModulesV502();
refresh();


/* v50.3 smart full-city redistribution */
function rebalanceCityV503(showMessage=true){
 ensureDynamicModulesV502();
 const sets=[...(state.collection||[])].filter(x=>String(x.setNumber||"").trim());
 const zones=moduleZonesV50();

 // Capacity: one fixed city slot per unique set, plus reserve.
 const needed=Math.max(40,sets.length+8);
 const capacity=Math.ceil(needed/8)*8;
 for(let i=1;i<=capacity;i++){
   const m="M"+String(i).padStart(2,"0");
   if(!Array.isArray(state.modules[m]))state.modules[m]=[];
 }
 // Clear all placements before rebuilding the city.
 for(const m of Object.keys(state.modules))state.modules[m]=[];
 for(const x of sets)x.module="";

 const byZone={winter:[],station:[],hogwarts:[],harbor:[],disney:[],city:[],world:[]};
 for(let i=1;i<=capacity;i++){
   const m="M"+String(i).padStart(2,"0"),z=zones[m]||dynamicZoneForModuleV502(m);
   if(!byZone[z])byZone[z]=[];
   byZone[z].push(m);
 }

 // Larger sets are placed first so they get priority in their matching area.
 const ordered=[...sets].sort((a,b)=>{
   const aa=pV3(a.width)*pV3(a.depth),bb=pV3(b.width)*pV3(b.depth);
   return bb-aa||String(a.setNumber).localeCompare(String(b.setNumber),undefined,{numeric:true});
 });

 const allModules=[];
 for(let i=1;i<=capacity;i++)allModules.push("M"+String(i).padStart(2,"0"));
 const used=new Set();
 let placed=0;
 for(const x of ordered){
   const z=inferZoneV50(x);
   let m=(byZone[z]||[]).find(k=>!used.has(k));
   if(!m)m=allModules.find(k=>!used.has(k));
   if(!m)continue;
   used.add(m);
   state.modules[m]=[String(x.setNumber)];
   x.module=m;
   placed++;
 }

 state.meta=state.meta||{};
 state.meta.moduleCapacity=capacity;
 state.meta.lastCityRebalanceV503=new Date().toISOString();
 state.meta.cityLayoutVersion="50.3";
 citySuggestionV50=null;
 persist();
 refresh();
 if(showMessage)alert("Stadt neu verteilt: "+placed+" Sets auf "+capacity+" Modulplätze. "+Math.max(0,capacity-placed)+" Plätze bleiben als Reserve frei.");
 return {placed,capacity,free:Math.max(0,capacity-placed)};
}

function bindRebalanceV503(){
 const b=$("rebalanceCityV503");
 if(b)b.onclick=()=>{if(confirm("Alle bisherigen Modul-Zuordnungen werden neu verteilt. Fortfahren?"))rebalanceCityV503(true)};
}

// Run once for existing v50 users so the enlarged city is actually populated.
function migrateCityLayoutV503(){
 state.meta=state.meta||{};
 if(state.meta.cityLayoutVersion==="50.3"){bindRebalanceV503();return}
 rebalanceCityV503(false);
 bindRebalanceV503();
}
setTimeout(migrateCityLayoutV503,650);


/* v50.4 collector catalog */
let collectorCurrentV504=null;

function collectorStatusForV504(setNumber){
 const n=String(setNumber);
 if((state.collection||[]).some(x=>String(x.setNumber)===n))return "owned";
 if((state.wishlist||[]).some(x=>String(x.setNumber)===n))return "wishlist";
 return "missing";
}
function collectorFeaturedDefsV504(){
 return [
  {key:"christmas",label:"Weihnachten / Winter Village",icon:"❄",setNumbers:["10199","10216","10222","10229","10235","10245","10249","10254","10259","10263","10267","10275","10293","10308","10325","10339"]},
  {key:"modular-buildings",label:"Modular Buildings",icon:"▦",pathSegments:["Modular Buildings"]},
  {key:"botanical",label:"Botanical Collection",icon:"✿",pathSegments:["Botanical Collection"]},
  {key:"harry-potter",label:"Harry Potter",icon:"⚡",roots:["Harry Potter"]},
  {key:"disney",label:"Disney",icon:"★",roots:["Disney"]},
  {key:"star-wars",label:"Star Wars",icon:"✦",roots:["Star Wars"]},
  {key:"technic",label:"Technic",icon:"⚙",roots:["Technic"]},
  {key:"architecture",label:"Architecture",icon:"▥",roots:["Architecture"]},
  {key:"speed-champions",label:"Speed Champions",icon:"🏁",roots:["Speed Champions"]},
  {key:"creator-icons",label:"Creator Expert / Icons",icon:"◆",roots:["Creator Expert","Icons"]}
 ];
}
function collectorThemePathV504(all,row){
 const t=all?.themes?.[String(row?.[5]||"")];
 return {name:t?.[0]||"",path:t?.[2]||"",root:t?.[3]||t?.[0]||""};
}
function collectorSetTypeV506(all,row,setNumber=""){
 const t=collectorThemePathV504(all,row);
 const name=nV3(row?.[0]||""),path=nV3(t.path||""),n=String(setNumber||row?.[4]||"").replace(/-\d+$/,""),num=Number(n)||0,parts=pV3(row?.[2]);
 // First use explicit catalog/theme information.
 if(/(^| › )(polybag|poly bags|foil pack|foil packs)( › |$)/.test(path)||/\bpolybag\b|\bfoil pack\b|\bfoilbag\b/.test(name))return "polybag";
 if(/(^| › )(promotional|promotions|gift with purchase|gwp|magazine gift|store exclusive|exclusive gift)( › |$)/.test(path)||
    /\bgift with purchase\b|\bgwp\b|\bpromotional\b|\bpromo\b|\bfree gift\b|\bmagazine gift\b/.test(name))return "gwp";
 // LEGO's 30xxx range is commonly used for small promotional/polybag releases.
 // Restrict this fallback to small sets so normal numbered sets are not affected.
 if(num>=30000&&num<40000&&parts>0&&parts<=180)return "polybag";
 // 40xxx/41xxx contains many gifts/promotional side releases. Treat small releases
 // in this range as GWP for collector-completion purposes unless catalog says otherwise.
 if(num>=40000&&num<42000&&parts>0&&parts<=500)return "gwp";
 return "main";
}
function collectorSetTypeLabelV506(type){
 return type==="polybag"?"Polybag":type==="gwp"?"Gratis-Beigabe / GWP":"Hauptset";
}
function collectorMatchesDefV504(all,row,def,setNumber=""){
 if(Array.isArray(def.setNumbers))return def.setNumbers.includes(String(setNumber));
 const t=collectorThemePathV504(all,row);
 if(Array.isArray(def.roots)&&def.roots.length)return def.roots.includes(t.root);
 if(def.root)return t.root===def.root;
 if(Array.isArray(def.pathSegments)&&def.pathSegments.length){
   const segments=String(t.path||"").split(" › ").map(x=>x.trim());
   return def.pathSegments.some(x=>segments.includes(x));
 }
 // Kept only as a fallback for future custom collections.
 const hay=(t.path+" "+t.name+" "+t.root).toLowerCase();
 return (def.keywords||[]).some(k=>hay.includes(String(k).toLowerCase()));
}
function collectorRowsV504(all,def){
 const entries=Object.entries(all?.sets||{});
 const featured=collectorFeaturedDefsV504();
 const idx=featured.findIndex(d=>d.key===def.key);
 if(idx>=0){
   return entries.filter(([n,row])=>{
     if(!collectorMatchesDefV504(all,row,def,n))return false;
     for(let i=0;i<idx;i++){
       if(collectorMatchesDefV504(all,row,featured[i],n))return false;
     }
     return true;
   });
 }
 // "Weitere Themen" also excludes every set already assigned to one of the Top-10 rubrics.
 return entries.filter(([n,row])=>{
   if(!collectorMatchesDefV504(all,row,def,n))return false;
   return !featured.some(d=>collectorMatchesDefV504(all,row,d,n));
 });
}
function collectorThemeDefsV504(all){
 const roots=new Map();
 for(const row of Object.values(all?.sets||{})){
   const t=collectorThemePathV504(all,row);
   if(t.root)roots.set(t.root,(roots.get(t.root)||0)+1);
 }
 const featured=collectorFeaturedDefsV504();
 const featuredRoots=new Set(featured.flatMap(d=>[...(d.roots||[]),d.root||""].filter(Boolean).map(x=>x.toLowerCase())));
 const dynamic=[...roots.entries()]
   .filter(([name])=>!featuredRoots.has(name.toLowerCase()))
   .map(([root,count])=>({key:"root:"+root,label:root,root,count,icon:"◻"}))
   .sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,"de"));
 return [...featured,...dynamic];
}
function collectorProgressV504(rows){
 const total=rows.length;
 const owned=rows.filter(([n])=>collectorStatusForV504(n)==="owned").length;
 const wished=rows.filter(([n])=>collectorStatusForV504(n)==="wishlist").length;
 return {total,owned,wished,missing:Math.max(0,total-owned),pct:total?Math.round(owned/total*100):0};
}
function collectorCardHtmlV504(all,def){
 const rows=collectorRowsV504(all,def),p=collectorProgressV504(rows);
 if(!p.total)return "";
 return '<button class="collectorThemeCardV504" onclick="openCollectorThemeV504(\''+esc(def.key)+'\')">'+
   '<span class="collectorThemeIconV504">'+esc(def.icon||"◻")+'</span>'+
   '<span class="collectorThemeCardMainV504"><b>'+esc(def.label)+'</b><small>'+p.owned+' von '+p.total+' vorhanden · '+p.missing+' fehlen</small><span class="collectorMiniProgressV504"><i style="width:'+p.pct+'%"></i></span></span>'+
   '<strong>'+p.pct+'%</strong></button>';
}
async function renderCollectorThemesV504(){
 const box=$("collectorFeaturedV504");if(!box)return;
 const all=await loadAllSetsV46(false);
 if(!all?.sets){box.innerHTML='<div class="card"><p>Sammler-Katalog wird gerade geladen. Bitte die App gleich noch einmal öffnen.</p></div>';return}
 if($("collectorThemeCountV504"))$("collectorThemeCountV504").textContent=all.meta?.themeCount||Object.keys(all.themes||{}).length||"–";
 if($("collectorSetCountV504"))$("collectorSetCountV504").textContent=all.meta?.uniqueSetNumbers||Object.keys(all.sets||{}).length||"–";
 const q=nV3($("collectorSearchV504")?.value);
 const defs=collectorThemeDefsV504(all);
 const byProgress=(a,b)=>{
   const pa=collectorProgressV504(collectorRowsV504(all,a)),pb=collectorProgressV504(collectorRowsV504(all,b));
   return pb.pct-pa.pct||pb.owned-pa.owned||a.label.localeCompare(b.label,"de");
 };
 const featured=defs.slice(0,10).filter(d=>!q||nV3(d.label).includes(q)).sort(byProgress);
 const rest=defs.slice(10).filter(d=>!q||nV3(d.label).includes(q)).sort(byProgress).slice(0,q?100:36);
 let html="";
 if(featured.length)html+='<div class="collectorSectionTitleV504"><span>Top 10 Sammlerwelten</span><small>Jedes Set wird hier nur einer Rubrik zugeordnet</small></div><div class="collectorThemeGridV504">'+featured.map(d=>collectorCardHtmlV504(all,d)).join("")+'</div>';
 if(rest.length)html+='<div class="collectorSectionTitleV504"><span>'+(q?'Gefundene Themen':'Weitere Themen')+'</span><small>'+rest.length+' angezeigt</small></div><div class="collectorThemeGridV504 compact">'+rest.map(d=>collectorCardHtmlV504(all,d)).join("")+'</div>';
 if(!html)html='<div class="card"><p>Kein passendes Thema gefunden.</p></div>';
 box.innerHTML=html;
}
function collectorDefByKeyV504(all,key){
 return collectorThemeDefsV504(all).find(d=>d.key===key)||null;
}
window.openCollectorThemeV504=async key=>{
 const all=await loadAllSetsV46(false),def=collectorDefByKeyV504(all,key);if(!def)return;
 collectorCurrentV504=def;
 $("collectorFeaturedV504")?.classList.add("hidden");
 $("collectorThemeViewV504")?.classList.remove("hidden");
 renderCollectorSetViewV504();
};
async function renderCollectorSetViewV504(){
 if(!collectorCurrentV504)return;
 const all=await loadAllSetsV46(false);if(!all)return;
 let rows=collectorRowsV504(all,collectorCurrentV504);
 const years=[...new Set(rows.map(([,r])=>Number(r[1]||0)).filter(Boolean))].sort((a,b)=>b-a);
 const yearEl=$("collectorYearV504"),oldYear=yearEl?.value||"";
 if(yearEl){
   yearEl.innerHTML='<option value="">Alle Jahre</option>'+years.map(y=>'<option value="'+y+'">'+y+'</option>').join("");
   if(years.includes(Number(oldYear)))yearEl.value=oldYear;
 }
 const subEl=$("collectorSubthemeV505"),oldSub=subEl?.value||"";
 const subs=[...new Set(rows.map(([,r])=>collectorThemePathV504(all,r).path).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"de"));
 if(subEl){
   subEl.innerHTML='<option value="">Alle Unterthemen</option>'+subs.map(s=>'<option value="'+esc(s)+'">'+esc(s.split(" › ").slice(-1)[0])+'</option>').join("");
   if(subs.includes(oldSub))subEl.value=oldSub;
 }
 const status=$("collectorStatusV504")?.value||"all",year=Number($("collectorYearV504")?.value||0),sub=$("collectorSubthemeV505")?.value||"",type=$("collectorTypeV506")?.value||"",setq=nV3($("collectorSetSearchV505")?.value||"");
 const scopeRows=rows.filter(([n,r])=>{
   const t=collectorThemePathV504(all,r),kind=collectorSetTypeV506(all,r,n),hay=nV3([n,r[0],r[1],t.path].join(" "));
   return (!year||Number(r[1])===year)&&(!sub||t.path===sub)&&(!type||kind===type)&&(!setq||hay.includes(setq));
 });
 rows=scopeRows.filter(([n])=>status==="all"||collectorStatusForV504(n)===status);
 rows.sort((a,b)=>Number(b[1][1]||0)-Number(a[1][1]||0)||String(a[0]).localeCompare(String(b[0]),undefined,{numeric:true}));
 const p=collectorProgressV504(scopeRows);
 const scopeLabel=type?collectorSetTypeLabelV506(type)+(p.total===1?"":"s"):"Sets";
 if($("collectorThemeTitleV504"))$("collectorThemeTitleV504").textContent=collectorCurrentV504.label;
 if($("collectorThemeMetaV504"))$("collectorThemeMetaV504").textContent=p.owned+" von "+p.total+" "+scopeLabel+" vorhanden = "+p.pct+" % · "+p.wished+" Wunschliste · "+Math.max(0,p.total-p.owned-p.wished)+" noch offen";
 if($("collectorProgressTextV504"))$("collectorProgressTextV504").textContent=p.owned+" / "+p.total+" · "+p.pct+" %";
 if($("collectorProgressBarV504"))$("collectorProgressBarV504").style.width=p.pct+"%";
 const grid=$("collectorSetGridV504");if(!grid)return;
 grid.innerHTML=rows.length?rows.map(([n,r])=>{
   const st=collectorStatusForV504(n),label=st==="owned"?"✓ Vorhanden":st==="wishlist"?"♥ Wunschliste":"Fehlt";
   const action=st==="missing"?'<button class="btn collectorWishBtnV504" onclick="event.stopPropagation();addCollectorWishV504(\''+esc(n)+'\')">Auf Wunschliste</button>':
     st==="owned"?'<span class="collectorStatusV504 owned">✓ Vorhanden</span>':'<span class="collectorStatusV504 wishlist">♥ Wunschliste</span>';
   const kind=collectorSetTypeV506(all,r,n);
   return '<article class="collectorSetCardV504 '+st+'">'+
     '<div class="collectorSetImageV504">'+(r[3]?'<img src="'+esc(r[3])+'" loading="lazy" alt="">':'<span>LEGO<br>'+esc(n)+'</span>')+'</div>'+
     '<div class="collectorSetBodyV504"><div class="collectorSetTopV504"><span>'+esc(n)+'</span><em>'+esc(String(r[1]||"–"))+'</em></div><h3>'+esc(r[0]||("Set "+n))+'</h3><div class="collectorMetaRowV506"><span>'+pV3(r[2])+' Teile</span><b class="collectorTypeBadgeV506 '+kind+'">'+esc(collectorSetTypeLabelV506(kind))+'</b></div>'+action+'</div>'+
   '</article>';
 }).join(""):'<div class="card"><p>Für diesen Filter wurden keine Sets gefunden.</p></div>';
}
window.addCollectorWishV504=async n=>{
 n=String(n);
 if((state.collection||[]).some(x=>String(x.setNumber)===n))return;
 if((state.wishlist||[]).some(x=>String(x.setNumber)===n)){renderCollectorSetViewV504();return}
 const all=await loadAllSetsV46(false),r=all?.sets?.[n];if(!r)return;
 state.wishlist.push({
   priority:"Normal",setNumber:n,name:r[0]||("Set "+n),area:collectorCurrentV504?.label||"",
   rrp:0,price:0,limit:0,offer:0,imageUrl:r[3]||"",
   reason:"Sammler-Katalog · "+(collectorCurrentV504?.label||"Thema")
 });
 persist();refresh();renderCollectorSetViewV504();
};
function bindCollectorV504(){
 const search=$("collectorSearchV504"),status=$("collectorStatusV504"),year=$("collectorYearV504"),sub=$("collectorSubthemeV505"),type=$("collectorTypeV506"),setSearch=$("collectorSetSearchV505"),back=$("collectorBackV504");
 if(search)search.oninput=()=>{if(collectorCurrentV504){collectorCurrentV504=null;$("collectorThemeViewV504")?.classList.add("hidden");$("collectorFeaturedV504")?.classList.remove("hidden")}renderCollectorThemesV504()};
 if(status)status.onchange=()=>collectorCurrentV504?renderCollectorSetViewV504():renderCollectorThemesV504();
 if(year)year.onchange=()=>collectorCurrentV504&&renderCollectorSetViewV504();
 if(sub)sub.onchange=()=>collectorCurrentV504&&renderCollectorSetViewV504();
 if(type)type.onchange=()=>collectorCurrentV504&&renderCollectorSetViewV504();
 if(setSearch)setSearch.oninput=()=>collectorCurrentV504&&renderCollectorSetViewV504();
 if(back)back.onclick=()=>{collectorCurrentV504=null;$("collectorThemeViewV504")?.classList.add("hidden");$("collectorFeaturedV504")?.classList.remove("hidden");if(year)year.value="";if(sub)sub.value="";if(type)type.value="";if(setSearch)setSearch.value="";renderCollectorThemesV504()};
}
const switchTabBaseV504=switchTab;
switchTab=function(id){switchTabBaseV504(id);if(id==="collector"){renderCollectorThemesV504();if(collectorCurrentV504)renderCollectorSetViewV504()}};
bindCollectorV504();
/* v50.42: Sammler-Katalog wird bewusst erst beim Öffnen geladen. */


/* v50.15 UI cleanup: remove legacy duplicate surfaces without touching data */
function cleanupDuplicateUiV515(){
 const oldPlanner=$("plannerV28");
 if(oldPlanner&&document.querySelector(".cityPlannerCardV49"))oldPlanner.remove();
 const legacyWish=document.querySelector(".legacyWishTableV515");
 if(legacyWish){legacyWish.hidden=true;legacyWish.setAttribute("aria-hidden","true")}
}
const refreshBaseV515=refresh;
refresh=function(){
 const r=refreshBaseV515();
 cleanupDuplicateUiV515();
 return r;
};
setTimeout(cleanupDuplicateUiV515,100);


/* v50.16 pricing page */
let pricingYearlyV516=false;
function renderPricingV516(){
 const basic=$("basicPriceV516"),basicPeriod=$("basicPeriodV516"),premium=$("premiumPriceV516"),premiumPeriod=$("premiumPeriodV516");
 if(basic)basic.textContent=pricingYearlyV516?"39,99 €":"3,99 €";
 if(basicPeriod)basicPeriod.textContent=pricingYearlyV516?"pro Jahr":"pro Monat";
 if(premium)premium.textContent=pricingYearlyV516?"79,99 €":"7,99 €";
 if(premiumPeriod)premiumPeriod.textContent=pricingYearlyV516?"pro Jahr":"pro Monat";
 $("pricingMonthlyV516")?.classList.toggle("active",!pricingYearlyV516);
 $("pricingYearlyV516")?.classList.toggle("active",pricingYearlyV516);
}
function bindPricingV516(){
 const monthly=$("pricingMonthlyV516"),yearly=$("pricingYearlyV516"),plans=$("v50Plans");
 if(monthly)monthly.onclick=()=>{pricingYearlyV516=false;renderPricingV516()};
 if(yearly)yearly.onclick=()=>{pricingYearlyV516=true;renderPricingV516()};
 if(plans)plans.onclick=()=>switchTab("plans");
 document.querySelectorAll(".pricingCtaV516").forEach(b=>b.onclick=()=>{
   const plan=b.dataset.plan;
   if(plan==="free"){switchTab("collection");return}
   alert((plan==="premium"?"Premium":"Basic")+" ist vorbereitet und wird buchbar, sobald die Zahlungsanbindung aktiviert ist.");
 });
 renderPricingV516();
}
setTimeout(bindPricingV516,80);


/* v50.19 subscription limits */
function planKeyV519(){
 const p=String(state?.meta?.subscriptionPlan||"free").toLowerCase();
 return ["free","basic","premium"].includes(p)?p:"free";
}
function trialInfoV520(){
 const started=state?.meta?.premiumTrialStartedAt?new Date(state.meta.premiumTrialStartedAt).getTime():0;
 const ends=started+7*24*60*60*1000;
 const active=!!started&&Date.now()<ends&&!state?.meta?.premiumTrialUsed;
 return {started,ends,active,daysLeft:active?Math.max(1,Math.ceil((ends-Date.now())/86400000)):0};
}
function planInfoV519(){
 // The signed-in operator account is not subject to consumer collection tiers.
 if(isAdminV36())return {key:"admin",label:"Administrator",limit:Infinity,desc:"Unbegrenzte Set-Verwaltung (Betreiberkonto)."};
 const key=planKeyV519(),trial=trialInfoV520();
 if(trial.active)return {key:"premium",baseKey:key,label:"Premium Test",limit:Infinity,desc:"7 Tage Premium-Testphase aktiv.",trial:true};
 return key==="premium"
   ?{key,label:"Premium",limit:Infinity,desc:"Unbegrenzt viele Sets verwalten."}
   :key==="basic"
     ?{key,label:"Basic",limit:50,desc:"Bis zu 50 Sets verwalten."}
     :{key:"free",label:"Free",limit:20,desc:"Bis zu 20 Sets verwalten."};
}
function collectionCountV519(){return (state.collection||[]).length}
function canAddNewSetV519(setNumber=""){
 const n=String(setNumber||"").trim();
 if(n&&(state.collection||[]).some(x=>String(x.setNumber)===n))return true;
 const info=planInfoV519();
 return !Number.isFinite(info.limit)||collectionCountV519()<info.limit;
}
function renderPlanStatusV519(){
 const info=planInfoV519(),used=collectionCountV519(),limit=info.limit,trial=trialInfoV520();
 if($("planNameV519"))$("planNameV519").textContent=info.label;
 if($("planDescriptionV519"))$("planDescriptionV519").textContent=info.trial?info.desc+" Noch "+trial.daysLeft+" Tag"+(trial.daysLeft===1?"":"e")+".":info.desc;
 if($("planBillingStatusV520"))$("planBillingStatusV520").textContent=info.label;
 if($("planBillingPeriodV520"))$("planBillingPeriodV520").textContent=info.trial?new Date(trial.ends).toLocaleDateString("de-DE"):(info.key==="free"?"Keine Laufzeit":"Aktiver Tarif");
 if($("planBillingActionV520"))$("planBillingActionV520").textContent=info.trial?"Test endet automatisch":(info.key==="free"?"Bei Bedarf upgraden":"Abo verwalten");
 const usage=$("planUsageTextV519"),bar=$("planUsageBarV519"),hint=$("planUsageHintV519");
 if(Number.isFinite(limit)){
   if(usage)usage.textContent=used+" / "+limit+" Sets";
   if(bar)bar.style.width=Math.min(100,Math.round(used/limit*100))+"%";
   const left=Math.max(0,limit-used);
   if(hint)hint.textContent=used>limit
     ?"Dein bestehender Bestand bleibt erhalten. Neue Sets sind bis zum Upgrade gesperrt."
     :left===0
       ?"Limit erreicht. Für weitere Sets bitte Tarif upgraden."
       :"Noch "+left+" Set"+(left===1?"":"s")+" verfügbar.";
 }else{
   if(usage)usage.textContent=used+" Sets · unbegrenzt";
   if(bar)bar.style.width="100%";
   if(hint)hint.textContent="Premium hat kein Set-Limit.";
 }
}
function openPlanLimitV519(){
 const info=planInfoV519(),m=$("planLimitModalV519");
 const next=info.key==="free"?"Basic":"Premium";
 const nextText=info.key==="free"
   ?"Mit Basic kannst du bis zu 50 Sets verwalten."
   :"Mit Premium kannst du unbegrenzt viele Sets verwalten.";
 if($("planLimitTitleV519"))$("planLimitTitleV519").textContent="Dein "+info.label+"-Limit ist erreicht.";
 if($("planLimitTextV519"))$("planLimitTextV519").textContent=nextText+" Dein bestehender Bestand wird nicht verändert.";
 if(m){m.classList.add("show");m.setAttribute("aria-hidden","false")}
}
function closePlanLimitV519(){
 const m=$("planLimitModalV519");if(m){m.classList.remove("show");m.setAttribute("aria-hidden","true")}
}
function goPlansV519(){closePlanLimitV519();switchTab("plans")}
function bindPlanLimitsV519(){
 if($("planUpgradeV519"))$("planUpgradeV519").onclick=goPlansV519;
 if($("planLimitUpgradeV519"))$("planLimitUpgradeV519").onclick=goPlansV519;
 if($("planLimitLaterV519"))$("planLimitLaterV519").onclick=closePlanLimitV519;
 if($("planLimitCloseV519"))$("planLimitCloseV519").onclick=closePlanLimitV519;
 const m=$("planLimitModalV519");if(m)m.onclick=e=>{if(e.target===m)closePlanLimitV519()};

 const saveBtn=$("saveSet");
 if(saveBtn&&!saveBtn.dataset.planGateV519){
   saveBtn.dataset.planGateV519="1";
   const old=saveBtn.onclick;
   saveBtn.onclick=e=>{
     const n=$("fSet")?.value.trim()||"";
     const isNew=!editing&&!(state.collection||[]).some(x=>String(x.setNumber)===String(n));
     if(isNew&&!canAddNewSetV519(n)){e?.preventDefault?.();openPlanLimitV519();return}
     return old?.call(saveBtn,e);
   };
 }
 const purchaseBtn=$("savePurchase");
 if(purchaseBtn&&!purchaseBtn.dataset.planGateV519){
   purchaseBtn.dataset.planGateV519="1";
   const old=purchaseBtn.onclick;
   purchaseBtn.onclick=e=>{
     const n=$("pSet")?.value.trim()||"";
     const isNew=n&&!(state.collection||[]).some(x=>String(x.setNumber)===String(n));
     if(isNew&&!canAddNewSetV519(n)){e?.preventDefault?.();openPlanLimitV519();return}
     return old?.call(purchaseBtn,e);
   };
 }
 renderPlanStatusV519();
}
const refreshBaseV519=refresh;
refresh=function(){
 const r=refreshBaseV519();
 renderPlanStatusV519();
 setTimeout(bindPlanLimitsV519,0);
 return r;
};
setTimeout(bindPlanLimitsV519,120);


/* v50.20 commercial readiness */
function startPremiumTrialV520(){
 state.meta=state.meta||{};
 if(state.meta.premiumTrialUsed)return alert("Die kostenlose Premium-Testphase wurde bereits genutzt.");
 if(state.meta.premiumTrialStartedAt)return alert("Deine Premium-Testphase läuft bereits.");
 state.meta.premiumTrialStartedAt=new Date().toISOString();
 persist();refresh();
 alert("Premium ist jetzt 7 Tage kostenlos freigeschaltet. Die Testphase endet automatisch und es wird nichts berechnet.");
}
function finishExpiredTrialV520(){
 const t=state?.meta?.premiumTrialStartedAt?new Date(state.meta.premiumTrialStartedAt).getTime():0;
 if(t&&Date.now()>=t+7*86400000&&!state.meta.premiumTrialUsed){
   state.meta.premiumTrialUsed=true;persist();
 }
}
function renderCommercialV520(){
 finishExpiredTrialV520();
 const trial=trialInfoV520(),info=planInfoV519();
 const trialButtons=[$("startTrialV520"),$("startTrialAccountV520")].filter(Boolean);
 trialButtons.forEach(b=>{
   b.disabled=!!state?.meta?.premiumTrialUsed||trial.active;
   b.textContent=trial.active?"Premium-Test läuft ("+trial.daysLeft+" Tage)":state?.meta?.premiumTrialUsed?"Testphase bereits genutzt":"7 Tage Premium kostenlos testen";
 });
 document.querySelectorAll(".premiumTabV520").forEach(el=>el.classList.toggle("premiumActiveV520",info.key==="premium"));
 if($("cloudBackupTimeV520")){
   const ts=state?.meta?.lastCloudBackupAt;
   $("cloudBackupTimeV520").textContent=ts?new Date(ts).toLocaleString("de-DE",{dateStyle:"short",timeStyle:"short"}):"Noch keine";
 }
}
function bindCommercialV520(){
 if($("startTrialV520"))$("startTrialV520").onclick=startPremiumTrialV520;
 if($("startTrialAccountV520"))$("startTrialAccountV520").onclick=startPremiumTrialV520;
 if($("manageSubscriptionV520"))$("manageSubscriptionV520").onclick=()=>alert("Die Abo-Verwaltung ist vorbereitet. Sie wird mit der Zahlungsanbindung freigeschaltet.");
 if($("showInvoicesV520"))$("showInvoicesV520").onclick=()=>alert("Rechnungen werden verfügbar, sobald die Zahlungsanbindung aktiviert ist.");
 if($("supportContactV520"))$("supportContactV520").onclick=()=>alert("Support-Kontakt ist vorbereitet. Vor dem öffentlichen Start bitte noch eine Support-E-Mail hinterlegen.");
 renderCommercialV520();
}
const cloudSaveBaseV520=cloudSaveV3;
cloudSaveV3=async function(show=false){
 const r=await cloudSaveBaseV520(show);
 if(cloudUserV3){
   state.meta=state.meta||{};
   state.meta.lastCloudBackupAt=new Date().toISOString();
   if(typeof persistBaseV3==="function")persistBaseV3();
   renderCommercialV520();
 }
 return r;
};
const refreshBaseV520=refresh;
refresh=function(){
 const r=refreshBaseV520();
 renderCommercialV520();
 setTimeout(bindCommercialV520,0);
 return r;
};
setTimeout(bindCommercialV520,160);


/* v50.21 onboarding, global search, goals, favorites, notifications, demo, feedback */
function openUtilityV521(id){
 const el=$(id);if(!el)return;
 el.classList.add("show");el.setAttribute("aria-hidden","false");
}
function closeUtilityV521(id){
 const el=$(id);if(!el)return;
 el.classList.remove("show");el.setAttribute("aria-hidden","true");
}
function ensureUxStateV521(){
 state.meta=state.meta||{};
 state.meta.favoriteSets=Array.isArray(state.meta.favoriteSets)?state.meta.favoriteSets:[];
 state.meta.feedbackDrafts=Array.isArray(state.meta.feedbackDrafts)?state.meta.feedbackDrafts:[];
}
function isFavoriteV521(n){ensureUxStateV521();return state.meta.favoriteSets.includes(String(n))}
window.toggleFavoriteV521=n=>{
 ensureUxStateV521();n=String(n);
 if(isFavoriteV521(n))state.meta.favoriteSets=state.meta.favoriteSets.filter(x=>x!==n);
 else state.meta.favoriteSets.push(n);
 persist();renderGlobalSearchV521();renderHomeUxV521();
};
function renderGlobalSearchV521(){
 const box=$("globalSearchResultsV521"),input=$("globalSearchInputV521");if(!box||!input)return;
 const q=nV3(input.value||"");
 if(!q){box.innerHTML='<p class="hint">Suche über Sammlung und Wunschliste. Favoriten kannst du mit ★ markieren.</p>';return}
 const own=(state.collection||[]).filter(x=>nV3([x.setNumber,x.name,x.category,x.cityArea,x.storage].join(" ")).includes(q)).slice(0,12);
 const wish=(state.wishlist||[]).filter(x=>nV3([x.setNumber,x.name,x.area,x.reason].join(" ")).includes(q)).slice(0,8);
 let html="";
 if(own.length)html+='<h3>Sammlung</h3>'+own.map(x=>'<div class="globalResultV521"><button class="favBtnV521 '+(isFavoriteV521(x.setNumber)?"active":"")+'" onclick="toggleFavoriteV521(\''+esc(x.setNumber)+'\')">★</button><button class="globalResultMainV521" onclick="closeUtilityV521(\'globalSearchV521\');showDetailV3(\''+esc(x.setNumber)+'\')"><b>'+esc(x.setNumber)+' · '+esc(x.name)+'</b><small>'+esc(x.cityArea||x.category||"Sammlung")+'</small></button></div>').join("");
 if(wish.length)html+='<h3>Wunschliste</h3>'+wish.map(x=>'<div class="globalResultV521"><span class="favPlaceholderV521">♡</span><button class="globalResultMainV521" onclick="closeUtilityV521(\'globalSearchV521\');switchTab(\'wishlist\')"><b>'+esc(x.setNumber)+' · '+esc(x.name)+'</b><small>'+esc(x.area||"Wunschliste")+'</small></button></div>').join("");
 if(!html)html='<p class="hint">Keine passenden Einträge gefunden.</p>';
 box.innerHTML=html;
}
async function renderHomeSeriesGoalsV521(){
 const box=$("homeSeriesGoalsV521");if(!box)return;
 try{
   const all=await loadAllSetsV46(false);if(!all?.sets){box.innerHTML='<p class="hint">Katalog wird geladen…</p>';return}
   const defs=collectorFeaturedDefsV504();
   const goals=defs.map(def=>{
     const rows=collectorRowsV504(all,def),p=collectorProgressV504(rows);
     const missing=rows.find(([n])=>collectorStatusForV504(n)==="missing");
     return {def,p,missing};
   }).filter(x=>x.p.total&&x.p.pct<100).sort((a,b)=>b.p.pct-a.p.pct||a.p.missing-b.p.missing).slice(0,3);
   box.innerHTML=goals.length?goals.map(g=>{
     const next=g.missing?g.missing[0]+" · "+(g.missing[1]?.[0]||"fehlendes Set"):"";
     return '<button class="seriesGoalV521" onclick="switchTab(\'collector\');openCollectorThemeV504(\''+esc(g.def.key)+'\')"><div><b>'+esc(g.def.label)+'</b><small>'+g.p.owned+' von '+g.p.total+' vorhanden · '+g.p.missing+' fehlen</small></div><strong>'+g.p.pct+' %</strong><span class="seriesGoalBarV521"><i style="width:'+g.p.pct+'%"></i></span>'+(next?'<em>Nächstes: '+esc(next)+'</em>':'')+'</button>';
   }).join(""):'<p class="hint">Deine angezeigten Top-Serien sind bereits komplett.</p>';
 }catch{box.innerHTML='<p class="hint">Serienziele konnten gerade nicht geladen werden.</p>'}
}
function renderAchievementsV521(){
 const box=$("homeAchievementsV521");if(!box)return;
 const count=(state.collection||[]).length,favs=state.meta?.favoriteSets?.length||0,planned=(state.collection||[]).filter(x=>x.module).length;
 const badges=[
   {ok:count>=1,icon:"◆",label:"Erstes Set"},
   {ok:count>=10,icon:"★",label:"10 Sets"},
   {ok:count>=25,icon:"🏙",label:"25 Sets"},
   {ok:planned>=10,icon:"▦",label:"10 geplant"},
   {ok:favs>=3,icon:"♥",label:"3 Favoriten"}
 ];
 box.innerHTML=badges.map(x=>'<div class="achievementV521 '+(x.ok?"done":"")+'"><b>'+x.icon+'</b><span>'+esc(x.label)+'</span><small>'+(x.ok?"Erreicht":"Noch offen")+'</small></div>').join("");
}
function renderRecommendationsV521(){
 const box=$("homeRecommendationsV521");if(!box)return;
 const quality=(state.collection||[]).filter(x=>typeof qualityIssuesV35==="function"&&qualityIssuesV35(x).length).length;
 const unplanned=(state.collection||[]).filter(x=>!x.module).length;
 const wish=(state.wishlist||[]).length;
 const recs=[];
 if(quality)recs.push({title:quality+" Sets mit fehlenden Daten",text:"Bilder, Werte oder Maße ergänzen.",tab:"analysis"});
 if(unplanned)recs.push({title:unplanned+" Sets noch ohne Stadtplatz",text:"Freie Module automatisch oder manuell zuordnen.",tab:"city"});
 if(wish)recs.push({title:wish+" Sets auf deiner Wunschliste",text:"Prioritäten und Kaufgrenzen prüfen.",tab:"wishlist"});
 if(!recs.length)recs.push({title:"Alles sauber gepflegt",text:"Öffne den Sammler-Katalog und suche dein nächstes Serienziel.",tab:"collector"});
 box.innerHTML=recs.slice(0,3).map(r=>'<button onclick="switchTab(\''+r.tab+'\')"><b>'+esc(r.title)+'</b><small>'+esc(r.text)+'</small><span>Öffnen →</span></button>').join("");
}
function notificationItemsV521(){
 const out=[];
 const quality=(state.collection||[]).filter(x=>typeof qualityIssuesV35==="function"&&qualityIssuesV35(x).length).length;
 const unplanned=(state.collection||[]).filter(x=>!x.module).length;
 const alerts=state.meta?.wishAlerts?.length||0;
 const trial=typeof trialInfoV520==="function"?trialInfoV520():{active:false,daysLeft:0};
 if(quality)out.push({title:"Datenqualität",text:quality+" Sets brauchen Ergänzungen.",tab:"analysis"});
 if(unplanned)out.push({title:"Stadtplanung",text:unplanned+" Sets haben noch keinen Modulplatz.",tab:"city"});
 if(alerts)out.push({title:"Preisalarme",text:alerts+" Wunschlisten-Set"+(alerts===1?"":"s")+" unter Kaufgrenze.",tab:"wishlist"});
 if(trial.active)out.push({title:"Premium-Test",text:"Noch "+trial.daysLeft+" Tag"+(trial.daysLeft===1?"":"e")+" Premium-Test.",tab:"users"});
 return out;
}
function renderNotificationsV521(){
 const rows=notificationItemsV521(),box=$("notificationListV521"),count=$("notificationCountV521");
 if(count){count.textContent=rows.length?String(rows.length):"";count.classList.toggle("show",!!rows.length)}
 if(box)box.innerHTML=rows.length?rows.map(r=>'<button class="noticeRowV521" onclick="closeUtilityV521(\'notificationsV521\');switchTab(\''+r.tab+'\')"><b>'+esc(r.title)+'</b><span>'+esc(r.text)+'</span><em>Öffnen →</em></button>').join(""):'<p class="hint">Aktuell gibt es keine offenen Hinweise.</p>';
}
function renderPremiumPreviewV521(){
 const premium=typeof planInfoV519==="function"&&planInfoV519().key==="premium";
 ["prices","analysis"].forEach(id=>{
   const panel=$(id);if(!panel)return;
   let banner=panel.querySelector(".premiumPreviewV521");
   if(premium){banner?.remove();return}
   if(!banner){
     banner=document.createElement("div");banner.className="premiumPreviewV521";
     banner.innerHTML='<div><b>Premium-Vorschau</b><span>Du kannst diesen Bereich ansehen. Premium schaltet den vollständigen Funktionsumfang frei.</span></div><button class="btn secondary">Tarife ansehen</button>';
     banner.querySelector("button").onclick=()=>switchTab("plans");
     panel.prepend(banner);
   }
 });
}
function printCollectionV521(){
 switchTab("collection");
 document.body.classList.add("printCollectionV521");
 setTimeout(()=>window.print(),80);
}
window.addEventListener("afterprint",()=>document.body.classList.remove("printCollectionV521"));
function saveFeedbackV521(){
 ensureUxStateV521();
 const text=$("feedbackTextV521")?.value.trim();if(!text)return alert("Bitte zuerst dein Feedback eingeben.");
 state.meta.feedbackDrafts.unshift({type:$("feedbackTypeV521")?.value||"Feedback",text,date:new Date().toISOString(),version:"50.21"});
 persist();
 if($("feedbackStatusV521"))$("feedbackStatusV521").textContent="Gespeichert. Das Feedback bleibt in deinen App-Daten erhalten.";
 if($("feedbackTextV521"))$("feedbackTextV521").value="";
}
function renderHomeUxV521(){
 ensureUxStateV521();
 renderAchievementsV521();renderRecommendationsV521();renderNotificationsV521();renderPremiumPreviewV521();
 renderHomeSeriesGoalsV521();
}
function bindUxV521(){
 ensureUxStateV521();
 if($("globalSearchTopV521"))$("globalSearchTopV521").onclick=()=>{openUtilityV521("globalSearchV521");setTimeout(()=>$("globalSearchInputV521")?.focus(),30);renderGlobalSearchV521()};
 if($("notificationsTopV521"))$("notificationsTopV521").onclick=()=>{renderNotificationsV521();openUtilityV521("notificationsV521")};
 if($("globalSearchInputV521"))$("globalSearchInputV521").oninput=renderGlobalSearchV521;
 document.querySelectorAll("[data-close-v521]").forEach(b=>b.onclick=()=>closeUtilityV521(b.dataset.closeV521));
 document.querySelectorAll(".utilityModalV521").forEach(m=>m.onclick=e=>{if(e.target===m)closeUtilityV521(m.id)});
 if($("onboardingStartV521"))$("onboardingStartV521").onclick=()=>{state.meta.onboardingDoneV521=true;persist();closeUtilityV521("onboardingV521");$("addBtn")?.click()};
 if($("onboardingDoneV521"))$("onboardingDoneV521").onclick=()=>{state.meta.onboardingDoneV521=true;persist();closeUtilityV521("onboardingV521")};
 if($("homeGoalsOpenV521"))$("homeGoalsOpenV521").onclick=()=>switchTab("collector");
 if($("qualityQuickV521"))$("qualityQuickV521").onclick=()=>switchTab("analysis");
 if($("printCollectionV521"))$("printCollectionV521").onclick=printCollectionV521;
 if($("demoModeV521"))$("demoModeV521").onclick=()=>openUtilityV521("demoV521");
 if($("changelogV521"))$("changelogV521").onclick=()=>openUtilityV521("changelogModalV521");
 if($("feedbackV521"))$("feedbackV521").onclick=()=>openUtilityV521("feedbackModalV521");
 if($("saveFeedbackV521"))$("saveFeedbackV521").onclick=saveFeedbackV521;
 if(!state.meta.onboardingDoneV521&&!sessionStorage.getItem("onboardingSeenV521")){
   sessionStorage.setItem("onboardingSeenV521","1");setTimeout(()=>openUtilityV521("onboardingV521"),500);
 }
 renderHomeUxV521();
}
const refreshBaseV521=refresh;
refresh=function(){
 const r=refreshBaseV521();
 renderHomeUxV521();
 setTimeout(bindUxV521,0);
 return r;
};
setTimeout(bindUxV521,220);


/* v50.23 data quality bulk repair */
async function bulkEnrichCollectionV523(){
 const btn=$("qualityBulkFillV523");
 if(btn){btn.disabled=true;btn.textContent="Daten werden ergänzt…"}
 let changed=0,img=0,value=0,dims=0,barcode=0;
 try{
   await loadEnrichmentV3(true);
   const all=await loadAllSetsV46(false);
   for(const x of (state.collection||[])){
     const n=String(x.setNumber||"").replace(/-1$/,"");
     let e=enrichmentV3?.sets?.[n]||null;
     if(!e){
       try{e=await lookupSetOnlineV45(n)}catch{}
     }
     const bulk=all?.sets?.[n]||null;
     let touched=false;
     if(!x.imageUrl){
       const u=e?.imageUrl||bulk?.[3]||"";
       if(u){x.imageUrl=u;touched=true;img++}
     }
     if(!x.name||/^Set\s+\d+/i.test(String(x.name))){
       const name=e?.brickeconomyName||e?.rebrickableName||bulk?.[0]||"";
       if(name){x.name=name;touched=true}
     }
     if(!x.barcode&&(e?.ean||e?.upc)){x.barcode=e.ean||e.upc;touched=true;barcode++}
     const mv=e?chooseMarketV3(x,e):0;
     if(!pV3(x.currentValue)&&mv){x.currentValue=mv;x.valueSource="Online-Katalog";touched=true;value++}
     if(e){
       let gotDims=false;
       if(!(Array.isArray(x.modelDimensions)&&x.modelDimensions.length===3)&&pV3(e.modelDimension1)&&pV3(e.modelDimension2)&&pV3(e.modelDimension3)){
         x.modelDimensions=[pV3(e.modelDimension1),pV3(e.modelDimension2),pV3(e.modelDimension3)];
         x.modelDimensionsSource=e.modelDimensionsSource||"Brickset";touched=true;gotDims=true
       }
       if(!pV3(x.footprintWidth)&&pV3(e.footprintWidth)&&pV3(e.footprintDepth)){
         x.footprintWidth=pV3(e.footprintWidth);x.footprintDepth=pV3(e.footprintDepth);
         x.footprintSource=e.footprintSource||"Brickset/LEGO-Beschreibung";touched=true;gotDims=true
       }
       if(!pV3(x.width)&&pV3(e.width)){x.width=e.width;touched=true;gotDims=true}
       if(!pV3(x.depth)&&pV3(e.depth)){x.depth=e.depth;touched=true;gotDims=true}
       if(!pV3(x.height)&&pV3(e.height)){x.height=e.height;touched=true;gotDims=true}
       if(gotDims)dims++;
       x.market={...(x.market||{}),...e};
     }
     if(touched)changed++;
   }
   if(changed){persist();refresh()}
   renderQualityAssistantV35();
   const remaining={
     image:(state.collection||[]).filter(x=>!x.imageUrl).length,
     value:(state.collection||[]).filter(x=>!pV3(x.currentValue)).length,
     dims:(state.collection||[]).filter(x=>!(pV3(x.width)&&pV3(x.depth)&&pV3(x.height))&&!(Array.isArray(x.modelDimensions)&&x.modelDimensions.filter(v=>pV3(v)>0).length===3)).length
   };
   alert(
     "Automatische Ergänzung abgeschlossen.\n\n"+
     "Sets aktualisiert: "+changed+
     "\nBilder ergänzt: "+img+
     "\nMarktwerte ergänzt: "+value+
     "\nMaße ergänzt: "+dims+
     "\nBarcodes ergänzt: "+barcode+
     "\n\nNoch offen: "+remaining.image+" Bilder, "+remaining.value+" Marktwerte, "+remaining.dims+" Maße."+
     "\nFür verbleibende Werte liegen im aktuellen Online-Katalog keine verlässlichen Daten vor."
   );
 }finally{
   if(btn){btn.disabled=false;btn.textContent="Alle automatisch ergänzen"}
 }
}
function applyAllSetImageFallbackV523(){
 if(!allSetsV46?.sets)return false;
 let changed=false;
 for(const x of (state.collection||[])){
   const n=String(x.setNumber||"").replace(/-1$/,""),r=allSetsV46.sets[n];
   if(!r)continue;
   if(!x.imageUrl&&r[3]){x.imageUrl=r[3];changed=true}
   if((!x.name||/^Set\s+\d+/i.test(String(x.name)))&&r[0]){x.name=r[0];changed=true}
 }
 if(changed)persist();
 return changed;
}
const loadAllSetsBaseV523=loadAllSetsV46;
loadAllSetsV46=async function(force=false){
 const out=await loadAllSetsBaseV523(force);
 if(out&&applyAllSetImageFallbackV523())setTimeout(refresh,0);
 return out;
};
function bindQualityBulkV523(){
 if($("qualityBulkFillV523"))$("qualityBulkFillV523").onclick=bulkEnrichCollectionV523;
}
const refreshBaseV523=refresh;
refresh=function(){const r=refreshBaseV523();setTimeout(bindQualityBulkV523,0);return r};
setTimeout(bindQualityBulkV523,200);


/* v50.26 trustworthy footprint handling */
function footprintV526(x){
 const w=pV3(x?.width),d=pV3(x?.depth);
 if(w&&d)return {w,d,source:"Eigene/strukturierte Maße"};
 const fw=pV3(x?.footprintWidth),fd=pV3(x?.footprintDepth);
 if(fw&&fd)return {w:fw,d:fd,source:x?.footprintSource||"Brickset/LEGO-Beschreibung"};
 return null;
}
function footprintAreaCm2V526(x){
 const f=footprintV526(x);return f?f.w*f.d*Math.max(1,pV3(x?.quantity)||1):0;
}
function footprintTextV526(x){
 const f=footprintV526(x);return f?(f.w+" × "+f.d+" cm · "+f.source):"keine verlässliche Stellfläche";
}


/* v50.27 data-quality consistency + clickable quality summary */
function hasFullDimsV527(x){
 return !!(pV3(x?.width)&&pV3(x?.depth)&&pV3(x?.height));
}
function hasModelDimsV527(x){
 return Array.isArray(x?.modelDimensions)&&x.modelDimensions.filter(v=>pV3(v)>0).length===3;
}
function hasReliableFootprintV527(x){
 return !!footprintV526(x);
}
function dimensionStatusV527(x){
 if(hasFullDimsV527(x))return "full";
 if(hasReliableFootprintV527(x))return "footprint";
 if(hasModelDimsV527(x))return "modelonly";
 return "none";
}
function qualityChecksV527(x){
 return [
   !!x?.imageUrl,
   pV3(x?.currentValue)>0,
   hasFullDimsV527(x)||hasModelDimsV527(x)||hasReliableFootprintV527(x),
   !!x?.barcode,
   pV3(x?.purchasePrice)>0,
   !!(x?.condition&&x.condition!=="Unbekannt"),
   !!x?.cityArea,
   !!x?.category
 ];
}
qualityScoreV38=function(x){
 const checks=qualityChecksV527(x);
 return Math.round(checks.filter(Boolean).length/checks.length*100);
};
dataQualityV50=function(){
 const rows=state.collection||[];if(!rows.length)return 0;
 let got=0,total=rows.length*qualityChecksV527({}).length;
 for(const x of rows)got+=qualityChecksV527(x).filter(Boolean).length;
 return Math.round(got/total*100);
};
qualityIssuesV35=function(x){
 const a=[];
 if(!pV3(x.currentValue))a.push("value");
 if(!x.imageUrl)a.push("image");
 if(!(hasFullDimsV527(x)||hasModelDimsV527(x)||hasReliableFootprintV527(x)))a.push("dims");
 if(!x.barcode)a.push("barcode");
 if(!pV3(x.purchasePrice))a.push("price");
 if(!x.condition||x.condition==="Unbekannt")a.push("condition");
 return a;
};
function setQualityFilterV527(filter){
 const el=$("qualityFilterV35");if(el)el.value=filter;
 renderQualityAssistantV35();
 document.getElementById("qualityAssistantV35")?.scrollIntoView({behavior:"smooth",block:"start"});
}
window.setQualityFilterV527=setQualityFilterV527;
function renderQualitySummaryV527(){
 const box=$("qualityAnalysis");if(!box)return;
 const rows=state.collection||[];
 const stats=[
   ["image","Ohne Bild",rows.filter(x=>!x.imageUrl).length],
   ["value","Ohne aktuellen Wert",rows.filter(x=>!pV3(x.currentValue)).length],
   ["dims","Ohne nutzbare Maße",rows.filter(x=>!(hasFullDimsV527(x)||hasModelDimsV527(x)||hasReliableFootprintV527(x))).length],
   ["footprint","Ohne verlässliche Stellfläche",rows.filter(x=>!hasReliableFootprintV527(x)).length],
   ["barcode","Ohne Barcode",rows.filter(x=>!x.barcode).length],
   ["price","Ohne Kaufpreis",rows.filter(x=>!pV3(x.purchasePrice)).length],
   ["condition","Ohne Zustand",rows.filter(x=>!x.condition||x.condition==="Unbekannt").length]
 ];
 box.innerHTML='<div class="qualitylist qualityClickableV527">'+stats.map(([f,k,v])=>'<button type="button" class="qualityitem qualityBtnV527" onclick="setQualityFilterV527(\''+f+'\')"><span>'+esc(k)+'</span><b>'+v+'</b><small>anzeigen →</small></button>').join("")+'</div>'+
 '<div class="measureStatusV527">'+[
   ["Vollständige Maße",rows.filter(x=>dimensionStatusV527(x)==="full").length],
   ["Sichere Stellfläche",rows.filter(x=>hasReliableFootprintV527(x)).length],
   ["Nur Brickset-Modellmaße",rows.filter(x=>dimensionStatusV527(x)==="modelonly").length],
   ["Keine Maße",rows.filter(x=>dimensionStatusV527(x)==="none").length]
 ].map(([k,v])=>'<div><span>'+k+'</span><b>'+v+'</b></div>').join("")+'</div>';
}
const renderQualityAssistantCoreV527=renderQualityAssistantV35;
renderQualityAssistantV35=function(){
 const box=$("qualityAssistantV35");if(!box)return;
 const filter=$("qualityFilterV35")?.value||"all";
 const rows=(state.collection||[]).map(x=>({x,issues:qualityIssuesV35(x),score:qualityScoreV38(x),dim:dimensionStatusV527(x)})).filter(r=>{
   if(filter==="all")return r.issues.length;
   if(filter==="modelonly")return r.dim==="modelonly";
   if(filter==="nodims")return r.dim==="none";
   if(filter==="footprint")return !hasReliableFootprintV527(r.x);
   return r.issues.includes(filter);
 });
 box.innerHTML=rows.length?rows.slice(0,100).map(({x,issues,score,dim})=>{
   const chips=issues.map(k=>'<span class="chip warn">'+esc(qualityLabelsV35[k])+'</span>');
   if(dim==="modelonly")chips.push('<span class="chip">nur Modellmaße</span>');
   if(!hasReliableFootprintV527(x))chips.push('<span class="chip warn">keine sichere Stellfläche</span>');
   return '<div class="qualityRowV35"><div><b>'+esc(x.setNumber)+' · '+esc(x.name)+'</b><small>'+score+' % vollständig</small><div class="chips">'+chips.join("")+'</div></div><div class="actions"><button class="btn secondary" onclick="autoEnrichOneV35(\''+esc(x.setNumber)+'\')">Auto ergänzen</button><button class="btn" onclick="editSet(\''+esc(x.setNumber)+'\')">Bearbeiten</button></div></div>';
 }).join(""):'<p class="hint">Für diesen Filter sind keine Einträge vorhanden.</p>';
};
const renderAnalysisBaseV527=renderAnalysisV3;
renderAnalysisV3=function(){
 const r=renderAnalysisBaseV527();
 renderQualitySummaryV527();
 if($("aSized"))$("aSized").textContent=(state.collection||[]).filter(x=>hasFullDimsV527(x)||hasModelDimsV527(x)||hasReliableFootprintV527(x)).length;
 return r;
};
const renderStatsBaseV527=renderStatsV36;
renderStatsV36=function(){
 const r=renderStatsBaseV527();
 const cov=$("coverageV36");if(cov){
   const total=state.collection.length||1;
   const rows=[
     ["Marktwert",state.collection.filter(x=>pV3(x.currentValue)).length],
     ["Bild",state.collection.filter(x=>x.imageUrl).length],
     ["Maße",state.collection.filter(x=>hasFullDimsV527(x)||hasModelDimsV527(x)||hasReliableFootprintV527(x)).length],
     ["Stellfläche",state.collection.filter(x=>hasReliableFootprintV527(x)).length],
     ["Barcode",state.collection.filter(x=>x.barcode).length],
     ["Kaufpreis",state.collection.filter(x=>pV3(x.purchasePrice)).length],
     ["Zustand",state.collection.filter(x=>x.condition&&x.condition!=="Unbekannt").length]
   ];
   cov.innerHTML=rows.map(([k,v])=>'<div class="coverageRowV36"><span>'+k+'</span><div class="bar"><i style="width:'+(v/total*100)+'%"></i></div><b>'+v+'/'+total+'</b></div>').join("");
 }
 return r;
};
setTimeout(()=>{renderQualitySummaryV527();renderQualityAssistantV35()},240);


/* v50.28 city modules, source transparency, collector near-complete */
function moduleNeedV528(x){
 const fp=typeof footprintV526==="function"?footprintV526(x):null;
 if(!fp)return {count:1,known:false,cols:1,rows:1};
 const mw=pV3(state.meta?.moduleWidth)||25.6,md=pV3(state.meta?.moduleDepth)||25.6;
 const a={cols:Math.max(1,Math.ceil(fp.w/mw)),rows:Math.max(1,Math.ceil(fp.d/md))};
 const b={cols:Math.max(1,Math.ceil(fp.d/mw)),rows:Math.max(1,Math.ceil(fp.w/md))};
 const pa=a.cols*a.rows,pb=b.cols*b.rows,best=pb<pa?b:a;
 return {count:best.cols*best.rows,known:true,cols:best.cols,rows:best.rows,w:fp.w,d:fp.d};
}
const dynamicModuleCapacityBaseV528=dynamicModuleCapacityV502;
dynamicModuleCapacityV502=function(){
 const need=(state.collection||[]).reduce((s,x)=>s+moduleNeedV528(x).count,0);
 const highestExisting=Math.max(0,...Object.keys(state.modules||{}).map(k=>Number(String(k).replace(/^M/i,""))||0));
 return Math.ceil(Math.max(40,need+8,highestExisting)/8)*8;
};
function renderCityCoverageV528(){
 const box=$("cityCoverageV528");if(!box)return;
 const rows=state.collection||[],withFoot=rows.filter(x=>hasReliableFootprintV527(x)).length,without=Math.max(0,rows.length-withFoot);
 const area=rows.reduce((s,x)=>s+footprintAreaCm2V526(x),0)/10000;
 const multi=rows.filter(x=>moduleNeedV528(x).known&&moduleNeedV528(x).count>1).length;
 const modules=rows.reduce((s,x)=>s+moduleNeedV528(x).count,0);
 const pct=rows.length?Math.round(withFoot/rows.length*100):0;
 box.innerHTML='<div class="cityCoverageHeadV528"><div><b>'+area.toFixed(2).replace(".",",")+' m² bekannte Stellfläche</b><span>'+withFoot+' von '+rows.length+' Sets · '+pct+' % Flächenabdeckung</span></div><strong>'+modules+' Modulplätze benötigt</strong></div>'+
 '<div class="cityCoverageBarV528"><i style="width:'+pct+'%"></i></div>'+
 '<div class="cityCoverageMetaV528"><span>'+without+' Sets ohne sichere Stellfläche</span><span>'+multi+' Mehrmodul-Set'+(multi===1?"":"s")+'</span></div>';
}
const renderCityPlannerBaseV528=renderCityPlannerV49;
renderCityPlannerV49=function(){
 const r=renderCityPlannerBaseV528();
 renderCityCoverageV528();
 const list=$("cityUnplannedV49");
 if(list){
   list.querySelectorAll(".cityUnplannedItemV49").forEach(btn=>{
     const n=btn.getAttribute("onclick")?.match(/'([^']+)'/)?.[1],x=(state.collection||[]).find(y=>String(y.setNumber)===String(n));
     if(!x)return;const need=moduleNeedV528(x),text=btn.querySelector(".cityUnplannedTextV49 small");
     if(text&&need.known)text.textContent+=(need.count>1?" · "+need.count+" Module ("+need.cols+"×"+need.rows+")":" · 1 Modul");
   });
 }
 return r;
};
const fitWarningBaseV528=fitWarningV28;
fitWarningV28=function(x){
 const base=fitWarningBaseV528(x),need=moduleNeedV528(x);
 if(need.known&&need.count>1)return base+" Empfohlen: "+need.count+" Module ("+need.cols+" × "+need.rows+").";
 return base;
};
function sourceRowsV528(x){
 const e=enrichmentV3?.sets?.[String(x.setNumber)]||x.market||{};
 const out=[];
 if(x.imageUrl)out.push(["Bild",e.rebrickableUpdated?"Rebrickable":e.brickeconomyUpdated?"BrickEconomy":"Sammlung"]);
 if(pV3(x.currentValue))out.push(["Marktwert",x.valueSource||e.marketSourceFallback||(e.brickeconomyUpdated?"BrickEconomy":"Sammlung")]);
 if(hasReliableFootprintV527(x))out.push(["Stellfläche",x.footprintSource||"Eigene/strukturierte Maße"]);
 else if(hasModelDimsV527(x))out.push(["Modellmaße",x.modelDimensionsSource||"Brickset"]);
 if(x.barcode)out.push(["Barcode",(e.ean||e.upc)?"Online-Katalog":"Sammlung"]);
 return out;
}
const detailTabsBaseV528=detailTabsV38;
detailTabsV38=function(n){
 detailTabsBaseV528(n);
 const x=(state.collection||[]).find(y=>String(y.setNumber)===String(n)),d=$("detailContent");if(!x||!d)return;
 const online=d.querySelector('.detailViewV38[data-view="online"]');if(!online)return;
 const rows=sourceRowsV528(x);
 let box=online.querySelector(".dataSourcesV528");
 if(!box){box=document.createElement("div");box.className="dataSourcesV528";online.appendChild(box)}
 box.innerHTML='<h3>Datenquellen</h3>'+(rows.length?rows.map(([k,v])=>'<div><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>').join(""):'<p class="hint">Noch keine Quelle zugeordnet.</p>');
};
async function renderCollectorFastCompleteV528(){
 const box=$("collectorFastCompleteGridV528");if(!box)return;
 const all=await loadAllSetsV46(false);if(!all?.sets)return;
 const defs=collectorThemeDefsV504(all);
 const rows=defs.map(def=>({def,p:collectorProgressV504(collectorRowsV504(all,def))}))
   .filter(x=>x.p.total&&x.p.missing>=1&&x.p.missing<=5)
   .sort((a,b)=>a.p.missing-b.p.missing||b.p.pct-a.p.pct||a.def.label.localeCompare(b.def.label,"de"))
   .slice(0,8);
 box.innerHTML=rows.length?rows.map(({def,p})=>
   '<button class="collectorThemeCardV504 fastCompleteCardV528" onclick="openCollectorThemeV504(\''+esc(def.key)+'\')">'+
   '<span class="collectorThemeIconV504">'+esc(def.icon||"✓")+'</span>'+
   '<span class="collectorThemeCardMainV504"><b>'+esc(def.label)+'</b><small>Noch '+p.missing+' Set'+(p.missing===1?"":"s")+' · '+p.pct+' % komplett</small><span class="collectorMiniProgressV504"><i style="width:'+p.pct+'%"></i></span></span>'+
   '<strong>'+p.pct+'%</strong></button>'
 ).join(""):'<div class="card"><p class="hint">Aktuell gibt es keine Themenwelt mit nur noch 1–5 fehlenden Sets.</p></div>';
}
const renderCollectorThemesBaseV528=renderCollectorThemesV504;
renderCollectorThemesV504=async function(){
 const r=await renderCollectorThemesBaseV528();
 await renderCollectorFastCompleteV528();
 return r;
};
function renderNightCareV528(){
 const box=$("nightCareStatusV528");if(!box)return;
 const m=enrichmentV3?.meta||{},last=m.lastUpdated?new Date(m.lastUpdated).toLocaleString("de-DE"):"noch kein Lauf";
 const err=(m.errors||[]).slice(-1)[0]||"";
 let status="Automatik bereit";
 if(m.rateLimited)status="API-Limit erreicht – nächster Lauf setzt automatisch fort";
 else if(m.lastUpdated)status="Letzter Lauf: "+last;
 box.querySelector("b").textContent="✓ Nachtpflege aktiv";
 box.querySelector("small").textContent=status+(err&&!m.rateLimited?" · Letzte Meldung: "+err:"");
}
const refreshBaseV528=refresh;
refresh=function(){
 const r=refreshBaseV528();
 renderCityCoverageV528();renderNightCareV528();setTimeout(renderCollectorFastCompleteV528,0);
 return r;
};
setTimeout(()=>{renderCityCoverageV528();renderNightCareV528();renderCollectorFastCompleteV528()},260);


/* v50.28 reliable footprint final override */
moduleFitsV35=function(x){
 const mw=pV3(state.meta?.moduleWidth)||25.6,md=pV3(state.meta?.moduleDepth)||25.6,f=footprintV526(x);
 if(!f)return null;
 return (f.w<=mw&&f.d<=md)||(f.d<=mw&&f.w<=md);
};
const fitWarningReliableV528=fitWarningV28;
fitWarningV28=function(x){
 const mw=pV3(state.meta?.moduleWidth)||25.6,md=pV3(state.meta?.moduleDepth)||25.6,f=footprintV526(x);
 if(!f)return "Keine verlässliche Stellfläche – Passform kann nicht geprüft werden.";
 const fits=(f.w<=mw&&f.d<=md)||(f.d<=mw&&f.w<=md),need=moduleNeedV528(x);
 if(fits)return "Passt in ein Standardmodul ("+mw+" × "+md+" cm).";
 return "⚠ Größer als ein Standardmodul. Empfohlen: "+need.count+" Module ("+need.cols+" × "+need.rows+").";
};
const renderAnalysisReliableV528=renderAnalysisV3;
renderAnalysisV3=function(){
 const r=renderAnalysisReliableV528();
 if($("aArea")){
   const area=(state.collection||[]).reduce((s,x)=>s+footprintAreaCm2V526(x),0)/10000;
   $("aArea").textContent=area.toFixed(2).replace(".",",")+" m²";
 }
 renderQualitySummaryV527();
 return r;
};
const renderCityPlannerReliableV528=renderCityPlannerV49;
renderCityPlannerV49=function(){
 const r=renderCityPlannerReliableV528();
 const stats=$("cityPlannerStatsV49");
 if(stats){
   const items=[...stats.querySelectorAll(".miniStat")];
   const area=(state.collection||[]).reduce((s,x)=>s+footprintAreaCm2V526(x),0)/10000;
   const target=items.find(el=>/Bekannte Setfläche/.test(el.textContent||""));
   if(target?.querySelector("b"))target.querySelector("b").textContent=area.toFixed(2).replace(".",",")+" m²";
 }
 renderCityCoverageV528();
 return r;
};


/* v50.29 default missing condition to used */
function fillMissingConditionV529(){
 const rows=state.collection||[];
 let changed=0;
 for(const x of rows){
   if(!x.condition||x.condition==="Unbekannt"){
     x.condition="Gebraucht";
     changed++;
   }
 }
 if(changed){
   state.meta=state.meta||{};
   state.meta.conditionDefaultMigrationV529=new Date().toISOString();
   persist();
 }
 return changed;
}
const refreshBaseV529=refresh;
refresh=function(){
 fillMissingConditionV529();
 return refreshBaseV529();
};
setTimeout(()=>{fillMissingConditionV529();refresh()},120);


/* v50.30 Smart Autopilot */
function autopilotSnapshotV530(){
 const rows=state.collection||[];
 const total=rows.length||1;
 const metrics={
   sets:rows.length,
   missingImage:rows.filter(x=>!x.imageUrl).length,
   missingValue:rows.filter(x=>!pV3(x.currentValue)).length,
   missingDims:rows.filter(x=>!(hasFullDimsV527(x)||hasModelDimsV527(x)||hasReliableFootprintV527(x))).length,
   missingFoot:rows.filter(x=>!hasReliableFootprintV527(x)).length,
   missingBarcode:rows.filter(x=>!x.barcode).length,
   missingModule:rows.filter(x=>!x.module).length,
   missingStorage:rows.filter(x=>!x.storage).length,
   incompleteCondition:rows.filter(x=>!x.condition||x.condition==="Unbekannt").length
 };
 const score=Math.max(0,Math.min(100,Math.round(
   100-(
     metrics.missingImage+
     metrics.missingValue+
     metrics.missingDims+
     metrics.missingBarcode+
     metrics.missingModule+
     Math.min(metrics.missingStorage,rows.length)
   )/(total*6)*100
 )));
 return {...metrics,score};
}
function autopilotActionsV530(m){
 const out=[];
 if(m.missingImage)out.push(["image",m.missingImage+" Bilder fehlen","Online-Daten ergänzen"]);
 if(m.missingValue)out.push(["value",m.missingValue+" Marktwerte fehlen","Marktwerte nachladen"]);
 if(m.missingDims)out.push(["dims",m.missingDims+" Maße fehlen","Maße ergänzen"]);
 if(m.missingFoot)out.push(["footprint",m.missingFoot+" Stellflächen unsicher","Stadtplanung prüfen"]);
 if(m.missingModule)out.push(["module",m.missingModule+" Sets ohne Modul","Stadt planen"]);
 if(m.missingStorage)out.push(["storage",m.missingStorage+" Sets ohne Lagerort","Bestand ordnen"]);
 if(m.missingBarcode)out.push(["barcode",m.missingBarcode+" Barcodes fehlen","Online-Daten ergänzen"]);
 if(!out.length)out.push(["done","Sammlung sauber","Keine dringenden Aufgaben"]);
 return out.slice(0,4);
}
function renderAutopilotV530(){
 const box=$("megaAutoMetricsV530"),act=$("megaAutoActionsV530"),score=$("megaAutoScoreV530");
 if(!(box&&act&&score))return;
 const m=autopilotSnapshotV530();
 score.textContent=m.score+"%";
 box.innerHTML=[
   ["Sets",m.sets],
   ["Bilder offen",m.missingImage],
   ["Werte offen",m.missingValue],
   ["Maße offen",m.missingDims],
   ["Ohne Modul",m.missingModule],
   ["Ohne Lagerort",m.missingStorage]
 ].map(([k,v])=>'<div><span>'+k+'</span><b>'+v+'</b></div>').join("");
 act.innerHTML=autopilotActionsV530(m).map(([type,title,sub])=>
   '<button type="button" data-auto-action="'+type+'"><span>'+esc(title)+'</span><small>'+esc(sub)+'</small><b>›</b></button>'
 ).join("");
 act.querySelectorAll("button").forEach(b=>b.onclick=()=>{
   const t=b.dataset.autoAction;
   if(["image","value","dims","barcode"].includes(t)){switchTab("analysis");setTimeout(()=>setQualityFilterV527(t==="image"?"image":t==="value"?"value":t==="dims"?"dims":"barcode"),80)}
   else if(t==="footprint"){switchTab("analysis");setTimeout(()=>setQualityFilterV527("footprint"),80)}
   else if(t==="module"){switchTab("city")}
   else if(t==="storage"){switchTab("collection")}
 });
}
async function runAutopilotV530(){
 const btn=$("megaAutoRunV530"),p=$("megaAutoProgressV530");
 if(btn)btn.disabled=true;
 if(p){p.classList.remove("hidden");p.querySelector("span").textContent="Autopilot läuft…";p.querySelector("i").style.width="12%"}
 try{
   fillMissingConditionV529();
   if(p)p.querySelector("i").style.width="30%";
   await loadEnrichmentV3(true);
   if(p)p.querySelector("i").style.width="48%";
   if(typeof bulkEnrichCollectionV523==="function")await bulkEnrichCollectionV523();
   if(p)p.querySelector("i").style.width="78%";
   renderQualitySummaryV527();
   renderQualityAssistantV35();
   renderCityCoverageV528();
   renderNightCareV528();
   renderAutopilotV530();
   if(p){p.querySelector("i").style.width="100%";p.querySelector("span").textContent="Fertig · Sammlung neu bewertet"}
   setTimeout(()=>p?.classList.add("hidden"),1800);
 }catch(e){
   if(p){p.querySelector("span").textContent="Autopilot teilweise abgeschlossen";p.querySelector("i").style.width="100%"}
 }finally{
   if(btn)btn.disabled=false;
 }
}
function bindAutopilotV530(){
 const run=$("megaAutoRunV530"),ana=$("megaAutoAnalysisV530");
 if(run)run.onclick=runAutopilotV530;
 if(ana)ana.onclick=()=>switchTab("analysis");
}
const refreshBaseV530=refresh;
refresh=function(){
 const r=refreshBaseV530();
 renderAutopilotV530();
 return r;
};
bindAutopilotV530();
setTimeout(renderAutopilotV530,220);


/* v50.31 data traffic light, structured storage, module-block planner, safety snapshots */
function parseStorageV531(value=""){
 const parts=String(value||"").split(" › ").map(x=>x.trim()).filter(Boolean);
 return {room:parts[0]||"",shelf:parts[1]||"",bin:parts.slice(2).join(" › ")||""};
}
function composeStorageV531(room="",shelf="",bin=""){
 return [room,shelf,bin].map(x=>String(x||"").trim()).filter(Boolean).join(" › ");
}
function fillStorageFieldsV531(prefix,x){
 const storage=x?.storage||"";
 const parsed=(x?.storageRoom||x?.storageShelf||x?.storageBin)?{
   room:x.storageRoom||"",shelf:x.storageShelf||"",bin:x.storageBin||""
 }:parseStorageV531(storage);
 const total=$(prefix+"Storage"),room=$(prefix+"StorageRoom"),shelf=$(prefix+"StorageShelf"),bin=$(prefix+"StorageBin");
 if(total)total.value=storage||composeStorageV531(parsed.room,parsed.shelf,parsed.bin);
 if(room)room.value=parsed.room;
 if(shelf)shelf.value=parsed.shelf;
 if(bin)bin.value=parsed.bin;
}
function readStorageFieldsV531(prefix,x){
 const total=$(prefix+"Storage"),room=$(prefix+"StorageRoom"),shelf=$(prefix+"StorageShelf"),bin=$(prefix+"StorageBin");
 const r=room?.value.trim()||"",s=shelf?.value.trim()||"",b=bin?.value.trim()||"";
 const composed=composeStorageV531(r,s,b);
 x.storageRoom=r;x.storageShelf=s;x.storageBin=b;
 x.storage=composed||(total?.value.trim()||x.storage||"");
 if(total&&composed)total.value=composed;
}
const openSetBaseV531=openSet;
openSet=function(x=null){
 const r=openSetBaseV531(x);
 fillStorageFieldsV531("f",x||{});
 return r;
};
const saveSetBaseV531=saveSet;
saveSet=function(){
 const was=editing||$("fSet")?.value?.trim();
 const r=saveSetBaseV531();
 const x=(state.collection||[]).find(y=>String(y.setNumber)===String(was));
 if(x){readStorageFieldsV531("f",x);persist();refresh()}
 return r;
};
const openPurchaseBaseV531=openPurchaseV3;
openPurchaseV3=function(w=null,x=null){
 const r=openPurchaseBaseV531(w,x);
 fillStorageFieldsV531("p",x||{storage:""});
 return r;
};
const savePurchaseBaseV531=savePurchaseV3;
savePurchaseV3=function(){
 const n=$("pSet")?.value?.trim();
 const r=savePurchaseBaseV531();
 const x=(state.collection||[]).find(y=>String(y.setNumber)===String(n));
 if(x){readStorageFieldsV531("p",x);persist();refresh()}
 return r;
};

function dataLightRowsV531(x){
 const e=enrichmentV3?.sets?.[String(x.setNumber)]||x.market||{};
 const updated=e.brickeconomyUpdated||e.bricklinkUpdated||e.rebrickableUpdated||e.bricksetUpdated||"";
 let marketFresh="unknown";
 if(updated){
   const age=(Date.now()-new Date(updated).getTime())/86400000;
   marketFresh=age<=14?"fresh":age<=45?"aging":"old";
 }
 return [
   ["Bild",!!x.imageUrl, x.imageUrl?"vorhanden":"fehlt"],
   ["Marktwert",pV3(x.currentValue)>0, pV3(x.currentValue)>0?(marketFresh==="fresh"?"aktuell":marketFresh==="aging"?"älter":"vorhanden"):"fehlt"],
   ["Maße",hasFullDimsV527(x)||hasModelDimsV527(x),hasFullDimsV527(x)?"vollständig":hasModelDimsV527(x)?"Modellmaße":"fehlen"],
   ["Stellfläche",hasReliableFootprintV527(x),hasReliableFootprintV527(x)?"verlässlich":"unsicher"],
   ["Barcode",!!x.barcode,x.barcode?"vorhanden":"fehlt"],
   ["Zustand",!!(x.condition&&x.condition!=="Unbekannt"),x.condition||"fehlt"],
   ["Lagerort",!!x.storage,x.storage||"fehlt"]
 ];
}
function renderDataLightV531(x,root){
 if(!root||!x)return;
 let box=root.querySelector(".dataLightV531");
 if(!box){box=document.createElement("div");box.className="dataLightV531";root.prepend(box)}
 box.innerHTML='<div class="dataLightHeadV531"><div><span class="eyebrowV50">DATENAMPEL</span><h3>Setdaten auf einen Blick</h3></div><b>'+qualityScoreV38(x)+'%</b></div>'+
 '<div class="dataLightGridV531">'+dataLightRowsV531(x).map(([k,ok,label])=>'<div class="'+(ok?'ok':'warn')+'"><i></i><span>'+esc(k)+'</span><b>'+esc(label)+'</b></div>').join("")+'</div>';
}
const detailTabsBaseV531=detailTabsV38;
detailTabsV38=function(n){
 const r=detailTabsBaseV531(n);
 const x=(state.collection||[]).find(y=>String(y.setNumber)===String(n));
 renderDataLightV531(x,$("detailContent"));
 return r;
};

function moduleDomMatrixV531(){
 const g=$("moduleGrid");if(!g)return [];
 const items=[...g.children];
 const cols=8,rows=[];
 for(let i=0;i<items.length;i+=cols)rows.push(items.slice(i,i+cols));
 return rows;
}
function findModuleBlockV531(x){
 const need=moduleNeedV528(x);
 if(!need.known||need.count<=1)return null;
 const matrix=moduleDomMatrixV531();if(!matrix.length)return null;
 const variants=[[need.cols,need.rows]];
 if(need.cols!==need.rows)variants.push([need.rows,need.cols]);
 const used=new Set();
 for(const [m,a] of Object.entries(state.modules||{}))if((a||[]).length)used.add(m);
 for(const [cols,rows] of variants){
   for(let r=0;r<=matrix.length-rows;r++){
     for(let c=0;c<=8-cols;c++){
       const mods=[];let ok=true;
       for(let rr=0;rr<rows;rr++)for(let cc=0;cc<cols;cc++){
         const el=matrix[r+rr]?.[c+cc],m=el?.dataset?.module;
         if(!m||used.has(m)){ok=false;break}
         mods.push(m);
       }
       if(ok&&mods.length===cols*rows)return {modules:mods,cols,rows};
     }
   }
 }
 return null;
}
window.assignSuggestedBlockV531=n=>{
 const x=(state.collection||[]).find(y=>String(y.setNumber)===String(n));if(!x)return;
 const block=findModuleBlockV531(x);if(!block)return alert("Aktuell wurde kein zusammenhängender freier Modulblock gefunden.");
 for(const arr of Object.values(state.modules||{})){
   const i=arr.indexOf(String(x.setNumber));if(i>=0)arr.splice(i,1);
 }
 for(const m of block.modules){
   state.modules[m]=state.modules[m]||[];
   if(!state.modules[m].includes(String(x.setNumber)))state.modules[m].push(String(x.setNumber));
 }
 x.modules=[...block.modules];x.module=block.modules[0]||"";
 state.meta=state.meta||{};state.meta.lastModuleBlockAssignmentV531=new Date().toISOString();
 persist();refresh();
 alert(x.setNumber+" wurde auf "+block.modules.length+" zusammenhängende Module verteilt: "+block.modules.join(", "));
};
function renderBlockSuggestionV531(){
 const box=$("cityBlockSuggestionV531");if(!box)return;
 const candidates=(state.collection||[]).map(x=>({x,need:moduleNeedV528(x)})).filter(o=>o.need.known&&o.need.count>1&&!o.x.module);
 if(!candidates.length){box.innerHTML='<span>✓ Keine ungeplanten Mehrmodul-Sets.</span>';return}
 const o=candidates.sort((a,b)=>b.need.count-a.need.count)[0],block=findModuleBlockV531(o.x);
 box.innerHTML='<div><span class="eyebrowV50">MEHRMODUL-PLANER</span><b>'+esc(o.x.setNumber)+' · '+esc(o.x.name)+'</b><small>Benötigt '+o.need.count+' Module ('+o.need.cols+'×'+o.need.rows+')</small></div>'+
 (block?'<button class="btn" onclick="assignSuggestedBlockV531(\''+esc(o.x.setNumber)+'\')">Block '+block.modules.join(" · ")+' zuweisen</button>':'<span class="chip warn">Kein zusammenhängender Block frei</span>');
}
const renderCityPlannerBaseV531=renderCityPlannerV49;
renderCityPlannerV49=function(){
 const r=renderCityPlannerBaseV531();
 setTimeout(renderBlockSuggestionV531,0);
 return r;
};

function createSafetySnapshotV531(reason="Automatik"){
 try{
   const snap={createdAt:new Date().toISOString(),reason,state:structuredClone(state)};
   localStorage.setItem("brick-city-manager-safety-snapshot-v531",JSON.stringify(snap));
   state.meta=state.meta||{};state.meta.lastSafetySnapshotV531=snap.createdAt;
   return snap;
 }catch(e){return null}
}
window.restoreSafetySnapshotV531=()=>{
 const raw=localStorage.getItem("brick-city-manager-safety-snapshot-v531");
 if(!raw)return alert("Noch kein Sicherheits-Snapshot vorhanden.");
 if(!confirm("Den letzten Sicherheits-Snapshot wiederherstellen? Der aktuelle lokale Stand wird ersetzt."))return;
 try{
   const snap=JSON.parse(raw);state=snap.state;persist();refresh();alert("Snapshot vom "+new Date(snap.createdAt).toLocaleString("de-DE")+" wurde wiederhergestellt.");
 }catch(e){alert("Snapshot konnte nicht geladen werden.")}
};
const runAutopilotBaseV531=runAutopilotV530;
runAutopilotV530=async function(){
 createSafetySnapshotV531("Smart Autopilot");
 return await runAutopilotBaseV531();
};
function renderSafetySnapshotControlV531(){
 const settings=$("settings");if(!settings||$("safetySnapshotV531"))return;
 const card=document.createElement("div");card.className="card wide";card.id="safetySnapshotV531";
 const raw=localStorage.getItem("brick-city-manager-safety-snapshot-v531");let stamp="Noch keiner";
 try{if(raw)stamp=new Date(JSON.parse(raw).createdAt).toLocaleString("de-DE")}catch{}
 card.innerHTML='<div class="sectionHead"><div><h2>Sicherheits-Snapshot</h2><p class="hint">Vor größeren Automatikläufen wird automatisch ein lokaler Wiederherstellungspunkt erstellt.</p></div><button class="btn secondary" onclick="restoreSafetySnapshotV531()">Letzten Stand wiederherstellen</button></div><small>Letzter Snapshot: '+esc(stamp)+'</small>';
 settings.prepend(card);
}
const refreshBaseV531=refresh;
refresh=function(){
 const r=refreshBaseV531();
 renderBlockSuggestionV531();renderSafetySnapshotControlV531();
 return r;
};
setTimeout(()=>{renderBlockSuggestionV531();renderSafetySnapshotControlV531()},250);


/* v50.32 transparent market valuation + full collection price audit */
function valuationModeV532(){
 state.meta=state.meta||{};
 return state.meta.valuationModeV532||"condition";
}
function marketSourceV532(e={},kind=""){
 if(kind==="new"){
   if(pV3(e.marketNewEUR))return e.bricklinkUpdated&&e.marketSourceFallback?"BrickLink · neu":"BrickEconomy · neu / OVP";
 }
 if(kind==="used"){
   if(pV3(e.marketUsedEUR))return e.bricklinkUpdated&&e.marketSourceFallback?"BrickLink · gebraucht":"BrickEconomy · gebraucht";
 }
 return e.marketSourceFallback||"Online-Katalog";
}
function marketChoiceV532(x,e={},mode=valuationModeV532()){
 const nu=pV3(e.marketNewEUR),us=pV3(e.marketUsedEUR);
 if(mode==="manual")return {value:pV3(x?.currentValue),kind:"manual",source:x?.valueSource||"Manuell",reason:"Manueller Sammlungswert"};
 if(mode==="new"){
   if(nu)return {value:nu,kind:"new",source:marketSourceV532(e,"new"),reason:"Bewertungsmodus Neu / OVP"};
   if(us)return {value:us,kind:"used",source:marketSourceV532(e,"used"),reason:"Neu-Wert fehlt · Gebrauchtwert als Fallback"};
 }
 if(mode==="used"){
   if(us)return {value:us,kind:"used",source:marketSourceV532(e,"used"),reason:"Bewertungsmodus Gebraucht"};
   if(nu)return {value:nu,kind:"new",source:marketSourceV532(e,"new"),reason:"Gebrauchtwert fehlt · Neu-Wert als Fallback"};
 }
 const cond=nV3(x?.condition||x?.buildStatus||"");
 const wantsNew=cond.includes("neu")||cond.includes("ovp");
 if(wantsNew&&nu)return {value:nu,kind:"new",source:marketSourceV532(e,"new"),reason:"Zustand Neu / OVP"};
 if(!wantsNew&&us)return {value:us,kind:"used",source:marketSourceV532(e,"used"),reason:"Zustand Gebraucht"};
 if(nu)return {value:nu,kind:"new",source:marketSourceV532(e,"new"),reason:"Passender Gebrauchtwert fehlt · Neu-Wert verwendet"};
 if(us)return {value:us,kind:"used",source:marketSourceV532(e,"used"),reason:"Passender Neu-Wert fehlt · Gebrauchtwert verwendet"};
 return {value:0,kind:"none",source:"Keine Marktdaten",reason:"Für dieses Set liegt noch kein Online-Marktwert vor"};
}
chooseMarketV3=function(x,e){
 return marketChoiceV532(x,e).value;
};
function priceAuditCheckV532(e={}){
 const nu=pV3(e.marketNewEUR),us=pV3(e.marketUsedEUR),lo=pV3(e.marketUsedLowEUR),hi=pV3(e.marketUsedHighEUR);
 const issues=[];
 if(!nu&&!us)issues.push("Keine Marktdaten");
 if(lo&&us&&lo>us)issues.push("Gebrauchtwert unter Minimum");
 if(hi&&us&&hi<us)issues.push("Gebrauchtwert über Maximum");
 if(nu&&us&&us>nu*1.25)issues.push("Gebraucht deutlich über Neu");
 return issues;
}
function renderPriceAuditStatusV532(){
 const box=$("priceAuditStatusV532");if(!box)return;
 const a=state.meta?.priceAuditV532;
 const mode=valuationModeV532();
 const modeLabel={condition:"zustandsgerecht",used:"gebraucht",new:"neu / OVP",manual:"manuell"}[mode]||mode;
 if(!a){
   box.innerHTML='<span>Bewertung: <b>'+esc(modeLabel)+'</b></span><small>Noch keine vollständige Prüfung in dieser Sitzung.</small>';
   return;
 }
 box.innerHTML='<span>Bewertung: <b>'+esc(modeLabel)+'</b></span>'+
   '<span><b>'+a.checked+'</b> Sets geprüft</span>'+
   '<span><b>'+a.changed+'</b> Werte angepasst</span>'+
   '<span><b>'+a.missing+'</b> ohne Marktdaten</span>'+
   '<span><b>'+a.suspicious+'</b> auffällig</span>'+
   '<small>Letzte Prüfung: '+new Date(a.at).toLocaleString("de-DE")+'</small>';
}
async function auditAllPricesV532(showMessage=false,forceReload=true){
 if(typeof createSafetySnapshotV531==="function")createSafetySnapshotV531("Marktwert-Prüfung");
 if(forceReload)await loadEnrichmentV3(true);
 const mode=valuationModeV532(),now=new Date().toISOString();
 let checked=0,changed=0,missing=0,suspicious=0;
 const details=[];
 for(const x of state.collection||[]){
   const e=enrichmentV3.sets?.[String(x.setNumber)]||x.market||{};
   const choice=marketChoiceV532(x,e,mode),issues=priceAuditCheckV532(e);
   checked++;
   if(!choice.value)missing++;
   if(issues.length)suspicious++;
   if(mode!=="manual"&&choice.value&&x.marketAuto!==false&&Math.abs(pV3(x.currentValue)-choice.value)>0.004){
     x.currentValue=choice.value;changed++;
   }
   if(choice.value){
     x.valueSource=choice.source;
     x.valueReason=choice.reason;
     x.valueCheckedAt=now;
   }
   x.market={...(x.market||{}),...e};
   if(issues.length)details.push({setNumber:String(x.setNumber),issues});
 }
 state.meta=state.meta||{};
 state.meta.priceAuditV532={at:now,mode,checked,changed,missing,suspicious,details:details.slice(0,30)};
 persist();refresh();renderPricesV31();renderPriceAuditStatusV532();
 if(showMessage)alert("Wertprüfung abgeschlossen.\n\nSets geprüft: "+checked+"\nWerte angepasst: "+changed+"\nOhne Marktdaten: "+missing+"\nAuffällige Datensätze: "+suspicious);
 return state.meta.priceAuditV532;
}
window.auditAllPricesV532=auditAllPricesV532;

priceRowsV31=function(){
 const rows=[];
 for(const x of state.collection||[]){
   const e=enrichmentV3.sets?.[String(x.setNumber)]||x.market||{},choice=marketChoiceV532(x,e);
   rows.push({
     kind:"collection",setNumber:x.setNumber,name:x.name,purchase:pV3(x.purchasePrice),
     own:pV3(x.currentValue),newv:pV3(e.marketNewEUR),used:pV3(e.marketUsedEUR),
     low:pV3(e.marketUsedLowEUR),high:pV3(e.marketUsedHighEUR),market:choice.value,
     source:choice.source,reason:choice.reason,limit:0
   });
 }
 for(const w of state.wishlist||[]){
   const e=enrichmentV3.sets?.[String(w.setNumber)]||w.market||{},market=pV3(e.marketNewEUR)||pV3(e.marketUsedEUR);
   rows.push({
     kind:"wishlist",setNumber:w.setNumber,name:w.name,purchase:0,own:pV3(w.offer)||pV3(w.price),
     newv:pV3(e.marketNewEUR),used:pV3(e.marketUsedEUR),low:pV3(e.marketUsedLowEUR),high:pV3(e.marketUsedHighEUR),
     market,source:e.marketSourceFallback||"Online-Katalog",reason:"Wunschliste",limit:pV3(w.limit)
   });
 }
 return rows;
};
renderPricesV31=function(){
 const body=$("priceTableV30");if(!body)return;
 const q=nV3($("priceSearchV30")?.value),mode=$("priceModeV30")?.value||"all";
 const rows=priceRowsV31().filter(r=>(mode==="all"||r.kind===mode)&&(!q||nV3(r.setNumber+" "+r.name).includes(q)));
 const withMarket=rows.filter(r=>r.market).length,alerts=rows.filter(r=>r.kind==="wishlist"&&r.limit&&r.market&&r.market<=r.limit).length;
 const suspect=rows.filter(r=>{
   const e=enrichmentV3.sets?.[String(r.setNumber)]||{};return priceAuditCheckV532(e).length;
 }).length;
 if($("priceSummaryV30"))$("priceSummaryV30").innerHTML=
   '<div class="miniStat"><span>Einträge</span><b>'+rows.length+'</b></div>'+
   '<div class="miniStat"><span>mit Marktwert</span><b>'+withMarket+'</b></div>'+
   '<div class="miniStat"><span>auffällig</span><b>'+suspect+'</b></div>'+
   '<div class="miniStat"><span>unter Kaufgrenze</span><b>'+alerts+'</b></div>';
 body.innerHTML=rows.length?rows.map(r=>{
   const diff=r.kind==="collection"&&r.purchase&&r.market?r.market-r.purchase:0,pct=r.purchase&&diff?diff/r.purchase*100:0;
   let status="–";
   if(!r.market)status="Keine Marktdaten";
   else if(r.kind==="wishlist"&&r.limit)status=r.market<=r.limit?"🟢 unter Kaufgrenze":"🔴 über Kaufgrenze";
   else if(r.kind==="collection"&&r.purchase)status=diff>=0?"🟢 über Kaufpreis":"🔴 unter Kaufpreis";
   const range=r.low||r.high?((r.low?euro(r.low):"–")+" – "+(r.high?euro(r.high):"–")):"–";
   return '<tr><td><b>'+esc(r.setNumber)+'</b><br><small>'+(r.kind==="collection"?"Bestand":"Wunsch")+'</small></td>'+
     '<td>'+esc(r.name)+'</td><td>'+(r.purchase?euro(r.purchase):"–")+'</td><td><b>'+euro(r.market||r.own)+'</b><br><small>'+esc(r.reason||"")+'</small></td>'+
     '<td>'+euro(r.newv)+'</td><td>'+euro(r.used)+'</td><td>'+range+'</td>'+
     '<td>'+(diff?euro(diff):"–")+'</td><td>'+(diff?(pct>=0?"+":"")+pct.toFixed(1).replace(".",",")+" %":"–")+'</td>'+
     '<td><small>'+esc(r.source||"–")+'</small></td><td>'+esc(status)+'</td></tr>';
 }).join(""):'<tr><td colspan="11">Keine Einträge gefunden.</td></tr>';
 renderPriceAuditStatusV532();
};

function renderValuationDetailV532(x){
 const root=$("detailContent");if(!root||!x)return;
 let box=root.querySelector(".valuationDetailV532");
 if(!box){box=document.createElement("div");box.className="valuationDetailV532 card wide";root.appendChild(box)}
 const e=enrichmentV3.sets?.[String(x.setNumber)]||x.market||{},choice=marketChoiceV532(x,e);
 const range=(pV3(e.marketUsedLowEUR)||pV3(e.marketUsedHighEUR))
   ?((pV3(e.marketUsedLowEUR)?euro(e.marketUsedLowEUR):"–")+" – "+(pV3(e.marketUsedHighEUR)?euro(e.marketUsedHighEUR):"–")):"–";
 box.innerHTML='<div class="sectionHead"><div><span class="eyebrowV50">WERTBEWERTUNG</span><h3>Warum dieser Wert?</h3></div><b>'+euro(choice.value)+'</b></div>'+
   '<div class="detailFacts"><div class="fact"><small>Verwendeter Wert</small><b>'+euro(choice.value)+'</b></div>'+
   '<div class="fact"><small>Markt gebraucht</small><b>'+euro(e.marketUsedEUR)+'</b></div>'+
   '<div class="fact"><small>Markt neu / OVP</small><b>'+euro(e.marketNewEUR)+'</b></div>'+
   '<div class="fact"><small>Gebraucht-Spanne</small><b>'+esc(range)+'</b></div>'+
   '<div class="fact"><small>Quelle</small><b>'+esc(choice.source)+'</b></div>'+
   '<div class="fact"><small>Auswahlgrund</small><b>'+esc(choice.reason)+'</b></div></div>';
}
const detailTabsBaseV532=detailTabsV38;
detailTabsV38=function(n){
 const r=detailTabsBaseV532(n);
 const x=(state.collection||[]).find(y=>String(y.setNumber)===String(n));
 renderValuationDetailV532(x);
 return r;
};

function bindValuationV532(){
 const sel=$("valuationModeV532"),audit=$("auditPricesV532");
 if(sel){
   sel.value=valuationModeV532();
   sel.onchange=async()=>{
     state.meta=state.meta||{};state.meta.valuationModeV532=sel.value;persist();
     await auditAllPricesV532(false,false);
   };
 }
 if(audit)audit.onclick=()=>auditAllPricesV532(true,true);
}
const loadEnrichmentBaseV532=loadEnrichmentV3;
loadEnrichmentV3=async function(force=false){
 const r=await loadEnrichmentBaseV532(force);
 renderPriceAuditStatusV532();
 return r;
};
bindValuationV532();
setTimeout(async()=>{
 renderPriceAuditStatusV532();
 if(!state.meta?.priceAuditV532||state.meta.priceAuditV532.mode!==valuationModeV532()){
   await auditAllPricesV532(false,false);
 }
},650);


/* v50.33 collector-friendly valuation */
function collectorValueV533(x,e={}){
 const nu=pV3(e.marketNewEUR),us=pV3(e.marketUsedEUR),lo=pV3(e.marketUsedLowEUR),hi=pV3(e.marketUsedHighEUR);
 const cond=nV3(x?.condition||x?.buildStatus||"");
 if(cond.includes("neu")||cond.includes("ovp")){
   if(nu)return {value:nu,kind:"new",reason:"Sammlerwert · Neu / OVP = Neu-Marktwert"};
   if(hi||us)return {value:hi||us,kind:"used",reason:"Sammlerwert · Neu-Wert fehlt, obere Gebrauchtbewertung verwendet"};
 }
 if(cond.includes("unvollständig")){
   if(lo&&us)return {value:(lo+us)/2,kind:"used",reason:"Sammlerwert · gebraucht unvollständig = Mitte aus Minimum und Gebrauchtmarkt"};
   if(lo||us)return {value:lo||us,kind:"used",reason:"Sammlerwert · gebraucht unvollständig"};
 }
 if(cond.includes("vollständig")){
   let v=0;
   if(us&&hi)v=(us+hi)/2;
   else if(us)v=us*1.1;
   else if(hi)v=hi;
   if(nu&&v)v=Math.min(v,nu*0.95);
   if(v)return {value:v,kind:"used",reason:"Sammlerwert · gebraucht vollständig = obere Gebrauchtbewertung"};
 }
 if(us&&hi){
   let v=us*0.35+hi*0.65;
   if(nu)v=Math.min(v,nu*0.95);
   return {value:v,kind:"used",reason:"Sammlerwert · gebraucht = stärker gewichteter oberer Marktbereich"};
 }
 if(us){
   let v=us*1.08;
   if(nu)v=Math.min(v,nu*0.95);
   return {value:v,kind:"used",reason:"Sammlerwert · gebraucht = Marktwert mit moderatem Sammleraufschlag"};
 }
 if(hi)return {value:nu?Math.min(hi,nu*0.95):hi,kind:"used",reason:"Sammlerwert · obere Gebrauchtspanne"};
 if(nu)return {value:nu*0.9,kind:"new",reason:"Sammlerwert · nur Neu-Marktwert verfügbar, vorsichtiger Abschlag"};
 return {value:0,kind:"none",reason:"Keine Marktdaten"};
}

const marketChoiceBaseV533=marketChoiceV532;
marketChoiceV532=function(x,e={},mode=valuationModeV532()){
 if(mode==="collector"){
   const r=collectorValueV533(x,e);
   const source=r.kind==="new"?marketSourceV532(e,"new"):r.kind==="used"?marketSourceV532(e,"used"):"Keine Marktdaten";
   return {...r,source};
 }
 return marketChoiceBaseV533(x,e,mode);
};

function migrateCollectorModeV533(){
 state.meta=state.meta||{};
 if(state.meta.collectorModeMigrationV533)return;
 const old=state.meta.valuationModeV532||"condition";
 if(old==="condition"||!state.meta.valuationModeV532)state.meta.valuationModeV532="collector";
 state.meta.collectorModeMigrationV533=new Date().toISOString();
 persist();
}
migrateCollectorModeV533();

const bindValuationBaseV533=bindValuationV532;
bindValuationV532=function(){
 const r=bindValuationBaseV533();
 const sel=$("valuationModeV532");
 if(sel)sel.value=valuationModeV532();
 return r;
};

setTimeout(async()=>{
 const sel=$("valuationModeV532");if(sel)sel.value=valuationModeV532();
 if(valuationModeV532()==="collector")await auditAllPricesV532(false,false);
},900);


/* v50.34 Brickr quantity reconciliation */
function reconcileBrickrQuantitiesV534(){
 state.meta=state.meta||{};
 if(state.meta.brickrQtyReconcileV534)return;
 const wanted={"21045":3,"76453":2,"40680":2,"21338":2,"76415":2,"76388":2};
 let changed=0;
 for(const x of state.collection||[]){
   const n=String(x.setNumber||"").replace(/-\d+$/,"");
   const q=wanted[n];
   if(q && (+x.quantity||0)<q){ x.quantity=q; changed++; }
 }
 state.meta.brickrQtyReconcileV534={
   at:new Date().toISOString(),
   changed,
   expectedTotal:253,
   source:"Brickr Fotoabgleich"
 };
 persist();
}
reconcileBrickrQuantitiesV534();
setTimeout(()=>{try{renderAll?.();}catch(e){}},250);


/* v50.35 Sammlerwert = Durchschnitt aus Markt-Mittelwert und oberer Spanne */
collectorValueV533=function(x,e={}){
 const nu=pV3(e.marketNewEUR),us=pV3(e.marketUsedEUR),lo=pV3(e.marketUsedLowEUR),hi=pV3(e.marketUsedHighEUR);
 const cond=nV3(x?.condition||x?.buildStatus||"");
 if(cond.includes("neu")||cond.includes("ovp")){
   if(nu)return {value:nu,kind:"new",reason:"Sammlerwert · Neu / OVP = Neu-Marktwert"};
   if(hi||us)return {value:hi||us,kind:"used",reason:"Sammlerwert · Neu-Wert fehlt, obere Gebrauchtbewertung verwendet"};
 }
 if(cond.includes("unvollständig")){
   if(lo&&us)return {value:(lo+us)/2,kind:"used",reason:"Sammlerwert · unvollständig = Durchschnitt aus Untergrenze und Markt-Mittelwert"};
   if(lo||us)return {value:lo||us,kind:"used",reason:"Sammlerwert · unvollständig"};
 }
 if(us&&hi){
   let v=(us+hi)/2;
   if(nu)v=Math.min(v,nu*0.98);
   return {value:v,kind:"used",reason:"Sammlerwert · Durchschnitt aus Gebraucht-Mittelwert und oberer Marktspanne"};
 }
 if(us){
   let v=us;
   if(nu)v=Math.min(v,nu*0.98);
   return {value:v,kind:"used",reason:"Sammlerwert · Gebraucht-Mittelwert, da keine obere Spanne verfügbar"};
 }
 if(hi)return {value:nu?Math.min(hi,nu*0.98):hi,kind:"used",reason:"Sammlerwert · obere Gebrauchtspanne"};
 if(nu)return {value:nu*0.92,kind:"new",reason:"Sammlerwert · nur Neu-Marktwert verfügbar, moderater Abschlag"};
 return {value:0,kind:"none",reason:"Keine Marktdaten"};
};

function migrateValuationV535(){
 state.meta=state.meta||{};
 if(state.meta.valuationMigrationV535)return;
 state.meta.valuationModeV532="collector";
 state.meta.valuationMigrationV535=new Date().toISOString();
 persist();
}
migrateValuationV535();
setTimeout(async()=>{
 try{
   await auditAllPricesV532(false,false);
   renderPricesV31();
   refresh();
 }catch(e){}
},1100);


/* v50.36 Intelligence Pack: Markt, Vertrauen, Referenzbestand, Exemplare, Ziele, Journal */
function qtyTotalV536(){return (state.collection||[]).reduce((s,x)=>s+(pV3(x.quantity)||0),0)}
function setKeyV536(n){return String(n||"").replace(/-\d+$/,"")}
function enrichmentForV536(x){return enrichmentV3?.sets?.[setKeyV536(x?.setNumber)]||x?.market||{}}
function quoteSourcesV536(x){
 const e=enrichmentForV536(x),out=[];
 const used=pV3(e.marketUsedEUR),high=pV3(e.marketUsedHighEUR),low=pV3(e.marketUsedLowEUR),nu=pV3(e.marketNewEUR);
 if(used||high||low||nu)out.push({source:"BrickEconomy",used,newv:nu,low,high,updated:e.brickeconomyUpdated||e.updatedAt||""});
 const blu=pV3(e.bricklinkUsedEUR||e.bricklinkUsedAvgEUR||e.bricklinkAvgUsedEUR);
 const bln=pV3(e.bricklinkNewEUR||e.bricklinkNewAvgEUR||e.bricklinkAvgNewEUR);
 const bll=pV3(e.bricklinkUsedLowEUR),blh=pV3(e.bricklinkUsedHighEUR);
 if(blu||bln||bll||blh)out.push({source:"BrickLink",used:blu,newv:bln,low:bll,high:blh,updated:e.bricklinkUpdated||""});
 const ref=pV3(x?.portalReferenceValue);
 if(ref)out.push({source:x.portalReferenceSource||"Portal-Referenz",used:ref,newv:0,low:0,high:0,updated:x.portalReferenceDate||""});
 return out;
}
function confidenceV536(x){
 const e=enrichmentForV536(x),src=quoteSourcesV536(x);
 const vals=[];
 for(const s of src)for(const v of [s.used,s.high,s.newv])if(pV3(v))vals.push(pV3(v));
 let score=src.length>=3?92:src.length===2?82:src.length===1?66:20;
 if(vals.length>=2){const mn=Math.min(...vals),mx=Math.max(...vals),spread=mn?((mx-mn)/mn):1;if(spread>.7)score-=22;else if(spread>.4)score-=12;else if(spread<.18)score+=5}
 const stamp=e.brickeconomyUpdated||e.updatedAt||"";
 if(stamp){const age=(Date.now()-new Date(stamp).getTime())/86400000;if(age>60)score-=15;else if(age>30)score-=8}
 if(!(pV3(e.marketUsedEUR)||pV3(e.marketNewEUR)))score-=15;
 score=Math.max(5,Math.min(99,Math.round(score)));
 return {score,label:score>=80?"hoch":score>=60?"mittel":"niedrig",sources:src.length};
}
function bandForSetV536(x){
 const e=enrichmentForV536(x),q=Math.max(1,pV3(x.quantity)||1),choice=marketChoiceV532(x,e),c=pV3(choice.value)||pV3(x.currentValue);
 let low=pV3(e.marketUsedLowEUR)||pV3(e.marketUsedEUR)||c,high=pV3(e.marketUsedHighEUR)||pV3(e.marketNewEUR)||c;
 if(low&&high&&low>high)[low,high]=[high,low];
 if(!low)low=c;if(!high)high=c;
 return {low:low*q,mid:c*q,high:high*q};
}
function portfolioBandV536(){
 return (state.collection||[]).reduce((a,x)=>{const b=bandForSetV536(x);a.low+=b.low;a.mid+=b.mid;a.high+=b.high;return a},{low:0,mid:0,high:0});
}
function trendFromRowsV536(rows,days){
 if(!Array.isArray(rows)||rows.length<2)return null;
 const now=Date.now(),cut=now-days*86400000;
 const sorted=rows.map(r=>({t:new Date(r.date||r.updatedAt||0).getTime(),v:pV3(r.currentEUR)||pV3(r.value)||pV3(r.usedEUR)||pV3(r.newEUR)})).filter(r=>r.t&&r.v).sort((a,b)=>a.t-b.t);
 if(sorted.length<2)return null;
 const end=sorted[sorted.length-1],start=[...sorted].reverse().find(r=>r.t<=cut)||sorted[0];
 if(!start?.v)return null;
 return {abs:end.v-start.v,pct:(end.v-start.v)/start.v*100,start:start.v,end:end.v};
}
function setTrendV536(x,days=365){return trendFromRowsV536(state.priceHistory?.[setKeyV536(x.setNumber)]||[],days)}
function portfolioHighlightsV536(){
 const rows=(state.collection||[]).map(x=>{
   const q=Math.max(1,pV3(x.quantity)||1),value=pV3(x.currentValue)*q,invest=pV3(x.purchasePrice)*q,gain=value-invest,tr=setTrendV536(x,365);
   return {x,value,invest,gain,pct:invest?gain/invest*100:0,trend:tr?.pct??null};
 });
 const by=(k)=>[...rows].sort((a,b)=>(b[k]??-1e9)-(a[k]??-1e9))[0];
 return {value:by("value"),gain:by("gain"),pct:by("pct"),trend:[...rows].filter(r=>r.trend!==null).sort((a,b)=>b.trend-a.trend)[0]||null};
}
function ensureJournalV536(){state.meta=state.meta||{};state.meta.changeJournalV536=state.meta.changeJournalV536||[]}
function journalAddV536(type,title,detail=""){
 ensureJournalV536();const j=state.meta.changeJournalV536;
 j.unshift({at:new Date().toISOString(),type,title,detail});if(j.length>80)j.length=80;
}
function journalDetectV536(){
 ensureJournalV536();
 const band=portfolioBandV536(),sig={qty:qtyTotalV536(),unique:(state.collection||[]).length,value:Math.round(band.mid)};
 const prev=state.meta.journalSignatureV536;
 if(prev){
   if(sig.qty!==prev.qty)journalAddV536("Bestand","Bestand geändert",(sig.qty>prev.qty?"+":"")+(sig.qty-prev.qty)+" Exemplare · jetzt "+sig.qty);
   const dv=sig.value-prev.value;if(Math.abs(dv)>=25)journalAddV536("Marktwert","Portfolio neu bewertet",(dv>0?"+":"")+euro(dv)+" · jetzt "+euro(sig.value));
 }
 state.meta.journalSignatureV536=sig;
}
function ensureExemplarIdsV536(){
 let changed=false;
 for(const x of state.collection||[]){
   x.exemplars=x.exemplars||[];
   const q=Math.max(1,pV3(x.quantity)||1);
   while(x.exemplars.length<q){x.exemplars.push({id:setKeyV536(x.setNumber)+"-"+(x.exemplars.length+1),legacy:true,date:x.purchaseDate||"",seller:x.seller||"",condition:x.condition||"Gebraucht",price:pV3(x.purchasePrice),shipping:0,box:"",complete:"",storage:x.storage||"",module:"",note:"Bestand automatisch getrennt"});changed=true}
   x.exemplars.forEach((e,i)=>{if(!e.id){e.id=setKeyV536(x.setNumber)+"-"+(i+1);changed=true}if(e.module===undefined){e.module="";changed=true}});
 }
 return changed;
}
function ensureInventoryReferenceV536(){
 state.meta=state.meta||{};
 if(state.meta.inventoryReferenceV536)return;
 if(qtyTotalV536()!==253)return;
 const quantities={};for(const x of state.collection||[])quantities[setKeyV536(x.setNumber)]=pV3(x.quantity);
 state.meta.inventoryReferenceV536={label:"Brickr-Referenz 07.10.2026",createdAt:new Date().toISOString(),total:253,quantities};
 journalAddV536("Referenz","Brickr-Referenzbestand gespeichert","253 Exemplare");
}
function inventoryDiffV536(){
 const ref=state.meta?.inventoryReferenceV536;if(!ref)return [];
 const cur={};for(const x of state.collection||[])cur[setKeyV536(x.setNumber)]=pV3(x.quantity);
 const keys=new Set([...Object.keys(ref.quantities||{}),...Object.keys(cur)]);
 return [...keys].map(n=>({setNumber:n,ref:pV3(ref.quantities?.[n]),cur:pV3(cur[n])})).filter(r=>r.ref!==r.cur).sort((a,b)=>Math.abs(b.cur-b.ref)-Math.abs(a.cur-a.ref));
}
function resetInventoryReferenceV536(){
 if(!confirm("Aktuellen Bestand als neue Referenz speichern?"))return;
 const quantities={};for(const x of state.collection||[])quantities[setKeyV536(x.setNumber)]=pV3(x.quantity);
 state.meta.inventoryReferenceV536={label:"Eigene Referenz",createdAt:new Date().toISOString(),total:qtyTotalV536(),quantities};journalAddV536("Referenz","Bestandsreferenz aktualisiert",qtyTotalV536()+" Exemplare");persist();renderIntelligenceV536();
}
window.resetInventoryReferenceV536=resetInventoryReferenceV536;

function setPortalReferenceV536(n){
 const x=(state.collection||[]).find(y=>setKeyV536(y.setNumber)===setKeyV536(n));if(!x)return;
 const v=prompt("Vergleichswert eines anderen Portals für "+x.setNumber+" in €:",x.portalReferenceValue||"");if(v===null)return;
 const num=Number(String(v).replace(",","."));
 if(!Number.isFinite(num)||num<0)return alert("Bitte einen gültigen Euro-Wert eingeben.");
 const src=prompt("Quelle / Portal: ",x.portalReferenceSource||"Brickr")||"Portal-Referenz";
 x.portalReferenceValue=num;x.portalReferenceSource=src;x.portalReferenceDate=new Date().toISOString().slice(0,10);
 journalAddV536("Portalvergleich",x.setNumber+" Referenzwert gespeichert",src+" · "+euro(num));persist();showDetailV3(x.setNumber);
}
window.setPortalReferenceV536=setPortalReferenceV536;

function sourceTableV536(x){
 const src=quoteSourcesV536(x);
 if(!src.length)return '<p class="hint">Noch keine Marktquelle verfügbar.</p>';
 return '<div class="sourceGridV536">'+src.map(s=>'<div><b>'+esc(s.source)+'</b><span>Gebraucht '+(s.used?euro(s.used):"–")+'</span><span>Neu '+(s.newv?euro(s.newv):"–")+'</span><span>Spanne '+(s.low||s.high?((s.low?euro(s.low):"–")+" – "+(s.high?euro(s.high):"–")):"–")+'</span></div>').join("")+'</div>';
}
function renderDetailIntelligenceV536(x){
 const root=$("detailContent");if(!root||!x)return;
 root.querySelectorAll(".intelDetailV536").forEach(e=>e.remove());
 const conf=confidenceV536(x),e=enrichmentForV536(x),choice=marketChoiceV532(x,e),ref=pV3(x.portalReferenceValue),delta=ref&&choice.value?choice.value-ref:0;
 const card=document.createElement("div");card.className="card wide intelDetailV536";
 card.innerHTML='<div class="sectionHead"><div><span class="eyebrowV50">MARKT-INTELLIGENCE</span><h3>Quellen & Preisvertrauen</h3></div><div class="confidenceV536 c'+conf.label+'"><b>'+conf.score+'%</b><small>'+conf.label+'</small></div></div>'+
 sourceTableV536(x)+
 '<div class="detailFacts"><div class="fact"><small>Sammlerwert</small><b>'+euro(choice.value)+'</b></div><div class="fact"><small>Portal-Referenz</small><b>'+(ref?euro(ref):"–")+'</b></div><div class="fact"><small>Abweichung</small><b>'+(ref?(delta>=0?"+":"")+euro(delta):"–")+'</b></div><div class="fact"><small>Marktquellen</small><b>'+conf.sources+'</b></div></div>'+
 '<div class="actions"><button class="btn secondary" onclick="setPortalReferenceV536(\''+esc(x.setNumber)+'\')">'+(ref?"Portalwert ändern":"Portalwert erfassen")+'</button></div>';
 root.appendChild(card);
}
const detailBaseV536=showDetailV3;
showDetailV3=function(n){detailBaseV536(n);const x=(state.collection||[]).find(y=>setKeyV536(y.setNumber)===setKeyV536(n));renderDetailIntelligenceV536(x)};

function instancePlannerV536(){
 state.meta=state.meta||{};state.meta.instanceModulesV536=state.meta.instanceModulesV536||{};
 return state.meta.instanceModulesV536;
}
function autoPlaceInstancesV536(){
 const map=instancePlannerV536(),allMods=[];
 for(let i=1;i<=40;i++)allMods.push("M"+String(i).padStart(2,"0"));
 const used=new Set(Object.values(map).flat());
 let assigned=0;
 for(const x of state.collection||[]){
   const q=Math.max(1,pV3(x.quantity)||1);
   if(q<2)continue;
   for(let i=0;i<q;i++){
     const key=setKeyV536(x.setNumber)+"#"+(i+1);if(map[key]?.length)continue;
     const need=moduleNeedV528(x)?.count||1,free=allMods.filter(m=>!used.has(m)).slice(0,need);
     if(free.length===need){map[key]=free;free.forEach(m=>used.add(m));assigned++}
   }
 }
 journalAddV536("Stadtplanung","Exemplare automatisch eingeplant",assigned+" neue Exemplar-Platzierungen");persist();renderIntelligenceV536();
}
window.autoPlaceInstancesV536=autoPlaceInstancesV536;
function clearInstancePlanV536(){
 if(!confirm("Separate Exemplar-Platzierungen wirklich löschen?"))return;
 state.meta.instanceModulesV536={};journalAddV536("Stadtplanung","Exemplar-Platzierungen zurückgesetzt","");persist();renderIntelligenceV536();
}
window.clearInstancePlanV536=clearInstancePlanV536;

function renderHomeExecutiveV536(){
 const home=$("home");if(!home)return;
 let box=$("executiveV536");
 if(!box){box=document.createElement("div");box.id="executiveV536";box.className="executiveV536";const hero=home.querySelector(".heroV50");hero?.insertAdjacentElement("afterend",box)}
 const b=portfolioBandV536(),d=inventoryDiffV536(),h=portfolioHighlightsV536(),confRows=(state.collection||[]).map(confidenceV536),avg=confRows.length?Math.round(confRows.reduce((s,c)=>s+c.score,0)/confRows.length):0;
 box.innerHTML='<div class="execHeadV536"><div><span class="eyebrowV50">EXECUTIVE SUMMARY</span><h2>Deine Sammlung in vier Zahlen</h2></div><button class="btn secondary" id="toggleTechV536">Technische Details</button></div>'+
 '<div class="execGridV536"><div><span>Sammlerwert</span><b>'+euro(b.mid)+'</b><small>realistisch '+euro(b.low)+' – '+euro(b.high)+'</small></div><div><span>Bestand</span><b>'+qtyTotalV536()+'</b><small>'+(d.length?d.length+" Abweichungen zur Referenz":"✓ Referenzbestand passt")+'</small></div><div><span>Preisvertrauen</span><b>'+avg+'%</b><small>'+((state.collection||[]).filter(x=>confidenceV536(x).score<60).length)+' Sets prüfen</small></div><div><span>Top-Wert</span><b>'+(h.value?euro(h.value.value):"–")+'</b><small>'+(h.value?esc(h.value.x.setNumber+" "+h.value.x.name):"–")+'</small></div></div>';
 const btn=$("toggleTechV536");if(btn)btn.onclick=()=>{
   const tech=[home.querySelector(".commandGridV50"),home.querySelector(".megaAutopilotV530")].filter(Boolean);
   const hidden=tech.every(e=>e.classList.contains("intelHiddenV536"));tech.forEach(e=>e.classList.toggle("intelHiddenV536",!hidden));btn.textContent=hidden?"Technische Details ausblenden":"Technische Details";
 };
}
function ensurePanelCardV536(panelId,id,title,html){
 const panel=$(panelId);if(!panel)return null;let box=$(id);if(!box){box=document.createElement("div");box.id=id;box.className="card wide intelligenceCardV536";panel.appendChild(box)}
 box.innerHTML='<div class="sectionHead"><div><span class="eyebrowV50">BRICK CITY INTELLIGENCE</span><h2>'+title+'</h2></div></div>'+html;return box;
}
function renderAnalysisIntelV536(){
 const b=portfolioBandV536(),h=portfolioHighlightsV536(),ph=state.meta?.portfolioHistory||[];
 const t30=trendFromRowsV536(ph,30),t180=trendFromRowsV536(ph,180),t365=trendFromRowsV536(ph,365);
 const fmt=t=>t?((t.pct>=0?"+":"")+t.pct.toFixed(1).replace(".",",")+" %"):"noch offen";
 const lows=(state.collection||[]).map(x=>({x,c:confidenceV536(x)})).sort((a,b)=>a.c.score-b.c.score).slice(0,8);
 ensurePanelCardV536("analysis","marketIntelV536","Marktwert, Korridor & Vertrauen",
 '<div class="execGridV536"><div><span>Unterer Korridor</span><b>'+euro(b.low)+'</b></div><div><span>Sammlerwert</span><b>'+euro(b.mid)+'</b></div><div><span>Obere Spanne</span><b>'+euro(b.high)+'</b></div><div><span>12-Monats-Trend</span><b>'+fmt(t365)+'</b></div></div>'+
 '<div class="trendStripV536"><span>30 Tage <b>'+fmt(t30)+'</b></span><span>6 Monate <b>'+fmt(t180)+'</b></span><span>12 Monate <b>'+fmt(t365)+'</b></span></div>'+
 '<h3>Portfolio-Highlights</h3><div class="highlightGridV536">'+
 (h.value?'<div><span>Höchster Gesamtwert</span><b>'+esc(h.value.x.setNumber)+'</b><small>'+esc(h.value.x.name)+' · '+euro(h.value.value)+'</small></div>':"")+
 (h.gain?'<div><span>Größter Gewinn</span><b>'+esc(h.gain.x.setNumber)+'</b><small>'+euro(h.gain.gain)+'</small></div>':"")+
 (h.pct?'<div><span>Beste Rendite</span><b>'+esc(h.pct.x.setNumber)+'</b><small>'+(h.pct.pct>=0?"+":"")+h.pct.pct.toFixed(1).replace(".",",")+' %</small></div>':"")+
 (h.trend?'<div><span>Stärkster 12M-Trend</span><b>'+esc(h.trend.x.setNumber)+'</b><small>'+(h.trend.trend>=0?"+":"")+h.trend.trend.toFixed(1).replace(".",",")+' %</small></div>':"")+'</div>'+
 '<h3>Niedrigstes Preisvertrauen</h3><div class="confidenceListV536">'+lows.map(r=>'<button class="miniSet" onclick="showDetailV3(\''+esc(r.x.setNumber)+'\')"><b>'+esc(r.x.setNumber)+'</b><span>'+r.c.score+'% · '+esc(r.c.label)+'</span></button>').join("")+'</div>');
}
function renderPricesIntelV536(){
 const rows=(state.collection||[]).map(x=>({x,src:quoteSourcesV536(x),c:confidenceV536(x),choice:marketChoiceV532(x,enrichmentForV536(x))})).filter(r=>r.src.length||r.choice.value).sort((a,b)=>a.c.score-b.c.score).slice(0,25);
 ensurePanelCardV536("prices","sourceCompareV536","Mehrquellen-Preisvergleich",
 '<p class="hint">BrickEconomy ist aktiv. BrickLink wird automatisch ergänzt, sobald die Schnittstelle Daten liefert. Portalwerte kannst du im Set-Detail hinterlegen.</p>'+
 '<div class="intelTableWrapV536"><table class="intelTableV536"><thead><tr><th>Set</th><th>Sammlerwert</th><th>Quellen</th><th>Vertrauen</th><th>Vergleich</th></tr></thead><tbody>'+
 rows.map(r=>'<tr><td><button class="linkbtn" onclick="showDetailV3(\''+esc(r.x.setNumber)+'\')"><b>'+esc(r.x.setNumber)+'</b><br>'+esc(r.x.name)+'</button></td><td>'+euro(r.choice.value)+'</td><td>'+r.src.map(s=>esc(s.source)).join("<br>")+'</td><td><b>'+r.c.score+'%</b><br><small>'+esc(r.c.label)+'</small></td><td>'+r.src.map(s=>'<small>'+esc(s.source)+': '+euro(s.used||s.newv)+'</small>').join("<br>")+'</td></tr>').join("")+
 '</tbody></table></div>');
}
function renderInventoryV536(){
 const ref=state.meta?.inventoryReferenceV536,d=inventoryDiffV536();
 ensurePanelCardV536("analysis","inventoryAuditV536","Automatischer Bestandsabgleich",
 '<div class="detailFacts"><div class="fact"><small>Aktueller Bestand</small><b>'+qtyTotalV536()+'</b></div><div class="fact"><small>Referenz</small><b>'+(ref?ref.total:"–")+'</b></div><div class="fact"><small>Abweichungen</small><b>'+d.length+'</b></div><div class="fact"><small>Status</small><b>'+(ref?(d.length?"⚠ prüfen":"✓ identisch"):"Referenz fehlt")+'</b></div></div>'+
 (d.length?'<div class="confidenceListV536">'+d.slice(0,20).map(r=>'<div class="diffRowV536"><b>'+esc(r.setNumber)+'</b><span>Referenz '+r.ref+' → aktuell '+r.cur+'</span><strong>'+(r.cur-r.ref>0?"+":"")+(r.cur-r.ref)+'</strong></div>').join("")+'</div>':'<p class="hint">Der aktuelle Bestand entspricht der gespeicherten Referenz.</p>')+
 '<div class="actions"><button class="btn secondary" onclick="resetInventoryReferenceV536()">Aktuellen Bestand als Referenz setzen</button></div>');
}
function renderInstancePlannerV536(){
 const multi=(state.collection||[]).filter(x=>pV3(x.quantity)>1),map=instancePlannerV536();
 const total=multi.reduce((s,x)=>s+pV3(x.quantity),0),placed=Object.keys(map).length;
 ensurePanelCardV536("city","instancePlannerV536","Separate Stadtplanung je Exemplar",
 '<div class="detailFacts"><div class="fact"><small>Mehrfach-Sets</small><b>'+multi.length+'</b></div><div class="fact"><small>Einzel-Exemplare</small><b>'+total+'</b></div><div class="fact"><small>Separat platziert</small><b>'+placed+'</b></div></div>'+
 '<div class="confidenceListV536">'+multi.slice(0,20).map(x=>{const q=pV3(x.quantity),n=[...Array(q)].filter((_,i)=>map[setKeyV536(x.setNumber)+"#"+(i+1)]?.length).length;return '<div class="diffRowV536"><b>'+esc(x.setNumber)+'</b><span>'+esc(x.name)+'</span><strong>'+n+'/'+q+'</strong></div>'}).join("")+'</div>'+
 '<div class="actions"><button class="btn" onclick="autoPlaceInstancesV536()">Mehrfach-Sets automatisch platzieren</button><button class="btn secondary" onclick="clearInstancePlanV536()">Exemplar-Plan zurücksetzen</button></div>');
}
function renderCollectorGoalsV536(){
 const defs=collectorFeaturedDefsV504?.()||[];
 const goals=[];
 for(const d of defs){
   const nums=d.setNumbers||[];
   if(!nums.length)continue;
   const owned=nums.filter(n=>(state.collection||[]).some(x=>setKeyV536(x.setNumber)===String(n))).length,missing=nums.filter(n=>!(state.collection||[]).some(x=>setKeyV536(x.setNumber)===String(n)));
   goals.push({label:d.label,owned,total:nums.length,missing});
 }
 goals.sort((a,b)=>(b.owned/b.total)-(a.owned/a.total));
 ensurePanelCardV536("collector","collectorGoalsV536","Sammler-Ziele",
 '<div class="goalGridV536">'+goals.map(g=>'<div><span>'+esc(g.label)+'</span><b>'+g.owned+'/'+g.total+'</b><div class="commandBarV50"><i style="width:'+Math.round(g.owned/g.total*100)+'%"></i></div><small>'+(g.missing.length?g.missing.length+" fehlen":"✓ komplett")+'</small></div>').join("")+'</div>');
}
function renderJournalV536(){
 ensureJournalV536();const j=state.meta.changeJournalV536||[];
 const html='<p class="hint">Automatisches Änderungsjournal für Bestand, Marktwerte, Referenzen und Stadtplanung.</p><div class="journalV536">'+(j.length?j.slice(0,30).map(r=>'<div><time>'+esc(new Date(r.at).toLocaleString("de-DE"))+'</time><b>'+esc(r.title)+'</b><span>'+esc(r.detail||r.type)+'</span></div>').join(""):'<p>Noch keine Änderungen protokolliert.</p>')+'</div>';
 ensurePanelCardV536("settings","journalCardV536","Änderungsjournal",html);
}
function renderIntelligenceV536(){
 ensureExemplarIdsV536();ensureInventoryReferenceV536();
 renderHomeExecutiveV536();renderAnalysisIntelV536();renderPricesIntelV536();renderInventoryV536();renderInstancePlannerV536();renderCollectorGoalsV536();renderJournalV536();
}
const refreshBaseV536=refresh;
refresh=function(){
 ensureExemplarIdsV536();ensureInventoryReferenceV536();journalDetectV536();
 const r=refreshBaseV536();setTimeout(renderIntelligenceV536,0);return r;
};
const auditBaseV536=auditAllPricesV532;
auditAllPricesV532=async function(force=false,announce=false){
 const before=portfolioBandV536().mid,r=await auditBaseV536(force,announce),after=portfolioBandV536().mid;
 if(Math.abs(after-before)>=1)journalAddV536("Marktwert","Marktwerte neu berechnet",(after-before>=0?"+":"")+euro(after-before));
 persist();renderIntelligenceV536();return r;
};
window.auditAllPricesV532=auditAllPricesV532;

function migrateV536(){
 state.meta=state.meta||{};
 if(state.meta.intelligenceV536)return;
 ensureExemplarIdsV536();
 if(qtyTotalV536()===253)ensureInventoryReferenceV536();
 state.meta.intelligenceV536={at:new Date().toISOString(),version:"50.36"};
 journalAddV536("System","Intelligence Pack aktiviert","Mehrquellenpreise · Wertband · Vertrauen · Referenzbestand · Exemplarplanung · Journal");
 persist();
}
migrateV536();
setTimeout(renderIntelligenceV536,700);


/* v50.37 Startseite: neue Premium-KPI-Darstellung */
renderHomeExecutiveV536=function(){
 const home=$("home");if(!home)return;
 let box=$("executiveV536");
 if(!box){box=document.createElement("div");box.id="executiveV536";box.className="executiveV536";const hero=home.querySelector(".heroV50");hero?.insertAdjacentElement("afterend",box)}
 const b=portfolioBandV536(),d=inventoryDiffV536(),h=portfolioHighlightsV536(),confRows=(state.collection||[]).map(confidenceV536),avg=confRows.length?Math.round(confRows.reduce((s,c)=>s+c.score,0)/confRows.length):0;
 const lowTrust=(state.collection||[]).filter(x=>confidenceV536(x).score<60).length;
 const topLabel=h.value?esc(h.value.x.setNumber+" · "+h.value.x.name):"–";
 box.innerHTML=
 '<div class="execHeadV537"><div><span class="eyebrowV50">PORTFOLIO AUF EINEN BLICK</span><h2>Deine wichtigsten Zahlen</h2></div><button class="execTechBtnV537" id="toggleTechV536">Details</button></div>'+
 '<div class="execRailV537">'+
   '<article class="execHeroCardV537"><div class="execIconV537">€</div><div class="execCopyV537"><span>Sammlerwert</span><b>'+euro(b.mid)+'</b><small>Marktspanne '+euro(b.low)+' – '+euro(b.high)+'</small></div><div class="execAccentV537"></div></article>'+
   '<article class="execMetricV537"><div class="execIconV537">▦</div><div class="execCopyV537"><span>Bestand</span><b>'+qtyTotalV536()+'</b><small>'+(d.length?d.length+" Abweichungen zur Referenz":"Referenzbestand vollständig")+'</small></div></article>'+
   '<article class="execMetricV537"><div class="execIconV537">✓</div><div class="execCopyV537"><span>Preisvertrauen</span><b>'+avg+'%</b><small>'+lowTrust+' Sets mit Prüfbedarf</small></div><div class="execTrustBarV537"><i style="width:'+avg+'%"></i></div></article>'+
   '<article class="execMetricV537"><div class="execIconV537">★</div><div class="execCopyV537"><span>Top-Wert</span><b>'+(h.value?euro(h.value.value):"–")+'</b><small>'+topLabel+'</small></div></article>'+
 '</div>';
 const btn=$("toggleTechV536");if(btn)btn.onclick=()=>{
   const tech=[home.querySelector(".commandGridV50"),home.querySelector(".megaAutopilotV530")].filter(Boolean);
   const hidden=tech.every(e=>e.classList.contains("intelHiddenV536"));tech.forEach(e=>e.classList.toggle("intelHiddenV536",!hidden));btn.textContent=hidden?"Details ausblenden":"Details";
 };
};
setTimeout(renderHomeExecutiveV536,250);


/* v50.38 UX Upgrade: Sammlung, Details, Prüfung, Top-10, Einkauf, Suche, Mobile */
function priceSignalV538(x){
 const e=enrichmentForV536(x),c=confidenceV536(x),choice=marketChoiceV532(x,e),v=pV3(choice.value),lo=pV3(e.marketUsedLowEUR),hi=pV3(e.marketUsedHighEUR),nu=pV3(e.marketNewEUR);
 if(!v)return {label:"Keine Daten",cls:"unknown",note:"Marktwert fehlt"};
 if(c.score<55)return {label:"Unsicher",cls:"warn",note:"Datenlage prüfen"};
 if(lo&&v<=lo*1.04)return {label:"Günstig",cls:"good",note:"am unteren Marktbereich"};
 if(hi&&v>=hi*.94)return {label:"Hoch",cls:"high",note:"nahe oberer Marktspanne"};
 if(nu&&v>nu*.95)return {label:"Hoch",cls:"high",note:"nahe Neu-Markt"};
 return {label:"Fair",cls:"fair",note:"im realistischen Marktbereich"};
}
function miniTrendV538(x){
 const h=state.priceHistory?.[setKeyV536(x.setNumber)]||[];
 const vals=h.map(r=>pV3(r.currentEUR)||pV3(r.value)||pV3(r.usedEUR)||pV3(r.newEUR)).filter(Boolean).slice(-12);
 if(vals.length<2)return "";
 const min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;
 const pts=vals.map((v,i)=>((i/(vals.length-1))*100).toFixed(1)+","+((28-(v-min)/span*24)).toFixed(1)).join(" ");
 return '<svg class="miniTrendV538" viewBox="0 0 100 32" preserveAspectRatio="none"><polyline points="'+pts+'" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';
}
function conditionShortV538(x){
 const s=String(x.condition||"Gebraucht");
 if(/neu|ovp/i.test(s))return "Neu / OVP";
 if(/unvoll/i.test(s))return "Unvollständig";
 if(/voll/i.test(s))return "Gebraucht komplett";
 return "Gebraucht";
}
renderCollection=function(){
 const data=filteredV3(),list=document.querySelector("#collection .tablewrap"),grid=$("collectionGrid");if(!grid)return;
 list?.classList.add("collectionTableLegacyV538");
 grid.classList.remove("hidden");
 if($("toggleView"))$("toggleView").textContent="☷ Kompakt";
 const total=data.reduce((s,x)=>s+pV3(x.quantity),0),value=data.reduce((s,x)=>s+pV3(x.quantity)*pV3(x.currentValue),0);
 let head=$("collectionSummaryV538");
 if(!head){head=document.createElement("div");head.id="collectionSummaryV538";head.className="collectionSummaryV538";document.querySelector("#collection .toolbar")?.insertAdjacentElement("afterend",head)}
 head.innerHTML='<div><span>Gefunden</span><b>'+data.length+'</b><small>'+total+' Exemplare</small></div><div><span>Wert</span><b>'+euro(value)+'</b><small>aktuelle Auswahl</small></div><div><span>Ansicht</span><b>Sammlerkarten</b><small>Zustand · Lagerort · Markt</small></div>';
 grid.innerHTML=data.length?data.map(x=>{
   const sig=priceSignalV538(x),conf=confidenceV536(x),q=pV3(x.quantity);
   return '<article class="setcard setcardV538" onclick="showDetailV3(\''+esc(x.setNumber)+'\')">'+
    '<div class="setVisualV538">'+(x.imageUrl?'<img src="'+esc(x.imageUrl)+'" alt="">':'<div class="setFallbackV538">LEGO<br>'+esc(x.setNumber)+'</div>')+
    '<span class="marketPillV538 '+sig.cls+'">'+esc(sig.label)+'</span>'+(q>1?'<b class="qtyBadgeV538">×'+q+'</b>':'')+'</div>'+
    '<div class="setBodyV538"><div class="setNoV538">'+esc(x.setNumber)+'</div><h3>'+esc(x.name)+'</h3>'+
    '<div class="setMetaV538"><span>'+esc(conditionShortV538(x))+'</span><span>'+esc(x.storage||"Lagerort offen")+'</span></div>'+
    miniTrendV538(x)+
    '<div class="setValueRowV538"><div><small>Kauf</small><b>'+euro(x.purchasePrice)+'</b></div><div><small>Wert</small><b>'+euro(x.currentValue)+'</b></div><div><small>Vertrauen</small><b>'+conf.score+'%</b></div></div>'+
    '<div class="setFootV538"><span>'+esc(shortAreaV3(x.cityArea||"Ohne Bereich"))+'</span><span>'+(x.module?esc(x.module):"noch nicht geplant")+'</span></div></div></article>';
 }).join(""):'<div class="emptyV538">Keine Sets gefunden.</div>';
 if($("collectionBody"))$("collectionBody").innerHTML=data.map(x=>'<tr><td><b>'+esc(x.setNumber)+'</b></td><td>'+esc(x.name)+'</td><td>'+pV3(x.quantity)+'</td><td>'+euro(x.purchasePrice)+'</td><td>'+euro(x.currentValue)+'</td><td>'+esc(x.cityArea||"")+'</td><td><button class="rowbtn" onclick="showDetailV3(\''+esc(x.setNumber)+'\')">Öffnen</button></td></tr>').join("");
};
function setupCollectionViewV538(){
 collectionModeV3="grid";
 const list=document.querySelector("#collection .tablewrap"),grid=$("collectionGrid");
 if(list)list.classList.add("collectionTableLegacyV538");
 if(grid)grid.classList.remove("hidden");
 if($("toggleView"))$("toggleView").onclick=()=>document.querySelector("#collection .tablewrap")?.classList.toggle("showCompactV538");
}

function addDetailNavV538(x){
 const root=$("detailContent");if(!root||!x)return;
 root.querySelector(".detailNavV538")?.remove();
 const nav=document.createElement("div");nav.className="detailNavV538";
 nav.innerHTML='<button data-go="overview">Übersicht</button><button data-go="market">Wert & Markt</button><button data-go="copies">Exemplare</button><button data-go="city">Stadt</button><button data-go="history">Historie</button>';
 root.prepend(nav);
 const blocks=[...root.children].filter(e=>e!==nav);
 blocks.forEach((el,i)=>{if(!el.id)el.dataset.detailSectionV538=i===0?"overview":""});
 const market=root.querySelector(".valuationDetailV532,.intelDetailV536");if(market)market.dataset.detailSectionV538="market";
 const copies=root.querySelector(".exemplars")?.closest(".card")||root.querySelector(".exemplars");if(copies)copies.dataset.detailSectionV538="copies";
 const history=[...root.querySelectorAll(".card")].find(el=>/Preisverlauf/i.test(el.textContent||""));if(history)history.dataset.detailSectionV538="history";
 nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{
   const key=b.dataset.go;
   if(key==="city"){$("detailModal")?.classList.remove("show");switchTab("city");return}
   const target=root.querySelector('[data-detail-section-v538="'+key+'"]')||root.querySelector(key==="market"?".valuationDetailV532,.intelDetailV536":key==="copies"?".exemplars":key==="history"?".priceChartV37":"");
   target?.scrollIntoView({behavior:"smooth",block:"start"});
 });
 const sig=priceSignalV538(x),conf=confidenceV536(x);
 const intro=document.createElement("div");intro.className="detailSummaryV538";intro.dataset.detailSectionV538="overview";
 intro.innerHTML='<div><span>'+esc(x.setNumber)+'</span><h3>'+esc(x.name)+'</h3><small>'+esc(conditionShortV538(x))+' · '+pV3(x.quantity)+' Exemplar'+(pV3(x.quantity)===1?"":"e")+'</small></div>'+
 '<div class="detailSummaryMetricsV538"><div><small>Sammlerwert</small><b>'+euro(x.currentValue)+'</b></div><div><small>Markt</small><b class="signal '+sig.cls+'">'+esc(sig.label)+'</b></div><div><small>Vertrauen</small><b>'+conf.score+'%</b></div><div><small>Lagerort</small><b>'+esc(x.storage||"offen")+'</b></div></div>';
 nav.insertAdjacentElement("afterend",intro);
}
const showDetailBaseV538=showDetailV3;
showDetailV3=function(n){showDetailBaseV538(n);const x=(state.collection||[]).find(y=>setKeyV536(y.setNumber)===setKeyV536(n));setTimeout(()=>addDetailNavV538(x),0)};

function collectionAuditV538(){
 const rows=state.collection||[],issues=[];
 const dup=new Map();
 rows.forEach(x=>dup.set(setKeyV536(x.setNumber),(dup.get(setKeyV536(x.setNumber))||0)+1));
 for(const x of rows){
   const a=[];
   if(!pV3(x.purchasePrice))a.push("Kaufpreis");
   if(!x.condition||x.condition==="Unbekannt")a.push("Zustand");
   if(!x.imageUrl)a.push("Bild");
   if(!pV3(x.currentValue))a.push("Marktwert");
   if(!x.storage)a.push("Lagerort");
   if(!x.module)a.push("Stadtplatz");
   if(confidenceV536(x).score<55)a.push("Preisvertrauen");
   if(a.length)issues.push({x,a});
 }
 return {sets:rows.length,qty:qtyTotalV536(),issues,duplicateRows:[...dup].filter(([,n])=>n>1)};
}
function renderAuditV538(){
 const a=collectionAuditV538(),html='<div class="auditHeroV538"><div><span>Sammlung geprüft</span><b>'+a.sets+' Sets · '+a.qty+' Exemplare</b></div><strong class="'+(a.issues.length?"warn":"good")+'">'+(a.issues.length?a.issues.length+" Sets prüfen":"Alles sauber")+'</strong></div>'+
 '<div class="auditGridV538">'+[
  ["Ohne Kaufpreis",a.issues.filter(r=>r.a.includes("Kaufpreis")).length],
  ["Ohne Lagerort",a.issues.filter(r=>r.a.includes("Lagerort")).length],
  ["Ohne Stadtplatz",a.issues.filter(r=>r.a.includes("Stadtplatz")).length],
  ["Preis unsicher",a.issues.filter(r=>r.a.includes("Preisvertrauen")).length]
 ].map(([k,v])=>'<div><span>'+k+'</span><b>'+v+'</b></div>').join("")+'</div>'+
 (a.issues.length?'<div class="auditListV538">'+a.issues.slice(0,25).map(r=>'<button onclick="showDetailV3(\''+esc(r.x.setNumber)+'\')"><b>'+esc(r.x.setNumber)+' · '+esc(r.x.name)+'</b><small>'+r.a.map(esc).join(" · ")+'</small></button>').join("")+'</div>':'<p class="hint">Keine offenen Prüfungen.</p>');
 ensurePanelCardV536("analysis","collectionAuditV538","Sammlung prüfen",html);
}
window.runCollectionAuditV538=()=>{renderAuditV538();switchTab("analysis");document.getElementById("collectionAuditV538")?.scrollIntoView({behavior:"smooth"})};

function smartWishLimitV538(w){
 const e=enrichmentV3?.sets?.[setKeyV536(w.setNumber)]||w.market||{},used=pV3(e.marketUsedEUR),low=pV3(e.marketUsedLowEUR),nu=pV3(e.marketNewEUR);
 const base=low||used||nu;
 return base?Math.round(base*.9*100)/100:0;
}
function applyWishlistLimitsV538(){
 let changed=0;
 for(const w of state.wishlist||[]){if(!pV3(w.limit)){const v=smartWishLimitV538(w);if(v){w.limit=v;changed++}}}
 if(changed){journalAddV536("Einkauf","Kaufgrenzen automatisch ergänzt",changed+" Wunschlisten-Sets");persist();refresh()}
 alert(changed?changed+" Kaufgrenzen wurden ergänzt.":"Für die offenen Wünsche konnten keine neuen sicheren Kaufgrenzen berechnet werden.");
}
window.applyWishlistLimitsV538=applyWishlistLimitsV538;
const renderWishlistBaseV538=renderWishlist;
renderWishlist=function(){
 renderWishlistBaseV538();
 const panel=$("wishlist");if(!panel)return;
 let bar=$("wishlistSmartV538");
 if(!bar){bar=document.createElement("div");bar.id="wishlistSmartV538";bar.className="wishlistSmartV538";panel.querySelector(".toolbar")?.insertAdjacentElement("afterend",bar)}
 const alerts=(state.wishlist||[]).filter(w=>pV3(w.offer)&&pV3(w.limit)&&pV3(w.offer)<=pV3(w.limit)).length;
 bar.innerHTML='<div><span>SMART BUY</span><b>'+alerts+' aktuelle Kaufchance'+(alerts===1?"":"n")+'</b><small>Kaufgrenzen orientieren sich am unteren Marktbereich mit Sicherheitsabschlag.</small></div><button class="btn secondary" onclick="applyWishlistLimitsV538()">Fehlende Kaufgrenzen berechnen</button>';
};

async function renderCollectorPriorityV538(){
 const panel=$("collector");if(!panel)return;
 let box=$("collectorPriorityV538");if(!box){box=document.createElement("div");box.id="collectorPriorityV538";box.className="collectorPriorityV538";panel.querySelector(".collectorFastCompleteV528")?.insertAdjacentElement("beforebegin",box)}
 try{
   const all=await loadAllSetsV46(false);if(!all?.sets)return;
   const defs=collectorThemeDefsV504(all),goals=defs.map(def=>{const rows=collectorRowsV504(all,def),p=collectorProgressV504(rows),missing=rows.filter(([n])=>collectorStatusForV504(n)==="missing");return {def,p,missing}}).filter(g=>g.p.total&&g.p.missing>0).sort((a,b)=>a.p.missing-b.p.missing||b.p.pct-a.p.pct).slice(0,6);
   box.innerHTML='<div class="sectionHead"><div><span class="eyebrowV50">NÄCHSTE ABSCHLÜSSE</span><h2>Diese Serien erreichst du am schnellsten</h2></div></div><div class="collectorPriorityGridV538">'+goals.map(g=>'<button onclick="openCollectorThemeV504(\''+esc(g.def.key)+'\')"><div><span>'+esc(g.def.label)+'</span><b>'+g.p.pct+'%</b></div><small>'+g.p.missing+' fehlen · '+g.p.owned+' vorhanden</small><i><em style="width:'+g.p.pct+'%"></em></i></button>').join("")+'</div>';
 }catch{}
}

function renderGlobalSearchV521(){
 const box=$("globalSearchResultsV521"),input=$("globalSearchInputV521");if(!box||!input)return;
 const q=nV3(input.value||"");
 if(!q){box.innerHTML='<p class="hint">Durchsuche Sets, Setnummern, Lagerorte, Themen, Wunschliste und Stadtmodule.</p>';return}
 const own=(state.collection||[]).filter(x=>nV3([x.setNumber,x.name,x.category,x.cityArea,x.storage,x.module,...(x.exemplars||[]).flatMap(e=>[e.storage,e.seller,e.note])].join(" ")).includes(q)).slice(0,15);
 const wish=(state.wishlist||[]).filter(x=>nV3([x.setNumber,x.name,x.area,x.reason,x.priority].join(" ")).includes(q)).slice(0,8);
 const modules=Object.entries(state.modules||{}).filter(([m,sets])=>nV3([m,...sets].join(" ")).includes(q)).slice(0,8);
 let html="";
 if(own.length)html+='<h3>Sammlung</h3>'+own.map(x=>'<div class="globalResultV521"><button class="favBtnV521 '+(isFavoriteV521(x.setNumber)?"active":"")+'" onclick="toggleFavoriteV521(\''+esc(x.setNumber)+'\')">★</button><button class="globalResultMainV521" onclick="closeUtilityV521(\'globalSearchV521\');showDetailV3(\''+esc(x.setNumber)+'\')"><b>'+esc(x.setNumber)+' · '+esc(x.name)+'</b><small>'+esc([x.cityArea,x.storage,x.module].filter(Boolean).join(" · ")||"Sammlung")+'</small></button></div>').join("");
 if(wish.length)html+='<h3>Wunschliste</h3>'+wish.map(x=>'<div class="globalResultV521"><span class="favPlaceholderV521">♡</span><button class="globalResultMainV521" onclick="closeUtilityV521(\'globalSearchV521\');switchTab(\'wishlist\')"><b>'+esc(x.setNumber)+' · '+esc(x.name)+'</b><small>'+esc(x.area||x.reason||"Wunschliste")+'</small></button></div>').join("");
 if(modules.length)html+='<h3>Stadtmodule</h3>'+modules.map(([m,sets])=>'<div class="globalResultV521"><span class="favPlaceholderV521">▦</span><button class="globalResultMainV521" onclick="closeUtilityV521(\'globalSearchV521\');switchTab(\'city\');setTimeout(()=>moduleClickV3(\''+esc(m)+'\'),150)"><b>'+esc(m)+'</b><small>'+sets.length+' Set'+(sets.length===1?"":"s")+'</small></button></div>').join("");
 if(!html)html='<p class="hint">Keine passenden Einträge gefunden.</p>';
 box.innerHTML=html;
}

function topCardV538(x,i,kind,max){
 const val=kind==="value"?x.value:x.gain,pct=max?Math.max(3,Math.max(0,val)/max*100):3;
 return '<button class="rankCardV538" onclick="showDetailV3(\''+esc(x.setNumber)+'\')"><div class="rankNoV538">'+(i+1)+'</div><div class="rankPicV538">'+(x.imageUrl?'<img src="'+esc(x.imageUrl)+'" alt="">':'<span>LEGO</span>')+'</div><div class="rankMainV538"><div><b>'+esc(x.setNumber)+'</b><span>'+esc(x.name)+'</span></div><small>'+(kind==="value"?x.qty+'× · '+euro(x.market)+' je Set':"Kauf "+euro(x.purchase)+" → "+euro(x.market))+'</small><i><em style="width:'+pct+'%"></em></i></div><div class="rankValueV538"><b>'+(kind==="gain"&&val>=0?"+":"")+euro(val)+'</b>'+(kind==="gain"?'<small>'+(x.pct>=0?"+":"")+x.pct.toFixed(1).replace(".",",")+'%</small>':'')+'</div></button>';
}
const renderStatsBaseV538=renderStatsV36;
renderStatsV36=function(){
 renderStatsBaseV538();
 const rows=(state.collection||[]).map(x=>{const qty=pV3(x.quantity),market=pV3(x.currentValue),purchase=pV3(x.purchasePrice),value=qty*market,gain=qty*(market-purchase);return {...x,qty,market,purchase,value,gain,pct:purchase?((market-purchase)/purchase*100):0}});
 const bestV=[...rows].sort((a,b)=>b.value-a.value).slice(0,10),bestG=[...rows].filter(x=>x.market&&x.purchase).sort((a,b)=>b.gain-a.gain).slice(0,10);
 const mv=Math.max(...bestV.map(x=>x.value),1),mg=Math.max(...bestG.map(x=>Math.max(0,x.gain)),1);
 if($("topValueV36"))$("topValueV36").innerHTML='<div class="rankListV538">'+bestV.map((x,i)=>topCardV538(x,i,"value",mv)).join("")+'</div>';
 if($("topGainV36"))$("topGainV36").innerHTML='<div class="rankListV538">'+bestG.map((x,i)=>topCardV538(x,i,"gain",mg)).join("")+'</div>';
 renderAuditV538();
};

function simplifyHomeV538(){
 const home=$("home");if(!home)return;
 const selectors=[".homeSectionTitleV50",".cards",".homegridV515",".homeSmartGridV521"];
 selectors.forEach(sel=>home.querySelectorAll(sel).forEach(el=>el.classList.add("homeSecondaryV538")));
 let focus=$("todayFocusV538");
 if(!focus){focus=document.createElement("div");focus.id="todayFocusV538";focus.className="todayFocusV538";$("executiveV536")?.insertAdjacentElement("afterend",focus)}
 const a=collectionAuditV538(),unplanned=(state.collection||[]).filter(x=>!x.module).length,wish=(state.wishlist||[]).filter(w=>pV3(w.offer)&&pV3(w.limit)&&pV3(w.offer)<=pV3(w.limit)).length;
 const tasks=[
   a.issues.length?{n:a.issues.length,t:"Sammlung prüfen",s:"Sets mit offenen Angaben",go:"runCollectionAuditV538()"}:null,
   unplanned?{n:unplanned,t:"Stadt weiterplanen",s:"Sets ohne Modulplatz",go:"switchTab('city')"}:null,
   wish?{n:wish,t:"Kaufchancen ansehen",s:"Angebote unter Kaufgrenze",go:"switchTab('wishlist')"}:null
 ].filter(Boolean).slice(0,3);
 focus.innerHTML='<div class="sectionHead"><div><span class="eyebrowV50">HEUTE WICHTIG</span><h2>Deine nächsten Schritte</h2></div><button class="execTechBtnV537" id="homeMoreV538">Mehr anzeigen</button></div><div class="todayGridV538">'+(tasks.length?tasks.map(t=>'<button onclick="'+t.go+'"><b>'+t.n+'</b><span>'+esc(t.t)+'</span><small>'+esc(t.s)+'</small></button>').join(""):'<div class="allGoodV538"><b>✓</b><span>Alles im grünen Bereich</span></div>')+'</div>';
 const btn=$("homeMoreV538");if(btn)btn.onclick=()=>home.querySelectorAll(".homeSecondaryV538").forEach(e=>e.classList.toggle("showV538"));
}

function backgroundQualityV538(){
 const q=$("qualityAnalysis")?.closest(".card");
 if(q){q.classList.add("qualityBackgroundV538");const h=q.querySelector(".sectionHead h2");if(h)h.textContent="Datenprüfung (nur bei Bedarf)"}
}
function renderUxV538(){setupCollectionViewV538();renderCollection();renderWishlist();renderStatsV36();renderCollectorPriorityV538();simplifyHomeV538();backgroundQualityV538()}
const refreshBaseV538=refresh;
refresh=function(){const r=refreshBaseV538();setTimeout(renderUxV538,0);return r};
setTimeout(renderUxV538,700);


/* v50.39 Pricing repositioning */
renderPricingV516=function(){
 const basic=$("basicPriceV516"),basicPeriod=$("basicPeriodV516"),premium=$("premiumPriceV516"),premiumPeriod=$("premiumPeriodV516");
 if(basic)basic.textContent=pricingYearlyV516?"39,99 €":"3,99 €";
 if(basicPeriod)basicPeriod.textContent=pricingYearlyV516?"pro Jahr":"pro Monat";
 if(premium)premium.textContent=pricingYearlyV516?"69,99 €":"6,99 €";
 if(premiumPeriod)premiumPeriod.textContent=pricingYearlyV516?"pro Jahr":"pro Monat";
 $("pricingMonthlyV516")?.classList.toggle("active",!pricingYearlyV516);
 $("pricingYearlyV516")?.classList.toggle("active",pricingYearlyV516);
};
planInfoV519=function(){
 // Operator exemption must also be present in this final pricing override.
 if(isAdminV36())return {key:"premium",label:"Administrator",limit:Infinity,desc:"Alle Funktionen und unbegrenzte Sets (Betreiberkonto).",admin:true};
 const key=planKeyV519(),trial=trialInfoV520();
 if(trial.active)return {key:"premium",baseKey:key,label:"Pro Test",limit:Infinity,desc:"7 Tage Pro-Testphase aktiv.",trial:true};
 return key==="premium"
   ?{key,label:"Pro",limit:Infinity,desc:"Unbegrenzt viele Sets · Marktwerte, Portfolio und Analyse."}
   :key==="basic"
     ?{key,label:"Collector",limit:Infinity,desc:"Unbegrenzt viele Sets · Sammlung, Serien, Lagerung, Stadtplanung und Cloud."}
     :{key:"free",label:"Free",limit:25,desc:"Bis zu 25 Sets verwalten."};
};
openPlanLimitV519=function(){
 const info=planInfoV519(),m=$("planLimitModalV519");
 const next=info.key==="free"?"Collector":"Pro";
 const nextText=info.key==="free"
   ?"Mit Collector verwaltest du unbegrenzt viele Sets und bekommst Serien, Lagerung, Stadtplanung und Cloud."
   :"Mit Pro bekommst du zusätzlich Marktwerte, Preisentwicklung, Portfolioanalyse und Preisalarme.";
 if($("planLimitTitleV519"))$("planLimitTitleV519").textContent="Dein "+info.label+"-Limit ist erreicht.";
 if($("planLimitTextV519"))$("planLimitTextV519").textContent=nextText+" Dein bestehender Bestand wird nicht verändert.";
 if(m){m.classList.add("show");m.setAttribute("aria-hidden","false")}
};
setTimeout(()=>{renderPricingV516();renderPlanStatusV519();},120);


/* v50.40 Commercial Launch */
let checkoutPlanV540=null;
function billingPeriodV540(){return pricingYearlyV516?"yearly":"monthly"}
function billingEntryV540(plan){
 const cfg=window.BRICK_BILLING||{},key=plan==="basic"?"collector":"pro",period=billingPeriodV540();
 return {key,period,...(cfg[key]?.[period]||{})};
}
function openCommercialCheckoutV540(plan){
 if(plan==="free"){switchTab("collection");return}
 checkoutPlanV540=plan;
 const entry=billingEntryV540(plan),label=plan==="basic"?"Collector":"Pro / Investor",period=entry.period==="yearly"?"Jahr":"Monat";
 const title=$("checkoutTitleV540"),sum=$("checkoutSummaryV540"),pay=$("checkoutPayV540"),status=$("checkoutStatusV540"),terms=$("checkoutTermsV540"),m=$("checkoutModalV540");
 if(title)title.textContent=label+" abonnieren";
 if(sum)sum.innerHTML='<div class="checkoutPlanV540"><span>Tarif</span><b>'+label+'</b></div><div class="checkoutPlanV540"><span>Abrechnung</span><b>'+period+'</b></div><div class="checkoutPlanV540"><span>Preis</span><b>'+euro(entry.amount||0)+'</b></div><p class="hint">Der Vertrag wird über den externen Zahlungsanbieter abgeschlossen. Vor dem Absenden siehst du Tarif, Preis und Abrechnungszeitraum.</p>';
 if(terms)terms.checked=false;
 const ready=!!entry.paymentLink;
 if(pay){pay.disabled=!ready;pay.textContent="Zahlungspflichtig bestellen"}
 if(status)status.textContent=ready?"Nach Bestätigung wirst du zum sicheren Zahlungsanbieter weitergeleitet.":"Bezahlfunktion wird gerade freigeschaltet. Du kannst den 7-Tage-Pro-Test bereits nutzen.";
 if(m){m.classList.add("show");m.setAttribute("aria-hidden","false")}
}
function closeCommercialCheckoutV540(){const m=$("checkoutModalV540");if(m){m.classList.remove("show");m.setAttribute("aria-hidden","true")}}
function bindCommercialCheckoutV540(){
 document.querySelectorAll(".pricingCtaV516").forEach(b=>b.onclick=()=>openCommercialCheckoutV540(b.dataset.plan));
 if($("checkoutCloseV540"))$("checkoutCloseV540").onclick=closeCommercialCheckoutV540;
 if($("checkoutCancelV540"))$("checkoutCancelV540").onclick=closeCommercialCheckoutV540;
 if($("checkoutModalV540"))$("checkoutModalV540").onclick=e=>{if(e.target===$("checkoutModalV540"))closeCommercialCheckoutV540()};
 if($("checkoutPayV540"))$("checkoutPayV540").onclick=()=>{
   if(!$("checkoutTermsV540")?.checked)return alert("Bitte bestätige zuerst AGB, Widerruf und Datenschutz.");
   const entry=billingEntryV540(checkoutPlanV540);
   if(!entry.paymentLink)return alert("Der Zahlungsanbieter ist noch nicht verbunden. Der Checkout bleibt deshalb sicher gesperrt.");
   location.href=entry.paymentLink;
 };
}
function commercialLaunchStatusV540(){
 const cfg=window.BRICK_BILLING||{},links=[
   cfg.collector?.monthly?.paymentLink,cfg.collector?.yearly?.paymentLink,
   cfg.pro?.monthly?.paymentLink,cfg.pro?.yearly?.paymentLink
 ];
 return {
   pricing:true,
   legal:true,
   auth:!!window.LEGO_SUPABASE,
   billing:links.every(Boolean),
   support:!!cfg.supportEmail,
   publicApp:true
 };
}
function renderCommercialLaunchV540(){
 const panel=$("settings");if(!panel)return;
 let box=$("commercialLaunchV540");
 if(!box){box=document.createElement("div");box.id="commercialLaunchV540";box.className="card wide commercialLaunchV540";panel.prepend(box)}
 const s=commercialLaunchStatusV540(),rows=[
   ["Öffentliche App","publicApp","GitHub Pages ist aktiv"],
   ["Tarife","pricing","Free · Collector · Pro sind konfiguriert"],
   ["Rechtstexte","legal","Impressum · Datenschutz · AGB · Widerruf"],
   ["Benutzerkonten","auth","Supabase Auth / Cloud"],
   ["Support","support","Supportkontakt hinterlegt"],
   ["Zahlungsanbieter","billing","4 Checkout-Links für Monat/Jahr"]
 ];
 box.innerHTML='<div class="sectionHead"><div><span class="eyebrowV50">COMMERCIAL LAUNCH</span><h2>Launch-Status</h2><p class="hint">Technischer Status der kommerziellen Freigabe.</p></div><b class="launchScoreV540">'+rows.filter(r=>s[r[1]]).length+'/'+rows.length+'</b></div>'+
 '<div class="launchGridV540">'+rows.map(([label,key,desc])=>'<div class="'+(s[key]?"ready":"blocked")+'"><b>'+(s[key]?"✓":"!")+' '+label+'</b><span>'+desc+'</span><small>'+(s[key]?"bereit":"noch offen")+'</small></div>').join("")+'</div>'+
 (!s.billing?'<p class="launchBlockerV540"><b>Noch offen:</b> Stripe verbinden und die vier Payment Links hinterlegen. Bis dahin bleiben kostenpflichtige Bestellungen technisch gesperrt.</p>':'<p class="launchReadyV540"><b>Bezahl-Checkout ist vollständig aktiv.</b></p>');
}
const bindPricingBaseV540=bindPricingV516;
bindPricingV516=function(){bindPricingBaseV540();bindCommercialCheckoutV540();renderCommercialLaunchV540()};
const refreshBaseV540=refresh;
refresh=function(){const r=refreshBaseV540();setTimeout(()=>{bindCommercialCheckoutV540();renderCommercialLaunchV540()},0);return r};
setTimeout(()=>{bindCommercialCheckoutV540();renderCommercialLaunchV540()},300);


/* v50.41 Collector Turbo: one-pass index + meistgesammelte Themen zuerst */
let collectorTurboCacheV541=null,collectorRenderSeqV541=0;
function collectorStateSigV541(){
 const own=(state.collection||[]).map(x=>String(x.setNumber)).sort().join(",");
 const wish=(state.wishlist||[]).map(x=>String(x.setNumber)).sort().join(",");
 return own+"|"+wish;
}
function buildCollectorTurboV541(all){
 const sig=collectorStateSigV541();
 if(collectorTurboCacheV541?.all===all&&collectorTurboCacheV541.sig===sig)return collectorTurboCacheV541;
 const ownedSet=new Set((state.collection||[]).map(x=>String(x.setNumber)));
 const wishSet=new Set((state.wishlist||[]).map(x=>String(x.setNumber)));
 const featured=collectorFeaturedDefsV504();
 const buckets=new Map(featured.map(d=>[d.key,{def:d,rows:[]}]));
 const dyn=new Map();
 for(const [n,row] of Object.entries(all?.sets||{})){
   let assigned=false;
   for(const d of featured){
     if(collectorMatchesDefV504(all,row,d,n)){
       buckets.get(d.key).rows.push([n,row]);assigned=true;break;
     }
   }
   if(assigned)continue;
   const t=collectorThemePathV504(all,row),root=t.root;
   if(!root)continue;
   const key="root:"+root;
   if(!dyn.has(key))dyn.set(key,{def:{key,label:root,root,count:0,icon:"◻"},rows:[]});
   const b=dyn.get(key);b.rows.push([n,row]);b.def.count++;
 }
 const allBuckets=[...buckets.values(),...dyn.values()].filter(b=>b.rows.length);
 for(const b of allBuckets){
   let owned=0,wished=0;
   for(const [n] of b.rows){if(ownedSet.has(String(n)))owned++;else if(wishSet.has(String(n)))wished++}
   const total=b.rows.length,missing=Math.max(0,total-owned),pct=total?Math.round(owned/total*100):0;
   b.p={total,owned,wished,missing,pct};
 }
 const byKey=new Map(allBuckets.map(b=>[b.def.key,b]));
 collectorTurboCacheV541={all,sig,buckets:allBuckets,byKey,ownedSet,wishSet};
 return collectorTurboCacheV541;
}
collectorRowsV504=function(all,def){
 const c=buildCollectorTurboV541(all),b=c.byKey.get(def?.key);
 return b?b.rows:[];
};
collectorThemeDefsV504=function(all){return buildCollectorTurboV541(all).buckets.map(b=>b.def)};
collectorProgressV504=function(rows){
 let owned=0,wished=0;
 const own=collectorTurboCacheV541?.ownedSet||new Set((state.collection||[]).map(x=>String(x.setNumber)));
 const wish=collectorTurboCacheV541?.wishSet||new Set((state.wishlist||[]).map(x=>String(x.setNumber)));
 for(const [n] of rows){if(own.has(String(n)))owned++;else if(wish.has(String(n)))wished++}
 const total=rows.length,missing=Math.max(0,total-owned);
 return {total,owned,wished,missing,pct:total?Math.round(owned/total*100):0};
};
function collectorCardTurboV541(b){
 const d=b.def,p=b.p;
 return '<button class="collectorThemeCardV504 collectorThemeTurboV541" onclick="openCollectorThemeV504(\''+esc(d.key)+'\')">'+
   '<span class="collectorThemeIconV504">'+esc(d.icon||"◻")+'</span>'+
   '<span class="collectorThemeCardMainV504"><b>'+esc(d.label)+'</b><small><strong class="ownedCountV541">'+p.owned+' gesammelt</strong> · '+p.total+' gesamt · '+p.missing+' fehlen</small><span class="collectorMiniProgressV504"><i style="width:'+p.pct+'%"></i></span></span>'+
   '<strong>'+p.pct+'%</strong></button>';
}
renderCollectorThemesV504=async function(){
 const box=$("collectorFeaturedV504");if(!box)return;
 const seq=++collectorRenderSeqV541;
 if(!allSetsV46)box.innerHTML='<div class="collectorLoadingV541"><b>Sammler-Katalog wird geladen…</b><small>Die Themenübersicht wird vorbereitet.</small></div>';
 const all=await loadAllSetsV46(false);
 if(seq!==collectorRenderSeqV541)return;
 if(!all?.sets){box.innerHTML='<div class="card"><p>Sammler-Katalog konnte gerade nicht geladen werden.</p></div>';return}
 const c=buildCollectorTurboV541(all);
 if($("collectorThemeCountV504"))$("collectorThemeCountV504").textContent=all.meta?.themeCount||Object.keys(all.themes||{}).length||"–";
 if($("collectorSetCountV504"))$("collectorSetCountV504").textContent=all.meta?.uniqueSetNumbers||Object.keys(all.sets||{}).length||"–";
 const q=nV3($("collectorSearchV504")?.value);
 const rows=c.buckets
   .filter(b=>!q||nV3(b.def.label).includes(q))
   .sort((a,b)=>b.p.owned-a.p.owned||b.p.pct-a.p.pct||b.p.total-a.p.total||a.def.label.localeCompare(b.def.label,"de"));
 const top=rows.slice(0,10),rest=rows.slice(10,q?110:46);
 let html="";
 if(top.length)html+='<div class="collectorSectionTitleV504"><span>Deine meistgesammelten Themen</span><small>Sortiert nach Anzahl deiner vorhandenen Sets</small></div><div class="collectorThemeGridV504">'+top.map(collectorCardTurboV541).join("")+'</div>';
 if(rest.length)html+='<div class="collectorSectionTitleV504"><span>'+(q?'Weitere Treffer':'Weitere Themen')+'</span><small>Danach ebenfalls nach deinem Bestand sortiert</small></div><div class="collectorThemeGridV504 compact">'+rest.map(collectorCardTurboV541).join("")+'</div>';
 if(!html)html='<div class="card"><p>Kein passendes Thema gefunden.</p></div>';
 box.innerHTML=html;
 renderCollectorFastCompleteV528();
};
renderCollectorFastCompleteV528=async function(){
 const box=$("collectorFastCompleteGridV528");if(!box)return;
 const all=allSetsV46||await loadAllSetsV46(false);if(!all?.sets)return;
 const c=buildCollectorTurboV541(all);
 const rows=c.buckets.filter(b=>b.p.missing>=1&&b.p.missing<=5)
   .sort((a,b)=>a.p.missing-b.p.missing||b.p.owned-a.p.owned||b.p.pct-a.p.pct)
   .slice(0,8);
 box.innerHTML=rows.length?rows.map(b=>
   '<button class="collectorThemeCardV504 fastCompleteCardV528" onclick="openCollectorThemeV504(\''+esc(b.def.key)+'\')">'+
   '<span class="collectorThemeIconV504">'+esc(b.def.icon||"✓")+'</span>'+
   '<span class="collectorThemeCardMainV504"><b>'+esc(b.def.label)+'</b><small>'+b.p.owned+' gesammelt · nur noch '+b.p.missing+' fehlen</small><span class="collectorMiniProgressV504"><i style="width:'+b.p.pct+'%"></i></span></span>'+
   '<strong>'+b.p.pct+'%</strong></button>'
 ).join(""):'<div class="card"><p class="hint">Aktuell gibt es keine Themenwelt mit nur noch 1–5 fehlenden Sets.</p></div>';
};
/* Die zusätzliche Prioritätsanalyse nutzte bisher erneut den gesamten Katalog.
   Ab v50.41 übernimmt die sortierte Hauptliste diese Aufgabe ohne zweiten Vollscan. */
renderCollectorPriorityV538=async function(){
 const old=$("collectorPriorityV538");if(old)old.remove();
};
const openCollectorThemeBaseV541=window.openCollectorThemeV504;
window.openCollectorThemeV504=async key=>{
 const all=allSetsV46||await loadAllSetsV46(false);
 const b=all?buildCollectorTurboV541(all).byKey.get(key):null;
 if(!b)return openCollectorThemeBaseV541(key);
 collectorCurrentV504=b.def;
 $("collectorFeaturedV504")?.classList.add("hidden");
 $("collectorThemeViewV504")?.classList.remove("hidden");
 renderCollectorSetViewV504();
};


/* v50.42 Performance + Sammler UX */
let collectorLoadedOnceV542=false,collectorSearchTimerV542=null;
function collectorSortModeV542(){
 return state.meta?.collectorSortV542||"owned";
}
function ensureCollectorSortV542(){
 const bar=$("collectorSearchV504")?.closest(".collectorToolbarV504");if(!bar||$("collectorSortV542"))return;
 const sel=document.createElement("select");sel.id="collectorSortV542";
 sel.innerHTML='<option value="owned">Meist gesammelt zuerst</option><option value="progress">Höchster Fortschritt</option><option value="missing">Wenigste fehlende zuerst</option><option value="size">Größte Themen zuerst</option><option value="az">A–Z</option>';
 sel.value=collectorSortModeV542();
 sel.onchange=()=>{state.meta=state.meta||{};state.meta.collectorSortV542=sel.value;persist();renderCollectorThemesV504()};
 bar.appendChild(sel);
}
function sortCollectorBucketsV542(rows){
 const mode=collectorSortModeV542();
 return rows.sort((a,b)=>{
   if(mode==="progress")return b.p.pct-a.p.pct||b.p.owned-a.p.owned||a.def.label.localeCompare(b.def.label,"de");
   if(mode==="missing")return a.p.missing-b.p.missing||b.p.owned-a.p.owned||a.def.label.localeCompare(b.def.label,"de");
   if(mode==="size")return b.p.total-a.p.total||b.p.owned-a.p.owned||a.def.label.localeCompare(b.def.label,"de");
   if(mode==="az")return a.def.label.localeCompare(b.def.label,"de");
   return b.p.owned-a.p.owned||b.p.pct-a.p.pct||b.p.total-a.p.total||a.def.label.localeCompare(b.def.label,"de");
 });
}
const renderCollectorThemesBaseV542=renderCollectorThemesV504;
renderCollectorThemesV504=async function(){
 const box=$("collectorFeaturedV504");if(!box)return;
 const seq=++collectorRenderSeqV541;
 ensureCollectorSortV542();
 if(!allSetsV46)box.innerHTML='<div class="collectorLoadingV541"><b>Sammler-Katalog wird geladen…</b><small>Einmalig beim ersten Öffnen – danach bleibt er im Speicher.</small></div>';
 const all=await loadAllSetsV46(false);
 if(seq!==collectorRenderSeqV541)return;
 if(!all?.sets){box.innerHTML='<div class="card"><p>Sammler-Katalog konnte gerade nicht geladen werden.</p></div>';return}
 collectorLoadedOnceV542=true;
 const cache=buildCollectorTurboV541(all);
 if($("collectorThemeCountV504"))$("collectorThemeCountV504").textContent=all.meta?.themeCount||Object.keys(all.themes||{}).length||"–";
 if($("collectorSetCountV504"))$("collectorSetCountV504").textContent=all.meta?.uniqueSetNumbers||Object.keys(all.sets||{}).length||"–";
 const q=nV3($("collectorSearchV504")?.value);
 const rows=sortCollectorBucketsV542(cache.buckets.filter(b=>!q||nV3(b.def.label).includes(q)));
 const top=rows.slice(0,10),rest=rows.slice(10,q?110:46);
 const mode=collectorSortModeV542(),caption=mode==="owned"?"Sortiert nach Anzahl deiner vorhandenen Sets":mode==="progress"?"Sortiert nach Sammlungsfortschritt":mode==="missing"?"Sortiert nach geringster Restmenge":mode==="size"?"Sortiert nach Themenumfang":"Alphabetisch sortiert";
 let html="";
 if(top.length)html+='<div class="collectorSectionTitleV504"><span>'+(mode==="owned"?"Deine meistgesammelten Themen":"Top-Themen")+'</span><small>'+caption+'</small></div><div class="collectorThemeGridV504">'+top.map(collectorCardTurboV541).join("")+'</div>';
 if(rest.length)html+='<div class="collectorSectionTitleV504"><span>'+(q?"Weitere Treffer":"Weitere Themen")+'</span><small>'+caption+'</small></div><div class="collectorThemeGridV504 compact">'+rest.map(collectorCardTurboV541).join("")+'</div>';
 if(!html)html='<div class="card"><p>Kein passendes Thema gefunden.</p></div>';
 box.innerHTML=html;
 renderCollectorFastCompleteV528();
};
function bindCollectorFastV542(){
 ensureCollectorSortV542();
 const search=$("collectorSearchV504");
 if(search&&!search.dataset.fastV542){
   search.dataset.fastV542="1";
   search.oninput=()=>{
     clearTimeout(collectorSearchTimerV542);
     collectorSearchTimerV542=setTimeout(()=>{
       if(collectorCurrentV504){collectorCurrentV504=null;$("collectorThemeViewV504")?.classList.add("hidden");$("collectorFeaturedV504")?.classList.remove("hidden")}
       renderCollectorThemesV504();
     },180);
   };
 }
}
const switchTabBaseV542=switchTab;
switchTab=function(id){
 const r=switchTabBaseV542(id);
 if(id==="collector"){
   bindCollectorFastV542();
   requestAnimationFrame(()=>{if(collectorCurrentV504)renderCollectorSetViewV504();else renderCollectorThemesV504()});
 }
 return r;
};
// Keep collector cache invalidation cheap and explicit after state-changing refreshes.
const persistBaseV542=persist;
persist=function(){
 collectorTurboCacheV541=null;
 return persistBaseV542();
};
// Browser scheduling: costly secondary panels get a chance after first paint.
function idleV542(fn,timeout=1000){
 if("requestIdleCallback" in window)return requestIdleCallback(fn,{timeout});
 return setTimeout(fn,80);
}
const renderUxBaseV542=renderUxV538;
renderUxV538=function(){
 setupCollectionViewV538();renderCollection();renderWishlist();simplifyHomeV538();backgroundQualityV538();
 idleV542(()=>renderStatsV36(),700);
 // Sammler intentionally omitted here: it loads only on demand.
};
setTimeout(()=>bindCollectorFastV542(),400);


/* v50.43 Speed Pack: kein Katalog-Load beim Start, sichtbare Bereiche zuerst */
let homeGoalsLoadedV543=false;

renderHomeUxV521=function(){
 ensureUxStateV521();
 renderAchievementsV521();
 renderRecommendationsV521();
 renderNotificationsV521();
 renderPremiumPreviewV521();
 // Wichtig: Der 2,3-MB-Gesamtkatalog wird auf der Startseite NICHT mehr automatisch geladen.
 // Serien-Ziele werden erst geladen, wenn der Nutzer sie wirklich aufklappt oder Sammler öffnet.
};

const simplifyHomeBaseV543=simplifyHomeV538;
simplifyHomeV538=function(){
 simplifyHomeBaseV543();
 const home=$("home"),btn=$("homeMoreV538");
 if(!home||!btn)return;
 btn.onclick=()=>{
   const blocks=[...home.querySelectorAll(".homeSecondaryV538")];
   const opening=blocks.some(e=>!e.classList.contains("showV538"));
   blocks.forEach(e=>e.classList.toggle("showV538",opening));
   btn.textContent=opening?"Weniger anzeigen":"Mehr anzeigen";
   if(opening&&!homeGoalsLoadedV543){
     homeGoalsLoadedV543=true;
     const box=$("homeSeriesGoalsV521");
     if(box)box.innerHTML='<p class="hint">Serien-Ziele werden geladen…</p>';
     idleV542(()=>renderHomeSeriesGoalsV521(),1200);
   }
 };
};

// Der Katalog-Status darf den Vollkatalog nicht mehr im Hintergrund laden.
const renderFastCatalogStatusBaseV543=renderFastCatalogStatusBaseV46;
renderFastCatalogStatusV45=async function(){
 await renderFastCatalogStatusBaseV543();
 const box=$("fastCatalogStatusV45");
 if(!box)return;
 let d=$("allSetsCountV46");
 if(allSetsV46?.meta?.uniqueSetNumbers){
   if(!d){d=document.createElement("div");d.className="miniStat";d.id="allSetsCountV46";box.appendChild(d)}
   d.innerHTML='<span>Alle Setnummern</span><b>'+allSetsV46.meta.uniqueSetNumbers+'</b>';
 }else if(d){
   d.remove();
 }
};

// Nur sichtbare Analyse rendern. Das spart mehrere DOM-Listen beim Start.
renderUxV538=function(){
 setupCollectionViewV538();
 renderCollection();
 renderWishlist();
 simplifyHomeV538();
 backgroundQualityV538();
 if($("analysis")?.classList.contains("active"))idleV542(()=>renderStatsV36(),500);
};

// Collector-Themen: Default bleibt "meist gesammelt zuerst".
// Zusätzlich wird die Auswahl beim ersten Start automatisch auf diesen Modus gesetzt.
function enforceCollectorDefaultV543(){
 state.meta=state.meta||{};
 if(!state.meta.collectorSortV542){
   state.meta.collectorSortV542="owned";
   persistBaseV542();
 }
 const sel=$("collectorSortV542");
 if(sel&&sel.value!==collectorSortModeV542())sel.value=collectorSortModeV542();
}

// Set-Suche im Sammler ebenfalls entprellen, damit große Themen nicht bei jedem Tastendruck neu gebaut werden.
let collectorSetSearchTimerV543=null;
function bindCollectorDetailFastV543(){
 const el=$("collectorSetSearchV505");
 if(el&&!el.dataset.fastV543){
   el.dataset.fastV543="1";
   el.oninput=()=>{
     clearTimeout(collectorSetSearchTimerV543);
     collectorSetSearchTimerV543=setTimeout(()=>collectorCurrentV504&&renderCollectorSetViewV504(),160);
   };
 }
}

// Bei Bildern unterhalb des sichtbaren Bereichs Browser-Decoding entkoppeln.
function optimizeCollectorImagesV543(){
 document.querySelectorAll("#collector img").forEach(img=>{
   img.loading="lazy";
   img.decoding="async";
   if(!img.hasAttribute("fetchpriority"))img.setAttribute("fetchpriority","low");
 });
}

const renderCollectorSetViewBaseV543=renderCollectorSetViewV504;
renderCollectorSetViewV504=async function(){
 await renderCollectorSetViewBaseV543();
 optimizeCollectorImagesV543();
};

const renderCollectorThemesBaseV543=renderCollectorThemesV504;
renderCollectorThemesV504=async function(){
 enforceCollectorDefaultV543();
 await renderCollectorThemesBaseV543();
 bindCollectorDetailFastV543();
 optimizeCollectorImagesV543();
};

// Beim Öffnen des Sammlers wird nur ein Renderlauf ausgelöst.
const switchTabBaseV543=switchTab;
switchTab=function(id){
 const wasCollector=$("collector")?.classList.contains("active");
 const r=switchTabBaseV543(id);
 if(id==="collector"){
   bindCollectorFastV542();
   bindCollectorDetailFastV543();
   if(!wasCollector){
     requestAnimationFrame(()=>collectorCurrentV504?renderCollectorSetViewV504():renderCollectorThemesV504());
   }
 }
 return r;
};

setTimeout(()=>{enforceCollectorDefaultV543();bindCollectorDetailFastV543()},350);


/* v50.43b: Sammler-Tab exakt einmal rendern */
switchTab=function(id){
 const wasCollector=$("collector")?.classList.contains("active");
 const r=switchTabBaseV504(id);
 if(id==="collector"&&!wasCollector){
   bindCollectorFastV542();
   bindCollectorDetailFastV543();
   requestAnimationFrame(()=>collectorCurrentV504?renderCollectorSetViewV504():renderCollectorThemesV504());
 }
 return r;
};
