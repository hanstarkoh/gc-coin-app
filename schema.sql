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
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_orders_kid on stock_orders(kid_id);

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
-- (정책을 추가하지 않으면 anon 키로는 아무것도 읽고 쓸 수 없고, service role 키는 항상 통과합니다.)
