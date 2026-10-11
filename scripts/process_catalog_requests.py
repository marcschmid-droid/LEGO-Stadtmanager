#!/usr/bin/env python3
import json, os, time
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"set-enrichment.json"
SUPABASE_URL=os.getenv("SUPABASE_URL","https://eeiokqujnpaxgncmcvsi.supabase.co").rstrip("/")
SERVICE=os.getenv("SUPABASE_SERVICE_ROLE_KEY","").strip()
RB_KEY=os.getenv("REBRICKABLE_API_KEY","").strip()
BE_KEY=os.getenv("BRICKECONOMY_API_KEY","").strip()
UA="Brick-City-Manager/1.0"

if not SERVICE:
    raise SystemExit("SUPABASE_SERVICE_ROLE_KEY missing")

headers={"apikey":SERVICE,"Authorization":"Bearer "+SERVICE}
r=requests.get(
    SUPABASE_URL+"/rest/v1/catalog_requests",
    params={"select":"set_number,requested_at","order":"requested_at.asc","limit":"5"},
    headers=headers,timeout=30
)
r.raise_for_status()
requests_rows=r.json()
if not requests_rows:
    print("No pending catalog requests")
    raise SystemExit(0)

data=json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"meta":{},"sets":{}}
sets=data.setdefault("sets",{})
errors=[];changed=False

def api_num(n):
    return n if "-" in n else n+"-1"

def get_json(url,headers=None):
    rr=requests.get(url,headers=headers or {},timeout=30)
    if rr.status_code==429: raise RuntimeError("RATE_LIMIT")
    rr.raise_for_status()
    return rr.json()

for row in requests_rows:
    n=str(row["set_number"]).strip().split("-",1)[0]
    row_changed=False
    try:
        e=sets.setdefault(n,{})
        if RB_KEY:
            try:
                j=get_json(f"https://rebrickable.com/api/v3/lego/sets/{api_num(n)}/",
                           {"Authorization":f"key {RB_KEY}","User-Agent":UA})
                e.update({
                    "imageUrl":j.get("set_img_url") or e.get("imageUrl"),
                    "rebrickableName":j.get("name") or e.get("rebrickableName"),
                    "year":j.get("year") or e.get("year"),
                    "pieces":j.get("num_parts") or e.get("pieces"),
                    "rebrickableUrl":j.get("set_url") or e.get("rebrickableUrl"),
                    "rebrickableUpdated":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
                });changed=True
            except Exception as ex:
                errors.append(f"Rebrickable {n}: {ex}")
        if BE_KEY:
            try:
                j=get_json(f"https://www.brickeconomy.com/api/v1/set/{api_num(n)}?currency=EUR",
                           {"x-apikey":BE_KEY,"Accept":"application/json","User-Agent":UA}).get("data",{})
                e.update({
                    "brickeconomyName":j.get("name") or e.get("brickeconomyName"),
                    "theme":j.get("theme") or e.get("theme"),
                    "subtheme":j.get("subtheme") or e.get("subtheme"),
                    "year":j.get("year") or e.get("year"),
                    "pieces":j.get("pieces_count") or e.get("pieces"),
                    "minifigs":j.get("minifigs_count"),
                    "rrpEUR":j.get("retail_price_eu"),
                    "ean":j.get("ean"),
                    "upc":j.get("upc"),
                    "marketNewEUR":j.get("current_value_new"),
                    "marketUsedEUR":j.get("current_value_used"),
                    "marketUsedLowEUR":j.get("current_value_used_low"),
                    "marketUsedHighEUR":j.get("current_value_used_high"),
                    "growth12mPct":j.get("rolling_growth_12months"),
                    "retired":j.get("retired"),
                    "brickeconomyUpdated":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
                });changed=True
                has_price=bool(j.get("current_value_new") or j.get("current_value_used"))
                if has_price:
                    payload={
                        "set_number":n,
                        "name":j.get("name") or e.get("rebrickableName") or "LEGO "+n,
                        "source_updated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
                    }
                    existing=requests.get(SUPABASE_URL+"/rest/v1/catalog_sets",
                        params={"set_number":"eq."+n,"select":"name,market_new_eur,market_used_eur"},
                        headers=headers,timeout=30)
                    existing.raise_for_status()
                    old=(existing.json() or [{}])[0]
                    for field,key in (("market_new_eur","current_value_new"),("market_used_eur","current_value_used")):
                        value=j.get(key)
                        payload[field]=value if value is not None else old.get(field)
                    if old.get("name") and payload["name"]=="LEGO "+n:
                        payload["name"]=old["name"]
                    response=requests.post(SUPABASE_URL+"/rest/v1/catalog_sets",
                        params={"on_conflict":"set_number"},
                        headers={**headers,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},
                        json=payload,timeout=30)
                    response.raise_for_status()
                    row_changed=True
                    print("CATALOG_PRICE_SAVED set="+n)
            except Exception as ex:
                errors.append(f"BrickEconomy {n}: {ex}")
        if not sets.get(n):
            errors.append(f"No metadata for {n}")
    except Exception as ex:
        errors.append(f"Catalog request {n}: {ex}")

    # The real catalog_requests schema has only set_number and requested_at.
    # Acknowledge only when a market price was actually obtained; metadata-only\n    # lookups must remain queued for a future licensed pricing source.
    if row_changed:
        pr=requests.delete(
            SUPABASE_URL+"/rest/v1/catalog_requests",
            params={"set_number":f"eq.{row['set_number']}","requested_at":f"eq.{row['requested_at']}"},
            headers=headers,timeout=30
        )
        pr.raise_for_status()

if changed:
    meta=data.setdefault("meta",{})
    meta["lastUpdated"]=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
    if errors: meta["errors"]=(meta.get("errors",[])+errors)[-20:]
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")

print(f"processed={len(requests_rows)} changed={changed} errors={len(errors)}")
