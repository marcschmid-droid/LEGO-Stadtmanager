const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const {JSDOM}=require('jsdom');
(async()=>{
 const id='11111111-1111-4111-8111-111111111111';let reserved=false;
 const dom=new JSDOM('<h1 id="shareTitle"></h1><p id="publicShareStatus"></p><div id="publicWishItems"></div>',{url:'https://example.com/wishlist-share.html#'+id,runScripts:'outside-only'});
 const w=dom.window;w.LEGO_SUPABASE={url:'https://example.com',publishableKey:'test'};
 w.supabase={createClient:()=>({rpc:async(name,args)=>{
  if(name==='get_shared_wishlist')return {data:{title:'<img src=x onerror=alert(1)>',items:[{setNumber:'10326',name:'<script>alert(1)</script>',reserved}]}};
  if(name==='reserve_wishlist_item'){if(reserved)return {data:null};reserved=true;return {data:'22222222-2222-4222-8222-222222222222'}};
  if(name==='release_wishlist_item'){if(args.p_token!=='22222222-2222-4222-8222-222222222222')return {data:false};reserved=false;return {data:true}}
 }})};
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../wishlist-share-v545.js'),'utf8'),dom.getInternalVMContext());
 const flush=()=>new Promise(r=>setTimeout(r,10));await flush();assert.equal(w.document.querySelectorAll('script,img').length,0);
 assert(w.document.getElementById('shareTitle').textContent.includes('<img'));
 w.document.querySelector('button').click();await flush();assert.equal(reserved,true);assert(w.document.querySelector('button').textContent.includes('aufheben'));
 w.document.querySelector('button').click();await flush();assert.equal(reserved,false);assert.equal(w.localStorage.length,0);
 dom.window.close();console.log('Wishlist viewer: safe text, reservation and release passed (mock backend).');
})().catch(e=>{console.error(e);process.exitCode=1});
