# HAFS 당근 로고 패키지 v1.0

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
