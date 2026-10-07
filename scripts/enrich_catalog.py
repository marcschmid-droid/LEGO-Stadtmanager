#!/usr/bin/env python3
import json, os, re, time
from pathlib import Path
import requests
try:
    from requests_oauthlib import OAuth1
except Exception:
    OAuth1=None

ROOT=Path(__file__).resolve().parents[1]
SEED=ROOT/"seed-data.js"
OUT=ROOT/"data"/"set-enrichment.json"
CONFIG=ROOT/"supabase-config.js"
OUT.parent.mkdir(parents=True,exist_ok=True)

RB_KEY=os.getenv("REBRICKABLE_API_KEY","").strip()
BE_KEY=os.getenv("BRICKECONOMY_API_KEY","").strip()
BS_KEY=os.getenv("BRICKSET_API_KEY","").strip()
BL_CONSUMER_KEY=os.getenv("BRICKLINK_CONSUMER_KEY","").strip()
BL_CONSUMER_SECRET=os.getenv("BRICKLINK_CONSUMER_SECRET","").strip()
BL_TOKEN_VALUE=os.getenv("BRICKLINK_TOKEN_VALUE","").strip()
BL_TOKEN_SECRET=os.getenv("BRICKLINK_TOKEN_SECRET","").strip()
BE_BATCH=max(1,min(int(os.getenv("BRICKECONOMY_BATCH_SIZE","90")),90))
REQUESTS_ONLY=os.getenv("REQUESTS_ONLY","").strip()=="1"
UA="LEGO-Stadtmanager/1.0 (+https://github.com/marcschmid-droid/LEGO-Stadtmanager)"

def load():
    if OUT.exists():
        try:return json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:pass
    return {"meta":{"version":1,"brickeconomyCursor":0},"sets":{}}

def nums():
    text=SEED.read_text(encoding="utf-8")
    # Prefer the real collection before wishlist/other references so scarce API
    # requests improve the user's owned inventory first.
    try:
        raw=text.split("=",1)[1].strip()
        if raw.endswith(";"): raw=raw[:-1]
        seed=json.loads(raw)
        vals=[]
        for section in ("collection","wishlist"):
            for item in seed.get(section,[]) or []:
                vals.append(str(item.get("setNumber","")))
    except Exception:
        vals=re.findall(r'"setNumber"\s*:\s*"([^"]+)"',text)
    out=[];seen=set()
    for n in vals:
        n=n.strip()
        base=n.split("-",1)[0]
        if not re.fullmatch(r"\d{4,7}",base):
            continue
        if n not in seen:
            seen.add(n);out.append(n)
    return out

def requested_nums():
    if not CONFIG.exists(): return []
    try:
        text=CONFIG.read_text(encoding="utf-8")
        url=re.search(r'url:"([^"]+)"',text)
        key=re.search(r'publishableKey:"([^"]+)"',text)
        if not url or not key: return []
        r=requests.get(
            url.group(1)+"/rest/v1/catalog_requests?select=set_number&order=requested_at.asc&limit=500",
            headers={"apikey":key.group(1),"Authorization":"Bearer "+key.group(1),"Accept":"application/json"},
            timeout=20
        )
        if not r.ok: return []
        out=[];seen=set()
        for row in r.json():
            n=str(row.get("set_number","")).strip()
            if re.fullmatch(r"\d{4,7}(?:-\d+)?",n) and n not in seen:
                seen.add(n);out.append(n)
        return out
    except Exception:
        return []

def api_num(n):
    return n if "-" in n else n+"-1"

def get_json(url,headers=None,timeout=25):
    r=requests.get(url,headers=headers or {},timeout=timeout)
    if r.status_code==429: raise RuntimeError("RATE_LIMIT")
    r.raise_for_status()
    return r.json()

data=load()
sets=data.setdefault("sets",{})
meta=data.setdefault("meta",{})
seed_numbers=nums()
requests_numbers=requested_nums()
numbers=[]
for n in requests_numbers+seed_numbers:
    if n not in numbers: numbers.append(n)
if REQUESTS_ONLY:
    numbers=requests_numbers
changed=False
errors=[]
rb_requests=0
be_requests=0
bs_requests=0
bl_requests=0
rate_limited=False

if RB_KEY:
    for i,n in enumerate(numbers):
        e=sets.setdefault(n,{})
        if e.get("imageUrl") and e.get("rebrickableUpdated"):
            continue
        try:
            rb_requests+=1
            j=get_json(
                f"https://rebrickable.com/api/v3/lego/sets/{api_num(n)}/",
                {"Authorization":f"key {RB_KEY}","User-Agent":UA}
            )
            e.update({
                "imageUrl":j.get("set_img_url") or e.get("imageUrl"),
                "rebrickableName":j.get("name"),
                "year":j.get("year"),
                "pieces":j.get("num_parts"),
                "rebrickableUrl":j.get("set_url"),
                "rebrickableUpdated":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
            })
            changed=True
        except Exception as ex:
            errors.append(f"Rebrickable {n}: {ex}")
            if "RATE_LIMIT" in str(ex):
                rate_limited=True
                # Keep already fetched entries and resume with missing sets next scheduled run.
                break
        # Be deliberately gentle with the public API; missing entries are retried next run.
        time.sleep(0.25)

