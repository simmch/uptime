#!/usr/bin/env python3
"""Build the game's sprite atlas from the Angais/pixel-art-atlas-1.4m dataset (CC0).

Downloads a few Parquet shards from Hugging Face, finds sprites by subject,
writes a contact sheet of candidates, and packs the chosen picks into
public/sprites/atlas.png + atlas.json.

  pip install pyarrow pillow
  python3 scripts/fetch_sprites.py download   # fetch shards (~60 MB)
  python3 scripts/fetch_sprites.py sheet      # candidates contact sheet
  python3 scripts/fetch_sprites.py build      # pack atlas

Edit scripts/sprite_picks.json: key -> [dataset subject, candidate index].
"""
import io, json, os, sys, urllib.request
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PQ = os.path.join(ROOT, "scripts", ".parquet")
OUT = os.path.join(ROOT, "public", "sprites")
SHARDS = ["train-000", "train-007", "validation-000"]
BASE = "https://huggingface.co/datasets/Angais/pixel-art-atlas-1.4m/resolve/main/data/"
PICKS = json.load(open(os.path.join(ROOT, "scripts", "sprite_picks.json")))
N = 8

def download():
    os.makedirs(PQ, exist_ok=True)
    for s in SHARDS:
        p = os.path.join(PQ, s + ".parquet")
        if not os.path.exists(p):
            print("downloading", s); urllib.request.urlretrieve(BASE + s + ".parquet", p)

def candidates():
    import pyarrow.parquet as pq
    want = {v[0] for v in PICKS.values()}
    found = {}
    for s in SHARDS:
        t = pq.read_table(os.path.join(PQ, s + ".parquet"), columns=["subject", "image"])
        subs = t.column("subject").to_pylist()
        imgs = t.column("image")
        for i, sub in enumerate(subs):
            if sub in want and len(found.setdefault(sub, [])) < N:
                found[sub].append(imgs[i].as_py()["bytes"])
    return found

def to_img(b):
    return Image.open(io.BytesIO(b)).convert("RGBA").resize((16, 16), Image.NEAREST)

def sheet():
    found = candidates(); keys = list(PICKS)
    S = 40; W = 140 + N * (S + 4)
    img = Image.new("RGBA", (W, len(keys) * (S + 4)), (60, 60, 70, 255)); dr = ImageDraw.Draw(img)
    for r, k in enumerate(keys):
        y = r * (S + 4); dr.text((4, y + 14), k, fill=(255, 255, 255, 255))
        for i, b in enumerate(found.get(PICKS[k][0], [])):
            x = 140 + i * (S + 4)
            if i == PICKS[k][1]: dr.rectangle([x - 2, y, x + S + 1, y + S + 2], outline=(255, 220, 0, 255))
            img.alpha_composite(to_img(b).resize((S, S), Image.NEAREST), (x, y + 2))
    img.save(os.path.join(ROOT, "scripts", "contact_sheet.png")); print("sheet ok", len(keys))

def build():
    found = candidates(); keys = list(PICKS); cols = 16; rows = (len(keys) + cols - 1) // cols
    os.makedirs(OUT, exist_ok=True)
    atlas = Image.new("RGBA", (cols * 16, rows * 16), (0, 0, 0, 0))
    meta = {"tile": 16, "cols": cols, "rows": rows, "frames": {}}
    for i, k in enumerate(keys):
        c = found.get(PICKS[k][0], [])
        if not c: print("missing", k); continue
        atlas.alpha_composite(to_img(c[min(PICKS[k][1], len(c) - 1)]), ((i % cols) * 16, (i // cols) * 16))
        meta["frames"][k] = [i % cols, i // cols]
    atlas.save(os.path.join(OUT, "atlas.png")); json.dump(meta, open(os.path.join(OUT, "atlas.json"), "w"))
    print("atlas", len(meta["frames"]))

if __name__ == "__main__":
    {"download": download, "sheet": sheet, "build": build}[sys.argv[1] if len(sys.argv) > 1 else "build"]()
