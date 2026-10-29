/* Explicit public snapshot schema: never serialize collection records directly. */
(function(root){
'use strict';
const MAX=12,LIMIT=12000;
function image(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&['images.brickset.com','img.bricklink.com','images.bricklink.com','cdn.rebrickable.com','www.lego.com','images.lego.com'].includes(u.hostname)?u.href:''}catch{return ''}}
function clean(items){if(!Array.isArray(items)||!items.length||items.length>MAX)throw Error('Bitte 1 bis 12 Sets auswählen.');return items.map(x=>{const number=String(x.setNumber||'').trim();if(!/^\d{4,7}(?:-\d)?$/.test(number))throw Error('Ein Set hat keine gültige Setnummer.');return {setNumber:number,name:String(x.name||'LEGO Set').slice(0,120),imageUrl:image(x.imageUrl||x.market?.imageUrl)}})}
function encode(items){const bytes=new TextEncoder().encode(JSON.stringify({v:1,sets:clean(items)}));const token=btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');if(token.length>LIMIT)throw Error('Der Link ist zu lang. Bitte weniger Sets auswählen.');return token}
function decode(token){if(typeof token!=='string'||token.length>LIMIT||!/^[-\w]+$/.test(token))throw Error('Dieser Schaufenster-Link ist ungültig.');const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(token.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))));if(data.v!==1)throw Error('Diese Schaufenster-Version wird nicht unterstützt.');return clean(data.sets)}
const api={MAX,clean,encode,decode};if(typeof module==='object')module.exports=api;else root.BrickShowcase=api;
})(typeof globalThis==='object'?globalThis:this);
