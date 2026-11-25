#!/usr/bin/env python3
"""Download the Polyfork low-poly models this game uses into public/models.
Models are CC BY 4.0 (credit Polyfork, https://polyfork.dev). Animation clips are CC0 (Quaternius)."""
import html, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'models')
os.makedirs(OUT, exist_ok=True)
catalog = json.load(open(sys.argv[1]))  # cards scraped from https://polyfork.dev/assets
by_title = {}
for r in catalog: by_title.setdefault(html.unescape(r['title']), r['id'])
want = {k: v for k, v in json.load(open(os.path.join(ROOT, 'scripts', 'polyfork-models.json'))).items() if not k.startswith('_')}
manifest, missing = {}, []
RAW = os.path.join(os.path.expanduser('~'), '.cache', 'polyfork-raw')
os.makedirs(RAW, exist_ok=True)
GLTF = os.environ.get('GLTF_TRANSFORM', 'gltf-transform')
def get(url, path):
    if os.path.exists(path) and os.path.getsize(path) > 0: return True
    return subprocess.run(['curl', '-sfL', '-m', '60', '-o', path, url]).returncode == 0
def model(aid, out):
    """Download the authored GLB and shrink it (meshopt + quantization, node names kept)."""
    raw = os.path.join(RAW, aid + '.glb')
    if not get(f'https://polyfork.dev/cdn/{aid}.glb', raw): return False
    if os.path.exists(out) and os.path.getmtime(out) > os.path.getmtime(raw) and os.path.getsize(out) < os.path.getsize(raw): return True
    r = subprocess.run([GLTF, 'optimize', raw, out, '--compress', 'meshopt', '--simplify', 'false', '--flatten', 'false',
                        '--join', 'false', '--instance', 'false', '--texture-compress', 'false'], capture_output=True, text=True)
    if r.returncode: print(r.stderr[-400:]); return False
    return True
for key, title in want.items():
    aid = by_title.get(title)
    if not aid: missing.append((key, title)); continue
    path = os.path.join(OUT, key + '.glb')
    if model(aid, path):
        manifest[key] = {'id': aid, 'title': title, 'source': f'https://polyfork.dev/asset/{aid}'}
    else: missing.append((key, title))
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print(len(manifest), 'models; missing:', missing)
