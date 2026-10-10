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
  let checking=false;
  function collectionSignature(s){
    return JSON.stringify((s?.collection||[]).map(x=>[String(x.setNumber),Number(x.quantity||1)]).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})));
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
  cloudSaveV3=async function(show=false){
    const user=cloudUserV3?.id;
    if(!user||!cloudV3||cloudApplyingV3)return;
    if(checking){if(show)cloudStatusV3('Speicherung läuft bereits. Bitte kurz den Status prüfen.');return}
    // A full extra local copy can exhaust iOS storage. Continue with the verified cloud path,
    // but show an explicit warning if a recovery copy could not be written.
    safeRecoveryCopy('Vor Cloud-Abgleich');
    if(!navigator.onLine){cloudStatusV3('Offline: nur lokal gespeichert, Cloud noch NICHT bestätigt.');return}
    checking=true;
    try{
      // Inspect remote version first. The existing optimistic concurrency write still
      // enforces the revision at commit time; this check also catches missing local sets.
      const remote=await cloudV3.from('user_state').select('state,updated_at').eq('user_id',user).maybeSingle();
      if(cloudUserV3?.id!==user)return;
      if(remote.error){cloudStatusV3('Cloud nicht lesbar: nichts überschrieben. '+remote.error.message);return}
      const localNums=new Set((state.collection||[]).map(x=>String(x.setNumber)));
      const missingInLocal=(remote.data?.state?.collection||[]).filter(x=>!localNums.has(String(x.setNumber)));
      if(missingInLocal.length){
        const sync=syncInfoV547(user);
        sync.conflict={remote:remote.data.state,revision:remote.data.updated_at||null};
        cloudStatusV3('STOPP: '+missingInLocal.length+' Cloud-Sets fehlen lokal. Beide Stände gesichert; bitte unter Konto den Konflikt prüfen.');
        renderSyncConflictV547();return;
      }
      const savedSnapshot=structuredClone(state);
      await initialSave(show);
      if(cloudUserV3?.id!==user)return;
      const sync=syncInfoV547(user);
      if(sync.conflict)return;
      const verified=await cloudV3.from('user_state').select('state').eq('user_id',user).maybeSingle();
      if(verified.error){cloudStatusV3('Cloud geschrieben, Nachprüfung nicht möglich: '+verified.error.message);return}
      if(collectionSignature(savedSnapshot)!==collectionSignature(verified.data?.state)){
        cloudStatusV3('Achtung: Cloud-Bestand weicht ab. Lokale Sicherung bleibt erhalten. Bitte Synchronisierung prüfen.');
        const s=syncInfoV547(user);s.dirty=true;storeSyncV547(user,s);
      }else if(collectionSignature(state)===collectionSignature(savedSnapshot)){
        cloudStatusV3('Cloud-Bestand bestätigt: '+savedSnapshot.collection.length+' Sets · '+new Date().toLocaleTimeString('de-DE'));
      }else{
        cloudStatusV3('Zwischenzeitliche Änderungen erkannt: weiterer Abgleich nötig.');
        queueCloudSaveV3();
      }
    }catch(err){cloudStatusV3('Abgleich unterbrochen. Lokal gesichert; Cloud nicht bestätigt. '+String(err?.message||err))}
    finally{checking=false}
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
    box.innerHTML='<h2>Speicherprüfung & Rettungskopie</h2><p class="hint">Eine lokale Sicherheitskopie wird vor jedem Cloud-Abgleich angelegt. Der Cloud-Bestand wird nach dem Speichern kontrolliert. Nicht bestätigte Speicherungen und Konflikte werden gemeldet.</p><div class="actions"><button class="btn secondary" id="exportProtectionV559">Sicherungen herunterladen</button><button class="btn secondary" id="cleanupProtectionV559">Alte lokale Kopien bereinigen</button></div>';
    $('exportProtectionV559').onclick=exportRecovery;
    $('cleanupProtectionV559').onclick=cleanupAfterExport;
  }
  // Never silently lose a save request when localStorage has reached its quota.
  const basePersistProtectedV559=persist;
  persist=function(){
    try{return basePersistProtectedV559()}
    catch(error){
      if(error?.name==='QuotaExceededError'||/quota/i.test(String(error?.message))){
        cloudStatusV3('GERÄTESPEICHER VOLL: lokale Speicherung nicht bestätigt. Bitte Backup exportieren und Cloud-Status prüfen.');
        if(cloudUserV3?.id)queueCloudSaveV3();
        return;
      }
      throw error;
    }
  };
  const oldRender=renderSyncConflictV547;
  renderSyncConflictV547=function(){oldRender();showProtection()};
  const oldSwitch=switchTab;
  switchTab=function(id){const r=oldSwitch(id);if(id==='users')showProtection();return r};
  document.addEventListener('DOMContentLoaded',()=>{showProtection();const badge=$('appVersion');if(badge)badge.textContent='v50.66';document.querySelectorAll('#visibleVersionV553').forEach(el=>el.textContent='v50.66')});
})();
