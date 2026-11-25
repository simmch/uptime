#!/usr/bin/env python3
"""Render every model in public/models into the UI icon sheet (public/sprites/icons.webp + icons.json).
Start the dev server first (npx vite --port 5173), then: python3 scripts/model-icons.py [key ...]
Needs: pip install playwright pillow && playwright install chromium"""
import asyncio, base64, io, json, os, sys
from playwright.async_api import async_playwright
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, 'scripts', '.icon-cache')
URL = os.environ.get('ICON_URL', 'http://localhost:5173/scripts/model-icons.html')

async def render(only):
    os.makedirs(CACHE, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = await browser.new_page()
        await page.goto(URL)
        for key in await page.evaluate('window.ready'):
            if only and key not in only: continue
            url = await page.evaluate('k => window.renderIcon(k)', key)
            if url: open(os.path.join(CACHE, key + '.png'), 'wb').write(base64.b64decode(url.split(',')[1]))
        await browser.close()

def sheet(cell=96, cols=16):
    files = sorted(f for f in os.listdir(CACHE) if f.endswith('.png'))
    rows = (len(files) + cols - 1) // cols
    out = Image.new('RGBA', (cols * cell, rows * cell), (0, 0, 0, 0))
    frames = {}
    for i, f in enumerate(files):
        im = Image.open(os.path.join(CACHE, f)).convert('RGBA')
        box = im.getbbox()
        if box:  # trim, then fit with a small margin
            im = im.crop(box); w, h = im.size; s = (cell - 6) / max(w, h)
            im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        x, y = (i % cols) * cell, (i // cols) * cell
        out.paste(im, (x + (cell - im.size[0]) // 2, y + (cell - im.size[1]) // 2), im)
        frames[f[:-4]] = [i % cols, i // cols]
    out.save(os.path.join(ROOT, 'public', 'sprites', 'icons.webp'), 'WEBP', quality=88, method=6)
    json.dump({'tile': cell, 'cols': cols, 'rows': rows, 'frames': frames}, open(os.path.join(ROOT, 'public', 'sprites', 'icons.json'), 'w'))
    print(len(files), 'icons')

asyncio.run(render(set(sys.argv[1:])))
sheet()
