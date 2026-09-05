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

-- 이 앱은 Next.js 서버(API 라우트)에서 Supabase "service role" 키로만 접근합니다.
-- 브라우저에서 테이블에 직접 접근하지 않으므로 Row Level Security 는 기본적으로 막아둡니다.
alter table settings enable row level security;
alter table kids enable row level security;
alter table transactions enable row level security;
alter table menu_items enable row level security;
-- (정책을 추가하지 않으면 anon 키로는 아무것도 읽고 쓸 수 없고, service role 키는 항상 통과합니다.)
