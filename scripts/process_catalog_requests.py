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
PRICE_BATCH=max(1,min(10,int(os.getenv("MARKET_PRICE_BATCH_SIZE","2"))))
MIN_PRICE_QUOTA_RESERVE=max(0,int(os.getenv("BRICKECONOMY_QUOTA_RESERVE","2")))

if not SERVICE:
    raise SystemExit("SUPABASE_SERVICE_ROLE_KEY missing")

headers={"apikey":SERVICE}
# sb_secret_* keys are API gateway keys, not JWT bearer tokens.
if not SERVICE.startswith("sb_secret_"):
    headers["Authorization"]="Bearer "+SERVICE

r=requests.get(
    SUPABASE_URL+"/rest/v1/catalog_requests",
    params={"select":"set_number,requested_at","order":"requested_at.asc","limit":str(PRICE_BATCH)},
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
quota_exhausted=False
minute_limited=False
usage=None

def api_num(n):
    return n if "-" in n else n+"-1"

def be_headers():
    return {"x-apikey":BE_KEY,"Accept":"application/json","User-Agent":UA}

def be_error(response):
    try:
        body=response.json() or {}
    except Exception:
        body={}
    return str(body.get("error") or "")

def be_usage():
    """Read BrickEconomy quota without spending daily quota."""
    if not BE_KEY:
        return None
    rr=requests.get("https://www.brickeconomy.com/api/v1/usage",headers=be_headers(),timeout=30)
    if rr.status_code==429:
        code=be_error(rr)
        if code=="TooManyRequestsError":
            retry=max(1,min(65,int(rr.headers.get("Retry-After","60") or "60")))
            print(f"BRICKECONOMY_USAGE_RETRY_AFTER seconds={retry}")
            time.sleep(retry)
            rr=requests.get("https://www.brickeconomy.com/api/v1/usage",headers=be_headers(),timeout=30)
    rr.raise_for_status()
    return (rr.json() or {}).get("data") or {}

def be_set(n):
    """Fetch a set and distinguish daily quota from short-term throttling."""
    global quota_exhausted, minute_limited
    url=f"https://www.brickeconomy.com/api/v1/set/{api_num(n)}?currency=EUR"
    for attempt in range(2):
        rr=requests.get(url,headers=be_headers(),timeout=30)
        if rr.status_code!=429:
            rr.raise_for_status()
            return (rr.json() or {}).get("data",{})
        code=be_error(rr)
        if code=="QuotaExceededError":
            quota_exhausted=True
            raise RuntimeError("QUOTA_EXCEEDED")
        if code=="TooManyRequestsError":
            minute_limited=True
            retry=max(1,min(65,int(rr.headers.get("Retry-After","60") or "60")))
            if attempt==0:
                print(f"BRICKECONOMY_RETRY_AFTER set={n} seconds={retry}")
                time.sleep(retry)
                continue
            raise RuntimeError("TOO_MANY_REQUESTS")
        raise RuntimeError("RATE_LIMIT")
    raise RuntimeError("TOO_MANY_REQUESTS")

# Usage does not count against BrickEconomy's daily quota. Reserve a small
# safety margin so concurrent/manual calls cannot unexpectedly exceed it.
if BE_KEY:
    try:
        usage=be_usage()
        quota=int(usage.get("quota",0) or 0)
        used=int(usage.get("used_today",0) or 0)
        remaining=int(usage.get("remaining",max(0,quota-used)) or 0)
        allowed=max(0,min(PRICE_BATCH,remaining-MIN_PRICE_QUOTA_RESERVE))
        print(f"BRICKECONOMY_USAGE quota={quota} used_today={used} remaining={remaining} reserve={MIN_PRICE_QUOTA_RESERVE} allowed={allowed}")
        if allowed<=0:
            print("PRICE_SOURCE_QUOTA_EXHAUSTED: no price requests sent; queued sets remain for next scheduled attempt")
            raise SystemExit(0)
        requests_rows=requests_rows[:allowed]
    except SystemExit:
        raise
    except Exception as ex:
        # Fail closed: if quota state cannot be verified, do not burn API calls.
        print(f"BRICKECONOMY_USAGE_ERROR: {ex}; no price requests sent")
        raise SystemExit(0)

for row in requests_rows:
    n=str(row["set_number"]).strip().split("-",1)[0]
    row_changed=False
    try:
        e=sets.setdefault(n,{})
        if RB_KEY:
            try:
                rr=requests.get(
                    f"https://rebrickable.com/api/v3/lego/sets/{api_num(n)}/",
                    headers={"Authorization":f"key {RB_KEY}","User-Agent":UA},timeout=30
                )
                rr.raise_for_status()
                j=rr.json()
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
                j=be_set(n)
                e.update({
                    "brickeconomyName":j.get("name") or e.get("brickeconomyName"),
                    "theme":j.get("theme") or e.get("theme"),
                    "subtheme":j.get("subtheme") or e.get("subtheme"),
                    "year":j.get("year") or e.get("year"),
                    "pieces":j.get("pieces_count") or e.get("pieces"),
                    "minifigs":j.get("minifigs_count") if j.get("minifigs_count") is not None else e.get("minifigs"),
                    "rrpEUR":j.get("retail_price_eu") if j.get("retail_price_eu") is not None else e.get("rrpEUR"),
                    "ean":j.get("ean") if j.get("ean") is not None else e.get("ean"),
                    "upc":j.get("upc") if j.get("upc") is not None else e.get("upc"),
                    "marketNewEUR":j.get("current_value_new") if j.get("current_value_new") is not None else e.get("marketNewEUR"),
                    "marketUsedEUR":j.get("current_value_used") if j.get("current_value_used") is not None else e.get("marketUsedEUR"),
                    "marketUsedLowEUR":j.get("current_value_used_low") if j.get("current_value_used_low") is not None else e.get("marketUsedLowEUR"),
                    "marketUsedHighEUR":j.get("current_value_used_high") if j.get("current_value_used_high") is not None else e.get("marketUsedHighEUR"),
                    "growth12mPct":j.get("rolling_growth_12months") if j.get("rolling_growth_12months") is not None else e.get("growth12mPct"),
                    "retired":j.get("retired") if j.get("retired") is not None else e.get("retired"),
                    "brickeconomyUpdated":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
                });changed=True
                has_price=bool(j.get("current_value_new") or j.get("current_value_used"))
                if has_price:
                    payload={
                        "set_number":n,
                        "name":j.get("name") or e.get("rebrickableName") or "LEGO "+n,
                        "source_updated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
                    }
                    existing=requests.get(
                        SUPABASE_URL+"/rest/v1/catalog_sets",
                        params={"set_number":"eq."+n,"select":"name,market_new_eur,market_used_eur"},
                        headers=headers,timeout=30
                    )
                    existing.raise_for_status()
                    old=(existing.json() or [{}])[0]
                    for field,key in (("market_new_eur","current_value_new"),("market_used_eur","current_value_used")):
                        value=j.get(key)
                        payload[field]=value if value is not None else old.get(field)
                    if old.get("name") and payload["name"]=="LEGO "+n:
                        payload["name"]=old["name"]
                    response=requests.post(
                        SUPABASE_URL+"/rest/v1/catalog_sets",
                        params={"on_conflict":"set_number"},
                        headers={**headers,"Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},
                        json=payload,timeout=30
                    )
                    response.raise_for_status()
                    row_changed=True
                    print("CATALOG_PRICE_SAVED set="+n)
                else:
                    print("CATALOG_PRICE_MISSING set="+n)
            except Exception as ex:
                errors.append(f"BrickEconomy {n}: {ex}")
        if not sets.get(n):
            errors.append(f"No metadata for {n}")
    except Exception as ex:
        errors.append(f"Catalog request {n}: {ex}")

    if quota_exhausted:
        print("PRICE_SOURCE_QUOTA_EXHAUSTED: stopping this run; queued sets remain for next scheduled attempt")
        break
    if minute_limited and any("TOO_MANY_REQUESTS" in x for x in errors):
        print("PRICE_SOURCE_MINUTE_LIMIT: stopping after retry; queued sets remain for next scheduled attempt")
        break

    # The real catalog_requests schema has only set_number and requested_at.
    # Acknowledge only when a market price was actually obtained and persisted;
    # metadata-only lookups remain queued for a future price attempt.
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
    if usage:
        meta["brickeconomyUsage"]={k:usage.get(k) for k in ("quota","used_today","remaining","resets_at")}
    if errors:
        meta["errors"]=(meta.get("errors",[])+errors)[-20:]
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")

print(f"processed={len(requests_rows)} changed={changed} errors={len(errors)}")
