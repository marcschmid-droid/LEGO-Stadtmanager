const test=require('node:test'),assert=require('node:assert/strict'),{select}=require('../collection-query.js');
const items=[
 {setNumber:'10002',name:'Bahnhof für Züge',purchasePrice:25,cityArea:'Bahnhof',tagsV547:['Favorit'],customCategoryV547:'Eisenbahn',storageRoom:'Keller',storageShelf:'Regal 2',condition:'Neu / OVP',purchaseDate:'2026-05-01',exemplars:[{date:'2026-01-01'}]},
 {setNumber:'10001',name:'Stadthaus',purchasePrice:0,cityArea:'Innenstadt',condition:'Gebraucht vollständig',box:'Nein',forSaleV546:true},
 {setNumber:'10003',name:'Schiff',purchasePrice:null,cityArea:'Hafen',tagsV547:['Favorit']},
 {setNumber:'10004',name:'Markt',purchasePrice:'',cityArea:'Innenstadt'}
];
const ids=rows=>rows.map(x=>x.setNumber);
test('multiple search terms match across fields, including tags, categories and structured storage',()=>{
 for(const query of ['keller eisenbahn','regal 2 favorit','zuege bahnhof','ZÜGE für','zuge bahnhof'])assert.deepEqual(ids(select(items,{query})),['10002']);
 assert.deepEqual(ids(select(items,{query:'keller schiff'})),[]);
});
test('tag, area and saved conditions are combined consistently',()=>{
 assert.deepEqual(ids(select(items,{tag:'Favorit',area:'Bahnhof',filter:{kind:'sealed'}})),['10002']);
 assert.deepEqual(ids(select(items,{tag:'Favorit',filter:{kind:'sale'}})),[]);
 assert.deepEqual(ids(select(items,{filter:{kind:'sale'}})),['10001']);
 assert.deepEqual(ids(select(items,{filter:{kind:'nobox'}})),['10001']);
});
test('unknown prices always follow known prices and genuine zero remains a known price',()=>{
 assert.deepEqual(ids(select(items,{sort:'price-asc'})),['10001','10002','10003','10004']);
 assert.deepEqual(ids(select(items,{sort:'price-desc'})),['10002','10001','10003','10004']);
});
test('purchase date includes all exemplars and unknown dates stay last',()=>{
 const rows=[{setNumber:'20002',exemplars:[{}, {purchaseDate:'2026-02-01'}]},{setNumber:'20001',purchaseDate:'2026-03-01'},{setNumber:'20003'}];
 assert.deepEqual(ids(select(rows,{sort:'date-asc'})),['20002','20001','20003']);
 assert.deepEqual(ids(select(rows,{sort:'date-desc'})),['20001','20002','20003']);
});
test('added sorting includes activity timestamps and respects ascending fallback order',()=>{
 const rows=[{setNumber:'30001'},{setNumber:'30002'},{setNumber:'30003'}];
 assert.deepEqual(ids(select(rows,{sort:'added-asc'})),['30001','30002','30003']);
 assert.deepEqual(ids(select(rows,{sort:'added-desc'})),['30003','30002','30001']);
 assert.deepEqual(ids(select(rows,{sort:'added-desc',activityLog:[{setNumber:'30001',type:'add',at:'2026-10-30'}]})),['30001','30003','30002']);
});
test('querying never mutates collection records or source order',()=>{
 const before=structuredClone(items);select(items,{query:'favorit',sort:'price-desc'});assert.deepEqual(items,before);
});
