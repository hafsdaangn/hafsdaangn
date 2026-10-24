# 합스당근 사이트 문구 검토표

기준: 2026-10-24 최초 수집본. 문구 번호는 후속 검토를 위해 유지합니다. 표의 현재 문구와 소스 위치는 최초 수집 당시 기준이며, 적용된 삭제·수정은 마지막 판정 칸에 표시합니다.

화면별로 현재 문구와 소스 위치를 정리했습니다. 같은 파일의 동일 문구는 한 행에 묶었습니다. 화면에 직접 보이는 글뿐 아니라 접근성 이름, 입력 예시, 개발 환경 안내, 알림, API 오류도 포함합니다. 코드나 주석, README, 테스트용 예문, 사용자가 작성한 게시글·닉네임·메시지는 제외합니다.

판정 칸에 `유지`, `삭제`, `변경 → 새 문구`를 적거나 문구 번호로 지시할 수 있습니다. `${…}`는 실행 시 실제 값으로 바뀌는 부분입니다. 줄바꿈으로 나뉜 제목은 소스 단위로 기록했습니다. 라이브 DB·브라우저·검증 라이브러리가 자체 생성하는 문구는 고정 문구로 열거할 수 없어 이 목록에 포함하지 않았습니다.

## 이미 제거한 문구

- 회원 탈퇴
- 합스당근을 탈퇴할까요?
- 프로필은 익명화되고 게시글은 숨겨져요. 기존 상대방의 대화 기록은 유지돼요. 재가입은 현재 지원하지 않아요.
- 탈퇴하기

## 먼저 검토할 표현 (최초 수집본 · 반영 전)

| 위치 | 현재 문구 |
| --- | --- |
| 첫 화면 상단 | 우리 학교의 작은 장터 |
| 첫 화면 제목 | 쓰던 물건의 다음 이야기는 우리 학교에서. |
| 첫 화면 소개 | 필요한 물건을 사고, 나누고. 잃어버린 물건도 다시 만나는 합스당근. |
| 첫 화면 그림 | HAFS / 함께 쓰는 일상 |
| 첫 화면 그림 | 가까워서 더 좋은 거래. |
| 첫 화면 그림 | 다음 주인도, 잃어버린 주인도 생각보다 가까이 있을 거예요. |
| 첫 화면 그림 | 점심시간에 만나요! / 찾았어요, 내 물건 |
| 첫 화면 하단 | 합스당근 · HAFS 구성원을 위한 중고거래와 분실물 연결 |
| 첫 화면 하단 | 학교 계정으로, 우리끼리. |
| 공통 헤더 | 우리 학교에서 시작하는 연결 |
| 목록 로딩 | 학교 소식을 불러오는 중이에요 |
| 첫 가입 | 반가워요! / 어떤 이름으로 만나볼까요? |
| 첫 가입 | 학교 친구들에게 보일 닉네임을 정해 주세요. |
| 장터 제목 | 우리 학교 장터 |
| 장터 소개 | 필요한 물건은 가까이, 쓰던 물건은 다음 친구에게. |
| 분실물 소개 | 잃어버린 물건, 여기서 찾아요. |
| 목록 배지 | HAFS 안에서 함께 |
| 빈 목록 | 첫 번째 글로 학교 친구들과 연결해 보세요. |
| 채팅 소개 | 물건도, 마음도 가까이. |
| 빈 채팅 목록 | 게시글에서 채팅을 시작해 보세요. |
| 선택 전 채팅 | 학교 친구와 거래를 이야기해 보세요. |
| 대화 첫 인사 | 첫 인사를 건네보세요. |
| 닉네임 대체 표시 | 학교 친구 |
| 내 게시글 빈 화면 | 사용하지 않는 물건을 학교 친구와 나눠보세요. |

참고: 요청에서 예로 든 “우리 학교에서 시작하는 거래”의 실제 소스 문구는 “우리 학교에서 시작하는 연결”입니다.

## 첫 화면 · 로그인

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C001 | 로그인 연결을 준비하고 있어요. 서비스 설정 후 이용할 수 있어요. | 표시 / 안내 | app/page.tsx:16 | |
| C002 | Google 계정으로 다시 로그인해 주세요. | 표시 / 안내 | app/page.tsx:18 | |
| C003 | @hafs.hs.kr 학교 Google 계정으로 로그인해 주세요. | 표시 / 안내 | app/page.tsx:19 | |
| C004 | 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요. | 표시 / 안내 | app/page.tsx:20 | |
| C005 | 우리 학교의 작은 장터 | 표시 / 안내 | app/page.tsx:26 | 삭제 완료 |
| C006 | 안녕, HAFS! | 표시 / 안내 | app/page.tsx:30 | 삭제 완료 |
| C007 | 쓰던 물건의 | 표시 / 안내 | app/page.tsx:32 | |
| C008 | 다음 이야기는 | 표시 / 안내 | app/page.tsx:34 | |
| C009 | 우리 학교에서. | 표시 / 안내 | app/page.tsx:36 | |
| C010 | 필요한 물건을 사고, 나누고. | 표시 / 안내 | app/page.tsx:39 | |
| C011 | 잃어버린 물건도 다시 만나는 합스당근. | 표시 / 안내 | app/page.tsx:41 | |
| C012 | Google 계정으로 시작하기 | 표시 / 안내 | app/page.tsx:52 | |
| C013 | 학교 Google 계정으로 시작하기 | 표시 / 안내 | app/page.tsx:53 | |
| C014 | 개발 환경 · 모든 Google 계정을 사용할 수 있어요 | 표시 / 안내 | app/page.tsx:58 | 삭제 완료 |
| C015 | @hafs.hs.kr 계정만 이용할 수 있어요 | 표시 / 안내 | app/page.tsx:59 | 삭제 완료 |
| C016 | HAFS / 함께 쓰는 일상 | 표시 / 안내 | app/page.tsx:70 | 삭제 완료 |
| C017 | 가까워서 더 좋은 거래. | 표시 / 안내 | app/page.tsx:78 | 삭제 완료 |
| C018 | 다음 주인도, 잃어버린 주인도 | 표시 / 안내 | app/page.tsx:80 | 삭제 완료 |
| C019 | 생각보다 가까이 있을 거예요. | 표시 / 안내 | app/page.tsx:82 | 삭제 완료 |
| C020 | 점심시간에 만나요! | 표시 / 안내 | app/page.tsx:88 | 삭제 완료 |
| C021 | 찾았어요, 내 물건 | 표시 / 안내 | app/page.tsx:92 | 삭제 완료 |
| C022 | 합스당근 · HAFS 구성원을 위한 중고거래와 분실물 연결 | 표시 / 안내 | app/page.tsx:97 | |
| C023 | 학교 계정으로, 우리끼리. | 표시 / 안내 | app/page.tsx:98 | 삭제 완료 |

