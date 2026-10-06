const STORE="lego-stadtmanager-ghpages-v2";
let state={collection:[],wishlist:[],trackShopping:[],classifiedOffers:[],meta:{}},editing=null;
const $=x=>document.getElementById(x),esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const euro=v=>new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(Number(v||0));
const DEFAULT_META={version:"2.1",brickrInvestmentReference:18026.14,confirmedUniqueSets:166,confirmedExemplars:245};
const DEFAULT_TRACKS=[
 {item:"Gerade Schienen",target:42,offerQty:24,confirmedOwned:null,status:"Bestand prüfen",note:"Planwert aus dem bisherigen Zugkonzept; noch nicht geometrisch exakt verifiziert."},
 {item:"Kurvenschienen",target:48,offerQty:16,confirmedOwned:null,status:"Bestand prüfen",note:"Planwert aus dem bisherigen Zugkonzept; noch nicht geometrisch exakt verifiziert."},
 {item:"Flexschienen",target:8,offerQty:16,confirmedOwned:null,status:"Bestand prüfen",note:"Grasbrunn würde den bisherigen Planwert bereits abdecken."},
 {item:"Weiche links",target:2,offerQty:2,confirmedOwned:null,status:"Bestand prüfen",note:"Für Hauptbahnhof/Hafenanschluss."},
 {item:"Weiche rechts",target:2,offerQty:2,confirmedOwned:null,status:"Bestand prüfen",note:"Für Hauptbahnhof/Hafenanschluss."}
];
const DEFAULT_OFFERS=[{title:"LEGO Eisenbahn – 60 Schienen/Zubehör",location:"Grasbrunn",price:55,shipping:"zzgl. Versand",details:"24 Gerade, 16 Kurven, 16 Flex, 2 linke + 2 rechte Weichen",status:"Angefragt",note:"Bevorzugtes Angebot für den Zugplan."}];

