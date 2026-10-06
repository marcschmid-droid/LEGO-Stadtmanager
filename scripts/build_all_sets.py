#!/usr/bin/env python3
import csv, gzip, io, json, re, urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"all-sets.json"
SETS_URL="https://cdn.rebrickable.com/media/downloads/sets.csv.gz"
THEMES_URL="https://cdn.rebrickable.com/media/downloads/themes.csv.gz"

def download_csv_gz(url):
    req=urllib.request.Request(url,headers={"User-Agent":"Brick-City-Manager/1.0"})
    with urllib.request.urlopen(req,timeout=90) as r:
        raw=r.read()
    return csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(raw)),encoding="utf-8-sig"))

theme_rows={}
for row in download_csv_gz(THEMES_URL):
    try:
        tid=int(row.get("id") or 0)
    except ValueError:
        continue
    if not tid:
        continue
    parent=row.get("parent_id","").strip()
    theme_rows[tid]={
        "name":row.get("name","").strip(),
        "parent":int(parent) if parent.isdigit() else 0
    }

def theme_path(tid):
    names=[]
    seen=set()
    cur=tid
    while cur and cur not in seen and cur in theme_rows:
        seen.add(cur)
        names.append(theme_rows[cur]["name"])
        cur=theme_rows[cur]["parent"]
    names.reverse()
    return " › ".join(x for x in names if x)

themes={}
for tid,row in theme_rows.items():
    path=theme_path(tid)
    root=path.split(" › ",1)[0] if path else row["name"]
    themes[str(tid)]=[row["name"],row["parent"],path,root]

sets={}
full_count=0
for row in download_csv_gz(SETS_URL):
    full=row.get("set_num","").strip()
    m=re.fullmatch(r"(\d{3,7})-(\d+)",full)
    if not m:
        continue
    base,variant=m.group(1),int(m.group(2))
    full_count+=1
    try:
        theme_id=int(row.get("theme_id") or 0)
    except ValueError:
        theme_id=0
    item=[
        row.get("name","").strip(),
        int(row.get("year") or 0),
        int(row.get("num_parts") or 0),
        row.get("img_url","").strip(),
        full,
        theme_id
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
        "variantsRead":full_count,
        "themeCount":len(themes),
        "schema":2
    },
    "themes":themes,
    "sets":sets
}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print(f"Wrote {len(sets)} unique set numbers and {len(themes)} themes to {OUT}")