## 공통 메뉴 · 첫 가입

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C024 | 장터 | 표시 / 안내 | components/workspace.tsx:31 | |
| C025 | 분실물 | 표시 / 안내 | components/workspace.tsx:37 | |
| C026 | 채팅 | 표시 / 안내 | components/workspace.tsx:43, 74, 152 | |
| C027 | 내 정보 | 표시 / 안내 | components/workspace.tsx:49 | |
| C028 | 본문으로 이동 | 표시 / 안내 | components/workspace.tsx:59 | |
| C029 | 합스당근 장터 | 접근성 / 대체 텍스트 | components/workspace.tsx:63 | |
| C030 | 주요 메뉴 | 접근성 / 대체 텍스트 | components/workspace.tsx:66 | |
| C031 | 우리 학교에서 시작하는 연결 | 표시 / 안내 | components/workspace.tsx:78 | 삭제 완료 |
| C032 | 다시 불러오기 | 표시 / 안내 | components/workspace.tsx:91 | |
| C033 | 로그인으로 돌아가기 | 표시 / 안내 | components/workspace.tsx:93 | |
| C034 | 학교 소식을 불러오는 중이에요 | 표시 / 안내 | components/workspace.tsx:98 | 변경 완료 → 내용을 불러오는 중이에요. |
| C035 | 반가워요! | 표시 / 안내 | components/workspace.tsx:104 | 삭제 완료 · Google 계정 이름 사용 |
| C036 | 어떤 이름으로 | 표시 / 안내 | components/workspace.tsx:106 | 삭제 완료 · Google 계정 이름 사용 |
| C037 | 만나볼까요? | 표시 / 안내 | components/workspace.tsx:108 | 삭제 완료 · Google 계정 이름 사용 |
| C038 | 학교 친구들에게 보일 닉네임을 정해 주세요. | 표시 / 안내 | components/workspace.tsx:110 | 삭제 완료 · Google 계정 이름 사용 |
| C039 | 하단 메뉴 | 접근성 / 대체 텍스트 | components/workspace.tsx:143 | |

## 장터 · 분실물 목록

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C040 | 전체 | 표시 / 안내 | components/feed.tsx:22, 24, 38, 63, 65, 134, 138, 159 | |
| C041 | 분실물 | 표시 / 안내 | components/feed.tsx:117 | |
| C042 | 우리 학교 장터 | 표시 / 안내 | components/feed.tsx:117 | |
| C043 | 잃어버린 물건, 여기서 찾아요. | 표시 / 안내 | components/feed.tsx:120 | |
| C044 | 필요한 물건은 가까이, 쓰던 물건은 다음 친구에게. | 표시 / 안내 | components/feed.tsx:121 | |
| C045 | HAFS 안에서 함께 | 표시 / 안내 | components/feed.tsx:124 | 삭제 완료 |
| C046 | 물건 이름이나 특징 검색 | 표시 / 안내 | components/feed.tsx:129 | |
| C047 | 어떤 물건을 찾으세요? | 표시 / 안내 | components/feed.tsx:129 | |
| C048 | 분실물 유형 | 표시 / 안내 | components/feed.tsx:131 | |
| C049 | 카테고리 | 표시 / 안내 | components/feed.tsx:131 | |
| C050 | 잃어버렸어요 | 표시 / 안내 | components/feed.tsx:135 | |
| C051 | 주웠어요 | 표시 / 안내 | components/feed.tsx:136 | |
| C052 | 장소 필터 | 접근성 / 대체 텍스트 | components/feed.tsx:155 | |
| C053 | 장소 전체 | 표시 / 안내 | components/feed.tsx:159 | |
| C054 | 글 유형 필터 | 접근성 / 대체 텍스트 | components/feed.tsx:166 | |
| C055 | 전체 유형 | 표시 / 안내 | components/feed.tsx:170 | |
| C056 | 판매 | 표시 / 안내 | components/feed.tsx:171 | |
| C057 | 나눔 | 표시 / 안내 | components/feed.tsx:172 | |
| C058 | 물물교환 | 표시 / 안내 | components/feed.tsx:173 | |
| C059 | 찾는 중만 | 표시 / 안내 | components/feed.tsx:182 | |
| C060 | 거래 가능한 글 | 표시 / 안내 | components/feed.tsx:182 | |
| C061 | 최신순 | 표시 / 안내 | components/feed.tsx:186 | |
| C062 | 목록 불러오는 중 | 접근성 / 대체 텍스트 | components/feed.tsx:191 | |
| C063 | 검색 결과가 없어요 | 표시 / 안내 | components/feed.tsx:204 | |
| C064 | 아직 올라온 글이 없어요 | 표시 / 안내 | components/feed.tsx:204 | |
| C065 | 다른 검색어나 필터로 찾아보세요. | 표시 / 안내 | components/feed.tsx:207 | |
| C066 | 첫 번째 글로 학교 친구들과 연결해 보세요. | 표시 / 안내 | components/feed.tsx:208 | |
| C067 | 필터 초기화 | 표시 / 안내 | components/feed.tsx:220 | |
| C068 | 더 보기 | 표시 / 안내 | components/feed.tsx:232 | |

