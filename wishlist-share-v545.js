/* Public viewer receives only intentionally published wishlist fields. */
(async()=>{
 const status=document.getElementById('publicShareStatus'),list=document.getElementById('publicWishItems'),id=location.hash.slice(1),cfg=window.LEGO_SUPABASE;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!cfg||!window.supabase){status.textContent='Dieser Freigabelink ist ungültig.';return}
 const client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const key=n=>'bcm-wish-reservation:'+id+':'+n;
 const token=n=>{try{return localStorage.getItem(key(n))}catch{return null}};
 async function render(){
  const {data,error}=await client.rpc('get_shared_wishlist',{p_share_id:id});
  if(error||!data){status.textContent='Diese Wunschliste ist nicht freigegeben oder derzeit nicht erreichbar.';list.replaceChildren();return}
  document.getElementById('shareTitle').textContent=data.title||'Wunschliste';status.textContent='';list.replaceChildren();
  for(const item of data.items||[]){const row=document.createElement('article');row.className='card';const name=document.createElement('h3');name.textContent=item.setNumber+' · '+item.name;const note=document.createElement('p');note.textContent=item.reserved?'Bereits reserviert':'Noch verfügbar';const button=document.createElement('button');button.className='btn secondary';const own=token(item.setNumber);button.textContent=own&&item.reserved?'Meine Reservierung aufheben':'Als Geschenk reservieren';button.disabled=item.reserved&&!own;
   button.onclick=async()=>{
    button.disabled=true;
    try{
     if(own&&item.reserved){const {data,error}=await client.rpc('release_wishlist_item',{p_share_id:id,p_set_number:item.setNumber,p_token:own});if(error||!data)throw new Error('Reservierung konnte nicht aufgehoben werden.');localStorage.removeItem(key(item.setNumber))}
     else {
      // Check persistent storage before taking a reservation, so its release token is not lost.
      localStorage.setItem(key(item.setNumber),'pending');localStorage.removeItem(key(item.setNumber));
      const {data,error}=await client.rpc('reserve_wishlist_item',{p_share_id:id,p_set_number:item.setNumber});if(error||!data)throw new Error('Das Geschenk wurde gerade reserviert oder ist nicht erreichbar.');
      try{localStorage.setItem(key(item.setNumber),data)}catch{await client.rpc('release_wishlist_item',{p_share_id:id,p_set_number:item.setNumber,p_token:data});throw new Error('Speicher nicht verfügbar. Reservierung wurde zurückgenommen.')}
     }
     await render();
    }catch(e){status.textContent=e.message||'Aktion fehlgeschlagen.';button.disabled=false}
   };row.append(name,note,button);list.append(row);
  }
 }
 await render();
})().catch(()=>{document.getElementById('publicShareStatus').textContent='Wunschliste konnte nicht geladen werden.'});
