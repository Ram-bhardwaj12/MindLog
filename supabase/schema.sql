-- MindLog backend schema
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to re-run: uses "if not exists" / "or replace" everywhere it can.
-- (Already ran this once? Running it again is safe and will just add the
--  new columns below without touching your existing entries.)

-- 1. Journal entries -----------------------------------------------------
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default 'Untitled entry',
  body_html text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extra fields used by the rich editor (mood, fonts, bookmark, soft-delete).
alter table public.journal_entries add column if not exists mood text;
alter table public.journal_entries add column if not exists title_font_style text;
alter table public.journal_entries add column if not exists font_style text;
alter table public.journal_entries add column if not exists font_size text;
alter table public.journal_entries add column if not exists line_height text;
alter table public.journal_entries add column if not exists bookmarked boolean not null default false;
alter table public.journal_entries add column if not exists deleted_at timestamptz;

alter table public.journal_entries enable row level security;

drop policy if exists "select own entries" on public.journal_entries;
create policy "select own entries" on public.journal_entries
  for select using (auth.uid() = user_id);

drop policy if exists "insert own entries" on public.journal_entries;
create policy "insert own entries" on public.journal_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own entries" on public.journal_entries;
create policy "update own entries" on public.journal_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "delete own entries" on public.journal_entries;
create policy "delete own entries" on public.journal_entries
  for delete using (auth.uid() = user_id);

-- keep updated_at fresh on every edit
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_journal_entries_updated_at on public.journal_entries;
create trigger set_journal_entries_updated_at
  before update on public.journal_entries
  for each row execute function public.set_updated_at();

-- 2. Media attached to entries -------------------------------------------
create table if not exists public.entry_media (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('image', 'video', 'audio')),
  storage_path text not null,
  name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.entry_media enable row level security;

drop policy if exists "select own media" on public.entry_media;
create policy "select own media" on public.entry_media
  for select using (auth.uid() = user_id);

drop policy if exists "insert own media" on public.entry_media;
create policy "insert own media" on public.entry_media
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own media" on public.entry_media;
create policy "delete own media" on public.entry_media
  for delete using (auth.uid() = user_id);

-- 3. Storage bucket for the actual files ---------------------------------
insert into storage.buckets (id, name, public)
values ('journal-media', 'journal-media', false)
on conflict (id) do nothing;

-- Files are stored as {user_id}/{entry_id}/{filename}, so folder[1] must
-- match the signed-in user for every operation.
drop policy if exists "select own files" on storage.objects;
create policy "select own files" on storage.objects
  for select using (
    bucket_id = 'journal-media' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "insert own files" on storage.objects;
create policy "insert own files" on storage.objects
  for insert with check (
    bucket_id = 'journal-media' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "delete own files" on storage.objects;
create policy "delete own files" on storage.objects
  for delete using (
    bucket_id = 'journal-media' and (storage.foldername(name))[1] = auth.uid()::text
  );
