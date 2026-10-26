const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const s=fs.readFileSync('scripts/process_catalog_requests.py','utf8');
test('Preiswerte werden in die gemeinsame Supabase Tabelle geschrieben',()=>{assert.match(s,/rest\/v1\/catalog_sets/);assert.match(s,/resolution=merge-duplicates/);assert.match(s,/market_new_eur/);assert.match(s,/market_used_eur/)});
test('Keine Anfrage als erledigt markieren, bevor Schreiben bestätigt wurde',()=>{const a=s.indexOf('response.raise_for_status()'),b=s.indexOf('row_changed=True'),c=s.indexOf('if row_changed:',b);assert.ok(a>=0&&b>a&&c>b)});
test('Kein Überschreiben der Nutzer-Sammlung durch Preisprozess',()=>{assert.match(s,/ur=requests\.get\(/);assert.match(s,/rest\/v1\/user_state/);assert.doesNotMatch(s,/requests\.(?:post|patch|put|delete)\(\s*SUPABASE_URL\+"\/rest\/v1\/user_state"/);assert.doesNotMatch(s,/purchasePrice|purchase_price/)});