## 게시글 작성 · 수정

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C069 | 사진은 최대 5장까지 올릴 수 있어요. | 표시 / 안내 | components/post-form.tsx:36 | |
| C070 | 기타 | 표시 / 안내 | components/post-form.tsx:63 | |
| C071 | 게시글 수정 | 표시 / 안내 | components/post-form.tsx:90 | |
| C072 | 분실물 글쓰기 | 표시 / 안내 | components/post-form.tsx:90 | |
| C073 | 장터 글쓰기 | 표시 / 안내 | components/post-form.tsx:90 | |
| C074 | 게시글 정보 | 표시 / 안내 | components/post-form.tsx:95 | |
| C075 | 사진 | 표시 / 안내 | components/post-form.tsx:98 | |
| C076 | 1~5장 | 표시 / 안내 | components/post-form.tsx:100 | |
| C077 | 선택, 최대 5장 | 표시 / 안내 | components/post-form.tsx:100 | |
| C078 | 올리는 중… | 표시 / 안내 | components/post-form.tsx:111 | |
| C079 | 업로드 사진 ${i + 1} | 표시 / 안내 | components/post-form.tsx:115 | |
| C080 | 대표 | 표시 / 안내 | components/post-form.tsx:116 | |
| C081 | 사진 ${i + 1} 삭제 | 표시 / 안내 | components/post-form.tsx:123 | |
| C082 | 사진 ${i + 1} 앞으로 | 표시 / 안내 | components/post-form.tsx:131 | |
| C083 | 사진 ${i + 1} 뒤로 | 표시 / 안내 | components/post-form.tsx:146 | |
| C084 | 개인정보가 보이지 않는 사진을 올려 주세요. 파일당 최대 10MB. | 표시 / 안내 | components/post-form.tsx:171 | |
| C085 | 글 유형 | 표시 / 안내 | components/post-form.tsx:175 | |
| C086 | 잃어버렸어요 | 표시 / 안내 | components/post-form.tsx:179 | |
| C087 | 주웠어요 | 표시 / 안내 | components/post-form.tsx:180 | |
| C088 | 판매 | 표시 / 안내 | components/post-form.tsx:183 | |
| C089 | 무료나눔 | 표시 / 안내 | components/post-form.tsx:184 | |
| C090 | 물물교환 | 표시 / 안내 | components/post-form.tsx:185 | |
| C091 | 등록 후에는 글 유형을 바꿀 수 없어요. | 표시 / 안내 | components/post-form.tsx:202 | |
| C092 | 제목 | 표시 / 안내 | components/post-form.tsx:207 | |
| C093 | 어떤 물건인가요? | 표시 / 안내 | components/post-form.tsx:215 | |
| C094 | 어떤 물건을 찾거나 주우셨나요? | 표시 / 안내 | components/post-form.tsx:215 | |
| C095 | 카테고리 | 표시 / 안내 | components/post-form.tsx:222 | |
| C096 | 가격 | 표시 / 안내 | components/post-form.tsx:235 | |
| C097 | 원 | 표시 / 안내 | components/post-form.tsx:249 | |
| C098 | 받고 싶은 물건 | 표시 / 안내 | components/post-form.tsx:257 | |
| C099 | 예: 문제집, 보조배터리 | 입력 예시 | components/post-form.tsx:265 | |
| C100 | 설명 | 표시 / 안내 | components/post-form.tsx:270 | |
| C101 | 사용 상태, 하자, 구성품 등을 알려 주세요. | 표시 / 안내 | components/post-form.tsx:281 | |
| C102 | 물건의 특징과 발견에 도움이 되는 정보를 알려 주세요. | 표시 / 안내 | components/post-form.tsx:282 | |
| C103 | 희망 거래 장소 | 표시 / 안내 | components/post-form.tsx:289 | |
| C104 | 분실·발견 장소 | 표시 / 안내 | components/post-form.tsx:289 | |
| C105 | 분실·발견 날짜 | 표시 / 안내 | components/post-form.tsx:303 | |
| C106 | 보관 방법 | 표시 / 안내 | components/post-form.tsx:319 | |
| C107 | 직접 보관 중 | 표시 / 안내 | components/post-form.tsx:325 | |
| C108 | 직접 보관 중 또는 맡긴 장소 | 입력 예시 | components/post-form.tsx:326 | |
| C109 | 저장하는 중 | 표시 / 안내 | components/post-form.tsx:339 | |
| C110 | 수정 완료 | 표시 / 안내 | components/post-form.tsx:342 | |
| C111 | 등록하기 | 표시 / 안내 | components/post-form.tsx:344 | |

