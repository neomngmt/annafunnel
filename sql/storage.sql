-- Bucket for the model photos, so they do not have to live in the Git repo.
-- Files are readable by URL but the bucket cannot be listed or written from outside.
insert into storage.buckets (id, name, public)
values ('funnel', 'funnel', true)
on conflict (id) do nothing;
