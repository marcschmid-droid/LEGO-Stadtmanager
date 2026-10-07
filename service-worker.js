const CACHE="brick-city-manager-v50-r43";
const ASSETS=["./styles.css?v=50.43","./app.js?v=50.43","./app-v3.js?v=50.43","./supabase-config.js?v=50.43","./seed-data.js","./manifest.webmanifest","./icon.svg?v=50.43","./ursprungsstadt.jpg","./data/set-enrichment.json","./impressum.html","./datenschutz.html","./vendor/supabase.js?v=50.43","./vendor/zxing.js?v=50.43"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))).then(()=>self.skipWaiting()));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET")return;
 if(e.request.mode==="navigate"){
   e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put("./index.html",c));return r}).catch(()=>caches.match("./index.html")));
   return;
 }
 const url=new URL(e.request.url);
 if(url.pathname.endsWith("/data/all-sets.json")){
   e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>{
     if(hit)return hit;
     return fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(x=>x.put(e.request,copy));return r});
   }));
   return;
 }
 e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request)));
});