## 게시글 상세

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C112 | 게시글 | 표시 / 안내 | components/post-detail.tsx:75 | |
| C113 | 게시글을 찾을 수 없어요 | 표시 / 안내 | components/post-detail.tsx:77 | |
| C114 | 삭제되었거나 접근할 수 없는 글이에요. | 표시 / 안내 | components/post-detail.tsx:78 | |
| C115 | 내 게시글만 수정할 수 있어요 | 표시 / 안내 | components/post-detail.tsx:94 | |
| C116 | 상품 상세 | 표시 / 안내 | components/post-detail.tsx:119 | |
| C117 | 분실물 상세 | 표시 / 안내 | components/post-detail.tsx:119 | |
| C118 | 이전 사진 | 접근성 / 대체 텍스트 | components/post-detail.tsx:132 | |
| C119 | 다음 사진 | 접근성 / 대체 텍스트 | components/post-detail.tsx:143 | |
| C120 | 학교 친구 | 표시 / 안내 | components/post-detail.tsx:155 | 삭제 완료 |
| C121 | Google 계정 인증 | 표시 / 안내 | components/post-detail.tsx:158 | 삭제 완료 |
| C122 | 내 게시글 | 표시 / 안내 | components/post-detail.tsx:161 | |
| C123 | 받고 싶은 물건 | 표시 / 안내 | components/post-detail.tsx:179 | |
| C124 | 희망 거래 장소 | 표시 / 안내 | components/post-detail.tsx:187 | |
| C125 | 분실·발견 장소 | 표시 / 안내 | components/post-detail.tsx:187 | |
| C126 | 분실·발견 날짜 | 표시 / 안내 | components/post-detail.tsx:196 | |
| C127 | 진행 상태 | 표시 / 안내 | components/post-detail.tsx:209 | |
| C128 | 거래 가능 | 표시 / 안내 | components/post-detail.tsx:223 | |
| C129 | 찾는 중 | 표시 / 안내 | components/post-detail.tsx:223 | |
| C130 | 예약 중 | 표시 / 안내 | components/post-detail.tsx:225 | |
| C131 | 거래 완료 | 표시 / 안내 | components/post-detail.tsx:227 | |
| C132 | 해결 완료 | 표시 / 안내 | components/post-detail.tsx:227 | |
| C133 | 수정 | 표시 / 안내 | components/post-detail.tsx:236 | |
| C134 | 삭제 | 표시 / 안내 | components/post-detail.tsx:243 | |
| C135 | 게시글을 삭제할까요? 기존 채팅은 유지돼요. | 표시 / 안내 | components/post-detail.tsx:248 | |
| C136 | 취소 | 표시 / 안내 | components/post-detail.tsx:254 | |
| C137 | 삭제하기 | 표시 / 안내 | components/post-detail.tsx:264 | |
| C138 | 거래 금액 | 표시 / 안내 | components/post-detail.tsx:273 | |
| C139 | 분실물 연결 | 표시 / 안내 | components/post-detail.tsx:273 | |
| C140 | 대화 이어가기 | 표시 / 안내 | components/post-detail.tsx:288 | |
| C141 | 완료된 게시글 | 표시 / 안내 | components/post-detail.tsx:290 | |
| C142 | 채팅하기 | 표시 / 안내 | components/post-detail.tsx:292 | |
| C143 | 관련 정보 보내기 | 표시 / 안내 | components/post-detail.tsx:294 | |
| C144 | 제 물건 같아요 | 표시 / 안내 | components/post-detail.tsx:296 | |

## 채팅

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C145 | 채팅 | 표시 / 안내 | components/chats.tsx:165 | |
| C146 | 물건도, 마음도 가까이. | 표시 / 안내 | components/chats.tsx:166 | |
| C147 | 학교 친구 | 표시 / 안내 | components/chats.tsx:187, 236 | 삭제 완료 |
| C148 | 사진을 보냈어요 | 표시 / 안내 | components/chats.tsx:194 | |
| C149 | 첫 인사를 건네보세요. | 표시 / 안내 | components/chats.tsx:195 | |
| C150 | 99+ | 표시 / 안내 | components/chats.tsx:201 | |
| C151 | 아직 대화가 없어요 | 표시 / 안내 | components/chats.tsx:209 | |
| C152 | 게시글에서 채팅을 시작해 보세요. | 표시 / 안내 | components/chats.tsx:210 | |
| C153 | 대화를 선택해 주세요 | 표시 / 안내 | components/chats.tsx:218 | |
| C154 | 학교 친구와 거래를 이야기해 보세요. | 표시 / 안내 | components/chats.tsx:219 | |
| C155 | 대화를 찾을 수 없어요 | 표시 / 안내 | components/chats.tsx:223 | |
| C156 | 채팅 목록으로 | 접근성 / 대체 텍스트 | components/chats.tsx:230 | |
| C157 | Google 계정 인증 | 표시 / 안내 | components/chats.tsx:237 | 삭제 완료 |
| C158 | 완료 | 표시 / 안내 | components/chats.tsx:255 | |
| C159 | 게시글 보기 | 표시 / 안내 | components/chats.tsx:256 | |
| C160 | 삭제된 게시글 | 표시 / 안내 | components/chats.tsx:257 | |
| C161 | 대화 내용 | 접근성 / 대체 텍스트 | components/chats.tsx:262 | |
| C162 | 대화가 시작되었어요 | 표시 / 안내 | components/chats.tsx:263 | |
| C163 | 불러오는 중… | 표시 / 안내 | components/chats.tsx:270 | |
| C164 | 이전 메시지 보기 | 표시 / 안내 | components/chats.tsx:270 | |
| C165 | 채팅에 첨부된 사진 | 접근성 / 대체 텍스트 | components/chats.tsx:294 | |
| C166 | 읽음 | 표시 / 안내 | components/chats.tsx:301 | |
| C167 | 보내는 사진 | 접근성 / 대체 텍스트 | components/chats.tsx:319 | |
| C168 | 전송 실패 · 재시도 | 표시 / 안내 | components/chats.tsx:328 | |
| C169 | 전송 중 | 표시 / 안내 | components/chats.tsx:331 | |
| C170 | 첨부할 사진 | 접근성 / 대체 텍스트 | components/chats.tsx:340 | |
| C171 | 사진 취소 | 표시 / 안내 | components/chats.tsx:341 | |
| C172 | 사진 첨부 | 접근성 / 대체 텍스트 | components/chats.tsx:354 | |
| C173 | 메시지 | 접근성 / 대체 텍스트 | components/chats.tsx:368 | |
| C174 | 메시지 보내기 | 입력 예시 | components/chats.tsx:369 | |
| C175 | 메시지 전송 | 접근성 / 대체 텍스트 | components/chats.tsx:377 | |

