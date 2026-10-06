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
    params={"status":"eq.pending","select":"id,set_number","order":"created_at.asc","limit":"20"},
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
    rid=row["id"];n=str(row["set_number"]).strip().split("-",1)[0]
    status="done"
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
            except Exception as ex:
                errors.append(f"BrickEconomy {n}: {ex}")
        if not sets.get(n):
            status="failed"
    except Exception as ex:
        errors.append(f"Catalog request {n}: {ex}")
        status="failed"

    patch={"status":status,"processed_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())}
    pr=requests.patch(
        SUPABASE_URL+"/rest/v1/catalog_requests",
        params={"id":f"eq.{rid}"},
        headers={**headers,"Content-Type":"application/json","Prefer":"return=minimal"},
        json=patch,timeout=30
    )
    pr.raise_for_status()

if changed:
    meta=data.setdefault("meta",{})
    meta["lastUpdated"]=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
    if errors: meta["errors"]=(meta.get("errors",[])+errors)[-20:]
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")

print(f"processed={len(requests_rows)} changed={changed} errors={len(errors)}")
