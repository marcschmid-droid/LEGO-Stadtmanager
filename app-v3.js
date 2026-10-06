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
function renderAnalysisV3(){const t=totalsV3(),valued=state.collection.filter(x=>pV3(x.currentValue)>0).length,sized=state.collection.filter(x=>pV3(x.width)>0&&pV3(x.depth)>0).length,area=state.collection.reduce((s,x)=>s+pV3(x.width)*pV3(x.depth)*pV3(x.quantity),0)/10000;if(!$("aValued"))return;$("aValued").textContent=valued;$("aSized").textContent=sized;$("aArea").textContent=area.toFixed(2).replace(".",",")+" m²";const g={};state.collection.forEach(x=>{const a=shortAreaV3(x.cityArea||"Ohne Bereich");g[a]=(g[a]||0)+pV3(x.quantity)});$("aZones").textContent=Object.keys(g).length;const mx=Math.max(...Object.values(g),1);$("areaAnalysis").innerHTML=Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'<div class="barrow"><span>'+esc(k)+'</span><div class="bar"><i style="width:'+(v/mx*100)+'%"></i></div><b>'+v+'</b></div>').join("");$("valueAnalysis").innerHTML='<div class="miniStats"><div class="miniStat"><span>Investment</span><b>'+euro(t.inv)+'</b></div><div class="miniStat"><span>Erfasster Wert</span><b>'+euro(t.val)+'</b></div><div class="miniStat"><span>Differenz</span><b>'+euro(t.gain)+'</b></div><div class="miniStat"><span>Rendite</span><b>'+t.pct.toFixed(1).replace(".",",")+' %</b></div></div><p class="hint">Aktuelle Werte sind nur für gepflegte Sets aussagekräftig.</p>';const q=[["Ohne Bild",state.collection.filter(x=>!x.imageUrl).length],["Ohne aktuellen Wert",state.collection.filter(x=>!pV3(x.currentValue)).length],["Ohne vollständige Maße",state.collection.filter(x=>!(pV3(x.width)&&pV3(x.depth)&&pV3(x.height))).length],["Ohne Modul",state.collection.filter(x=>!x.module).length],["Ohne Lagerort",state.collection.filter(x=>!x.storage).length]];$("qualityAnalysis").innerHTML='<div class="qualitylist">'+q.map(([k,v])=>'<div class="qualityitem"><span>'+k+'</span><b>'+v+'</b></div>').join("")+'</div>'}
const oldRefreshV3=refresh;refresh=function(){oldRefreshV3();fillAreaFilterV3();renderCollection();renderWishlist();renderCityV3();renderModulesV3();renderTracks();renderOffers();renderHomeV3();if(document.querySelector("#analysis.active"))renderAnalysisV3()}
function syncModuleV3(x){for(const m in state.modules)state.modules[m]=state.modules[m].filter(n=>n!==x.setNumber);if(x.module){state.modules[x.module]=state.modules[x.module]||[];if(!state.modules[x.module].includes(x.setNumber))state.modules[x.module].push(x.setNumber)}}
const oldOpenSetV3=openSet;openSet=function(x=null){oldOpenSetV3(x);if($("fModule"))$("fModule").value=x?.module||"";if($("fCondition"))$("fCondition").value=x?.condition||"Unbekannt";if($("fBuild"))$("fBuild").value=x?.buildStatus||"Unbekannt";if($("fStorage"))$("fStorage").value=x?.storage||"";if($("fBarcode"))$("fBarcode").value=x?.barcode||"";if($("fPurchaseDate"))$("fPurchaseDate").value=x?.purchaseDate||"";if($("fSeller"))$("fSeller").value=x?.seller||""}
const oldSaveSetV3=saveSet;saveSet=function(){const was=editing;oldSaveSetV3();const n=was||$("fSet")?.value?.trim();const x=state.collection.find(y=>y.setNumber===n);if(x){x.module=$("fModule")?.value.trim().toUpperCase()||x.module||"";x.condition=$("fCondition")?.value||x.condition||"Unbekannt";x.buildStatus=$("fBuild")?.value||x.buildStatus||"Unbekannt";x.storage=$("fStorage")?.value.trim()||x.storage||"";x.barcode=$("fBarcode")?.value.trim()||x.barcode||"";x.purchaseDate=$("fPurchaseDate")?.value||x.purchaseDate||"";x.seller=$("fSeller")?.value.trim()||x.seller||"";syncModuleV3(x);persist();refresh()}}
window.showDetailV3=n=>{const x=state.collection.find(y=>y.setNumber===n);if(!x)return;const gain=(pV3(x.currentValue)-pV3(x.purchasePrice))*pV3(x.quantity);$("detailTitle").textContent=x.setNumber+" · "+x.name;$("detailContent").innerHTML='<div class="detailHero"><div class="detailPic">'+(x.imageUrl?'<img src="'+esc(x.imageUrl)+'">':'<b>LEGO '+esc(x.setNumber)+'</b>')+'</div><div><div class="detailFacts"><div class="fact"><small>Anzahl</small><b>'+pV3(x.quantity)+'</b></div><div class="fact"><small>Kaufpreis</small><b>'+euro(x.purchasePrice)+'</b></div><div class="fact"><small>Aktueller Wert</small><b>'+euro(x.currentValue)+'</b></div><div class="fact"><small>Gewinn / Verlust</small><b>'+euro(gain)+'</b></div><div class="fact"><small>Stadtbereich</small><b>'+esc(x.cityArea||"–")+'</b></div><div class="fact"><small>Modul</small><b>'+esc(x.module||"–")+'</b></div><div class="fact"><small>Maße</small><b>'+(x.width??"–")+' × '+(x.depth??"–")+' × '+(x.height??"–")+' cm</b></div><div class="fact"><small>Zustand</small><b>'+esc(x.condition||"–")+'</b></div><div class="fact"><small>Bauzustand</small><b>'+esc(x.buildStatus||"–")+'</b></div><div class="fact"><small>Lagerort</small><b>'+esc(x.storage||"–")+'</b></div></div><div class="actions"><button class="btn" onclick="editSet(\''+esc(x.setNumber)+'\');document.getElementById(\'detailModal\').classList.remove(\'show\')">Bearbeiten</button><button class="btn secondary" onclick="purchaseSetV3(\''+esc(x.setNumber)+'\')">Weiteres Exemplar kaufen</button></div></div></div>'+(x.note?'<div class="card wide"><b>Notiz</b><p>'+esc(x.note)+'</p></div>':"")+'<div class="card wide marketCard">'+((x.market&&Object.keys(x.market).length)?'<h3>Online-Daten</h3><div class="detailFacts"><div class="fact"><small>Marktwert neu</small><b>'+euro(x.market.marketNewEUR)+'</b></div><div class="fact"><small>Marktwert gebraucht</small><b>'+euro(x.market.marketUsedEUR)+'</b></div><div class="fact"><small>UVP EU</small><b>'+euro(x.market.rrpEUR)+'</b></div><div class="fact"><small>12-Monats-Wachstum</small><b>'+(x.market.growth12mPct??'–')+' %</b></div></div>':'')+'</div><div class="exemplars"><h3>Einzel-Exemplare / Käufe</h3>'+((x.exemplars||[]).length?x.exemplars.map((e,i)=>'<div class="exemplar"><b>#'+(i+1)+'</b> · '+(e.date||"ohne Datum")+' · '+esc(e.condition||"Unbekannt")+' · '+esc(e.seller||"Quelle unbekannt")+' · '+euro(e.price)+'</div>').join(""):'<p class="hint">Noch keine Einzelkäufe separat erfasst.</p>')+'</div>';$("detailModal").classList.add("show")}
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
 const mw=pV3(state.meta.moduleWidth)||25.6,md=pV3(state.meta.moduleDepth)||25.6,w=pV3(x.width),d=pV3(x.depth);
 if(!w||!d)return "Maße fehlen – Passform kann nicht geprüft werden.";
 if((w<=mw&&d<=md)||(d<=mw&&w<=md))return "Passt in ein Standardmodul ("+mw+" × "+md+" cm).";
 return "⚠️ Größer als ein Standardmodul ("+mw+" × "+md+" cm).";
}
function setupPlannerV28(){
 const panel=$("city");if(!panel||$("plannerV28"))return;
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
 const h=state.meta?.wishAlerts||[];box.innerHTML='<div class="sectionHead"><div><h2>Preisalarme</h2><p class="hint">Vergleich der aktuellen Online-Marktwerte mit deiner Kaufgrenze.</p></div><button class="btn secondary" id="notifyV28">Benachrichtigungen aktivieren</button></div>'+(h.length?h.map(x=>'<div class="alertRow"><b>'+esc(x.setNumber)+' · '+esc(x.name)+'</b><span>'+euro(x.market)+' ≤ '+euro(x.limit)+'</span></div>').join(""):'<p class="hint">Aktuell kein Set unter deiner Kaufgrenze.</p>');
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
 if(!(pV3(x.width)&&pV3(x.depth)&&pV3(x.height)))a.push("dims");
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
 const mw=pV3(state.meta?.moduleWidth)||25.6,md=pV3(state.meta?.moduleDepth)||25.6,w=pV3(x?.width),d=pV3(x?.depth);
 if(!w||!d)return null;return (w<=mw&&d<=md)||(d<=mw&&w<=md);
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
 topV.innerHTML=bestValue.length?bestValue.map((x,i)=>'<div class="rankRowV36"><span>#'+(i+1)+' <b>'+esc(x.setNumber)+'</b> · '+esc(x.name)+'</span><b>'+euro(x.value)+'</b></div>').join(""):'<p class="hint">Keine Werte vorhanden.</p>';
 topG.innerHTML=bestGain.length?bestGain.map((x,i)=>'<div class="rankRowV36"><span>#'+(i+1)+' <b>'+esc(x.setNumber)+'</b> · '+esc(x.name)+'</span><b class="'+(x.gain>=0?'goodTxt':'badTxt')+'">'+(x.gain>=0?'+':'')+euro(x.gain)+' · '+(x.pct>=0?'+':'')+x.pct.toFixed(1).replace(".",",")+' %</b></div>').join(""):'<p class="hint">Noch keine vergleichbaren Werte vorhanden.</p>';
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
 views.city.innerHTML='<div class="detailFacts"><div class="fact"><small>Stadtbereich</small><b>'+esc(x.cityArea||"–")+'</b></div><div class="fact"><small>Modul</small><b>'+esc(x.module||"–")+'</b></div><div class="fact"><small>Maße</small><b>'+(x.width??"–")+' × '+(x.depth??"–")+' × '+(x.height??"–")+' cm</b></div><div class="fact"><small>Passform</small><b>'+esc(fitWarningV28(x))+'</b></div><div class="fact"><small>Datenqualität</small><b>'+qualityScoreV38(x)+' %</b></div></div>';
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
 if(alerts.length){const div=document.createElement("div");div.className="serverAlertsV38";div.innerHTML='<h3>Server-Preisalarme</h3>'+alerts.slice(0,8).map(a=>'<div class="alertRow"><b>'+esc(a.set_number)+' · '+esc(a.set_name||"")+'</b><span>'+euro(a.market_price)+' ≤ '+euro(a.limit_price)+'</span></div>').join("");box.appendChild(div)}
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