function migrate(){
 state.collection=state.collection||[]; state.wishlist=state.wishlist||[];
 if(!state.trackShopping?.length)state.trackShopping=JSON.parse(JSON.stringify(DEFAULT_TRACKS));
 if(!state.classifiedOffers?.length)state.classifiedOffers=JSON.parse(JSON.stringify(DEFAULT_OFFERS));
 state.meta={...DEFAULT_META,...(state.meta||{})};
}
function init(){
 const saved=localStorage.getItem(STORE);
 if(saved){try{state=JSON.parse(saved)}catch{}}
 else if(window.LEGO_SEED_DATA){state=JSON.parse(JSON.stringify(window.LEGO_SEED_DATA))}
 migrate();persist();bind();refresh();
 if("serviceWorker" in navigator)navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
}
function persist(){localStorage.setItem(STORE,JSON.stringify(state))}
function switchTab(id){document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===id));document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===id))}
function refresh(){
 $("kUnique").textContent=state.collection.length;
 $("kQty").textContent=state.collection.reduce((s,x)=>s+Number(x.quantity||0),0);
 const inv=state.collection.reduce((s,x)=>s+Number(x.quantity||0)*Number(x.purchasePrice||0),0);
 $("kInvest").textContent=euro(inv);
 $("investRef").textContent=state.meta?.brickrInvestmentReference?"Brickr-Referenz: "+euro(state.meta.brickrInvestmentReference):"";
 $("kWish").textContent=state.wishlist.length;
 renderCollection();renderWishlist();renderTracks();renderOffers();
}
function renderCollection(){
 const q=($("search").value||"").toLowerCase();
 const data=state.collection.filter(x=>[x.setNumber,x.name,x.category,x.cityArea].join(" ").toLowerCase().includes(q)).sort((a,b)=>String(a.setNumber).localeCompare(String(b.setNumber),undefined,{numeric:true}));
 $("collectionBody").innerHTML=data.length?data.map(x=>`<tr>
  <td>${x.imageUrl?`<img class="thumb" src="${esc(x.imageUrl)}" alt=""><br>`:""}<b>${esc(x.setNumber)}</b></td><td>${esc(x.name)}</td><td>${x.quantity||1}</td>
  <td>${euro(x.purchasePrice)}</td><td>${euro(x.currentValue)}</td><td>${esc(x.cityArea||"")}</td>
  <td><button class="rowbtn" onclick="editSet('${esc(x.setNumber)}')">✏️</button><button class="rowbtn" onclick="delSet('${esc(x.setNumber)}')">🗑️</button></td>
 </tr>`).join(""):`<tr><td colspan="7">Keine Sets gefunden.</td></tr>`;
}
function renderWishlist(){
 $("wishBody").innerHTML=state.wishlist.length?state.wishlist.map(x=>`<tr>
  <td><b>${esc(x.priority||"")}</b></td><td>${x.imageUrl?`<img class="thumb" src="${esc(x.imageUrl)}" alt=""><br>`:""}${esc(x.setNumber)}</td><td>${esc(x.name)}</td>
  <td>${esc(x.area||x.cityArea||"")}</td><td>${euro(x.price)}</td>
  <td><button class="rowbtn" onclick="buyWish('${esc(x.setNumber)}')">✅ In Bestand</button><button class="rowbtn" onclick="delWish('${esc(x.setNumber)}')">🗑️</button></td>
 </tr>`).join(""):`<tr><td colspan="6">Keine Wünsche.</td></tr>`;
}
function renderTracks(){
 const rows=state.trackShopping.map((x,i)=>`<tr><td><b>${esc(x.item)}</b><div class="trackNote">${esc(x.note||"")}</div></td>
 <td><input type="number" min="0" value="${x.target??0}" onchange="trackEdit(${i},'target',this.value)"></td>
 <td><input type="number" min="0" value="${x.confirmedOwned??""}" placeholder="?" onchange="trackEdit(${i},'confirmedOwned',this.value)"></td>
 <td>${x.offerQty??0}</td><td>${esc(x.status||"")}</td></tr>`).join("");
 $("trackTable").innerHTML=`<table class="trackTable"><thead><tr><th>Teil</th><th>Planwert</th><th>Bestätigt vorhanden</th><th>Grasbrunn</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
}
window.trackEdit=(i,k,v)=>{state.trackShopping[i][k]=v===""?null:Number(v);persist();renderTracks()};
function renderOffers(){
 $("offerList").innerHTML=state.classifiedOffers.length?state.classifiedOffers.map((o,i)=>`<div class="offer"><h3>${esc(o.title)}</h3>
 <div class="offerMeta">${esc(o.location||"")} · ${euro(o.price)} ${esc(o.shipping||"")}</div><span class="offerStatus">${esc(o.status||"")}</span>
 <p>${esc(o.details||"")}</p><div class="trackNote">${esc(o.note||"")}</div><button class="rowbtn" onclick="deleteOffer(${i})">🗑️ Entfernen</button></div>`).join(""):"<p>Keine Angebote gespeichert.</p>";
}
window.deleteOffer=i=>{state.classifiedOffers.splice(i,1);persist();renderOffers()};

function openSet(x=null){
 editing=x?.setNumber||null;$("setTitle").textContent=x?"Set bearbeiten":"Set hinzufügen";$("fSet").disabled=!!x;
 $("fSet").value=x?.setNumber||"";$("fName").value=x?.name||"";$("fQty").value=x?.quantity||1;$("fPrice").value=x?.purchasePrice||"";
 $("fValue").value=x?.currentValue||"";$("fArea").value=x?.cityArea||"";$("fCat").value=x?.category||"";
 $("fWidth").value=x?.width??"";$("fDepth").value=x?.depth??"";$("fHeight").value=x?.height??"";$("fImage").value=x?.imageUrl||"";$("fNote").value=x?.note||"";
 $("setModal").classList.add("show");
}
function closeSet(){$("setModal").classList.remove("show");$("fSet").disabled=false;editing=null}
function saveSet(){
 const n=$("fSet").value.trim(),name=$("fName").value.trim();if(!n||!name)return alert("Setnummer und Name fehlen.");
 const o={setNumber:n,name,quantity:Math.max(1,Number($("fQty").value||1)),purchasePrice:Number($("fPrice").value||0),currentValue:Number($("fValue").value||0),
 cityArea:$("fArea").value.trim(),category:$("fCat").value.trim(),width:$("fWidth").value===""?null:Number($("fWidth").value),depth:$("fDepth").value===""?null:Number($("fDepth").value),
 height:$("fHeight").value===""?null:Number($("fHeight").value),imageUrl:$("fImage").value.trim(),note:$("fNote").value.trim()};
 if(editing){const i=state.collection.findIndex(x=>x.setNumber===editing);if(i>=0)state.collection[i]={...state.collection[i],...o}}
 else{const ex=state.collection.find(x=>x.setNumber===n);if(ex){ex.quantity=Number(ex.quantity||0)+o.quantity;if(o.purchasePrice)ex.purchasePrice=o.purchasePrice;if(o.imageUrl)ex.imageUrl=o.imageUrl}else state.collection.push(o);state.wishlist=state.wishlist.filter(x=>x.setNumber!==n)}
 persist();refresh();closeSet();
}
window.editSet=n=>{const x=state.collection.find(y=>y.setNumber===n);if(x)openSet(x)};
window.delSet=n=>{if(confirm("Set wirklich löschen?")){state.collection=state.collection.filter(x=>x.setNumber!==n);persist();refresh()}};
window.delWish=n=>{state.wishlist=state.wishlist.filter(x=>x.setNumber!==n);persist();refresh()};
window.buyWish=n=>{const w=state.wishlist.find(x=>x.setNumber===n);if(!w)return;const ex=state.collection.find(x=>x.setNumber===n);
 if(ex)ex.quantity=Number(ex.quantity||0)+1;else state.collection.push({setNumber:w.setNumber,name:w.name,quantity:1,purchasePrice:Number(w.price||0),currentValue:0,cityArea:w.area||w.cityArea||"",category:"",imageUrl:w.imageUrl||"",note:w.reason||""});
 state.wishlist=state.wishlist.filter(x=>x.setNumber!==n);persist();refresh();switchTab("collection");
};

function parseLine(line,d){let a=[],c="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++}else q=!q}else if(ch===d&&!q){a.push(c);c=""}else c+=ch}a.push(c);return a}
async function importCsv(f){
 const t=await f.text(),ls=t.split(/\r?\n/).filter(Boolean);if(ls.length<2)return;const d=ls[0].includes(";")?";":",",h=parseLine(ls[0],d).map(x=>x.trim().toLowerCase());
 const find=(...names)=>{for(const n of names){const i=h.findIndex(x=>x.includes(n));if(i>=0)return i}return -1};
 const iSet=find("artikelnummer","setnummer"),iName=find("setname"),iQty=find("anzahl"),iPrice=find("investment je stück","kaufpreis"),iValue=find("aktueller wert je stück"),iCat=find("kategorie"),iArea=find("stadtbereich"),iNote=find("planungshinweis","notiz");let count=0;
 for(const l of ls.slice(1)){const p=parseLine(l,d),num=(p[iSet]||"").trim(),name=(p[iName]||"").trim();if(!num||!name)continue;const val=i=>i>=0?p[i]:"";
 const obj={setNumber:num,name,quantity:Number(val(iQty)||1),purchasePrice:Number(String(val(iPrice)||"0").replace(",",".")),currentValue:Number(String(val(iValue)||"0").replace(",",".")),category:val(iCat)||"",cityArea:val(iArea)||"",note:val(iNote)||""};
 const ex=state.collection.find(x=>x.setNumber===num);if(ex)Object.assign(ex,obj);else state.collection.push(obj);count++}
 persist();refresh();alert(count+" Zeilen importiert.");
}
function csvEsc(v){const s=String(v??"");return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function dl(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportCsv(){const H=["Artikelnummer","Setname","Anzahl","Investment je Stück (€)","Aktueller Wert je Stück (€)","Breite (cm)","Tiefe (cm)","Höhe (cm)","Kategorie","Stadtbereich","Planungshinweis"];const L=[H.join(";"),...state.collection.map(x=>[x.setNumber,x.name,x.quantity,x.purchasePrice,x.currentValue,x.width,x.depth,x.height,x.category,x.cityArea,x.note].map(csvEsc).join(";"))];dl(new Blob(["\ufeff"+L.join("\n")],{type:"text/csv"}),"LEGO_Sammlung_Export.csv")}
function bind(){
 document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));["addTop","addBtn","quickAdd"].forEach(id=>$(id).onclick=()=>openSet());$("quickExport").onclick=exportCsv;$("cancelSet").onclick=closeSet;$("saveSet").onclick=saveSet;$("search").oninput=renderCollection;
 $("wishAdd").onclick=()=>$("wishModal").classList.add("show");$("cancelWish").onclick=()=>$("wishModal").classList.remove("show");$("saveWish").onclick=()=>{const n=$("wSet").value.trim(),name=$("wName").value.trim();if(!n||!name)return alert("Setnummer und Name fehlen.");state.wishlist.push({priority:$("wPrio").value,setNumber:n,name,area:$("wArea").value.trim(),price:Number($("wPrice").value||0),imageUrl:$("wImage").value.trim(),reason:$("wReason").value.trim()});persist();refresh();$("wishModal").classList.remove("show")};
 $("addOffer").onclick=()=>$("offerModal").classList.add("show");$("cancelOffer").onclick=()=>$("offerModal").classList.remove("show");$("saveOffer").onclick=()=>{const title=$("oTitle").value.trim();if(!title)return alert("Titel fehlt.");state.classifiedOffers.push({title,location:$("oLocation").value.trim(),price:Number($("oPrice").value||0),status:$("oStatus").value,details:$("oDetails").value.trim(),note:$("oNote").value.trim()});persist();renderOffers();$("offerModal").classList.remove("show")};
 $("csvFile").onchange=e=>{if(e.target.files[0])importCsv(e.target.files[0]);e.target.value=""};$("exportCsv").onclick=exportCsv;$("exportJson").onclick=()=>dl(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),"LEGO_Stadtmanager_Backup.json");$("jsonFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{state=JSON.parse(await f.text());migrate();persist();refresh();alert("Backup geladen.")}catch{alert("Ungültiges Backup.")}e.target.value=""};
}
init();