## 채팅 알림 설정

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C176 | 알림 설정을 저장하지 못했어요. | 표시 / 안내 | components/push-settings.tsx:21 | |
| C177 | 먼저 이 브라우저의 알림을 허용해 주세요. | 오류 | components/push-settings.tsx:135 | |
| C178 | 합스당근 알림 테스트 | 표시 / 안내 | components/push-settings.tsx:136 | |
| C179 | 이 알림이 보이면 브라우저의 알림 표시가 동작하고 있어요. | 표시 / 안내 | components/push-settings.tsx:137 | |
| C180 | 테스트 알림을 요청했어요. 보이지 않으면 브라우저와 기기의 알림 설정을 확인해 주세요. | 표시 / 안내 | components/push-settings.tsx:143 | |
| C181 | 채팅 알림 | 표시 / 안내 | components/push-settings.tsx:157 | |
| C182 | iPhone은 Safari 공유 메뉴에서 ‘홈 화면에 추가’한 뒤, 추가된 아이콘으로 열어 알림을 켜주세요. iOS 16.4 이상에서 사용할 수 있어요. | 표시 / 안내 | components/push-settings.tsx:161 | |
| C183 | 이 브라우저에서는 알림을 지원하지 않아요. 최신 Safari 또는 Chrome에서 열어주세요. | 표시 / 안내 | components/push-settings.tsx:163 | |
| C184 | 채팅 알림 기능을 준비하고 있어요. | 표시 / 안내 | components/push-settings.tsx:165 | |
| C185 | 알림이 차단되어 있어요. 기기 또는 브라우저 설정에서 이 사이트의 알림을 허용한 뒤 다시 열어주세요. | 표시 / 안내 | components/push-settings.tsx:167 | |
| C186 | 이 기기로 새 채팅 알림을 받고 있어요. | 표시 / 안내 | components/push-settings.tsx:169 | |
| C187 | 사이트를 닫아도 새 채팅이 오면 알려드려요. | 표시 / 안내 | components/push-settings.tsx:170 | |
| C188 | 설정 중… | 표시 / 안내 | components/push-settings.tsx:180 | |
| C189 | 이 기기 알림 끄기 | 표시 / 안내 | components/push-settings.tsx:182 | |
| C190 | 채팅 알림 받기 | 표시 / 안내 | components/push-settings.tsx:183 | |
| C191 | 다시 확인 | 표시 / 안내 | components/push-settings.tsx:192 | |
| C192 | 테스트 알림 | 표시 / 안내 | components/push-settings.tsx:202 | |

## 내 정보 · 닉네임 (닉네임 설정 제거됨)

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C193 | 닉네임 | 표시 / 안내 | components/profile.tsx:40 | 삭제 완료 · Google 계정 이름 사용 |
| C194 | 학교에서 사용할 닉네임 | 입력 예시 | components/profile.tsx:48 | 삭제 완료 · Google 계정 이름 사용 |
| C195 | 2~16자. 실명이나 학번을 공개할 필요는 없어요. | 표시 / 안내 | components/profile.tsx:51 | 삭제 완료 · Google 계정 이름 사용 |
| C196 | 저장하기 | 표시 / 안내 | components/profile.tsx:56 | 삭제 완료 · Google 계정 이름 사용 |
| C197 | 합스당근 시작하기 | 표시 / 안내 | components/profile.tsx:56 | 삭제 완료 · Google 계정 이름 사용 |
| C198 | 내 정보 | 표시 / 안내 | components/profile.tsx:127 | |
| C199 | Google 계정 인증 | 표시 / 안내 | components/profile.tsx:134 | 삭제 완료 |
| C200 | 닫기 | 표시 / 안내 | components/profile.tsx:138 | 삭제 완료 · Google 계정 이름 사용 |
| C201 | 프로필 수정 | 표시 / 안내 | components/profile.tsx:138 | 삭제 완료 · Google 계정 이름 사용 |
| C202 | 내 게시글 | 표시 / 안내 | components/profile.tsx:151 | |
| C203 | 완료한 글 | 표시 / 안내 | components/profile.tsx:157 | |
| C204 | 아직 게시글이 없어요 | 표시 / 안내 | components/profile.tsx:172 | |
| C205 | 사용하지 않는 물건을 학교 친구와 나눠보세요. | 표시 / 안내 | components/profile.tsx:173 | |
| C206 | 더 보기 | 표시 / 안내 | components/profile.tsx:182 | |
| C207 | 로그아웃 | 표시 / 안내 | components/profile.tsx:188 | |

