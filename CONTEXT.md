# 금정코인(GC) 앱 — 현재 상태 & 다음 작업 요청

이 문서는 Claude(claude.ai)와 함께 처음 버전을 만든 뒤, VS Code의 Claude Code에게 이어서
작업을 맡기기 위해 정리한 컨텍스트예요. 프로젝트 루트에 이 파일을 두고 "이 문서 참고해서
아래 요청사항 작업해줘"라고 하면 됩니다.

## 프로젝트 개요

- 금정청소년수련관 주말 방과후 아카데미에서 쓰는 코인(GC) 관리 앱
- 청소년 약 30명이 토요일마다 출석 코인을 받고, 그 코인으로 오늘의 메뉴(간식)를 주문
- 관리자는 출석/보너스 코인 지급, 메뉴 등록, 청소년 관리, 전체 현황 확인
- 배포 주소: `gc-coin-app.vercel.app`

## 기술 스택

- Next.js 14 (App Router), JavaScript (TypeScript 아님)
- Supabase (Postgres DB) — 서버(API 라우트)에서 service_role(=새 이름 secret) 키로만 접근, 클라이언트는 직접 DB 접근 안 함
- Tailwind CSS
- Vercel 배포, GitHub(`hanstarkoh/gc-coin-app`) 연동
- 인증: 자체 4자리 PIN + HMAC 서명된 httpOnly 쿠키 세션 (Supabase Auth는 안 씀)

## 폴더 구조

```
app/
  page.js                    # 홈 - 청소년/관리자 선택 화면
  kid/page.js                 # 청소년 이름 선택 → PIN 설정/로그인
  kid/dashboard/page.js       # 청소년 대시보드 (잔액, 레벨바, 뱃지, 오늘의 메뉴, 주문, 내역)
  admin/page.js                # 관리자 PIN 로그인
  admin/dashboard/page.js      # 관리자 대시보드 (탭 5개)
  api/kids/route.js                        # GET 청소년 이름 목록(공개용, 이름만)
  api/kid/login/route.js                   # POST PIN 설정/검증 + 세션 쿠키 발급
  api/kid/me/route.js                      # GET 내 정보(잔액/레벨/뱃지)
  api/kid/menu/route.js                    # GET 오늘 메뉴
  api/kid/order/route.js                   # POST 메뉴 주문(코인 차감)
  api/kid/history/route.js                 # GET 내 거래내역
  api/kid/logout/route.js
  api/admin/login/route.js                 # POST 관리자 PIN 검증
  api/admin/logout/route.js
  api/admin/me/route.js                    # GET 관리자 세션 확인
  api/admin/kids/route.js                  # GET 전체 청소년 / POST 청소년 추가
  api/admin/kids/[id]/route.js             # DELETE 청소년 삭제
  api/admin/kids/[id]/reset-pin/route.js   # POST PIN 초기화
  api/admin/attendance/route.js            # POST 출석 코인 일괄 지급(+5GC, 중복지급 방지)
  api/admin/bonus/route.js                 # POST 개별 보너스 코인 지급
  api/admin/menu/route.js                  # GET/POST 오늘 메뉴 관리
  api/admin/menu/[id]/route.js             # DELETE 메뉴 삭제
  api/admin/transactions/route.js          # GET 전체 거래내역 (kidId, date 쿼리 필터 지원)
  api/admin/settings/pin/route.js          # POST 관리자 PIN 변경
lib/
  supabaseAdmin.js   # 서버 전용 Supabase 클라이언트 (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 사용)
  session.js         # 쿠키 서명/검증, 청소년·관리자 세션 관리
  level.js           # 레벨 계산 (누적 코인 15GC당 1레벨업, XP_PER_LEVEL 상수로 조정 가능)
  badges.js          # 뱃지 8종 정의 (배열에 항목만 추가하면 뱃지 늘어남)
components/
  TopBar.jsx, PinPad.jsx, Toast.jsx, LevelBar.jsx, BadgeGrid.jsx, Celebration.jsx(컨페티)
schema.sql            # Supabase 테이블 정의 (settings, kids, transactions, menu_items)
```

## DB 테이블 요약

- `settings` — admin_pin (관리자 비밀번호, 기본 1234)
- `kids` — id, name, pin(null=미설정), balance, total_earned, total_spent, attendance_count, purchase_count
- `transactions` — kid_id, type(earn/bonus/spend), amount, reason, tx_date, created_at
- `menu_items` — item_date, name, price (날짜별로 저장돼서 이력이 남음)

## 현재 동작 방식 (중요한 설계 원칙)

- 모든 코인 지급/차감 로직은 **서버(API 라우트)에서만** 처리. 클라이언트가 직접 DB를 건드릴 수 없음 → 계속 유지해야 함
- 청소년 세션: httpOnly 쿠키 60일 유지. 관리자 세션: httpOnly 쿠키 8시간 유지
- 출석 지급은 "오늘 이미 받은 사람 자동 제외" 로직 있음 (reason === '출석' 기준)
- 레벨/뱃지는 별도 테이블 없이 kids 테이블의 누적 값(total_earned, attendance_count, purchase_count)으로 매번 계산

---

## 지금 요청하는 작업: 인터페이스 개편

전체적으로 화면 구조를 다시 짜고 싶어요. 요청사항:

1. **관리자 로그인을 눈에 안 띄게 축소** — 지금처럼 홈 화면에 "청소년/관리자" 큰 버튼 두 개를 나란히 두는 구조 대신, **관리자 로그인은 우측 상단에 작은 탭/아이콘 버튼**으로만 존재하게 바꾸기. 메인 화면은 기본적으로 청소년 중심으로 구성.

2. **오늘의 메뉴를 메인 페이지에 바로 노출** — 지금은 청소년이 이름+PIN으로 로그인해야 대시보드에서 메뉴를 볼 수 있는데, 오늘의 메뉴 자체는 메인 페이지에서 로그인 없이도 바로 보이게 하고 싶음 (구경은 누구나, 주문/코인 사용은 로그인 후).

3. **"이벤트" 기능 신설** — 관리자가 이벤트(미션/과제)를 등록하면, 청소년이 그걸 보고 수행한 뒤 코인을 받을 수 있는 구조.
   - 예: 관리자가 "방 정리 도와주기 - 5GC" 같은 이벤트를 올림
   - 청소년 대시보드(또는 메인 페이지)에 오늘의 메뉴처럼 "진행 중인 이벤트" 목록이 보임
   - 청소년이 완료 표시를 하면 → (남용 방지를 위해) 관리자가 승인해야 코인 지급되는 방식 추천 — 자기가 자기한테 코인 주는 걸 막아야 함
   - 기존 "보너스 지급"과 통합할지, 별도 기능으로 둘지는 논의 필요

4. 전체적으로 지금보다 더 "보강"된 느낌으로 — 구체적으로 어떤 부분을 더 보강하고 싶은지는 진행하면서 논의

### 참고: 지금 화면 흐름 (개편 전)

```
/ (홈: 청소년/관리자 선택)
  → /kid (이름 선택 → PIN)
    → /kid/dashboard (잔액, 레벨, 뱃지, 오늘의 메뉴, 주문, 내역)
  → /admin (PIN 로그인)
    → /admin/dashboard (탭: 출석·코인지급 / 메뉴관리 / 청소년관리 / 전체현황 / 설정)
```

이 흐름을 어떻게 재구성할지는 Claude Code와 논의하면서 진행하면 될 것 같아요.
