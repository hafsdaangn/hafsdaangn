from pathlib import Path
import json, shutil, re, io
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
import matplotlib
matplotlib.use('Agg')
from matplotlib.figure import Figure
from matplotlib.path import Path as MPath
import fitz

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(r'C:\Users\seanc\.codex\generated_images\01a1ade9-cc07-7d11-bf18-c486c23bf42a\exec-50278af4-8eb0-4b88-93b4-74a49cf48bc2.png')
BLUE, ORANGE = '#0054B8', '#FF6800'
for folder in ['source', 'vector', 'digital', 'print', 'web', 'social', 'guidelines', 'presentation', 'qa']:
    (ROOT / folder).mkdir(exist_ok=True)
shutil.copy2(SOURCE, ROOT / 'source/approved-reference.png')
arr = np.array(Image.open(SOURCE).convert('RGBA'))
alpha = arr[:, :, 3] > 210
blue_mask = alpha & (arr[:, :, 2] > arr[:, :, 0] + 0.0) & (arr[:, :, 2] > 90)
orange_mask = alpha & (arr[:, :, 0] > 150) & (arr[:, :, 0].astype(float) > arr[:, :, 2].astype(float) + 80)

def clean(mask, small=False):
    labels, count = ndi.label(mask)
    sizes = np.bincount(labels.ravel())
    mask = np.isin(labels, np.where(sizes > 160)[0][1:])
    mask = ndi.binary_closing(mask, iterations=1)
    return ndi.gaussian_filter(mask.astype(float), 1.7 if small else 1.0) > .5

def rdp(points, tolerance=1.0):
    if len(points) < 3:
        return points
    delta = points[-1] - points[0]
    length = np.linalg.norm(delta)
    distance = np.linalg.norm(points - points[0], axis=1) if length < .001 else np.abs(delta[0] * (points[:, 1] - points[0, 1]) - delta[1] * (points[:, 0] - points[0, 0])) / length
    i = int(np.argmax(distance))
    if distance[i] > tolerance:
        return np.vstack([rdp(points[:i + 1], tolerance)[:-1], rdp(points[i:], tolerance)])
    return points[[0, -1]]

def trace(mask):
    fig = Figure()
    ax = fig.subplots()
    paths = ax.contour(mask.astype(float), levels=[.5]).allsegs[0]
    output = []
    for points in paths:
        if len(points) < 15:
            continue
        area = abs(np.sum(points[:-1, 0] * points[1:, 1] - points[1:, 0] * points[:-1, 1])) / 2
        if area < 35:
            continue
        # Split closed loops at the farthest point before simplifying.
        cut = int(np.argmax(np.linalg.norm(points - points[0], axis=1)))
        points = np.vstack([rdp(points[:cut + 1])[:-1], rdp(points[cut:])[:-1]])
        # Short quadratic joins retain the traced contour without pixel stair steps.
        mids = (points + np.roll(points, -1, axis=0)) / 2
        d = f'M {mids[-1, 0]:.2f} {mids[-1, 1]:.2f} '
        d += ' '.join(f'Q {p[0]:.2f} {p[1]:.2f} {m[0]:.2f} {m[1]:.2f}' for p, m in zip(points, mids)) + ' Z'
        output.append(d)
    return ' '.join(output)

masks = [clean(blue_mask), clean(orange_mask)]
symbol_masks, word_masks = [], []
for mask in masks:
    sy, wo = mask.copy(), mask.copy()
    sy[:, 820:] = False
    wo[:, :820] = False
    symbol_masks.append(sy)
    word_masks.append(wo)

def bbox(mm):
    ys, xs = np.where(np.logical_or.reduce(mm))
    return [int(xs.min()), int(ys.min()), int(xs.max() + 1), int(ys.max() + 1)]

sb, wb = bbox(symbol_masks), bbox(word_masks)
def group(mm, box, mono=None):
    x, y, _, _ = box
    return f'<g transform="translate({-x} {-y})">' + ''.join(f'<path fill="{mono or color}" fill-rule="evenodd" d="{trace(mask)}"/>' for mask, color in zip(mm, [BLUE, ORANGE])) + '</g>'

SY, WO = group(symbol_masks, sb), group(word_masks, wb)
sw, sh = sb[2] - sb[0], sb[3] - sb[1]
ww, wh = wb[2] - wb[0], wb[3] - wb[1]
gap, wtop = wb[0] - sb[2], wb[1] - sb[1]

def svg(body, w, h, name):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img"><title>HAFS 당근 — {name}</title>{body}</svg>'

def wrap(body, x, y, scale=1):
    return f'<g transform="translate({x:.2f} {y:.2f}) scale({scale:.5f})">{body}</g>'

