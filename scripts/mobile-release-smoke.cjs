/* Browser regression checks with intercepted Auth responses; no real signup/mail. */
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const base=process.env.BCM_TEST_BASE||'http://127.0.0.1:8765';
(async()=>{
 for(const [name,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.route('https://eeiokqujnpaxgncmcvsi.supabase.co/**',async route=>{
   const signup=route.request().url().includes('/signup');
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(signup?{user:{id:'00000000-0000-4000-8000-000000000001',email:'browser-test@example.invalid',identities:[]},session:null}:{})});
  });
  await page.goto(base+'/anmelden.html?mode=signup');
  await page.getByLabel('E-Mail-Adresse',{exact:true}).fill('browser-test@example.invalid');
  await page.getByLabel('Passwort',{exact:true}).fill('browser-test-only-123');
  await page.getByRole('button',{name:'Kostenloses Konto erstellen',exact:true}).click();
  await page.getByText(/Bitte prüfe dein E-Mail-Postfach/).waitFor();
  assert.equal(await page.locator('#open').isVisible(),false);
  await page.getByRole('button',{name:'Zurück zur Anmeldung',exact:true}).click();
  assert.equal(await page.locator('#login').textContent(),'Anmelden');
  // Use the production modal HTML and styles, without starting the production
  // account/cloud app. This isolates viewport/keyboard geometry from live data.
  const html=fs.readFileSync('index.html','utf8');
  const modal=html.slice(html.indexOf('<div id="setModal"'),html.indexOf('<div id="wishModal"'));
  const css=['styles.css','mobile-save-bar-v598.css'].map(path=>fs.readFileSync(path,'utf8')).join('\n');
  const viewportScript=fs.readFileSync('mobile-viewport.js','utf8');
  await page.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><body class="themeV39">'+modal+'<script>'+viewportScript+'</script></body>');
  await page.locator('#setModal').evaluate(el=>el.classList.add('show'));
  for(const height of [844,430,300]){
   await page.setViewportSize({width:390,height});
   await page.waitForTimeout(100);
   const rect=await page.locator('#saveSet').boundingBox();
   assert.ok(rect&&rect.y>=0&&rect.y+rect.height<=height+1,`${name}: save is outside ${height}px viewport: ${JSON.stringify(rect)}`);
   await page.locator('#fNote').scrollIntoViewIfNeeded();
   const next=await page.locator('#saveSet').boundingBox();
   assert.ok(next.y+next.height<=height+1,`${name}: scrolling form hides actions`);
  }
  console.log(name+': signup confirmation, return to login, portrait and keyboard-height save buttons passed');
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exit(1)});
