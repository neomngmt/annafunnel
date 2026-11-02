-- Tables behind the funnel chat pages. Run once in the Supabase SQL editor.
-- RLS is on with no policies, so only the edge function (service role) can read or write.

create table if not exists funnel_pages (
  slug text primary key,
  model_name text not null,
  language text not null default 'cs' check (language in ('cs', 'en')),
  opener text not null,
  photo_url text,
  tease_photos jsonb not null default '[]'::jsonb,
  persona text,
  style text,
  offer text,
  of_links jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Counters only, chat text is never stored.
create table if not exists funnel_sessions (
  id uuid primary key,
  slug text not null references funnel_pages (slug) on delete cascade,
  source text not null default 'direct',
  ip_hash text not null,
  turns integer not null default 0,
  link_sent boolean not null default false,
  photo_sent boolean not null default false,
  link_clicked boolean not null default false,
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists funnel_sessions_created_idx on funnel_sessions (created_at);
create index if not exists funnel_sessions_ip_idx on funnel_sessions (ip_hash, created_at);

alter table funnel_pages enable row level security;
alter table funnel_sessions enable row level security;

-- New tables are not exposed automatically in this project, so grant only the edge function.
grant select on funnel_pages to service_role;
grant select, insert, update on funnel_sessions to service_role;

create or replace view funnel_stats with (security_invoker = true) as
select
  slug,
  source,
  created_at::date as day,
  count(*) as chats_opened,
  count(*) filter (where turns > 0) as chats_started,
  count(*) filter (where link_sent) as links_sent,
  count(*) filter (where link_clicked) as links_clicked,
  round(avg(turns), 1) as avg_turns
from funnel_sessions
group by slug, source, created_at::date;

-- One file per model in sql/pages, see anna.sql.
