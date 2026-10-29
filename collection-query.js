/* One read-only query model shared by cards, saved views and batch tools. */
(function(root){
 'use strict';
 const collator=new Intl.Collator('de',{numeric:true,sensitivity:'base'});
 const plain=value=>String(value??'').toLocaleLowerCase('de').replace(/ß/g,'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g,'');
 const german=value=>plain(String(value??'').replace(/ä/gi,'ae').replace(/ö/gi,'oe').replace(/ü/gi,'ue'));
 function searchText(item){
  const fields=[item.setNumber,item.name,item.category,item.cityArea,item.storage,item.storageRoom,item.storageShelf,item.storageBin,item.module,item.customCategoryV547,...(Array.isArray(item.tagsV547)?item.tagsV547:[])].join(' ');
  return plain(fields)+' '+german(fields);
 }
 function matchesQuery(item,query){const words=plain(query).trim().split(/\s+/).filter(Boolean),text=searchText(item);return words.every(word=>text.includes(word))}
 function amount(value){if(value===null||value===undefined||String(value).trim()==='')return null;const number=Number(value);return Number.isFinite(number)&&number>=0?number:null}
 function date(value){if(!value||!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(String(value)))return null;const stamp=Date.parse(value);return Number.isFinite(stamp)?stamp:null}
 function purchaseDate(item){const dates=[item.purchaseDate,...(Array.isArray(item.exemplars)?item.exemplars.flatMap(e=>[e.date,e.purchaseDate]):[])].map(date).filter(x=>x!==null);return dates.length?Math.min(...dates):null}
 function savedMatch(item,filter){
  if(!filter)return true;
  if(filter.query&&!matchesQuery(item,filter.query))return false;
  if(filter.area&&item.cityArea!==filter.area)return false;
  if(filter.kind==='sealed'&&item.condition!=='Neu / OVP')return false;
  if(filter.kind==='nobox'&&!(item.box==='Nein'||(Array.isArray(item.exemplars)&&item.exemplars.length&&item.exemplars.every(e=>e.box==='Nein'))))return false;
  return !(filter.kind==='sale'&&!item.forSaleV546);
 }
 function hasFilters(options={}){const f=options.filter;return !!(String(options.query||'').trim()||options.area||options.tag||f?.query||f?.area||f?.kind)}
 function select(collection,options={}){
  const items=Array.isArray(collection)?collection:[],logged=new Map();
  for(const event of options.activityLog||[]){if(!['add','restore'].includes(event.type))continue;const at=date(event.at),key=String(event.setNumber);if(at!==null)logged.set(key,Math.max(logged.get(key)??-Infinity,at))}
  const rows=items.map((item,index)=>{
   const stamps=[logged.get(String(item.setNumber)),...['addedAt','createdAt','dateAdded','importedAt','created_at','addedDate'].map(key=>date(item[key]))].filter(x=>x!==null&&x!==undefined);
   return {item,index,price:amount(item.purchasePrice),purchased:purchaseDate(item),added:stamps.length?Math.max(...stamps):null};
  }).filter(({item})=>(!options.query||matchesQuery(item,options.query))&&(!options.area||item.cityArea===options.area)&&(!options.tag||(Array.isArray(item.tagsV547)&&item.tagsV547.includes(options.tag)))&&savedMatch(item,options.filter));
  const [field,direction]=String(options.sort||'number-asc').split('-'),sign=direction==='desc'?-1:1;
  const number=(a,b)=>collator.compare(String(a.item.setNumber||''),String(b.item.setNumber||''));
  rows.sort((a,b)=>{
   if(field==='number')return sign*number(a,b);
   const key=row=>field==='added'?row.added:field==='date'?row.purchased:field==='price'?row.price:null;
   const av=key(a),bv=key(b);
   if(av===null&&bv!==null)return 1;if(bv===null&&av!==null)return -1;
   if(av!==null&&bv!==null&&av!==bv)return sign*(av-bv);
   return field==='added'?sign*(a.index-b.index):number(a,b);
  });
  return rows.map(row=>row.item);
 }
 const api={select,hasFilters,matchesQuery,amount,purchaseDate};
 if(typeof module==='object')module.exports=api;else root.BrickCollectionQuery=api;
})(typeof globalThis==='object'?globalThis:this);
