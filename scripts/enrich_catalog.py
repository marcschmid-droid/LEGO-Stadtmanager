#!/usr/bin/env python3
import json, os, re, time
from pathlib import Path
import requests

ROOT=Path(__file__).resolve().parents[1]
SEED=ROOT/"seed-data.js"
OUT=ROOT/"data"/"set-enrichment.json"
OUT.parent.mkdir(parents=True,exist_ok=True)

RB_KEY=os.getenv("REBRICKABLE_API_KEY","").strip()
BE_KEY=os.getenv("BRICKECONOMY_API_KEY","").strip()
BE_BATCH=max(1,min(int(os.getenv("BRICKECONOMY_BATCH_SIZE","90")),90))
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
numbers=nums()
changed=False
errors=[]

if RB_KEY:
    for i,n in enumerate(numbers):
        e=sets.setdefault(n,{})
        if e.get("imageUrl") and e.get("rebrickableUpdated"):
            continue
        try:
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
                # Keep already fetched entries and resume with missing sets next scheduled run.
                break
        # Be deliberately gentle with the public API; missing entries are retried next run.
        time.sleep(0.25)

if BE_KEY and numbers:
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
            if "RATE_LIMIT" in str(ex): break
        time.sleep(0.12)
    meta["brickeconomyCursor"]=(cursor+done)%len(numbers)

if changed:
    meta.update({
        "version":1,
        "lastUpdated":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
        "setCount":len(numbers),
        "rebrickableEnabled":bool(RB_KEY),
        "brickeconomyEnabled":bool(BE_KEY),
        "errors":errors[-20:]
    })
    OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2,sort_keys=True)+"\n",encoding="utf-8")
else:
    print("No API keys configured or no changes; nothing written.")

print(f"sets={len(numbers)} changed={changed} errors={len(errors)}")
