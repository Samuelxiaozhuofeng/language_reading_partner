create table if not exists public.collections (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at bigint not null
);

create table if not exists public.books (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text not null,
  language text check (language in ('es', 'ja')),
  source_type text check (source_type in ('epub', 'manual')),
  cover_url text,
  collection_id uuid references public.collections(id) on delete set null,
  imported_at timestamptz not null,
  chapter_count integer not null default 0,
  last_read_chapter_id uuid,
  last_opened_at timestamptz,
  analysis_state text not null check (analysis_state in ('idle', 'partial', 'running', 'analyzed')),
  epub_file_path text
);

create table if not exists public.chapters (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  title text not null,
  order_index integer not null,
  epub_href text,
  original_text text not null,
  source_text text not null,
  paragraph_blocks jsonb not null default '[]'::jsonb,
  sentences jsonb not null default '[]'::jsonb,
  results jsonb not null default '{}'::jsonb,
  analysis_state text not null check (analysis_state in ('idle', 'partial', 'running', 'analyzed')),
  active_range jsonb,
  last_read_end integer not null default -1,
  last_opened_at timestamptz,
  resume_anchor jsonb,
  unique (book_id, order_index)
);

create table if not exists public.resources (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  signature text not null,
  text text not null,
  kind text not null check (kind in ('grammar', 'phrase', 'vocabulary')),
  explanation text not null,
  grammar_text text not null,
  meaning text,
  sentence_id uuid not null,
  sentence_text text not null,
  saved_at timestamptz not null,
  book_id uuid references public.books(id) on delete cascade,
  book_title text,
  chapter_id uuid references public.chapters(id) on delete cascade,
  chapter_title text,
  unique (user_id, signature)
);

create index if not exists books_user_recent_idx on public.books (user_id, coalesce(last_opened_at, imported_at) desc);
create index if not exists books_user_collection_idx on public.books (user_id, collection_id);
create index if not exists chapters_user_book_order_idx on public.chapters (user_id, book_id, order_index);
create index if not exists resources_user_saved_idx on public.resources (user_id, saved_at desc);
create index if not exists resources_user_kind_idx on public.resources (user_id, kind);
create index if not exists resources_user_book_idx on public.resources (user_id, book_id);

alter table public.collections enable row level security;
alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.resources enable row level security;

drop policy if exists "Users can manage own collections" on public.collections;
drop policy if exists "Users can manage own books" on public.books;
drop policy if exists "Users can manage own chapters" on public.chapters;
drop policy if exists "Users can manage own resources" on public.resources;

create policy "Users can manage own collections"
on public.collections
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage own books"
on public.books
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage own chapters"
on public.chapters
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can manage own resources"
on public.resources
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-files', 'book-files', false, 52428800, array['application/epub+zip']::text[])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own book files" on storage.objects;
drop policy if exists "Users can insert own book files" on storage.objects;
drop policy if exists "Users can update own book files" on storage.objects;
drop policy if exists "Users can delete own book files" on storage.objects;

create policy "Users can read own book files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'book-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can insert own book files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'book-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update own book files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'book-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'book-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete own book files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'book-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
