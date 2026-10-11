const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const src=fs.readFileSync('app-v3.js','utf8');
test('veraltete Anmeldung darf keinen neueren Cloud-Stand ersetzen',()=>{assert.match(src,/loadEpoch!==cloudLoadEpochV584/);assert.match(src,/cloudUserV3\?\.id!==requestedUser/)});
test('nicht synchronisierte lokale Sets stoppen das Ueberschreiben',()=>{assert.match(src,/const unsynced=/);assert.match(src,/if\(unsynced\.length\)/);assert.match(src,/Kein Bestand überschrieben/)});
test('Cloud-Abgleich wird fuer komplette Sammlung bestaetigt',()=>{assert.match(src,/Cloud-Daten geladen: /);assert.match(src,/state\.collection\.length/)});
