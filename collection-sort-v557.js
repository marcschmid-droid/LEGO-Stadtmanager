/* Sammlung: Sortieren nach Setnummer, Kaufdatum und Kaufpreis (v50.57). */
(function(){
  const KEY="brickCollectionSortV557";
  const options=[
    ["number-asc","Setnummer: aufsteigend"],
    ["number-desc","Setnummer: absteigend"],
    ["date-desc","Kaufdatum: neueste zuerst"],
    ["date-asc","Kaufdatum: älteste zuerst"],
    ["price-desc","Kaufpreis: höchster zuerst"],
    ["price-asc","Kaufpreis: niedrigster zuerst"]
  ];
  const values=new Set(options.map(x=>x[0]));
  let mode="number-asc";
  try{const stored=localStorage.getItem(KEY);if(values.has(stored))mode=stored;}catch(_){}
  const numeric=new Intl.Collator("de",{numeric:true,sensitivity:"base"});
  function dateOf(x){
    const dates=[x.purchaseDate,...(Array.isArray(x.exemplars)?x.exemplars.map(e=>e.date||e.purchaseDate):[])]
      .filter(v=>v&&/^\\d{4}-\\d{2}-\\d{2}/.test(String(v)))
      .map(v=>Date.parse(String(v).slice(0,10))).filter(Number.isFinite);
    return dates.length?Math.min(...dates):null;
  }
  function sortCollection(rows){
    const [field,direction]=mode.split("-");
    const sign=direction==="desc"?-1:1;
    return [...rows].sort((a,b)=>{
      if(field==="number")return sign*numeric.compare(String(a.setNumber||""),String(b.setNumber||""));
      const av=field==="date"?dateOf(a):Number(a.purchasePrice);
      const bv=field==="date"?dateOf(b):Number(b.purchasePrice);
      const va=field==="date"?av:(Number.isFinite(av)&&av>=0?av:null);
      const vb=field==="date"?bv:(Number.isFinite(bv)&&bv>=0?bv:null);
      if(va===null&&vb!==null)return 1;
      if(vb===null&&va!==null)return -1;
      if(va!==null&&vb!==null&&va!==vb)return sign*(va-vb);
      return numeric.compare(String(a.setNumber||""),String(b.setNumber||""));
    });
  }
  function ensureControl(){
    const toolbar=document.querySelector("#collection > .toolbar");
    if(!toolbar)return;
    let select=document.getElementById("collectionSortV557");
    if(select)return;
    select=document.createElement("select");
    select.id="collectionSortV557";
    select.setAttribute("aria-label","Sammlung sortieren");
    select.title="Sammlung sortieren";
    select.innerHTML=options.map(([v,label])=>'<option value="'+v+'">'+label+'</option>').join("");
    select.value=mode;
    select.style.cssText="min-height:44px;max-width:100%;min-width:180px;flex:1 1 200px";
    select.addEventListener("change",()=>{
      mode=select.value;
      try{localStorage.setItem(KEY,mode);}catch(_){}
      if(typeof renderCollection==="function")renderCollection();
    });
    const view=document.getElementById("toggleView");
    toolbar.insertBefore(select,view||null);
  }
  const originalFiltered=filteredV3;
  filteredV3=function(){return sortCollection(originalFiltered());};
  const originalRender=renderCollection;
  renderCollection=function(){ensureControl();return originalRender.apply(this,arguments);};
  ensureControl();
})();
