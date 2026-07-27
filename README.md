# 2026 서울사회복지사 등반대회 신청

Next.js(App Router) + Google Sheets(API) + Solapi 카카오 알림톡. GitHub → Vercel 배포용.

- 한 페이지(`/`)에서 **행사 안내**(개요·일정·코스·오시는 길)와 **신청 폼**을 함께 제공합니다.
- 신청 시 **개인 / 단체**를 선택합니다.
  - **개인**: 기관명 없이 성함·직급·연락처·비고 입력 → 신청자 **성함으로 시트 탭** 생성
  - **단체**: 기관 또는 단체명 입력 → 그 **단체명으로 시트 탭** 생성
- 제출하면 각 참가자에게 **카카오 알림톡**이 발송됩니다.
- 데이터는 **구글 시트에 누적**되고, 재제출해도 기존 명단은 유지되며 **연락처 기준 중복은 자동 제외**됩니다.
- 연락처는 하이픈 없이 입력해도 `010-1234-5678` 형식으로 자동 변환됩니다.

---

## 1. 구글 시트 준비 (서비스 계정)

1. 스프레드시트를 만들고, 하단 탭 하나의 이름을 **`명단`** 으로 변경 (총괄 시트 역할, 헤더는 자동 생성)
2. [Google Cloud Console](https://console.cloud.google.com) → 프로젝트 생성
3. **API 및 서비스 → 라이브러리**에서 `Google Sheets API` **사용 설정**
4. **사용자 인증 정보 → 서비스 계정** 생성 → **키 → 키 추가 → JSON** 다운로드
5. JSON의 `client_email` 값을 복사해, 스프레드시트 **[공유]** 에서 **편집자**로 추가

## 2. Solapi 준비

- API Key / API Secret 발급, 카카오 채널 연동(pfId), 알림톡 templateId, 발신번호 확인
- 템플릿 변수는 `#{성함}` 사용

## 3. 환경변수 (.env.local)

`.env.local.example`을 복사해 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

| 변수 | 설명 |
| --- | --- |
| `GOOGLE_CREDENTIALS_BASE64` | 서비스 계정 JSON 전체를 Base64로 인코딩한 값 (아래 명령 참고) |
| `GOOGLE_SHEET_ID` | 시트 URL의 `/d/` 와 `/edit` 사이 값 |
| `SHEET_NAME` | 총괄 시트 탭 이름 (기본 `명단`) |
| `SOLAPI_API_KEY` / `SOLAPI_API_SECRET` | Solapi 인증 |
| `SOLAPI_PF_ID` | 카카오 채널 연동 ID |
| `SOLAPI_TEMPLATE_ID` | 알림톡 템플릿 ID |
| `SOLAPI_SENDER` | 등록된 발신번호 (숫자만) |

Base64 값 생성 (JSON 키 파일 경로로 바꿔 실행, 클립보드로 복사됨):

```bash
base64 -i /경로/서비스계정키.json | tr -d '\n' | pbcopy
```

`.env.local`에는 `GOOGLE_CREDENTIALS_BASE64=<붙여넣기>` 형태로 한 줄 추가합니다.
(Base64 방식은 줄바꿈/대시 문제가 없어 로컬·Vercel 모두 안전합니다.)

## 4. 로컬 실행

```bash
npm install
npm run dev
# http://localhost:3000
```

## 5. GitHub 업로드

```bash
git init
git add .
git commit -m "등반대회 신청"
git branch -M main
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

> `.env.local`은 `.gitignore`에 포함되어 업로드되지 않습니다.

## 6. Vercel 배포

1. [vercel.com](https://vercel.com) → Add New → Project → 저장소 Import (Next.js 자동 인식)
2. **Settings → Environment Variables** 에 위 표의 변수를 모두 등록
3. Deploy → 발급된 주소 안내
4. 환경변수를 바꾸면 **Redeploy** 해야 반영됩니다.

---

## 구조

```
app/
  layout.jsx          앱 라우트 레이아웃(루트)
  globals.css         (앱 라우트용 스타일)
  api/submit/route.js 신청 처리 — 개인=성함 탭 / 단체=단체명 탭 + 총괄 누적, 알림톡 발송
lib/
  sheets.js           Google Sheets 읽기/탭 생성/추가 (Base64 인증)
  solapi.js           알림톡 발송
public/
  event.html          메인 페이지(행사 안내 + 신청 폼 통합)
next.config.mjs       "/" → public/event.html 연결(rewrite)
```

## 시트 저장 규칙

- **총괄 탭(`명단`)**: 전체 신청자 누적 — `연번·기관명·성함·직급·연락처·비고·신청일시` (개인은 기관명 칸에 "개인")
- **단체 탭**: 단체명으로 생성 — `연번·성함·직급·연락처·비고·신청일시`
- **개인 탭**: 신청자 성함으로 생성 — 동일 컬럼
- 재제출 시 기존 유지 + 연락처 기준 중복 제외