## 공통 UI

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C208 | 합스당근 | 표시 / 안내 | components/ui.tsx:29 | |
| C209 | HAFS | 표시 / 안내 | components/ui.tsx:29 | |
| C210 | 처리 중 | 접근성 / 대체 텍스트 | components/ui.tsx:47 | |
| C211 | 뒤로 가기 | 접근성 / 대체 텍스트 | components/ui.tsx:79 | |
| C212 | 등록된 사진 없음 | 표시 / 안내 | components/ui.tsx:112 | |
| C213 | 받고 싶은 물건 · | 표시 / 안내 | components/ui.tsx:151 | |
| C214 | 찾는 중 | 표시 / 안내 | components/ui.tsx:157 | |
| C215 | 글쓰기 | 표시 / 안내 | components/ui.tsx:193 | |

## 분류 · 장소 · 상태 · 입력 검증

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C216 | 교재·도서 | 표시 / 안내 | lib/domain.ts:4 | |
| C217 | 문구·학습용품 | 표시 / 안내 | lib/domain.ts:5 | |
| C218 | 전자기기 | 표시 / 안내 | lib/domain.ts:6 | |
| C219 | 의류·잡화 | 표시 / 안내 | lib/domain.ts:7 | |
| C220 | 생활용품 | 표시 / 안내 | lib/domain.ts:8 | |
| C221 | 기타 | 표시 / 안내 | lib/domain.ts:9 | |
| C222 | 직접 정하기 | 표시 / 안내 | lib/domain.ts:12 | |
| C223 | 도서관 앞 | 표시 / 안내 | lib/domain.ts:13 | |
| C224 | 급식실 앞 | 표시 / 안내 | lib/domain.ts:14 | |
| C225 | 교실 | 표시 / 안내 | lib/domain.ts:15 | |
| C226 | 기숙사 앞 | 표시 / 안내 | lib/domain.ts:16 | |
| C227 | 기타·모름 | 표시 / 안내 | lib/domain.ts:17 | |
| C228 | 나눔 | 표시 / 안내 | lib/domain.ts:77 | |
| C229 | 물물교환 | 표시 / 안내 | lib/domain.ts:79 | |
| C230 | ${post.price.toLocaleString("ko-KR")}원 | 표시 / 안내 | lib/domain.ts:81 | |
| C231 | 잃어버렸어요 | 표시 / 안내 | lib/domain.ts:83 | |
| C232 | 주웠어요 | 표시 / 안내 | lib/domain.ts:84 | |
| C233 | 나눔 완료 | 표시 / 안내 | lib/domain.ts:89 | |
| C234 | 교환 완료 | 표시 / 안내 | lib/domain.ts:91 | |
| C235 | 거래 완료 | 표시 / 안내 | lib/domain.ts:92 | |
| C236 | 해결 완료 | 표시 / 안내 | lib/domain.ts:93 | |
| C237 | 예약 중 | 표시 / 안내 | lib/domain.ts:95 | |
| C238 | 나눔 중 | 표시 / 안내 | lib/domain.ts:98 | |
| C239 | 교환 가능 | 표시 / 안내 | lib/domain.ts:100 | |
| C240 | 판매 중 | 표시 / 안내 | lib/domain.ts:101 | |
| C241 | 찾는 중 | 표시 / 안내 | lib/domain.ts:103 | |
| C242 | 주인 찾는 중 | 표시 / 안내 | lib/domain.ts:104 | |
| C243 | 방금 전 | 표시 / 안내 | lib/domain.ts:111 | |
| C244 | ${minutes}분 전 | 표시 / 안내 | lib/domain.ts:113 | |
| C245 | ${Math.floor(minutes / 60)}시간 전 | 표시 / 안내 | lib/domain.ts:115 | |
| C246 | ${Math.floor(minutes / 1440)}일 전 | 표시 / 안내 | lib/domain.ts:116 | |
| C247 | 닉네임은 2자 이상 입력해 주세요. | 표시 / 안내 | lib/domain.ts:124 | 삭제 완료 · Google 계정 이름 사용 |
| C248 | 닉네임은 16자까지 입력할 수 있어요. | 표시 / 안내 | lib/domain.ts:125 | 삭제 완료 · Google 계정 이름 사용 |
| C249 | 제목은 2자 이상 입력해 주세요. | 표시 / 안내 | lib/domain.ts:130 | |
| C250 | 설명을 5자 이상 입력해 주세요. | 표시 / 안내 | lib/domain.ts:131 | |
| C251 | 판매 가격을 입력해 주세요. | 표시 / 안내 | lib/domain.ts:144 | |
| C252 | 판매 이외의 글에는 가격을 입력할 수 없어요. | 표시 / 안내 | lib/domain.ts:150 | |
| C253 | 사진을 한 장 이상 올려 주세요. | 표시 / 안내 | lib/domain.ts:156 | |
| C254 | 분실 또는 발견 날짜를 입력해 주세요. | 표시 / 안내 | lib/domain.ts:162 | |
| C255 | 미래 날짜는 선택할 수 없어요. | 표시 / 안내 | lib/domain.ts:172 | |
| C256 | 받고 싶은 물건을 2자 이상 입력해 주세요. | 표시 / 안내 | lib/domain.ts:178 | |
| C257 | 물물교환 이외의 글에는 받고 싶은 물건을 입력할 수 없어요. | 표시 / 안내 | lib/domain.ts:184 | |
| C258 | 보관 방법을 입력해 주세요. | 표시 / 안내 | lib/domain.ts:190 | |
| C259 | 메시지 또는 사진을 입력해 주세요. | 표시 / 안내 | lib/domain.ts:204 | |