pad = 36
layouts = {
    'horizontal': (wrap(SY, pad, pad) + wrap(WO, pad + sw + gap, pad + wtop), sw + gap + ww + 2 * pad, sh + 2 * pad),
    'symbol': (wrap(SY, pad, pad), sw + 2 * pad, sh + 2 * pad),
    'wordmark': (wrap(WO, pad, pad), ww + 2 * pad, wh + 2 * pad),
    'stacked': (wrap(SY, (max(sw, ww) - sw) / 2 + pad, pad) + wrap(WO, (max(sw, ww) - ww) / 2 + pad, pad + sh + 55), max(sw, ww) + 2 * pad, sh + wh + 55 + 2 * pad)
}
for name, (body, w, h) in layouts.items():
    for variant, mono in [('color', None), ('black', '#000000'), ('white', '#FFFFFF'), ('blue', BLUE)]:
        art = body if mono is None else re.sub(r'fill="#[0-9A-Fa-f]{6}"', f'fill="{mono}"', body)
        (ROOT / f'vector/hafsdaangn-{name}-{variant}.svg').write_text(svg(art, w, h, name), encoding='utf-8')

def tile(body, size=1024, safe=.72, background='#FFFFFF'):
    scale = size * safe / max(sw, sh)
    bg = f'<rect width="{size}" height="{size}" fill="{background}"/>' if background else ''
    return svg(bg + wrap(body, (size - sw * scale) / 2, (size - sh * scale) / 2, scale), size, size, 'app icon')

(ROOT / 'social/hafsdaangn-avatar.svg').write_text(tile(SY, safe=.66), encoding='utf-8')
(ROOT / 'web/app-icon.svg').write_text(tile(SY), encoding='utf-8')
(ROOT / 'web/maskable.svg').write_text(tile(SY, safe=.60), encoding='utf-8')
small_sy = group([clean(m, small=True) for m in symbol_masks], sb)
(ROOT / 'vector/hafsdaangn-symbol-small.svg').write_text(tile(small_sy, size=256, safe=.86, background=None), encoding='utf-8')
(ROOT / 'web/favicon.svg').write_text(tile(small_sy, size=64, safe=.86, background=None), encoding='utf-8')
spec = {'brand': 'HAFS 당근', 'brief': '왼쪽 심볼의 유려한 곡선을 유지하고, 부드럽지만 단정한 워드마크로 균형을 맞춘 학교 커뮤니티 로고.', 'adjectives': ['친근함', '명료함', '균형'], 'criteria': '선택한 마지막 시안의 비율을 유지하고, 크기와 배경에 맞춰 일관되게 사용합니다.', 'industry': 'consumer-app', 'nav': ['둘러보기', '관심 목록', '내 정보'], 'brand_color': BLUE, 'tile_color': '#F2F5FA', 'greyscale': False, 'final': True, 'round': 3, 'designer': 'HAFS 당근', 'concepts': [{'name': 'Final identity', 'symbol': '../vector/hafsdaangn-symbol-color.svg', 'lockup': '../vector/hafsdaangn-horizontal-color.svg', 'stacked': '../vector/hafsdaangn-stacked-color.svg', 'avatar': '../social/hafsdaangn-avatar.svg', 'symbol_on_tile': '../vector/hafsdaangn-symbol-color.svg', 'lockup_on_dark': '../vector/hafsdaangn-horizontal-white.svg', 'symbol_on_dark': '../vector/hafsdaangn-symbol-white.svg', 'idea': '유려한 심볼과 간결하게 정돈한 HAFS 당근 워드마크.', 'rationale': ['마지막 선택 시안의 크기·배치·글자 형태를 기준으로 벡터화', '미세한 가장자리 잡색을 제거하고 두 가지 단색으로 통일', '가로·세로·심볼·워드마크와 작은 화면용 자산 제공']}], 'recommendation': '기본은 가로형 컬러 로고, 좁은 공간에는 심볼 단독을 사용합니다.', 'next_steps': ['제공한 SVG·PNG를 용도에 맞게 사용', '인쇄는 실제 출력 색상 확인 후 진행']}
(ROOT / 'source/presentation-spec.json').write_text(json.dumps(spec, ensure_ascii=False, indent=2).replace('../vector/', '../vector/'), encoding='utf-8')
# Spec lives in source/, so relative sibling paths remain portable.
(ROOT / 'source/geometry.json').write_text(json.dumps({'symbol_bbox': sb, 'wordmark_bbox': wb, 'gap': gap, 'palette': {'blue': BLUE, 'orange': ORANGE}, 'method': 'alpha > 210, connected component cleanup, Gaussian contour smoothing, quadratic outline tracing', 'reference': SOURCE.name}, indent=2), encoding='utf-8')
print(json.dumps({'symbol': sb, 'wordmark': wb, 'svg_count': len(list(ROOT.rglob('*.svg')))}))
