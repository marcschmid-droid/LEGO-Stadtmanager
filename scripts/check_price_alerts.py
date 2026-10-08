#!/usr/bin/env python3
import json, os, datetime as dt
from html import escape
from math import isfinite
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
CAT=ROOT/"data"/"set-enrichment.json"
def eligible_offer_total(w):
    if not w.get("alertEnabledV545"):return None
    shipping=w.get("offerShippingV545")
    condition=w.get("offerConditionV545")
    if shipping is None or shipping=="" or not condition:return None
    target=w.get("alertConditionV545")
    if target and target!=condition:return None
    try:
        offer=float(w.get("offer") or 0)
        shipping=float(shipping)
    except (ValueError,TypeError):return None
    if not isfinite(offer) or not isfinite(shipping) or offer<=0 or shipping<0:return None
    total=offer+shipping
    return total if isfinite(total) else None

SUPABASE_URL=os.getenv("SUPABASE_URL","https://eeiokqujnpaxgncmcvsi.supabase.co").rstrip("/")
SERVICE=os.getenv("SUPABASE_SERVICE_ROLE_KEY","").strip()
RESEND=os.getenv("RESEND_API_KEY","").strip()
FROM_EMAIL=os.getenv("ALERT_FROM_EMAIL","").strip()

if not SERVICE:
    raise SystemExit("SUPABASE_SERVICE_ROLE_KEY missing")

headers={"apikey":SERVICE,"Authorization":"Bearer "+SERVICE}
catalog=json.loads(CAT.read_text(encoding="utf-8")) if CAT.exists() else {"sets":{}}
sets=catalog.get("sets",{})

def get_json(url, **kwargs):
    r=requests.get(url,timeout=30,**kwargs);r.raise_for_status();return r.json()

states=get_json(
    SUPABASE_URL+"/rest/v1/user_state",
    params={"select":"user_id,state"},
    headers=headers
)

today=dt.datetime.now(dt.timezone.utc).date().isoformat()
existing=get_json(
    SUPABASE_URL+"/rest/v1/price_alert_events",
    params={"select":"user_id,set_number,created_at","created_at":f"gte.{today}T00:00:00Z"},
    headers=headers
)
seen={(str(x.get("user_id")),str(x.get("set_number"))) for x in existing}

emails={}
if RESEND and FROM_EMAIL:
    try:
        users=get_json(
            SUPABASE_URL+"/auth/v1/admin/users",
            params={"page":"1","per_page":"1000"},
            headers=headers
        )
        for u in users.get("users",[]):
            if u.get("email"):emails[str(u.get("id"))]=u.get("email")
    except Exception as ex:
        print("Could not load auth emails:",ex)

created=0
mailed=0
for row in states:
    uid=str(row.get("user_id"))
    state=row.get("state") or {}
    hits=[]
    for w in state.get("wishlist",[]) or []:
        n=str(w.get("setNumber","")).strip()
        limit=float(w.get("limit") or 0)
        if not n or not isfinite(limit) or limit<=0:continue
        e=sets.get(n) or {}
        # Only opted-in concrete offers trigger alerts; market estimates are not offers.
        market=eligible_offer_total(w)
        if market is None or market>limit:continue
        name=w.get("name") or e.get("brickeconomyName") or e.get("rebrickableName") or ""
        if (uid,n) not in seen:
            ir=requests.post(
                SUPABASE_URL+"/rest/v1/price_alert_events",
                headers={**headers,"Content-Type":"application/json","Prefer":"return=minimal"},
                json={"user_id":uid,"set_number":n,"set_name":name,"market_price":market,"limit_price":limit},
                timeout=30
            )
            ir.raise_for_status();created+=1;seen.add((uid,n))
            hits.append((n,name,market,limit))
    if hits and state.get("meta",{}).get("emailPriceAlerts") and RESEND and FROM_EMAIL and emails.get(uid):
        lines="".join(f"<li><b>{escape(n)} · {escape(name)}</b>: {market:.2f} € inkl. Versand (Kaufgrenze {limit:.2f} €)</li>" for n,name,market,limit in hits)
        er=requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization":"Bearer "+RESEND,"Content-Type":"application/json"},
            json={
                "from":FROM_EMAIL,
                "to":[emails[uid]],
                "subject":"Brick City Manager – Preisalarm",
                "html":"<h2>Preisalarm</h2><p>Diese gespeicherten Angebote liegen einschließlich Versand unter deiner Kaufgrenze. Bitte Verfügbarkeit beim Anbieter prüfen:</p><ul>"+lines+"</ul><p>Brick City Manager</p>"
            },
            timeout=30
        )
        if er.ok:mailed+=1
        else:print("Email failed",uid,er.status_code,er.text[:300])

print(f"created_alerts={created} mailed_users={mailed} email_enabled={bool(RESEND and FROM_EMAIL)}")
