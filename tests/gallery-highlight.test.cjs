const test=require('node:test'),assert=require('node:assert/strict');
const {selectHighlight,imageFor}=require('../gallery-v606.js');
test('favorite selection preserves collection and ignores favorites absent from the account',()=>{
 const collection=[{setNumber:'1',name:'Own first',imageUrl:'https://example.invalid/1.png'},{setNumber:'2',name:'Own favorite'}];
 const before=JSON.stringify(collection);assert.equal(selectHighlight(collection,['foreign','2']),collection[1]);assert.equal(JSON.stringify(collection),before);
});
test('without favorites the gallery prefers a real image and supports cached catalog images',()=>{
 const collection=[{setNumber:'1'},{setNumber:'2',market:{imageUrl:'https://example.invalid/2.png'}}];assert.equal(selectHighlight(collection),collection[1]);assert.equal(imageFor(collection[1]),'https://example.invalid/2.png');
});
test('empty accounts have no highlight and unsafe image schemes are rejected',()=>{
 assert.equal(selectHighlight([]),null);assert.equal(selectHighlight(null),null);assert.equal(imageFor({imageUrl:'javascript:alert(1)'}),null);assert.equal(imageFor({imageUrl:'data:text/html,unsafe'}),null);
});
