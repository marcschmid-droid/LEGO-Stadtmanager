const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const tick=()=>new Promise(setImmediate);
async function setup({signupSession=null,loginError=null}={}){
 const elements=new Map(),calls=[];let authEvent;
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,disabled:false,listeners:{},classList:{toggle(){}},addEventListener(e,f){this.listeners[e]=f},reportValidity:()=>true});return elements.get(id)};
 const auth={onAuthStateChange:f=>authEvent=f,getSession:async()=>({data:{session:null}}),
 signUp:async input=>{calls.push(input);authEvent('SIGNED_IN',signupSession);return {data:{session:signupSession}}},
 signInWithPassword:async()=>({error:loginError,data:{session:{user:{email:'test@example.invalid'}}}}),
 resetPasswordForEmail:async()=>({}),resend:async input=>{calls.push(input);return {}},getUser:async()=>({data:{user:null}})};
 const context={window:{LEGO_SUPABASE:{url:'https://example.invalid',publishableKey:'public'},supabase:{createClient:()=>({auth})}},
 location:{search:'',href:'https://example.invalid/anmelden.html',hash:'',assign:()=>{}},
 document:{getElementById:get,querySelectorAll:()=>[get('login'),get('register')]},
 URL,URLSearchParams,setTimeout:f=>queueMicrotask(f),sessionStorage:{setItem(){}},console};
 vm.createContext(context);vm.runInContext(fs.readFileSync('auth-entry.js','utf8'),context);await tick();
 get('email').value='test@example.invalid';get('password').value='test-password-only';
 return {get,calls,submit:async()=>{get('form').listeners.submit({preventDefault(){}});await tick()},click:async id=>{get(id).listeners.click();await tick()}};
}
test('Bestätigungshinweis bleibt nach Registrierung ohne Sitzung sichtbar',async()=>{
 const x=await setup();await x.click('register');await x.submit();
 assert.match(x.get('status').textContent,/Bestätigungslink/);assert.equal(x.get('open').hidden,true);
 assert.equal(x.get('resend').hidden,false);assert.equal(x.calls[0].options.emailRedirectTo,'https://example.invalid/anmelden.html');
});
test('erneute Bestätigung verschickt keine zweite Registrierung',async()=>{
 const x=await setup();await x.click('register');await x.submit();await x.click('resend');
 assert.equal(x.calls.length,2);assert.equal(x.calls[1].type,'signup');
});
test('nach Registrierung kann direkt zurück zur Anmeldung gewechselt werden',async()=>{
 const x=await setup();await x.click('register');await x.submit();await x.click('register');
 assert.equal(x.get('login').textContent,'Anmelden');assert.equal(x.get('password').autocomplete,'current-password');
});
test('unbestätigte E-Mail zeigt eine verständliche Anleitung',async()=>{
 const x=await setup({loginError:{message:'Email not confirmed'}});await x.submit();
 assert.match(x.get('status').textContent,/bestätige zuerst/);assert.equal(x.get('resend').hidden,false);
});
