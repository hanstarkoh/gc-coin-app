# 금정코인(GC) 앱

금정청소년수련관 주말 방과후 아카데미용 코인 관리 앱이에요.
청소년은 출석/보너스로 코인을 받아 오늘의 메뉴(간식)를 주문하고, 레벨업과 뱃지로 재미를 느낄 수 있어요.
관리자는 출석 코인 지급, 보너스 지급, 메뉴 등록, 청소년 관리, 전체 현황을 볼 수 있어요.

기술 스택은 **Next.js + Supabase + Vercel**.
데이터는 전부 여러분의 Supabase 프로젝트(=여러분 소유)에 저장되고, 클로드 구독 여부와 전혀 무관하게 계속 작동해요.

---

## 1. Supabase 프로젝트 만들기

1. https://supabase.com 에서 새 프로젝트를 만드세요. (완전히 새 계정이어도 됩니다 — 이번엔 별도 프로젝트로 만드는 걸 추천해요.)
2. 프로젝트가 만들어지면 왼쪽 메뉴 **SQL Editor**로 들어가서, 이 프로젝트에 들어있는 `schema.sql` 파일 내용을 그대로 붙여넣고 실행(Run)하세요. 테이블 4개(`settings`, `kids`, `transactions`, `menu_items`)가 만들어집니다.
3. 왼쪽 메뉴 **Project Settings → API**로 들어가서 아래 두 값을 복사해두세요.
   - `Project URL` → `.env.local`의 `SUPABASE_URL`
   - `service_role` 키 (secret, "anon" 키 아님!) → `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`
   - ⚠️ `service_role` 키는 절대 외부에 노출되면 안 돼요. GitHub에 올리지 말고, Vercel 환경변수에만 넣어주세요 (이 프로젝트는 이미 `.gitignore`로 `.env.local`을 제외해뒀어요).

## 2. 로컬에서 먼저 실행해보기 (선택)

```bash
npm install
cp .env.local.example .env.local
# .env.local 파일을 열어서 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET 값을 채워주세요.
npm run dev
```

브라우저에서 http://localhost:3000 접속해서 잘 뜨는지 확인해보세요.
관리자 기본 비밀번호는 `1234`이고, 로그인 후 설정 탭에서 바로 바꿀 수 있어요.

## 3. GitHub에 올리기

BY NEWS 만들 때와 같은 방식이에요.

```bash
git init
git add .
git commit -m "금정코인 앱 초기 버전"
```

GitHub에서 새 저장소(예: `gc-coin-app`)를 만든 뒤:

```bash
git remote add origin <여러분의 저장소 주소>
git branch -M main
git push -u origin main
```

## 4. Vercel에 배포하기

1. https://vercel.com 에서 "Add New Project" → 방금 만든 GitHub 저장소 선택
2. **Environment Variables**에 아래 3개를 추가하세요 (Production, Preview, Development 모두 체크):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SESSION_SECRET` (임의의 긴 문자열. 터미널에서 `openssl rand -hex 32` 실행하면 바로 만들 수 있어요)
3. Deploy 버튼 클릭 → 몇 분 뒤 `xxx.vercel.app` 주소가 생겨요.
4. (선택) 가비아 등에서 산 도메인이 있다면 Vercel의 Domains 설정에서 연결할 수 있어요.

배포가 끝나면 그 주소를 청소년들 폰 브라우저에 "홈 화면에 추가" 하도록 안내해주시면 앱처럼 쓸 수 있어요.

## 5. 처음 사용 시작하기

1. 배포된 사이트 → 관리자 → PIN `1234` 입력
2. 설정 탭에서 관리자 비밀번호 변경
3. 청소년 관리 탭에서 청소년 30명 이름 등록
4. 메뉴 관리 탭에서 오늘 판매할 간식/가격 등록
5. 토요일마다 출석·코인 지급 탭에서 출석 체크 → 지급

---

## 앱 구조 살짝 설명

- `app/` — 화면(페이지)과 API 라우트
  - `app/kid/` — 청소년 이름선택 → PIN 로그인/설정 → 대시보드
  - `app/admin/` — 관리자 PIN 로그인 → 대시보드(5개 탭)
  - `app/api/` — 실제 데이터 처리(코인 지급/차감, 메뉴, 로그인 등)는 전부 서버에서만 처리돼요. 브라우저에서 Supabase에 직접 접근하지 않아서, 청소년이 개발자도구를 열어봐도 다른 사람 코인을 건드릴 수 없어요.
- `lib/level.js` — 레벨 계산 (15 GC 모을 때마다 1레벨업). 숫자만 바꾸면 밸런스 조정 가능해요.
- `lib/badges.js` — 뱃지 8종 정의. 배열에 항목만 추가하면 새 뱃지를 쉽게 늘릴 수 있어요.
- `schema.sql` — Supabase 테이블 정의

## 나중에 기능을 더 넣고 싶다면

VS Code에서 이 프로젝트를 열고,  AI(Claude Code, Gemini 등)에게 "이 파일들을 참고해서 ○○ 기능 추가해줘"라고 요청하시면 됩니다. 예를 들면:
- 출석 코인 5GC를 요일별로 다르게 주기
- 청소년별 순위(리더보드) 화면 추가
- 관리자에게 카카오톡 알림 보내기
