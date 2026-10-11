/* v50.75 - transparent, non-destructive set-number catalog retrieval */
(function(){
 'use strict';
 const byId=id=>document.getElementById(id);
 let sequence=0;
 const isPositive=v=>Number.isFinite(Number(v))&&Number(v)>0;
 const valid=n=>/^\d{4,7}$/.test(String(n||'').trim().replace(/-1$/,''));
 function attach(){
   const field=byId('fSet');if(!field||field.dataset.catalogFeedbackV575)return;
   field.dataset.catalogFeedbackV575='yes';
   const status=byId('fCatalogStatusV35');
   const note=document.createElement('small');note.id='marketStatusV575';note.setAttribute('role','status');
   note.style.cssText='display:block;margin-top:6px;color:#556376';
   byId('fValue')?.closest('label')?.append(note);
   const retry=document.createElement('button');retry.type='button';retry.className='btn secondary';retry.textContent='Setdaten erneut prüfen';
   retry.style.cssText='margin-top:6px;font-size:12px;padding:8px 11px';
   field.closest('label')?.append(retry);
   async function check(force){
     const number=String(field.value||'').trim().replace(/-1$/,'');
     const current=++sequence;
     if(!valid(number)){note.textContent='Setnummer eingeben, um verfügbare Marktwerte abzurufen.';return}
     note.textContent='Setdaten werden geprüft…';
     const previous={name:byId('fName')?.value,image:byId('fImage')?.value,value:byId('fValue')?.value};
     try{
       // The application already searches its complete catalog and configured online catalog.
       const found=await lookupSetOnlineV45(number);
       if(current!==sequence||String(field.value||'').trim().replace(/-1$/,'')!==number)return;
       if(found){
         // Fill only missing fields; editing a stored set never erases manual entries.
         if(typeof fillSetFieldsV45==='function')fillSetFieldsV45(found);
         const raw=isPositive(found.marketUsedEUR)?Number(found.marketUsedEUR):isPositive(found.marketNewEUR)?Number(found.marketNewEUR):null;
         if(!isPositive(byId('fValue')?.value)&&raw!==null&&byId('fValue')){
           byId('fValue').value=raw.toFixed(2);
         }
         const filledValue=isPositive(byId('fValue')?.value);
         note.textContent=filledValue?'Marktwert vorhanden: '+Number(byId('fValue').value).toLocaleString('de-DE',{minimumFractionDigits:2,maximumFractionDigits:2})+' € (Katalogwert – Zustand prüfen).':'Name/Bild ggf. ergänzt. Kein Marktwert verfügbar – bitte manuell prüfen.';
         if(force&&status)status.textContent='Katalogprüfung abgeschlossen: '+(filledValue?'Wert vorhanden':'Marktwert fehlt');
       }else{
         note.textContent='Kein passender Katalogdatensatz gefunden. Marktwert nicht verfügbar – bitte manuell prüfen.';
         if(force&&status)status.textContent='Setnummer nicht im verfügbaren Katalog gefunden.';
       }
     }catch(e){if(current===sequence)note.textContent='Online-Abfrage derzeit nicht möglich. Kaufpreis und bisherige Daten bleiben unverändert.'}
   }
   retry.addEventListener('click',()=>check(true));
   field.addEventListener('change',()=>setTimeout(()=>check(false),60));
   field.addEventListener('input',()=>{const current=++sequence;setTimeout(()=>{if(current===sequence)check(false)},750)});
   // On editing an already saved set, label missing value without changing it.
   const priorOpen=window.openSet;
   if(typeof priorOpen==='function'&&!window.__marketOpenWrappedV575){
     window.__marketOpenWrappedV575=true;
     window.openSet=function(...args){const r=priorOpen.apply(this,args);setTimeout(()=>{if(byId('fValue'))note.textContent=isPositive(byId('fValue').value)?'Gespeicherter Marktwert vorhanden.':'Marktwert fehlt – Setdaten erneut prüfen.'},0);return r};
   }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach);else attach();
})();
