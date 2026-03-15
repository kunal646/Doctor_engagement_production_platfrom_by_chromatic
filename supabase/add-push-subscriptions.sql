create table if not exists user_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_push_subscriptions_user_id
  on user_push_subscriptions(user_id);

alter table user_push_subscriptions enable row level security;

drop trigger if exists user_push_subscriptions_set_updated_at on user_push_subscriptions;
create trigger user_push_subscriptions_set_updated_at
before update on user_push_subscriptions
for each row
execute function set_updated_at();
