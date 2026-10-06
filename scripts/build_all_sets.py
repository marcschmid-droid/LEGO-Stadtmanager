#!/usr/bin/env python3
import csv, gzip, io, json, re, urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"all-sets.json"
URL="https://cdn.rebrickable.com/media/downloads/sets.csv.gz"

req=urllib.request.Request(URL,headers={"User-Agent":"Brick-City-Manager/1.0"})
with urllib.request.urlopen(req,timeout=90) as r:
    raw=r.read()

rows=csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(raw)),encoding="utf-8-sig"))
sets={}
full_count=0
for row in rows:
    full=row.get("set_num","").strip()
    m=re.fullmatch(r"(\d{3,7})-(\d+)",full)
    if not m:
        continue
    base,variant=m.group(1),int(m.group(2))
    full_count+=1
    item=[
        row.get("name","").strip(),
        int(row.get("year") or 0),
        int(row.get("num_parts") or 0),
        row.get("img_url","").strip(),
        full
    ]
    prev=sets.get(base)
    # Prefer the standard -1 variant; otherwise retain the lowest variant.
    if prev is None or variant==1 or (not str(prev[4]).endswith("-1") and variant<int(str(prev[4]).rsplit("-",1)[1])):
        sets[base]=item

payload={
    "meta":{
        "source":"Rebrickable bulk downloads",
        "updatedAt":datetime.now(timezone.utc).isoformat(),
        "uniqueSetNumbers":len(sets),
        "variantsRead":full_count
    },
    "sets":sets
}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print(f"Wrote {len(sets)} unique set numbers to {OUT}")
