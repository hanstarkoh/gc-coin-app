-- 금청코인(GC) 앱 데이터베이스 스키마
-- Supabase 프로젝트의 SQL Editor 에서 이 파일 내용을 그대로 실행하세요.

create table if not exists settings (
  id int primary key default 1,
  admin_pin text not null default '1234',
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into settings (id, admin_pin) values (1, '1234')
  on conflict (id) do nothing;

create table if not exists kids (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin text,                         -- 4자리 PIN, 처음엔 비어있음(NULL)
  balance int not null default 0,
  total_earned int not null default 0,   -- 지금까지 받은 코인 총합 (레벨 계산용)
  total_spent int not null default 0,
  attendance_count int not null default 0,
  purchase_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids(id) on delete cascade,
  kid_name text not null,
  type text not null check (type in ('earn','bonus','spend')),
  amount int not null,
  reason text,
  tx_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists idx_transactions_kid on transactions(kid_id);
create index if not exists idx_transactions_date on transactions(tx_date);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  item_date date not null default current_date,
  name text not null,
  price int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_menu_date on menu_items(item_date);

-- 금청수 상점 메뉴 소분류(간식/음료/완구/기타). 이름은 lib/menuCategories.js에서 관리합니다.
alter table menu_items add column if not exists category text not null default 'snack';
alter table menu_items drop constraint if exists menu_items_category_check;
alter table menu_items add constraint menu_items_category_check check (category in ('snack', 'drink', 'toy', 'etc'));

-- 상품 사진 대신 짧은 한 줄 설명(용량 부담 없이 상품을 소개하는 용도)
alter table menu_items add column if not exists description text;

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  reward int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists event_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  kid_name text not null,
  event_title text not null,   -- 승인 시점 스냅샷 (transactions.kid_name 패턴과 동일)
  reward int not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists idx_event_submissions_event on event_submissions(event_id);
create index if not exists idx_event_submissions_kid on event_submissions(kid_id);

-- 이벤트(미션) 완료 승인 시 지급되는 코인은 이력 구분을 위해 'event' 타입으로 기록합니다.
alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check
  check (type in ('earn','bonus','spend','event'));

-- 주문(type='spend') 지급 완료 체크용. 기존 행/코인 지급 타입은 기본값 true로
-- 채워지고, 새 주문 건만 서버에서 false로 넣어서 "미완료"로 시작합니다.
alter table transactions add column if not exists fulfilled boolean not null default true;

-- 모의투자 최초 이용 시 설명 동의 여부 (null = 아직 동의 안 함)
alter table kids add column if not exists invest_agreed_at timestamptz;

-- 모의투자: 종목, 시세 이력, 청소년별 보유 주식, 매수/매도 내역.
-- 매수/매도는 kids.balance만 증감시키고 total_earned/total_spent/purchase_count(레벨·뱃지용)는
-- 건드리지 않습니다. 반복 매매로 레벨을 어뷰징하는 걸 막기 위함이며, 같은 이유로 transactions
-- 테이블과도 분리된 별도 원장(stock_orders)에 기록합니다.
create table if not exists stocks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text default '📈',
  price int not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists stock_price_history (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references stocks(id) on delete cascade,
  price int not null,
  recorded_at timestamptz not null default now()
);
create index if not exists idx_stock_price_history_stock on stock_price_history(stock_id, recorded_at);

create table if not exists stock_holdings (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids(id) on delete cascade,
  stock_id uuid not null references stocks(id) on delete cascade,
  shares int not null default 0,
  avg_price int not null default 0,   -- 가중평균 매수단가 (손익 계산용)
  unique (kid_id, stock_id)
);

create table if not exists stock_orders (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids(id) on delete cascade,
  kid_name text not null,
  stock_id uuid not null references stocks(id) on delete cascade,
  stock_name text not null,
  type text not null check (type in ('buy','sell')),
  shares int not null,
  price int not null,
  amount int not null,
  fee int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_orders_kid on stock_orders(kid_id);

-- 실현 손익 누적(매도 시점마다 갱신, 수수료 반영) + 총 매매 횟수. '주식왕' 등 칭호/뱃지 조건에 사용.
alter table kids add column if not exists invest_realized_profit int not null default 0;
alter table kids add column if not exists invest_trade_count int not null default 0;

-- 예금(정기예금): 주식(위험자산)과 대비되는 안전자산. 상품 목록(기간/이율)은 lib/deposits.js에서
-- 관리하고, 여기는 "누가 얼마를 언제까지 넣었는지"만 저장합니다. 만기 시점 이후 조회가 들어오면
-- 그때 이자를 더해 잔액에 넣어주고 claimed=true로 표시합니다(주식 시세 갱신과 같은 지연 처리 방식).
create table if not exists kid_deposits (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids(id) on delete cascade,
  principal int not null,
  rate_pct numeric not null,
  term_days int not null,
  created_at timestamptz not null default now(),
  matures_at timestamptz not null,
  claimed boolean not null default false,
  payout int
);
create index if not exists idx_kid_deposits_kid on kid_deposits(kid_id);
alter table kid_deposits enable row level security;

-- 간식 주문 오픈/마감을 관리자가 직접 켜고 끔 (날짜 기준 아님)
alter table settings add column if not exists orders_open boolean not null default false;

-- 메뉴 재고. null = 무제한, 숫자 = 남은 개수(0이면 품절)
alter table menu_items add column if not exists stock int;

-- 상점: 아바타/액세서리/스티커/테마/특수효과. 카탈로그(가격, 이름, 이모지 등)는
-- lib/shop.js 코드에 정의하고, 여기 두 테이블은 "누가 뭘 샀는지"와
-- "지금 뭘 착용 중인지"만 저장합니다.
create table if not exists kid_inventory (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids(id) on delete cascade,
  category text not null,
  item_key text not null,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (kid_id, item_key)
);
create index if not exists idx_kid_inventory_kid on kid_inventory(kid_id);
-- expires_at이 null이면 영구 보유(아바타/액세서리/스티커/테마/가구), 값이 있으면 그 시점에 만료되는
-- 기간제 아이템(특별효과)입니다. 이 컬럼을 나중에 추가했기 때문에 기존 행은 전부 null(영구)로
-- 남아 있고, 새로 산 특별효과부터 기간제로 적용됩니다.

create table if not exists kid_equipped (
  kid_id uuid primary key references kids(id) on delete cascade,
  avatar_key text,
  accessory_key text,
  sticker_key text,
  theme_key text
);

-- 마이룸: 가구는 상점의 'furniture' 카테고리로 kid_inventory에 구매 기록이 남고,
-- 어디에 배치했는지는 여기 따로 저장합니다. 한 아이템은 한 칸에만, 한 칸엔 하나만.
create table if not exists kid_room_items (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids(id) on delete cascade,
  item_key text not null,
  grid_x int not null,
  grid_y int not null,
  created_at timestamptz not null default now(),
  unique (kid_id, item_key),
  unique (kid_id, grid_x, grid_y)
);
create index if not exists idx_kid_room_items_kid on kid_room_items(kid_id);

-- 마이룸에서 잔액을 친구들에게 공개할지 (기본은 비공개)
alter table kids add column if not exists room_balance_public boolean not null default false;

-- 마이룸 확장 단계(0~4). lib/room.js의 ROOM_EXPANSION_COSTS와 짝을 이룹니다.
alter table kids add column if not exists room_expansions int not null default 0;

-- 기부함(공동 목표): 관리자가 "피자데이" 같은 목표를 정하면 청소년들이 코인을 기부해서
-- 채우고, 달성되면 관리자가 실제로 진행한 뒤 완료 처리합니다. 목표별 기부 순위 1등에게
-- 메뉴 선정권을 주는 식으로 씁니다(순위는 group_goal_donations를 집계해서 그때그때 계산).
create table if not exists group_goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  target int not null,
  current int not null default 0,
  is_active boolean not null default true,
  achieved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists group_goal_donations (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references group_goals(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  kid_name text not null,
  amount int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_goal_donations_goal on group_goal_donations(goal_id);

-- 누적 기부액. '나눔이'/'기부왕' 뱃지 조건에 사용.
alter table kids add column if not exists total_donated int not null default 0;

-- 주문 수량 + 2단계 수령 흐름(대기 -> 준비완료(장소 안내) -> 수령완료(fulfilled)).
alter table transactions add column if not exists quantity int not null default 1;
alter table transactions add column if not exists ready_at timestamptz;
alter table transactions add column if not exists pickup_location text;

-- 확성기: 코인 내고 하루 동안 홈 화면 상단에 돌아가는 한마디를 올림.
-- 부적절한 글은 관리자가 removed_at을 채워서 즉시 내릴 수 있습니다.
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  kid_id uuid not null references kids(id) on delete cascade,
  kid_name text not null,
  message text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  removed_at timestamptz
);
create index if not exists idx_announcements_active on announcements(expires_at);

-- 예측 시장(베팅 풀): 관리자가 질문(예: "이번 주 출석 20명 넘을까?")을 올리면 청소년들이
-- 두 선택지 중 하나에 코인을 걸고, 관리자가 나중에 정답을 발표하면 맞춘 사람들이 틀린 쪽의
-- 판돈을 자기 베팅액 비율대로 나눠 가집니다(패리뮤추얼 방식). 새 코인을 만들어내지 않고
-- 참가자끼리 돈이 오가기만 하는 구조라 전체 코인 총량에는 영향이 없습니다.
create table if not exists predictions (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  option_a text not null default '예',
  option_b text not null default '아니오',
  status text not null default 'open' check (status in ('open', 'closed', 'resolved')),
  resolved_option text check (resolved_option in ('a', 'b')),
  created_at timestamptz not null default now(),
  closes_at timestamptz,
  resolved_at timestamptz
);

create table if not exists prediction_bets (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references predictions(id) on delete cascade,
  kid_id uuid not null references kids(id) on delete cascade,
  kid_name text not null,
  option text not null check (option in ('a', 'b')),
  amount int not null,
  payout int,
  created_at timestamptz not null default now(),
  unique (prediction_id, kid_id)
);
create index if not exists idx_prediction_bets_prediction on prediction_bets(prediction_id);
create index if not exists idx_prediction_bets_kid on prediction_bets(kid_id);
alter table predictions enable row level security;
alter table prediction_bets enable row level security;

-- 모의투자 뉴스 이벤트: 관리자가 특정 종목에 "호재/악재" 헤드라인과 등락률을 발표하면
-- 그 자리에서 바로 시세에 반영하고(무작위 변동과 별개), 홈 화면/청소년 대시보드에
-- 실제 증권 뉴스 티커처럼 헤드라인이 흘러갑니다.
create table if not exists stock_news (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references stocks(id) on delete cascade,
  stock_name text not null,
  headline text not null,
  pct int not null,
  old_price int not null,
  new_price int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_news_created on stock_news(created_at desc);
alter table stock_news enable row level security;

-- 이 앱은 Next.js 서버(API 라우트)에서 Supabase "service role" 키로만 접근합니다.
-- 브라우저에서 테이블에 직접 접근하지 않으므로 Row Level Security 는 기본적으로 막아둡니다.
alter table settings enable row level security;
alter table kids enable row level security;
alter table transactions enable row level security;
alter table menu_items enable row level security;
alter table events enable row level security;
alter table event_submissions enable row level security;
alter table stocks enable row level security;
alter table stock_price_history enable row level security;
alter table stock_holdings enable row level security;
alter table stock_orders enable row level security;
alter table kid_inventory enable row level security;
alter table kid_equipped enable row level security;
alter table kid_room_items enable row level security;
alter table group_goals enable row level security;
alter table group_goal_donations enable row level security;
alter table announcements enable row level security;
-- (정책을 추가하지 않으면 anon 키로는 아무것도 읽고 쓸 수 없고, service role 키는 항상 통과합니다.)
