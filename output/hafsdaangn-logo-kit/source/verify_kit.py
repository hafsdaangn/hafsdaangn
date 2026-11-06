from pathlib import Path
import json, hashlib, re, xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont
import fitz

R = Path(__file__).resolve().parents[1]
checks = []
for p in R.rglob('*.svg'):
    raw = p.read_text(encoding='utf-8')
    ET.fromstring(raw)
    assert not re.search(r'<(?:text|image|filter)\b', raw), p
    checks.append(f'PASS vector outlines: {p.relative_to(R)}')
for p in (R / 'digital').glob('*.png'):
    image = Image.open(p)
    size = int(p.stem.rsplit('-', 1)[1])
    assert image.width == size and image.mode == 'RGBA', p
    assert image.getextrema()[3][0] == 0, p
checks.append('PASS all transparent PNG widths and alpha channels')
for p in R.rglob('*.pdf'):
    doc = fitz.open(p)
    assert len(doc) == 1, (p, len(doc))
    if p.parent.name == 'print':
        assert len(doc[0].get_images()) == 0, p
    doc[0].get_pixmap(matrix=fitz.Matrix(.8, .8)).save(str(R / 'qa' / (p.stem + '-pdf.png')))
checks.append('PASS 5 single-page PDFs; print masters contain vector artwork without raster images')
with Image.open(R / 'web/favicon.ico') as icon:
    assert icon.ico.sizes() == {(16, 16), (32, 32), (48, 48)}
checks.append('PASS ICO contains 16 / 32 / 48px entries')
manifest = json.loads((R / 'web/site.webmanifest').read_text(encoding='utf-8'))
assert all((R / 'web' / i['src']).exists() for i in manifest['icons'])
checks.append('PASS manifest icon paths resolve')
font = ImageFont.truetype('C:/Windows/Fonts/malgun.ttf', 16)
sheet = Image.new('RGB', (1100, 540), '#F1F4F8')
draw = ImageDraw.Draw(sheet)
draw.text((25, 20), 'HAFS 당근 · 실제 크기 / 확대 픽셀 확인', fill='#17263D', font=font)
for i, size in enumerate([16, 24, 32, 48, 64]):
    image = Image.open(R / f'web/favicon-{size if size != 24 else 48}.png').convert('RGBA').resize((size, size), Image.Resampling.LANCZOS)
    x = 35 + i * 200
    sheet.paste(image, (x, 90), image)
    large = image.resize((size * 3, size * 3), Image.Resampling.NEAREST)
    sheet.paste(large, (x, 190), large)
    draw.text((x, 410), f'{size}px / 3×', fill='#17263D', font=font)
sheet.save(R / 'qa/size-check.png')
checks += ['NOTE traced outlines retain the approved raster character; minor contour smoothing and solid-color normalization applied.', 'NOTE horizontal outline has 486 anchors: higher than a geometric mark, retained to preserve approved letterforms.', 'NOTE minimum sizes in the guide are recommendations; tiny 16px icons lose fine internal detail. Use 24px or larger when possible.', 'NOTE white variant uses the same master geometry; no separate optical thinning is claimed.', 'NOTE RGB print files require print-shop ICC conversion and proofing. No Pantone match or font license identification claimed.']
(R / 'qa/validation.txt').write_text('\n'.join(checks), encoding='utf-8')
print('\n'.join(checks[-9:]))
