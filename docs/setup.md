# 합스당근 외부 서비스 연결 가이드

현재 저장소는 외부 프로젝트에 연결하지 않았다. `/app`은 실제 Google 로그인이 필요한 경로다. 아래 작업은 개발·배포 연결에 필요한 설정이며, 설정만으로 출시 검증이 끝나는 것은 아니다.

## 1. Supabase 전용 프로젝트

Supabase Dashboard에서 합스당근 전용 프로젝트를 만든다. 현재 다른 앱이 사용하는 프로젝트를 공유하지 않는다. 학교 계정 가입 제한 트리거가 프로젝트의 Auth 전체에 적용되기 때문이다.

- 이름 예시: `hafsdaangn`.
- 사용자와 가까운 지역을 선택한다. 서울 리전이 제공되면 사용한다.
- DB 비밀번호는 비밀번호 관리자에 보관한다. 웹 앱 환경변수에는 DB 비밀번호가 필요하지 않다.
- 프로젝트 요금제·사용량·스토리지 한도는 생성 화면에서 확인한다.
- Connect/Settings에서 Project URL, Publishable key, Secret key를 확인한다.

## 2. DB 초기화

빈 전용 프로젝트에 `supabase/migrations/`의 모든 SQL을 파일명 순서대로 적용한다. 초기 마이그레이션을 적용했다면 `20260925132923_app_environment.sql`만 추가 적용한다. CLI를 사용한다면 먼저 설치된 버전의 `supabase link --help`, `supabase db push --help`로 사용법을 확인하고 프로젝트를 연결해 마이그레이션을 적용한다. SQL Editor에서 동일 SQL을 실행할 수도 있으나 두 방식을 중복 실행하지 않는다.

이 SQL은 다음을 만든다.

- 프로필, 게시글, 채팅방, 메시지, 이미지 메타데이터 테이블.
- 학교 도메인·Google 제공자 검증 및 신규 프로필 생성 트리거.
- DB 접근 권한, RLS, 변경 함수, 메시지 중복 방지·속도 제한.
- 비공개 `images` Storage 버킷과 열람 정책.
- 메시지·채팅방의 Realtime publication 등록.

Data API에서 `public` 스키마를 노출한다. `private` 스키마는 노출하지 않는다. private 함수는 필요한 authenticated 역할에만 최소 권한을 부여한 내부 구현이다. 공개 함수는 명시적으로 허용한 것만 호출 가능하다.

Auth 신규 사용자 생성이 가능해야 한다. Google만 활성화하고 이메일/비밀번호, 전화번호, 익명 로그인 등 다른 제공자는 비활성화한다. 전체 신규 가입을 끄면 학교 계정의 첫 로그인도 막힌다.

초기 설계의 별도 Before User Created Hook 대신, 현재 구현은 `auth.users` INSERT 트리거에서 가입을 거절한다. Dashboard에 추가 훅을 설정할 필요는 없다. 마이그레이션을 반드시 첫 가입 전에 적용한다.

## 3. Google Cloud / Google Auth Platform

1. Google Cloud 프로젝트를 만든다.
2. Google Auth Platform의 Branding에 앱 이름 `합스당근`, 지원 이메일, 개발자 연락처를 등록한다.
3. Audience를 결정한다.
   - 학교 Google Cloud 조직 소속 프로젝트라면 Internal을 사용할 수 있다.
   - 개인 Google 계정/개인 프로젝트라면 External을 사용하고 앱·DB에서 학교 계정을 제한한다. 운영 환경에서는 일반 Gmail 계정을 차단한다. 외부 계정으로 개발하려면 External이 필요하다.
4. Data Access는 `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile`만 사용한다.
5. Clients에서 Web application OAuth 클라이언트를 만든다.

로컬 Next.js + 호스팅 Supabase를 사용하는 기준:

| Google OAuth 입력란 | 값 |
| --- | --- |
| Authorized JavaScript origins | `http://localhost:3000` |
| Authorized redirect URIs | `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback` |

콜백 주소는 Supabase의 Google 제공자 화면에서 복사한다. Next.js를 로컬에서 실행해도 Supabase를 클라우드로 쓰면 콜백은 위 클라우드 주소다. `http://127.0.0.1:54321/auth/v1/callback`은 로컬 Supabase 스택을 직접 실행할 때만 해당한다.

배포 후 Authorized JavaScript origins에 실제 `https://<배포 도메인>`을 추가한다. 해당 칸에는 경로를 붙이지 않는다. Client ID와 Client Secret을 저장해 Supabase의 Google 제공자 설정에 입력한다. Next.js 환경변수에 Google Client Secret을 넣을 필요는 없다.

Testing 단계에서는 사용할 학교 테스트 계정을 등록해 테스트 구성을 명확히 관리한다. 다만 Google 공식 문서상 기본 이름·이메일·프로필/OIDC 범위만 사용하는 로그인은 일반적인 테스트 사용자 명단 및 7일 만료 제한의 예외다. 다른 권한을 추가하면 예외가 적용되지 않을 수 있다. 정식 공개 시 Audience의 게시 상태와 Branding 검증 요구사항을 확인한다.

학교 계정에서 앱 차단 메시지가 나오면 학교 Workspace 관리자가 OAuth Client ID로 접근을 허용해야 할 수 있다. 앱 쪽 설정만으로 학교 관리 정책을 우회할 수는 없다.

