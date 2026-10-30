/* v50.59 — non-destructive cloud synchronization diagnostics and confirmation. */
(function(){
  'use strict';
  const initialSave=cloudSaveV3;
  // Stop allocating a new full JSON snapshot on every edit; leave existing snapshots intact.
  const originalSnapshotV561=snapshotV544;
  snapshotV544=function(reason='Automatische Sicherung',force=false){
    if(!force)return true;
    return originalSnapshotV561(reason,true);
  };
  let saveInFlight=null;
  function collectionSignature(s){
    const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
    const copy={...s,meta:{...(s?.meta||{})}};
    delete copy.meta.lastCloudBackupAt;
    copy.collection=[...(s?.collection||[])].sort((a,b)=>String(a.setNumber).localeCompare(String(b.setNumber),undefined,{numeric:true}));
    return JSON.stringify(canonical(copy));
  }
  function report(status,message,user=cloudUserV3?.id){
    if(cloudUserV3?.id!==user)return;
    cloudStatusV3(message);
    if(typeof window!=='undefined')window.BrickSaveStatus?.set(status,message,user||null);
  }
  function pending(user,status,message){
    if(cloudUserV3?.id!==user)return {status:'account-changed'};
    const sync=syncInfoV547(user);sync.dirty=true;
    try{storeSyncV547(user,sync)}catch(_){}
    report(status,message,user);return {status};
  }
  function safeRecoveryCopy(label){
    // No additional full-state copies in localStorage: iOS quota is limited.
    // Existing historical recovery copies remain untouched until the owner exports them.
    return true;
  }
  function cleanupAfterExport(){
    if(!cloudUserV3)return;
    if(!confirm('Du hast eine Rettungskopie heruntergeladen? Alte lokale Vollsicherungen dieses Kontos entfernen, um Speicher freizugeben? Die Cloud-Sammlung wird NICHT verändert.'))return;
    const key=backupKeyV544();
    // Do not remove the newest checkpoint; discard older duplicated full snapshots.
    try{
      const rows=backupRowsV544();
      if(rows.length>1)localStorage.setItem(key,JSON.stringify(rows.slice(0,1)));
      localStorage.removeItem('bcm-recovery-v559:'+cloudUserV3.id);
      localStorage.removeItem('brick-city-backups-v544-local');
      cloudStatusV3('Alte lokale Kopien bereinigt. Cloud-Bestand unverändert. Bitte Speicherung erneut prüfen.');
    }catch(err){cloudStatusV3('Speicherbereinigung nicht vollständig: '+String(err?.message||err))}
    renderSyncConflictV547();
  }
  async function saveVerified(show=false){
    const user=cloudUserV3?.id;
    if(!user||!cloudV3||cloudApplyingV3)return {status:'unavailable'};
    if(!navigator.onLine)return pending(user,'offline','Offline · Änderungen auf diesem Gerät vorgemerkt. Cloud noch nicht bestätigt.');
    if(show&&syncInfoV547(user).revision===undefined){
      await cloudSessionV3({user:cloudUserV3});
      if(cloudUserV3?.id!==user)return {status:'account-changed'};
      if(syncInfoV547(user).revision===undefined)return pending(user,'error','Cloud-Version noch nicht lesbar · Änderungen bleiben vorgemerkt.');
    }
    if(syncInfoV547(user).conflict){report('conflict','Gerätekonflikt · bitte unter Mein Konto prüfen.',user);return {status:'conflict'}}
    safeRecoveryCopy('Vor Cloud-Abgleich');
    report('saving','Wird gespeichert und in der Cloud geprüft…',user);
    try{
      const remote=await cloudV3.from('user_state').select('state,updated_at').eq('user_id',user).maybeSingle();
      if(cloudUserV3?.id!==user)return {status:'account-changed'};
      if(remote.error)return pending(user,'error','Cloud nicht lesbar: nichts überschrieben. '+remote.error.message);
      const localNums=new Set((state.collection||[]).map(x=>String(x.setNumber)));
      const missingInLocal=(remote.data?.state?.collection||[]).filter(x=>!localNums.has(String(x.setNumber)));
      if(missingInLocal.length || (remote.data?.state?.collection?.length||0) > (state.collection||[]).length){
        const sync=syncInfoV547(user);sync.conflict={remote:remote.data.state,revision:remote.data.updated_at||null};
        report('conflict','STOPP: Cloud enthält zusätzliche Sets. Bitte unter Mein Konto den Konflikt prüfen.',user);
        renderSyncConflictV547();return {status:'conflict'};
      }
      const savedSnapshot=structuredClone(state),outcome=await initialSave(show);
      if(outcome?.error)throw outcome.error;
      if(cloudUserV3?.id!==user)return {status:'account-changed'};
      const sync=syncInfoV547(user);
      if(sync.conflict){report('conflict','Gerätekonflikt · bitte unter Mein Konto prüfen.',user);return {status:'conflict'}}
      const verified=await cloudV3.from('user_state').select('state').eq('user_id',user).maybeSingle();
      if(cloudUserV3?.id!==user)return {status:'account-changed'};
      if(verified.error)return pending(user,'error','Cloud geschrieben, Nachprüfung nicht möglich: '+verified.error.message);
      if(collectionSignature(savedSnapshot)!==collectionSignature(verified.data?.state)){
        return pending(user,'error','Cloud-Bestand weicht ab · Änderungen bleiben vorgemerkt. Bitte Synchronisierung prüfen.');
      }
      if(collectionSignature(state)!==collectionSignature(savedSnapshot)){
        queueCloudSaveV3();return pending(user,'pending','Weitere Änderungen auf diesem Gerät vorgemerkt.');
      }
      sync.dirty=false;try{storeSyncV547(user,sync)}catch(_){}
      state.meta=state.meta||{};state.meta.lastCloudBackupAt=new Date().toISOString();
      try{persistBaseV3()}catch(error){console.warn('Backup timestamp',error)}
      if(typeof renderCommercialV520==='function')renderCommercialV520();
      report('confirmed','Cloud-Bestand bestätigt · '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}),user);
      return {status:'confirmed'};
    }catch(error){return pending(user,'error','Abgleich unterbrochen · Cloud nicht bestätigt. '+String(error?.message||error))}
  }
  // persist() queues autosave. A manual save can arrive during that request.
  // It must await the pending write instead of immediately checking stale data.
  cloudSaveV3=async function(show=false){
    const user=cloudUserV3?.id;
    while(saveInFlight)await saveInFlight;
    if(cloudUserV3?.id!==user)return;
    const task=saveVerified(show);
    saveInFlight=task;
    try{return await task}finally{if(saveInFlight===task)saveInFlight=null}
  };
  // Recover pending writes after transient network failures. Never bypass conflict checks.
  let retryDelayV559=5000, retryTimerV559=null;
  function pendingV559(){
    try{const id=cloudUserV3?.id;if(!id||!navigator.onLine||cloudApplyingV3)return false;
      const sync=syncInfoV547(id);return Boolean(sync?.dirty&&!sync?.conflict);
    }catch(_){return false}
  }
  function retryPendingV559(){
    if(retryTimerV559!==null){clearTimeout(retryTimerV559);retryTimerV559=null}
    if(!pendingV559())return;
    retryTimerV559=setTimeout(async()=>{
      retryTimerV559=null;
      if(!pendingV559())return;
      try{await cloudSaveV3(syncInfoV547(cloudUserV3.id).revision===undefined)}catch(err){console.warn('Cloud retry',err)}
      if(pendingV559()){
        retryDelayV559=Math.min(retryDelayV559*2,60000);
        retryPendingV559();
      }else retryDelayV559=5000;
    },retryDelayV559)
  }
  const saveWithRetryV559=cloudSaveV3;
  cloudSaveV3=async function(show=false){
    const outcome=await saveWithRetryV559(show);
    if(pendingV559())retryPendingV559();
    else {retryDelayV559=5000;if(retryTimerV559!==null){clearTimeout(retryTimerV559);retryTimerV559=null}}
    return outcome;
  };
  window.addEventListener('online',()=>{retryDelayV559=500;retryPendingV559()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){retryDelayV559=500;retryPendingV559()}});
  setTimeout(retryPendingV559,3000);
  const protectedSessionV603=cloudSessionV3;
  cloudSessionV3=async function(session){
    const task=protectedSessionV603(session),user=session?.user?.id;
    if(user)report('loading','Cloud wird geladen…',user);
    else if(typeof window!=='undefined')window.BrickSaveStatus?.set('local','Nicht angemeldet · Änderungen bleiben auf diesem Gerät.',null);
    const result=await task;
    if(user&&cloudUserV3?.id===user){
      const sync=syncInfoV547(user);
      if(sync.conflict)report('conflict','Gerätekonflikt · bitte unter Mein Konto prüfen.',user);
      else if(sync.dirty){report(navigator.onLine?'pending':'offline','Änderungen auf diesem Gerät vorgemerkt · Cloud-Abgleich ausstehend.',user);retryPendingV559()}
      else if(sync.revision===undefined)report('error','Cloud noch nicht erreichbar · bitte erneut versuchen.',user);
      else report('loaded','Cloud-Daten geladen.',user);
    }
    return result;
  };
  function exportRecovery(){
    if(!cloudUserV3)return alert('Bitte zuerst anmelden.');
    const local=JSON.parse(localStorage.getItem('bcm-recovery-v559:'+cloudUserV3.id)||'[]');
    const old=backupRowsV544();
    const bundle={createdAt:new Date().toISOString(),current:state,protectionCopies:local,automaticBackups:old};
    downloadValueV545(JSON.stringify(bundle,null,2),'Brick-City-Rettungskopie.json','application/json');
  }
  function showProtection(){
    const box=cardV544('users','saveProtectionV559','Speicherprüfung & Rettungskopie');
    if(!box)return;
    box.innerHTML='<h2>Speicherprüfung & Rettungskopie</h2><p class="hint">Änderungen bleiben im gerätebezogenen Speicher vorgemerkt. Der Cloud-Bestand wird nach dem Speichern kontrolliert. Nicht bestätigte Speicherungen und Konflikte werden gemeldet.</p><div class="actions"><button class="btn secondary" id="exportProtectionV559">Sicherungen herunterladen</button><button class="btn secondary" id="cleanupProtectionV559">Alte lokale Kopien bereinigen</button></div>';
    $('exportProtectionV559').onclick=exportRecovery;
    $('cleanupProtectionV559').onclick=cleanupAfterExport;
  }
  // Never silently lose a save request when localStorage has reached its quota.
  const basePersistProtectedV559=persist;
  persist=function(){
    try{
      const result=basePersistProtectedV559();
      if(cloudUserV3?.id&&!cloudApplyingV3)report(navigator.onLine?'pending':'offline',navigator.onLine?'Auf diesem Gerät gespeichert · Cloud-Abgleich ausstehend.':'Offline · Änderungen auf diesem Gerät vorgemerkt.');
      return result;
    }
    catch(error){
      if(error?.name==='QuotaExceededError'||/quota/i.test(String(error?.message))){
        report('storage-error','Gerätespeicher voll · lokale Speicherung nicht bestätigt. Bitte unter Mein Konto eine Sicherung herunterladen.');
        if(cloudUserV3?.id)queueCloudSaveV3();
        return false;
      }
      throw error;
    }
  };
  const oldRender=renderSyncConflictV547;
  renderSyncConflictV547=function(){oldRender();showProtection()};
  const oldSwitch=switchTab;
  switchTab=function(id){const r=oldSwitch(id);if(id==='users')showProtection();return r};
  document.addEventListener('DOMContentLoaded',()=>{showProtection();const badge=$('appVersion');if(badge)badge.textContent='v50.96';document.querySelectorAll('#visibleVersionV553').forEach(el=>el.textContent='v50.96')});
})();
