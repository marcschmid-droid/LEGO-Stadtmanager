/* Stable, pure collection calculations. No storage or cloud mutations. */
(function(root){
 'use strict';
 function num(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=typeof v==='number'?v:Number(String(v??'').replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)&&n>=0?n:null}
 function metrics(s){
   const collection=Array.isArray(s?.collection)?s.collection:[];
   const count=collection.length;
   const copies=collection.reduce((a,x)=>a+(num(x.quantity)??1),0);
   const valueKnown=collection.filter(x=>num(x.currentValue)!==null);
   const value=valueKnown.reduce((a,x)=>a+(num(x.currentValue)??0)*(num(x.quantity)??1),0);
   const recorded=collection.filter(x=>num(x.purchasePrice)!==null);
   const purchases=recorded.reduce((a,x)=>a+(num(x.purchasePrice)??0)*(num(x.quantity)??1),0);
   const baseline=num(s?.meta?.investmentBaseline)??num(s?.meta?.brickrInvestmentReference);
   const investment=baseline!==null?baseline+collection.reduce((a,x)=>a+(Array.isArray(x.exemplars)?x.exemplars:[]).filter(e=>e.addedAfterBaseline).reduce((b,e)=>b+(num(e.price)??0),0),0):recorded.length===collection.length?purchases:null;
   const completeValue=count>0&&valueKnown.length===count;
   const completeInvestment=investment!==null;
   return {count,copies,value:completeValue?value:null,investment:completeInvestment?investment:null,returnPct:completeValue&&completeInvestment&&investment>0?(value-investment)/investment*100:null,valueCovered:valueKnown.length,costCovered:recorded.length};
 }
 root.BrickCollectionMetrics={metrics};
})(typeof module==='object'&&module.exports?module.exports:window);