## 4. Supabase Authentication URL 설정

로컬 테스트:

- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

배포:

- Site URL: `https://<실제 배포 도메인>`
- Redirect URLs: `https://<실제 배포 도메인>/auth/callback`
- 개발도 계속한다면 로컬 콜백도 유지한다.

`localhost`와 `127.0.0.1`은 서로 다른 origin이다. 브라우저 접속 주소·APP_URL·Redirect URLs를 일치시킨다. Google Cloud 콜백은 `/auth/v1/callback`, Supabase Redirect URL은 `/auth/callback`임을 구분한다.

## 5. 환경변수

`.env.example`을 `.env.local`로 복사하고 다음 값을 넣는다.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
APP_URL=http://localhost:3000
APP_ENV=development
```

- Publishable key는 브라우저에서 쓰는 키다.
- Secret key는 서버의 이미지 업로드 및 DB 환경 정책 동기화에 쓰며 브라우저에 포함하지 않는다.
- `SUPABASE_SECRET_KEY`에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다.
- 실제 비밀 값은 Git이나 채팅에 붙이지 않는다. `.env.local`은 Git에서 제외된다.
- 환경변수를 바꾼 후 개발 서버를 재시작한다. NEXT_PUBLIC 값 변경 후 배포도 새로 빌드한다.

## 6. Vercel 배포

Next.js 프로젝트를 연결하고 위 환경변수를 입력한다. APP_URL을 실제 배포 origin으로 바꾸고 정식 운영에서는 APP_ENV=production으로 설정한다. 개발 Preview와 Production의 설정을 구분한다. OAuth는 우선 고정된 배포 주소로 테스트한다.

이미지는 브라우저에서 WebP로 축소해 3MB 이하로 전송하고 서버에서 다시 검증·재인코딩한다. 실제 휴대전화의 JPG/PNG/WebP 사진으로 업로드를 확인한다. HEIC는 브라우저 및 이미지 런타임 지원에 따라 실패할 수 있어 자동 변환 지원으로 안내하지 않는다.

이번 MVP에 Firebase, 별도 채팅 서버, 결제 서비스, 지도 API, Gmail/Drive API, 이메일 발송용 SMTP는 필요하지 않다. 앱 내 알림은 Realtime으로 동작하고 웹 푸시는 범위 밖이다.

## 7. 연결 후 반드시 수행할 실서비스 확인

- 학교 계정 2개로 Google 로그인 및 Google 계정 이름 자동 표시 확인.
- production에서 개인 Gmail 계정 거절, development에서 개인 Google 계정 허용. 두 환경 모두 비로그인 데이터·이미지 접근 거절.
- 판매·나눔·분실·습득 글의 생성·수정·삭제·상태 변경.
- 양쪽 기기에서 텍스트·이미지 채팅, 읽음, 재접속, 중복 전송 확인.
- Storage 비공개 유지, secret key가 클라이언트 코드에 없는지 확인.
- 탈퇴 후 기존 세션도 DB 접근이 차단되는지 확인.
- Supabase Security Advisor와 실제 Storage/Realtime 정책 확인.

## 공개 전 남은 운영 작업

서비스 운영 연락처, 개인정보 처리 안내·보관 기간, 탈퇴 후 기록 정리 정책을 확정한다. 현재 탈퇴는 회원 비활성화·프로필 익명화·게시글 숨김·세션 로그아웃이며 Auth 이메일과 기존 대화의 물리 삭제는 수행하지 않는다. 임시 업로드 및 보관 기간이 지난 데이터 정리 작업, 백업·복원 절차도 공개 전에 연결해야 한다. 이 항목은 대시보드 설정만으로 자동 완료되는 기능이 아니다.

## 공식 문서

- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/getting-started/api-keys
- https://developers.google.com/workspace/guides/configure-oauth-consent
- https://support.google.com/cloud/answer/15549945

## 실행 환경

`APP_ENV=production`은 @hafs.hs.kr Google 계정만 허용하고, `APP_ENV=development`는 다른 도메인의 Google 계정도 허용합니다. 학교 도메인은 대소문자를 구분하지 않습니다. 생략하면 production이며 다른 값은 오류로 처리합니다. Next.js의 NODE_ENV와 별개이므로 빌드 후 실행에서도 development를 선택할 수 있습니다. 로그인과 이메일 인증, 게시글 소유권, 채팅 참여자 검사는 두 환경 모두 유지합니다.

서버 시작 시 Secret key로 DB 정책을 동기화합니다. 새 마이그레이션이 없으면 서버 화면은 열리지만 로그인과 회원 API는 차단됩니다. 마이그레이션 적용 후 로그인하면 동기화를 다시 시도합니다. 설정을 바꾸면 서버를 재시작하세요. **개발과 운영은 같은 Supabase 프로젝트를 사용합니다.** URL과 키를 바꿀 필요 없이 APP_ENV만 변경합니다. 데이터도 그대로 공유됩니다. 계정 허용 정책은 프로젝트 전체에 적용되므로 연결된 모든 서버의 APP_ENV를 동일하게 맞추세요. 서로 다른 모드를 동시에 실행하면 마지막으로 동기화한 정책이 적용됩니다. production 전환 시 기존 외부 계정도 DB 접근이 차단되며 계정 자체는 삭제하지 않습니다. 외부 연결 전에는 로그인 화면만 표시되며 예시 데이터는 제공하지 않습니다.
