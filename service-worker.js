const CACHE="brick-city-manager-v50-r47";
const ASSETS=["./styles.css?v=50.47","./app.js?v=50.47","./app-v3.js?v=50.47","./improvements-v544.js?v=50.47","./customer-value-v545.js?v=50.47","./usability-v546.js?v=50.47","./collection-ops-v547.js?v=50.47","./shared-collections-v547.js?v=50.47","./billing-config.js?v=50.47","./supabase-config.js?v=50.47","./seed-data.js","./manifest.webmanifest","./icon.svg?v=50.47","./ursprungsstadt.jpg","./data/set-enrichment.json","./impressum.html","./datenschutz.html","./vendor/supabase.js?v=50.47","./vendor/zxing.js?v=50.47"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))).then(()=>self.skipWaiting()));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 if(e.request.mode==="navigate"){
   e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put("./index.html",c));return r}).catch(()=>caches.match("./index.html")));
   return;
 }
 const url=new URL(e.request.url);
 // Authenticated cloud requests must never enter the shared static-asset cache.
 if(url.origin!==self.location.origin)return;
 if(url.pathname.endsWith("/data/all-sets.json")){
   e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
     if(hit)return hit;
     return fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(x=>x.put(e.request,copy));return r});
   }));
   return;
 }
 e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
});
