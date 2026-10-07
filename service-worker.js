const CACHE="brick-city-manager-v50-r42";
const ASSETS=["./styles.css?v=50.41","./app.js?v=50.41","./app-v3.js?v=50.41","./supabase-config.js?v=50.41","./seed-data.js","./manifest.webmanifest","./icon.svg?v=50.41","./ursprungsstadt.jpg","./data/set-enrichment.json","./data/all-sets.json","./impressum.html","./datenschutz.html","./vendor/supabase.js?v=50.41","./vendor/zxing.js?v=50.41"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))).then(()=>self.skipWaiting()));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 if(e.request.mode==="navigate"){
   e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put("./index.html",c));return r}).catch(()=>caches.match("./index.html")));
   return;
 }
 e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
});
