/* v50.76: diagnostic-only catalog availability check; never writes collection data */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let currentRun=0;
 function ui(){
  const input=$('fSet'),status=$('marketStatusV575');if(!input||!status)return;
  let button=$('catalogDiagnoseV576');
  if(!button){button=document.createElement('button');button.id='catalogDiagnoseV576';button.type='button';button.className='btn secondary';button.textContent='Abfrage diagnostizieren';button.style.cssText='display:block;margin:8px 0;font-size:12px';status.after(button)}
  button.onclick=async()=>{
   status.textContent='Diagnose gestartet – bitte warten…';
   const n=String(input.value||'').trim().replace(/-1$/,'');
   const run=++currentRun;
   if(!/^\d{4,7}$/.test(n)){status.textContent='Ungültige Setnummer';return}
   const messages=[];const report=t=>{if(run===currentRun)status.textContent='Diagnose '+n+': '+t};
   const valid=r=>r&&typeof r==='object';
   const local=(()=>{try{return typeof enrichmentV3!=='undefined'&&enrichmentV3?.sets?.[n]}catch{return null}})();
   if(valid(local))messages.push('Lokaler Katalog: Treffer');
   else messages.push('Lokaler Katalog: kein Treffer');
   const all=(()=>{try{return typeof allSetsV46!=='undefined'&&allSetsV46?.sets?.[n]}catch{return null}})();
   if(valid(all))messages.push('Gesamtkatalog: Treffer');
   else messages.push('Gesamtkatalog: nicht lokal geladen oder kein Treffer');
   if(!navigator.onLine){messages.push('Gerät meldet offline');report(messages.join(' · '));return}
   // Public catalog diagnostics must not depend on the authenticated collection session.
   let client=typeof cloudV3!=='undefined'?cloudV3:null;
   if(!client){
     const cfg=window.LEGO_SUPABASE;
     if(window.supabase?.createClient&&cfg?.url&&cfg?.publishableKey){
       try{client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});messages.push('Separater Katalogzugang gestartet')}
       catch(e){messages.push('Katalog-Client konnte nicht gestartet werden')}
     }else messages.push('Katalog-Bibliothek oder Konfiguration fehlt');
   }
   if(!client){report(messages.join(' · '));return}
   button.disabled=true;report('Online-Katalog wird geprüft…');
   try{
    const result=await Promise.race([
      client.from('catalog_sets').select('*').eq('set_number',n).maybeSingle(),
      new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),5500))
    ]);
    if(result.error){const e=result.error;messages.push(e.code==='42501'||e.code==='PGRST301'?'Online-Zugriff verweigert':'Online-Katalogfehler ('+String(e.code||'unbekannt')+')')}
    else if(!result.data)messages.push('Online-Katalog: kein Eintrag');
    else {const row=result.data;const price=Number(row.market_used_eur)||Number(row.market_new_eur)||Number(row.marketUsedEUR)||Number(row.marketNewEUR)||0;messages.push(price>0?'Online-Katalog: Marktwert vorhanden':'Online-Katalog: Eintrag vorhanden, Marktwert fehlt')}
   }catch(err){messages.push(err?.message==='timeout'?'Online-Abfrage: Zeitüberschreitung':'Online-Abfrage technisch fehlgeschlagen')}
   finally{button.disabled=false}
   report(messages.join(' · '));
  };
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ui);else ui();
})();
