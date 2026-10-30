/* Read-only valuation of individual copies. Missing values never become zero prices. */
(function(root){
 'use strict';
 const number=value=>value===null||value===undefined||String(value).trim()===''?null:
   Number.isFinite(Number(value))&&Number(value)>0?Number(value):null;
 const conditionType=value=>/neu|ovp/i.test(String(value||''))?'new':/gebraucht/i.test(String(value||''))?'used':'unknown';
 const stamp=value=>Number.isFinite(Date.parse(value))?String(value):null;
 function manualNew(m){const e=m?.manualMarketNewEstimate;return e&&e.currency==='EUR'&&e.basis==='asking-prices'&&number(e.value)!==null&&number(e.value)===number(m.marketNewEUR)?e:null}
 function quoteFor(copy,market,mode){
  const kind=mode==='new'||mode==='used'?mode:conditionType(copy.condition);
  const value=number(kind==='new'?market.marketNewEUR:kind==='used'?market.marketUsedEUR:null);
  return {value,kind,source:kind==='new'&&manualNew(market)?'Manuelle Schätzung · Neu / OVP · Angebotspreise':market.marketSourceFallback||market.marketSource||(market.brickeconomyUpdated?'BrickEconomy':'Online-Katalog')};
 }
 function summarize(item={},market=item.market||{},mode='condition',quote=quoteFor){
  const quantity=Number.isInteger(Number(item.quantity))&&Number(item.quantity)>0?Number(item.quantity):1;
  if(quantity>10000)return {quantity,rows:[],mixed:false,mismatch:true,complete:false,knownCount:0,knownTotal:0,total:null,average:null,conditionLabel:'Stückzahl prüfen',source:'',at:null,manual:false,priceLabel:'Marktwert gesamt'};
  const originals=Array.isArray(item.exemplars)?item.exemplars:[];
  // An inconsistent copy count needs review; never silently discard excess copies.
  const mismatch=originals.length>quantity;
  const conditions=Array.from({length:quantity},(_,i)=>String(originals[i]?.condition??item.condition??'Unbekannt').trim()||'Unbekannt');
  const mixed=new Set(conditions).size>1;
  const estimate=manualNew(market);
  const rows=conditions.map((condition,index)=>{
   const exemplar=originals[index]||{},kind=mode==='new'||mode==='used'?mode:conditionType(condition);
   let value=null,source='',at=null;
   if(number(exemplar.currentValue)!==null){
    value=number(exemplar.currentValue);source=exemplar.valueSource||'Manuell erfasst';at=stamp(exemplar.valueCheckedAt);
   }else if((item.marketAuto===false||mode==='manual')&&number(item.currentValue)!==null){
    value=number(item.currentValue);source=item.valueSource||'Manuell erfasst';at=stamp(item.valueCheckedAt);
   }else if(kind!=='unknown'){
    const result=quote({...item,...exemplar,condition,exemplars:undefined},market,mode)||{};
    // A new-price fallback is not evidence for a used-copy price, or vice versa.
    if(result.kind===kind&&number(result.value)!==null){
     value=number(result.value);source=result.source||'Online-Katalog';
     at=stamp(kind==='new'&&estimate?estimate.recordedAt:market.bricklinkUpdated||market.brickeconomyUpdated||market.updatedAt);
    }
   }
   // Preserve already-recorded homogeneous legacy values when the catalog is unavailable.
   // A mixed set must not inherit one scalar price for every copy.
   if(value===null&&!mixed&&mode!=='new'&&mode!=='used'&&!(kind==='used'&&estimate)&&number(item.currentValue)!==null){
    value=number(item.currentValue);source=item.valueSource||'Erfasster Wert';at=stamp(item.valueCheckedAt);
   }
   return {index,condition,kind,value,source,at};
  });
  const known=rows.filter(row=>row.value!==null),complete=!mismatch&&known.length===quantity;
  const variedPrices=new Set(known.map(row=>row.value)).size>1;
  const knownTotal=known.reduce((sum,row)=>sum+row.value,0),sources=[...new Set(known.map(row=>row.source))];
  const dates=known.map(row=>row.at).filter(Boolean).sort((a,b)=>Date.parse(a)-Date.parse(b));
  return {quantity,rows,mixed,variedPrices,mismatch,complete,knownCount:known.length,knownTotal,
   total:complete?knownTotal:null,average:complete?knownTotal/quantity:null,
   conditionLabel:mismatch?'Exemplare prüfen':mixed?'Gemischter Zustand':conditionType(conditions[0])==='unknown'?'Zustand offen':conditions[0],
   source:sources.join(' / '),at:known.length&&known.every(row=>row.at)?dates[0]||null:null,
   manual:known.some(row=>/manuell|schätzung/i.test(row.source)),
   priceLabel:mixed||variedPrices?'Marktwert gesamt':'Marktwert / Stück'};
 }
 function editManual(exemplar,raw,now=new Date().toISOString()){
  const copy={...exemplar},text=String(raw??'').trim();
  if(!text){for(const key of ['currentValue','marketAuto','valueSource','valueCheckedAt'])delete copy[key];return copy}
  const value=number(text.replace(',','.'));if(value===null)throw Error('Bitte einen positiven Marktwert eingeben oder das Feld leer lassen.');
  return {...copy,currentValue:value,marketAuto:false,valueSource:'Manuell erfasst · einzelnes Exemplar',valueCheckedAt:now};
 }
 const api={summarize,conditionType,editManual};
 if(typeof module==='object'&&module.exports)module.exports=api;else root.BrickCollectionValuation=api;
})(typeof globalThis==='object'?globalThis:this);
