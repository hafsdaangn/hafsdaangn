from pathlib import Path
import json, re, hashlib
from PIL import Image
import fitz

R = Path(__file__).resolve().parents[1]
for name in ['horizontal', 'stacked', 'symbol', 'wordmark']:
    data = (R / f'vector/hafsdaangn-{name}-color.svg').read_bytes()
    with fitz.open(stream=data, filetype='svg') as doc:
        pdf = doc.convert_to_pdf()
    (R / f'print/hafsdaangn-{name}-color-rgb.pdf').write_bytes(pdf)
Image.open(R / 'web/favicon-48.png').save(R / 'web/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
manifest = {'name': 'HAFS 당근', 'short_name': 'HAFS 당근', 'start_url': '/', 'display': 'standalone', 'background_color': '#FFFFFF', 'theme_color': '#0054B8', 'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'}, {'src': 'maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]}
(R / 'web/site.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(R / 'web/head-snippet.html').write_text('''<!-- Copy the contents of web/ to your public asset directory; adjust paths if needed. -->
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0054B8">
''', encoding='utf-8')

guide = '''<!doctype html><html lang="ko"><meta charset="utf-8"><title>HAFS 당근 · 로고 사용 가이드</title><style>
*{box-sizing:border-box}body{margin:0;color:#152338;font:13px/1.65 'Malgun Gothic',sans-serif;background:#edf1f6}main{width:794px;min-height:1123px;margin:auto;padding:44px 48px;background:white}h1{font-size:30px;letter-spacing:-1px;margin:0}h2{font-size:15px;margin:24px 0 8px}p{margin:5px 0}.eyebrow{font-size:10px;letter-spacing:2px;color:#0054B8}header{display:flex;justify-content:space-between;align-items:end;border-bottom:1px solid #dbe2eb;padding-bottom:18px}.hero{height:212px;background:#f5f7fa;display:flex;align-items:center;justify-content:center;margin-top:22px}.hero img{height:185px;width:330px}.cols{display:grid;grid-template-columns:1fr 1fr;gap:26px}.swatch{display:flex;gap:14px}.color{width:30px;height:62px;border-radius:6px;flex-shrink:0}.small{font-size:11px;color:#536277}table{border-collapse:collapse;width:100%;font-size:11px}td,th{border-bottom:1px solid #e1e6ec;text-align:left;padding:6px}footer{border-top:1px solid #dbe2eb;margin-top:24px;padding-top:13px;font-size:10px;color:#536277}@page{size:A4;margin:0}@media print{body{background:white}main{margin:0;width:210mm;min-height:297mm}}
</style><main><header><div><div class="eyebrow">HAFS DAANGN / IDENTITY SYSTEM</div><h1>로고 사용 가이드</h1></div><span class="small">v1.0 · 2026.11.06</span></header>
<div class="hero"><img src="../vector/hafsdaangn-horizontal-color.svg"></div>
<div class="cols"><section><h2>01 · 기본 조합과 여백</h2><p>가로형 컬러 로고를 기본으로 사용합니다. 좁은 공간에는 심볼 단독, 정사각형 홍보물에는 세로형을 사용합니다.</p><p>로고 바깥에는 심볼 높이의 <b>10% 이상</b> 비워 둡니다. 파일에 포함된 여백이 부족하면 배치할 때 추가합니다.</p><p>늘이기·압축·기울이기·글꼴 교체·HAFS 분리·임의 재배치·그림자 추가를 피합니다.</p></section>
<section><h2>02 · 최소 크기와 배경</h2><p>가로형: 화면 <b>160px</b> / 인쇄 <b>30mm</b> 이상 권장.<br>심볼: 화면 <b>24px</b> / 인쇄 <b>8mm</b> 이상 권장.<br>16px는 전용 favicon 파일만 사용합니다.</p><p>컬러는 흰색·밝은 중성 배경에 사용합니다. 짙은 배경에는 white 버전, 단색 인쇄에는 black 또는 blue 버전을 선택합니다.</p></section></div>
<h2>03 · 지정 색상</h2><div class="cols"><div class="swatch"><div class="color" style="background:#0054B8"></div><div><b>HAFS Blue · #0054B8</b><p>RGB 0 / 84 / 184<br><span class="small">CMYK 근사 100 / 54 / 0 / 28</span></p></div></div><div class="swatch"><div class="color" style="background:#FF6800"></div><div><b>Daangn Orange · #FF6800</b><p>RGB 255 / 104 / 0<br><span class="small">CMYK 근사 0 / 59 / 100 / 0</span></p></div></div><p class="small">색상은 마지막 시안의 파랑·주황을 기준으로 단색화했습니다. CMYK는 프로파일 없는 계산 근사값입니다. 인쇄 PDF는 RGB이며 인쇄소의 ICC 변환·실물 교정을 거쳐 사용합니다. Pantone은 지정하지 않았습니다.</p>
<h2>04 · 파일 선택</h2><table><tr><th>용도</th><th>파일·폴더</th></tr><tr><td>웹·디자인 편집·확대</td><td>vector/ · 글자가 경로로 변환된 SVG</td></tr><tr><td>문서·일반 업로드</td><td>digital/ · 투명 PNG 512·1024·2048px / 흰 배경 JPG</td></tr><tr><td>인쇄소 전달</td><td>print/ · 벡터 PDF (RGB, 색상 교정 필요)</td></tr><tr><td>브라우저·PWA·앱</td><td>web/ · SVG·ICO·PNG·manifest·head-snippet</td></tr><tr><td>프로필·SNS</td><td>social/ · 원형 자르기 여유가 있는 1024px 아바타</td></tr></table>
<h2>05 · 원본과 타이포그래피</h2><p>사용자가 선택한 마지막 생성 이미지를 기준으로 윤곽을 정리한 벡터입니다. 원본과 미세한 곡선 차이가 있을 수 있습니다. HAFS와 ‘당근’은 이미지에서 추출한 경로로 제공하며 설치용 폰트는 포함하지 않습니다. 원본의 특정 서체명·라이선스는 확인되지 않았습니다.</p>
<footer>마스터에는 라이브 글자·임베디드 이미지·필터가 없습니다. 원본 참조는 source/approved-reference.png에 보존했습니다. 상표 유사성·학교 심볼 사용 권한 확인과 인쇄 교정은 별도입니다.</footer></main></html>'''
guide = guide.replace('</span></p></div></div><p class="small">색상은', '</span></p></div></div></div><p class="small">색상은')
guide = guide.replace('</style>', 'body{font-size:12px;line-height:1.55}main{padding:36px 44px}.hero{height:175px;margin-top:18px}.hero img{height:158px}h2{margin-top:18px}td,th{padding:5px}footer{margin-top:18px}</style>')
(R / 'guidelines/brand-guide.html').write_text(guide, encoding='utf-8')
readme = '''# HAFS 당근 로고 패키지 v1.0

기준: 대화에서 최종 선택한 마지막 이미지(exec-50278af4...). 원본은 source/approved-reference.png에 보관했습니다.

## 바로 사용할 파일
- 기본: vector/hafsdaangn-horizontal-color.svg
- 투명 이미지: digital/hafsdaangn-horizontal-color-2048.png
- 전체 조합: horizontal / stacked / symbol / wordmark
- 변형: color / black / white / blue
- 앱과 웹: web/ (favicon, apple-touch-icon, app-icon, PWA manifest 포함)
- 프로필: social/hafsdaangn-avatar-1024.png
- 인쇄: print/의 벡터 PDF (RGB)
- 사용 가이드: guidelines/brand-guide.pdf 또는 brand-guide.html
- 적용 예시: presentation/brand-board.html과 slide-*.png
- 전체 미리보기: presentation/package-overview.png

SVG는 글자까지 모두 경로이며 외부 폰트나 이미지가 필요 없습니다. PNG 파일명 숫자는 가로 픽셀입니다. white는 투명 배경의 흰 로고이므로 흰 화면에서는 보이지 않는 것이 정상입니다.

## 제작·색상 안내
새 이미지를 생성하지 않고 승인 이미지의 알파·색상 마스크에서 윤곽을 추출했습니다. 잡색을 제거하고 곡선을 다듬었으므로 원본 픽셀과 완전히 동일하지는 않습니다. 단색 지정은 Blue #0054B8, Orange #FF6800입니다. 원본 생성 이미지의 미세한 명암은 단색으로 정리했습니다.
CMYK 값은 가이드의 근사값이며 Pantone을 임의로 지정하지 않았습니다. 인쇄 PDF는 RGB 벡터이므로 인쇄소가 ICC 프로파일에 맞춰 변환하고 교정해야 합니다. AI/EPS 파일은 포함하지 않습니다. SVG를 Illustrator·Figma·Inkscape에서 편집할 수 있습니다.
로고 글자는 추출 경로이며 특정 서체명이나 서체 라이선스를 확인한 것은 아닙니다. 폰트 파일은 배포하지 않습니다.

## 유지보수
source/build_kit.py: 원본에서 벡터 추출. Python + Pillow + NumPy + SciPy + Matplotlib + PyMuPDF 필요.
source/render_kit.cjs: SVG에서 PNG와 보드 이미지 생성. 프로젝트의 sharp와 playwright 필요. LOGO_BROWSER 환경변수로 Chrome 실행 경로 설정 가능.
source/finish_kit.py: 인쇄 PDF, ICO, manifest, 가이드 HTML 생성.
source/complete_kit.cjs: 가이드 PDF와 미리보기 렌더링.
source/presentation-spec.json: logo-design 스킬 presentation_board.py용 사양.
qa/: 크기·색상·경로 검사 결과와 축소 미리보기.

생성된 웹 아이콘은 패키지로만 제공하며 현재 서비스 코드는 변경하지 않았습니다.
'''
(R / 'README.md').write_text(readme, encoding='utf-8')
print('Created print masters, icon metadata and guide source')
