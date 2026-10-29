/* Owner management and capability reads; no collection record is sent directly. */
(function(root){
'use strict';
function create(client,model,expectedOwner){
 const fields='token,items,active,updated_at';
 async function user(){const {data,error}=await client.auth.getUser();if(error||!data?.user||data.user.is_anonymous)throw Error('Bitte melde dich erneut an.');if(expectedOwner&&data.user.id!==expectedOwner)throw Error('Das Konto hat sich geändert. Bitte öffne die Freigabe erneut.');return data.user.id}
 function checked(response){if(response.error)throw Error('Die Freigabe konnte nicht geladen oder gespeichert werden. Bitte prüfe deine Verbindung und versuche es erneut.');return response.data}
 return {
  async load(){const id=await user();return checked(await client.from('showcase_links').select(fields).eq('owner_id',id).maybeSingle())},
  async save(items,existing){const id=await user(),safe=model.clean(items);return checked(await (existing?client.from('showcase_links').update({items:safe,active:true,updated_at:new Date().toISOString()}).eq('owner_id',id):client.from('showcase_links').insert({owner_id:id,items:safe})).select(fields).single())},
  async deactivate(){const id=await user();return checked(await client.from('showcase_links').update({active:false,updated_at:new Date().toISOString()}).eq('owner_id',id).select(fields).single())},
  async read(token){if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(token))throw Error('Ungültiger Freigabelink.');const data=checked(await client.rpc('read_showcase',{link_token:token}));return data?{sets:model.clean(data.sets),updated_at:data.updated_at}:null}
 };
}
const api={create};if(typeof module==='object')module.exports=api;else root.BrickShowcaseService=api;
})(typeof globalThis==='object'?globalThis:this);