## 페이지 제목 · 설치 정보

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C260 | 합스당근 \| 우리 학교의 작은 장터 | 표시 / 안내 | app/layout.tsx:6 | |
| C261 | HAFS 학교 계정으로 만나는 중고거래, 무료나눔, 분실물 연결. | 표시 / 안내 | app/layout.tsx:7 | |
| C262 | 합스당근 | 표시 / 안내 | app/layout.tsx:9 | |
| C263 | 합스당근 | 표시 / 안내 | app/manifest.ts:6, 7 | |
| C264 | 우리 학교의 작은 장터 | 표시 / 안내 | app/manifest.ts:8 | |

## 오류 · 로딩 화면

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C265 | 화면을 불러오지 못했어요 | 표시 / 안내 | app/error.tsx:5 | |
| C266 | 잠시 후 다시 시도해 주세요. | 표시 / 안내 | app/error.tsx:6 | |
| C267 | 다시 시도 | 표시 / 안내 | app/error.tsx:8 | |
| C268 | 페이지를 찾을 수 없어요 | 표시 / 안내 | app/not-found.tsx:5 | |
| C269 | 처음으로 | 표시 / 안내 | app/not-found.tsx:7 | |
| C270 | 불러오는 중… | 표시 / 안내 | app/app/[[...path]]/page.tsx:5 | |

## 알림 메시지

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C271 | 사진을 보냈어요. | 표시 / 안내 | lib/push-content.ts:17 | |
| C272 | 새 메시지를 보냈어요. | 표시 / 안내 | lib/push-content.ts:17 | |
| C273 | ${preview(nickname \|\| "학교 친구", 32)} · ${product} | 표시 / 안내 | lib/push-content.ts:20 | |
| C274 | 합스당근 | 표시 / 안내 | public/sw.js:17 | |
| C275 | 새 채팅 메시지가 도착했어요. | 표시 / 안내 | public/sw.js:18 | |

## 데이터 · 업로드 · 서버 오류

| 번호 | 현재 문구 | 종류 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- | --- |
| C276 | 앱을 불러오지 못했어요. | 오류 | components/provider.tsx:33 | |
| C277 | 요청을 처리하지 못했어요. | 표시 / 안내 | components/provider.tsx:39 | |
| C278 | 데이터 요청이 오래 걸리고 있어요. 연결을 확인한 뒤 다시 불러와 주세요. | 표시 / 안내 | components/provider.tsx:72 | |
| C279 | 데이터를 불러오지 못했어요. | 표시 / 안내 | components/provider.tsx:75 | |
| C280 | 잠시 기다려 주세요. | 오류 | components/provider.tsx:130 | |
| C281 | 사진은 10MB 이하로 올려 주세요. | 오류 | components/provider.tsx:184 | |
| C282 | 이 사진을 읽을 수 없어요. JPG 또는 PNG를 선택해 주세요. | 오류 | components/provider.tsx:187 | |
| C283 | 사진 용량을 줄여 다시 올려 주세요. | 오류 | components/provider.tsx:202 | |
| C284 | 허용된 Google 계정으로 로그인해 주세요. | 오류 | lib/auth.ts:19 | |
| C285 | 학교 계정으로 다시 로그인해 주세요. | 오류 | lib/auth.ts:22 | |
| C286 | Supabase SQL Editor에서 20260925132923_app_environment.sql을 적용한 뒤 다시 로그인해 주세요. | 오류 | lib/auth-policy.ts:13 | |
| C287 | 로그인 정책 동기화 실패 (${error.code \|\| "연결 오류"}). DB 마이그레이션과 서버 키를 확인해 주세요. | 오류 | lib/auth-policy.ts:17 | |
| C288 | 허용되지 않은 요청입니다. | 오류 | lib/http.ts:6 | |
| C289 | 요청을 처리하지 못했어요. 다시 시도해 주세요. | 표시 / 안내 | lib/http.ts:12 | |
| C290 | 지원하지 않는 알림 주소입니다. | 표시 / 안내 | lib/push-schema.ts:29 | |
| C291 | 알림 연결을 해제하지 못했어요. 다시 시도해 주세요. | 오류 | lib/push.ts:30 | |
| C292 | 학교 로그인 연결을 준비하고 있어요. | 오류 | lib/supabase/server.ts:12 | |
| C293 | 서버 연결 키를 설정해 주세요. | 오류 | lib/supabase/server.ts:35 | |
| C294 | 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요. | 오류 | app/api/data/route.ts:28 | |
| C295 | 사진을 찾을 수 없어요. | 오류 | app/api/media/[id]/route.ts:17 | |
| C296 | 사진을 불러오지 못했어요. | 오류 | app/api/media/[id]/route.ts:21 | |
| C297 | 대화를 불러오지 못했어요. | 오류 | app/api/messages/route.ts:18 | |
| C298 | 허용되지 않은 작업입니다. | 오류 | app/api/mutate/route.ts:30 | |
| C299 | 요청한 내용을 저장하지 못했어요. 입력을 확인하고 다시 시도해 주세요. | 표시 / 안내 | app/api/mutate/route.ts:41 | |
| C300 | 게시글을 불러오지 못했어요. | 오류 | app/api/posts/route.ts:51 | |
| C301 | 알림 상태를 확인하지 못했어요. | 오류 | app/api/push/route.ts:21 | |
| C302 | 채팅 알림을 준비하고 있어요. | 오류 | app/api/push/route.ts:40 | |
| C303 | 알림 연결을 갱신하지 못했어요. | 오류 | app/api/push/route.ts:51 | |
| C304 | 알림을 설정하지 못했어요. 잠시 후 다시 시도해 주세요. | 오류 | app/api/push/route.ts:64 | |
| C305 | 잘못된 요청입니다. | 오류 | app/api/session/route.ts:8 | |
| C306 | 사진은 10MB 이하로 올려 주세요. | 오류 | app/api/upload/route.ts:14 | |
| C307 | 10MB 이하의 사진을 선택해 주세요. | 오류 | app/api/upload/route.ts:19 | |
| C308 | 이 사진을 읽을 수 없어요. JPG, PNG 또는 WebP로 다시 올려 주세요. | 오류 | app/api/upload/route.ts:37 | |
| C309 | 사진을 저장하지 못했어요. | 오류 | app/api/upload/route.ts:46 | |
| C310 | 사진 정보를 저장하지 못했어요. | 오류 | app/api/upload/route.ts:52 | |

