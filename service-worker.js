/* Brick City Manager: network-first static shell, never cache user data. */
const CACHE="brick-city-manager-v50-r97";
const SHELL=["./index.html","./launch-5094.html","./styles.css?v=50.56"];
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(url=>cache.add(url)));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("brick-city-manager-")&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  if(req.mode==="navigate"||/\.(?:js|html)$/.test(url.pathname)){
    event.respondWith(fetch(req,{cache:"no-store"}).then(response=>{
      if(response.ok&&req.mode==="navigate"){
        const copy=response.clone();
        event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));
      }
      return response;
    }).catch(async()=>{
      const cache=await caches.open(CACHE);
      return (await cache.match(req))||(req.mode==="navigate"?await cache.match("./index.html"):undefined)||Response.error();
    }));
  }
});
