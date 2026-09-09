-- 금정코인(GC) 앱 데이터베이스 스키마
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
  unique (kid_id, item_key)
);
create index if not exists idx_kid_inventory_kid on kid_inventory(kid_id);

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
-- (정책을 추가하지 않으면 anon 키로는 아무것도 읽고 쓸 수 없고, service role 키는 항상 통과합니다.)