## DB에서 반환할 수 있는 문구

아래는 저장소의 SQL 마이그레이션에 들어 있는 문자열입니다. 배포된 DB에 적용된 마이그레이션에 따라 실제 노출 여부는 달라집니다. 과거 탈퇴 계정 표시와 DB 내부 탈퇴 처리는 기존 마이그레이션에 남아 있습니다. 이번 변경은 웹 화면과 웹 API의 탈퇴 진입 경로를 제거하며, 배포 DB의 함수를 변경하지 않습니다.

| 번호 | 현재 문구 | 소스 위치 | 판정 / 변경할 문구 |
| --- | --- | --- | --- |
| C311 | 교재·도서 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C312 | 문구·학습용품 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C313 | 전자기기 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C314 | 의류·잡화 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C315 | 생활용품 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C316 | 기타 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C317 | 직접 정하기 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C318 | 도서관 앞 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C319 | 급식실 앞 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C320 | 교실 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C321 | 기숙사 앞 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C322 | 기타·모름 | supabase/migrations/20260923153041_initial_mvp.sql | |
| C323 | 학교 Google 계정만 가입할 수 있어요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260925132923_app_environment.sql | |
| C324 | 잠시 후 다시 시도해 주세요. | supabase/migrations/20260923153041_initial_mvp.sql | |
| C325 | 학교 계정으로 로그인해 주세요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C326 | 닉네임은 2~16자로 입력해 주세요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | 새 마이그레이션에서 제거 · DB 적용 필요 |
| C327 | 탈퇴한 사용자 | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C328 | 먼저 닉네임을 설정해 주세요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | 새 마이그레이션에서 제거 · DB 적용 필요 |
| C329 | 글을 수정할 수 없어요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C330 | 글 유형은 변경할 수 없어요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C331 | 중복 사진입니다. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C332 | 사용할 수 없는 사진입니다. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C333 | 미래 날짜는 선택할 수 없어요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C334 | 글을 찾을 수 없어요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C335 | 글 상태가 변경됐어요. 새로고침 후 다시 시도해 주세요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C336 | 게시글을 찾을 수 없어요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C337 | 이 글에는 새 문의를 보낼 수 없어요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C338 | 대화에 접근할 수 없어요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C339 | 중복 요청 ID입니다. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C340 | 탈퇴한 사용자에게 메시지를 보낼 수 없어요. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C341 | 알 수 없는 요청입니다. | supabase/migrations/20260923153041_initial_mvp.sql<br>supabase/migrations/20260927000000_barter_posts.sql | |
| C342 | 사진을 보냈어요 | supabase/migrations/20260923153041_initial_mvp.sql | |

## 검토 시 확인할 일관성

- 나눔 / 무료나눔: 목록 필터와 작성 화면의 표기가 다릅니다.
- 게시글 / 글 / 상품: 같은 대상을 화면별로 다르게 부릅니다.
- 거래 가능 / 판매 중 / 교환 가능 / 나눔 중: 상태 선택과 배지의 표현이 다릅니다.
- 학교 Google 계정 / Google 계정 인증: 학교 계정 제한 안내와 인증 표시가 함께 존재합니다.
- 연결 / 이야기 / 친구 / 마음: 기능 안내와 홍보 표현 중 남길 범위를 정할 수 있습니다.
- 켜주세요 / 켜 주세요, 열어주세요 / 열어 주세요: 띄어쓰기를 맞출 수 있습니다.
- DB 분류·장소 문자열은 데이터 값으로도 쓰이므로 변경 시 기존 데이터와 제약 조건을 함께 확인해야 합니다.
- 길이·형식 제한에서 라이브러리나 브라우저가 생성하는 기본 오류는 별도로 한국어 문구를 지정할지 검토할 수 있습니다.

Google 계정 이름 전환: 닉네임 입력·수정 화면과 안내는 삭제했으며, 상세 적용 내용은 [Google 계정 이름 사용](google-account-names.md)을 참고하세요.
