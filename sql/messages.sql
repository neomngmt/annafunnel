-- Chat text per session, so the owner can read how chats go. Deleted after 30 days.
-- RLS is on with no policies, so only the edge function (service role) can read or write.

create table if not exists funnel_messages (
  id bigserial primary key,
  session_id uuid not null references funnel_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  photo text,
  link text,
  created_at timestamptz not null default now()
);

create index if not exists funnel_messages_session_idx on funnel_messages (session_id, id);
create index if not exists funnel_messages_created_idx on funnel_messages (created_at);

alter table funnel_messages enable row level security;
grant select, insert on funnel_messages to service_role;
grant usage on sequence funnel_messages_id_seq to service_role;

create extension if not exists pg_cron;
select cron.schedule(
  'funnel-messages-30-days',
  '15 3 * * *',
  $$delete from funnel_messages where created_at < now() - interval '30 days'$$
);
