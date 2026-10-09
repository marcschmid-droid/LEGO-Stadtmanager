const CACHE="brick-city-manager-v50-r55";
const ASSETS=["./index.html","./styles.css?v=50.55","./app.js?v=50.55","./app-v3.js?v=50.55","./improvements-v544.js?v=50.55","./customer-value-v545.js?v=50.55","./usability-v546.js?v=50.55","./collection-ops-v547.js?v=50.55","./shared-collections-v547.js?v=50.55","./customer-experience-v548.js?v=50.55","./billing-client-v548.js?v=50.55","./billing-config.js?v=50.55","./supabase-config.js?v=50.55","./seed-data.js","./manifest.webmanifest","./icon.svg?v=50.55","./ursprungsstadt.jpg","./data/set-enrichment.json","./impressum.html","./datenschutz.html","./vendor/supabase.js?v=50.55","./vendor/zxing.js?v=50.55"];
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
     if(hit&&e.request.cache!=="no-store")return hit;
     return fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(x=>x.put(url.origin+url.pathname,copy));return r});
   }));
   return;
 }
 // Same-version immutable assets render immediately from cache. Images and data refresh in background.
 const immutable=url.searchParams.get("v")==="50.55";
 e.respondWith(caches.match(e.request).then(hit=>{
  if(hit&&immutable)return hit;
  const network=fetch(e.request).then(r=>{if(r.ok){const c=r.clone();return caches.open(CACHE).then(x=>x.put(e.request,c)).then(()=>r)}return r}).catch(()=>hit||Response.error());
  if(hit){e.waitUntil(network);return hit}return network;
 }));
});
