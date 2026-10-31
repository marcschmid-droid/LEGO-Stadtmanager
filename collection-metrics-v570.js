/* Stable, pure collection calculations. No storage or cloud mutations. */
(function(root){
 'use strict';
 function num(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=typeof v==='number'?v:Number(String(v??'').replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>=0?n:null}
 const valuation=typeof module==='object'&&module.exports?require('./collection-valuation.js'):root.BrickCollectionValuation;
 function metrics(s,resolve){
   const collection=Array.isArray(s?.collection)?s.collection:[];
   const count=collection.length;

   const valuations=collection.map(x=>resolve?resolve(x):valuation.summarize(x));
   const copies=valuations.reduce((sum,v)=>sum+v.quantity,0);
   const pricedCopies=valuations.reduce((sum,v)=>sum+(v.mismatch?0:v.knownCount),0);
   const partialValue=valuations.reduce((sum,v)=>sum+(v.mismatch?0:v.knownTotal),0);
   const issues=[];
   valuations.forEach((v,i)=>{
    const item=collection[i];
    if(v.mismatch){issues.push({setNumber:String(item.setNumber),index:null,reason:'Stückzahl und Exemplare prüfen'});return}
    v.rows.filter(row=>row.value===null).forEach(row=>issues.push({setNumber:String(item.setNumber),index:row.index,reason:row.kind==='unknown'?'Zustand fehlt':'Marktwert fehlt'}));
   });
   const valueKnown=valuations.filter(x=>x.complete);
   const value=valueKnown.reduce((a,x)=>a+x.total,0);
   const recorded=collection.filter(x=>num(x.purchasePrice)!==null);
   const purchases=recorded.reduce((a,x)=>a+(num(x.purchasePrice)??0),0);
   const baseline=num(s?.meta?.investmentBaseline)??num(s?.meta?.brickrInvestmentReference);
   const investment=count===0?0:baseline!==null?baseline+collection.reduce((a,x)=>a+(Array.isArray(x.exemplars)?x.exemplars:[]).filter(e=>e.addedAfterBaseline).reduce((b,e)=>b+(num(e.price)??0),0),0):recorded.length===collection.length?purchases:null;
   const completeValue=count>0&&valueKnown.length===count;
   const completeInvestment=investment!==null;
   return {count,copies,pricedCopies,missingCopies:copies-pricedCopies,partialValue:pricedCopies?partialValue:null,issues,value:completeValue?value:null,investment:completeInvestment?investment:null,returnPct:completeValue&&completeInvestment&&investment>0?(value-investment)/investment*100:null,valueCovered:valueKnown.length,costCovered:recorded.length};
 }
 root.BrickCollectionMetrics={metrics};
})(typeof module==='object'&&module.exports?module.exports:window);
