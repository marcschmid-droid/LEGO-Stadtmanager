import Stripe from 'npm:stripe@22.6.0';
import {checkoutParameters,subscriptionIdForEvent,subscriptionRecord,strongestSubscription,validAppURL} from './core.mjs';
const APP_URL=validAppURL(Deno.env.get('APP_URL')||'https://marcschmid-droid.github.io/LEGO-Stadtmanager/');
const ORIGIN=new URL(APP_URL).origin,BASE=Deno.env.get('SUPABASE_URL')!,SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const stripe=new Stripe(Deno.env.get('STRIPE_RESTRICTED_KEY')||'not-configured',{apiVersion:'2026-09-30.endive' as Stripe.LatestApiVersion,httpClient:Stripe.createFetchHttpClient()});
const cryptoProvider=Stripe.createSubtleCryptoProvider();
let webhookSecret: string|null=null;
async function getWebhookSecret(){if(webhookSecret)return webhookSecret;webhookSecret=Deno.env.get('STRIPE_WEBHOOK_SECRET')||await database('rpc/billing_webhook_secret_v548','POST',{});if(!webhookSecret)throw Error('Webhook secret missing');return webhookSecret;}
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
async function database(path:string,method='GET',body?:unknown){const r=await fetch(BASE+'/rest/v1/'+path,{method,headers:{apikey:SERVICE,Authorization:'Bearer '+SERVICE,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('Database unavailable');return r.status===204?null:await r.json()}
async function handleWebhook(req:Request){const signature=req.headers.get('stripe-signature');if(!signature)return response({error:'Missing signature'},400);let event;try{event=await stripe.webhooks.constructEventAsync(await req.text(),signature,await getWebhookSecret(),undefined,cryptoProvider)}catch{return response({error:'Invalid signature'},400)}
 const id=subscriptionIdForEvent(event);if(!id)return response({received:true});
 const sub=await stripe.subscriptions.retrieve(id);if(!subscriptionRecord(sub))return response({received:true});const customer=typeof sub.customer==='string'?sub.customer:sub.customer.id;
 const mapping=await database('billing_customers_v548?stripe_customer_id=eq.'+encodeURIComponent(customer)+'&select=user_id');if(!mapping?.[0])throw Error('Customer mapping unavailable');
 // Fetch current object graph, not status snapshots embedded in potentially delayed events.
 const list=await stripe.subscriptions.list({customer,status:'all',limit:100});if(list.has_more)throw Error('Too many subscriptions for safe reconciliation');
 const current=strongestSubscription(list.data)||sub,record=subscriptionRecord(current);if(!record)return response({received:true});
 await database('rpc/apply_billing_event_v548','POST',{p_event_id:event.id,p_event_created:event.created,p_user_id:mapping[0].user_id,p_subscription:record});return response({received:true});
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{headers:cors});if(req.method==='GET'){try{return response({ready:!!Deno.env.get('STRIPE_RESTRICTED_KEY')&&!!await getWebhookSecret()})}catch{return response({ready:false})}}if(req.method!=='POST')return response({error:'Method not allowed'},405);try{
 if(req.headers.has('stripe-signature'))return await handleWebhook(req);
 if(req.headers.get('origin')!==ORIGIN)return response({error:'Origin not allowed'},403);
 const authorization=req.headers.get('authorization');if(!authorization)return response({error:'Please sign in'},401);
 const auth=await fetch(BASE+'/auth/v1/user',{headers:{apikey:ANON,Authorization:authorization}});if(!auth.ok)return response({error:'Please sign in'},401);const user=await auth.json();if(!user.id||!user.email_confirmed_at)return response({error:'Verified account required'},403);
 const body=await req.json();if(body.action==='status')return response({ready:!!Deno.env.get('STRIPE_RESTRICTED_KEY')&&!!await getWebhookSecret()});
 const mapped=await database('billing_customers_v548?user_id=eq.'+encodeURIComponent(user.id)+'&select=stripe_customer_id');let customer=mapped?.[0]?.stripe_customer_id;
 if(body.action==='portal'){if(!customer)return response({error:'Noch kein Kundenkonto vorhanden.'},404);const portal=await stripe.billingPortal.sessions.create({customer,return_url:APP_URL,configuration:'bpc_1UO9OGBrfEi477jIdvxftbpV'});return response({url:portal.url})}
 if(body.action!=='checkout')return response({error:'Unknown action'},400);
 if(!Deno.env.get('STRIPE_RESTRICTED_KEY'))return response({error:'Billing not activated'},503);
 await getWebhookSecret();
 // Validate tariff before creating any external resource.
 checkoutParameters(body,'validation',APP_URL,'abcdefgh');
 if(!customer){const created=await stripe.customers.create({email:user.email},{idempotencyKey:'bcm-customer-'+user.id});customer=created.id;await database('rpc/register_billing_customer_v548','POST',{p_user_id:user.id,p_customer:customer})}
 const existing=await stripe.subscriptions.list({customer,status:'all',limit:100});if(existing.has_more||existing.data.some(s=>['active','trialing','past_due','unpaid','incomplete'].includes(s.status)))return response({error:'Ein Abo besteht bereits. Bitte im Kundenportal verwalten.'},409);
 if(!/^[0-9a-f-]{36}$/.test(body.requestId||''))return response({error:'Invalid request'},400);
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body.requestId))),identifier=Array.from(hash.slice(0,8),n=>String.fromCharCode(97+n%26)).join('');
 const session=await stripe.checkout.sessions.create(checkoutParameters(body,customer,APP_URL,identifier),{idempotencyKey:'bcm-checkout-'+user.id+'-'+body.plan+'-'+body.period+'-'+body.requestId});return response({url:session.url});
 }catch{return response({error:'Abo-Service derzeit nicht verfügbar. Bitte später erneut versuchen.'},503)}});