# Brickset fallback for model dimensions. Brickset exposes three model
# dimensions but does not guarantee which physical axis each value represents,
# so keep them as generic modelDimension1/2/3 instead of pretending they are
# width/depth/height.
if BS_KEY:
    missing_dims=[n for n in numbers if not all([
        sets.get(n,{}).get("modelDimension1"),
        sets.get(n,{}).get("modelDimension2"),
        sets.get(n,{}).get("modelDimension3")
    ])]
    for n in missing_dims[:95]:
        e=sets.setdefault(n,{})
        try:
            bs_requests+=1
            r=requests.get(
                "https://brickset.com/api/v3.asmx/getSets",
                params={"apiKey":BS_KEY,"userHash":"","params":json.dumps({"setNumber":api_num(n),"pageSize":1})},
                headers={"Accept":"application/json","User-Agent":UA},
                timeout=25
            )
            r.raise_for_status()
            j=r.json()
            rows=j.get("sets") or []
            if rows:
                row=rows[0]
                md=row.get("modelDimensions") or {}
                d1=md.get("dimension1"); d2=md.get("dimension2"); d3=md.get("dimension3")
                if d1 and d2 and d3:
                    e.update({
                        "modelDimension1":d1,
                        "modelDimension2":d2,
                        "modelDimension3":d3,
                        "modelDimensionsSource":"Brickset",
                        "bricksetUpdated":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
                    })
                    changed=True
        except Exception as ex:
            errors.append(f"Brickset {n}: {ex}")
        time.sleep(0.18)

if BE_KEY and numbers and not REQUESTS_ONLY:
    cursor=int(meta.get("brickeconomyCursor",0)) % len(numbers)
    # Missing market data first, in collection priority order. After coverage is
    # complete, continue round-robin refreshes for already known sets.
    missing=[n for n in numbers if not (sets.get(n,{}).get("marketNewEUR") or sets.get(n,{}).get("marketUsedEUR"))]
    batch=missing[:BE_BATCH]
    if len(batch)<BE_BATCH:
        for k in range(len(numbers)):
            n=numbers[(cursor+k)%len(numbers)]
            if n not in batch:
                batch.append(n)
            if len(batch)>=BE_BATCH: break
    done=0
    for n in batch:
        e=sets.setdefault(n,{})
        try:
            be_requests+=1
            j=get_json(
                f"https://www.brickeconomy.com/api/v1/set/{api_num(n)}?currency=EUR",
                {"x-apikey":BE_KEY,"Accept":"application/json","User-Agent":UA}
            ).get("data",{})
            e.update({
                "brickeconomyName":j.get("name"),
                "theme":j.get("theme"),
                "subtheme":j.get("subtheme"),
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
                "forecast2yEUR":j.get("forecast_value_new_2_years"),
                "forecast5yEUR":j.get("forecast_value_new_5_years"),
                "growth12mPct":j.get("rolling_growth_12months"),
                "retired":j.get("retired"),
                "brickeconomyUpdated":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
            })
            changed=True; done+=1
        except Exception as ex:
            errors.append(f"BrickEconomy {n}: {ex}")
            if "RATE_LIMIT" in str(ex):
                rate_limited=True
                break
        time.sleep(0.12)
    meta["brickeconomyCursor"]=(cursor+done)%len(numbers)

# BrickLink fallback for market values. Use sold-price averages in EUR.
# BrickLink requires OAuth 1.0 credentials. Some accounts also require requests
# to originate from registered IP addresses; failures are recorded but never
# overwrite existing BrickEconomy values.
bl_ready=all([BL_CONSUMER_KEY,BL_CONSUMER_SECRET,BL_TOKEN_VALUE,BL_TOKEN_SECRET,OAuth1])
if bl_ready and numbers and not REQUESTS_ONLY:
    auth=OAuth1(BL_CONSUMER_KEY,BL_CONSUMER_SECRET,BL_TOKEN_VALUE,BL_TOKEN_SECRET)
    missing_prices=[n for n in numbers if not (sets.get(n,{}).get("marketNewEUR") or sets.get(n,{}).get("marketUsedEUR"))]
    for n in missing_prices[:40]:
        e=sets.setdefault(n,{})
        base=api_num(n)
        got=False
        try:
            vals={}
            for condition,key in (("N","marketNewEUR"),("U","marketUsedEUR")):
                bl_requests+=1
                r=requests.get(
                    f"https://api.bricklink.com/api/store/v1/items/SET/{base}/price",
                    params={"guide_type":"sold","new_or_used":condition,"currency_code":"EUR"},
                    auth=auth,
                    headers={"Accept":"application/json","User-Agent":UA},
                    timeout=25
                )
                if r.status_code==429: raise RuntimeError("RATE_LIMIT")
                r.raise_for_status()
                j=(r.json() or {}).get("data") or {}
                v=j.get("qty_avg_price") or j.get("avg_price")
                if v is not None:
                    try: vals[key]=float(v)
                    except Exception: pass
                time.sleep(0.12)
            if vals:
                for key,val in vals.items():
                    if not e.get(key): e[key]=val
                e["marketSourceFallback"]="BrickLink sold 6m"
                e["bricklinkUpdated"]=time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime())
                changed=True;got=True
        except Exception as ex:
            errors.append(f"BrickLink {n}: {ex}")
            if "RATE_LIMIT" in str(ex):
                rate_limited=True
                break

if changed:
    meta.update({
        "version":1,
        "lastUpdated":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
        "setCount":len(numbers),
        "rebrickableEnabled":bool(RB_KEY),
        "brickeconomyEnabled":bool(BE_KEY),
        "bricksetEnabled":bool(BS_KEY),
        "bricklinkEnabled":bool(bl_ready),
        "errors":errors[-20:],
        "rebrickableRequestsThisRun":rb_requests,
        "brickeconomyRequestsThisRun":be_requests,
        "bricksetRequestsThisRun":bs_requests,
        "bricklinkRequestsThisRun":bl_requests,
        "rateLimited":rate_limited
    })
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")
else:
    print("No API keys configured or no changes; nothing written.")

print(f"sets={len(numbers)} changed={changed} errors={len(errors)}")
