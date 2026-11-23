-- ReadingApp initial schema.
-- See PLAN.md → "Data model (v1)" and "The ranking system".
--
-- Design notes
-- * Rankings are per (user, category, bucket) list. rank_position 0 = best.
-- * Scores are derived from bucket + position and cached on user_books.
--   The formula lives in bucket_score() and must match src/lib/ranking/scores.ts.
-- * Clients never write rank positions directly. They call rank_book() and
--   unrank_book(), which shift the rest of the list in one transaction.
-- * Raw comparisons are stored, so scores can be recomputed and used for
--   recommendations later.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.reading_status as enum ('want_to_read', 'reading', 'read');
create type public.rank_bucket as enum ('liked', 'fine', 'disliked');
create type public.category_group as enum ('fiction', 'nonfiction', 'other');
create type public.tag_source as enum ('open_library', 'llm', 'user');
create type public.comparison_context as enum ('insertion', 'rerank', 'desert_island');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created automatically)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text check (char_length(display_name) <= 80),
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Catalog: categories, chips, books, tags
-- ---------------------------------------------------------------------------
create table public.categories (
  id smallint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  grp public.category_group not null,
  sort_order smallint not null
);

create table public.category_chips (
  id smallint generated always as identity primary key,
  category_id smallint not null references public.categories (id) on delete cascade,
  slug text not null,
  label text not null,
  sort_order smallint not null,
  unique (category_id, slug)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  authors text[] not null default '{}',
  cover_url text,
  description text,
  subjects text[] not null default '{}',
  first_publish_year smallint,
  page_count integer,
  default_category_id smallint references public.categories (id),
  open_library_key text unique check (open_library_key ~ '^/works/OL[0-9]+W$'),
  isbn_13 text check (isbn_13 ~ '^97[89][0-9]{10}$'),
  google_books_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id integer generated always as identity primary key,
  slug text not null unique,
  label text not null,
  kind text not null,             -- subgenre | pace | tone | audience | ...
  category_id smallint references public.categories (id)  -- subgenres belong to one category
);

create table public.book_tags (
  book_id uuid not null references public.books (id) on delete cascade,
  tag_id integer not null references public.tags (id) on delete cascade,
  source public.tag_source not null,
  confidence real check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (book_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- Per-user library and rankings
-- ---------------------------------------------------------------------------
create table public.user_books (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  status public.reading_status not null,
  category_id smallint references public.categories (id),
  bucket public.rank_bucket,
  rank_position integer check (rank_position >= 0),
  score numeric(3, 1) check (score between 0 and 10),
  note text check (char_length(note) <= 5000),
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id),
  -- A ranked book has all ranking fields; an unranked book has none of them.
  constraint ranked_fields_together check (
    (bucket is null and rank_position is null and score is null)
    or (bucket is not null and rank_position is not null and score is not null
        and category_id is not null and status = 'read')
  ),
  -- Deferred, so rank_book() can shift positions within one transaction.
  constraint unique_rank_position
    unique (user_id, category_id, bucket, rank_position) deferrable initially deferred
);

create index user_books_list_idx
  on public.user_books (user_id, category_id, bucket, rank_position)
  where rank_position is not null;

create table public.user_book_chips (
  user_id uuid not null,
  book_id uuid not null,
  chip_id smallint not null references public.category_chips (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id, chip_id),
  foreign key (user_id, book_id) references public.user_books (user_id, book_id) on delete cascade
);

create table public.comparisons (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id smallint not null references public.categories (id),
  winner_book_id uuid not null references public.books (id) on delete cascade,
  loser_book_id uuid not null references public.books (id) on delete cascade,
  context public.comparison_context not null,
  created_at timestamptz not null default now(),
  check (winner_book_id <> loser_book_id)
);

create index comparisons_user_category_idx on public.comparisons (user_id, category_id);

-- Phase 2, created now because it is tiny and RLS policies are easier to get right early.
create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger books_updated_at before update on public.books
  for each row execute function public.set_updated_at();
create trigger user_books_updated_at before update on public.user_books
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Scoring (must match src/lib/ranking/scores.ts)
-- ---------------------------------------------------------------------------
create function public.bucket_score(b public.rank_bucket, pos integer, n integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  -- Multiply before dividing, so exact halves (e.g. 9.45) stay exact and round up.
  -- pos / (n - 1) first would store 1/6 as 0.1666…67 and turn 9.45 into 9.4499….
  select case when n <= 1 then hi
              else round((hi * (n - 1) - pos * (hi - lo)) / (n - 1), 1)
         end
  from (
    select
      case b when 'liked' then 10.0 when 'fine' then 6.6 else 3.3 end as hi,
      case b when 'liked' then 6.7 when 'fine' then 3.4 else 0.0 end as lo
  ) band;
$$;

-- Rewrites positions as 0..n-1 (closing gaps) and recomputes cached scores for one list.
create function public.recompute_list(p_user uuid, p_category smallint, p_bucket public.rank_bucket)
returns void
language sql
security definer
set search_path = ''
as $$
  with ordered as (
    select book_id,
           (row_number() over (order by rank_position) - 1)::integer as pos,
           count(*) over ()::integer as n
    from public.user_books
    where user_id = p_user and category_id = p_category and bucket = p_bucket
      and rank_position is not null
  )
  update public.user_books ub
  set rank_position = o.pos,
      score = public.bucket_score(p_bucket, o.pos, o.n)
  from ordered o
  where ub.user_id = p_user and ub.book_id = o.book_id;
$$;

-- ---------------------------------------------------------------------------
-- Ranking API (called by the app through supabase.rpc)
-- ---------------------------------------------------------------------------

-- Remove a book from its ranked list (it stays on the Read shelf).
create function public.unrank_book(p_book_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_row public.user_books;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_row from public.user_books
  where user_id = v_user and book_id = p_book_id
  for update;

  if v_row.rank_position is null then
    return;
  end if;

  update public.user_books
  set bucket = null, rank_position = null, score = null
  where user_id = v_user and book_id = p_book_id;

  perform public.recompute_list(v_user, v_row.category_id, v_row.bucket);
end;
$$;

-- Insert (or move) a book into the user's (category, bucket) list at p_position,
-- then store the comparisons that led there.
-- p_comparisons: [{"winner": "<book uuid>", "loser": "<book uuid>"}, ...]
create function public.rank_book(
  p_book_id uuid,
  p_category_slug text,
  p_bucket public.rank_bucket,
  p_position integer,
  p_comparisons jsonb default '[]'::jsonb,
  p_context public.comparison_context default 'insertion'
)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_category smallint;
  v_len integer;
  v_score numeric;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select id into v_category from public.categories where slug = p_category_slug;
  if v_category is null then
    raise exception 'unknown category %', p_category_slug;
  end if;

  -- Serialize concurrent ranking for this user (e.g. two devices).
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  -- If the book is already ranked somewhere, take it out first.
  perform public.unrank_book(p_book_id);

  select count(*) into v_len from public.user_books
  where user_id = v_user and category_id = v_category and bucket = p_bucket
    and rank_position is not null;

  if p_position is null or p_position < 0 or p_position > v_len then
    raise exception 'position % out of range 0..%', p_position, v_len;
  end if;

  -- Make room.
  update public.user_books
  set rank_position = rank_position + 1
  where user_id = v_user and category_id = v_category and bucket = p_bucket
    and rank_position >= p_position;

  insert into public.user_books (user_id, book_id, status, category_id, bucket, rank_position, score,
                                 finished_at)
  values (v_user, p_book_id, 'read', v_category, p_bucket, p_position, 0, current_date)
  on conflict (user_id, book_id) do update
    set status = 'read',
        category_id = excluded.category_id,
        bucket = excluded.bucket,
        rank_position = excluded.rank_position,
        score = excluded.score,
        finished_at = coalesce(public.user_books.finished_at, excluded.finished_at);

  perform public.recompute_list(v_user, v_category, p_bucket);

  -- Only keep comparisons between this book and books in the same list.
  insert into public.comparisons (user_id, category_id, winner_book_id, loser_book_id, context)
  select v_user, v_category, (c ->> 'winner')::uuid, (c ->> 'loser')::uuid, p_context
  from jsonb_array_elements(p_comparisons) c
  where p_book_id in ((c ->> 'winner')::uuid, (c ->> 'loser')::uuid)
    and exists (
      select 1 from public.user_books ub
      where ub.user_id = v_user and ub.category_id = v_category and ub.bucket = p_bucket
        and ub.book_id = case when (c ->> 'winner')::uuid = p_book_id
                              then (c ->> 'loser')::uuid else (c ->> 'winner')::uuid end
    );

  select score into v_score from public.user_books where user_id = v_user and book_id = p_book_id;
  return v_score;
end;
$$;

-- Add a book from Open Library to the shared catalog, or return the existing one.
-- Security definer, because clients cannot write to books directly.
create function public.upsert_open_library_book(
  p_open_library_key text,
  p_title text,
  p_subtitle text default null,
  p_authors text[] default '{}',
  p_cover_url text default null,
  p_subjects text[] default '{}',
  p_first_publish_year smallint default null,
  p_page_count integer default null,
  p_isbn_13 text default null,
  p_default_category_slug text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_cover_url is not null and p_cover_url !~ '^https://covers\.openlibrary\.org/' then
    raise exception 'unexpected cover url';
  end if;

  select id into v_id from public.books where open_library_key = p_open_library_key;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.books (open_library_key, title, subtitle, authors, cover_url, subjects,
                            first_publish_year, page_count, isbn_13, default_category_id)
  values (p_open_library_key, left(p_title, 500), left(p_subtitle, 500), p_authors[1:20], p_cover_url,
          p_subjects[1:100], p_first_publish_year, p_page_count, p_isbn_13,
          (select id from public.categories where slug = p_default_category_slug))
  on conflict (open_library_key) do nothing
  returning id into v_id;

  if v_id is null then  -- lost a race with another insert
    select id into v_id from public.books where open_library_key = p_open_library_key;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.category_chips enable row level security;
alter table public.books enable row level security;
alter table public.tags enable row level security;
alter table public.book_tags enable row level security;
alter table public.user_books enable row level security;
alter table public.user_book_chips enable row level security;
alter table public.comparisons enable row level security;
alter table public.follows enable row level security;

-- Catalog: readable by everyone; written only by server functions or admins.
create policy "catalog readable" on public.categories for select using (true);
create policy "catalog readable" on public.category_chips for select using (true);
create policy "catalog readable" on public.books for select using (true);
create policy "catalog readable" on public.tags for select using (true);
create policy "catalog readable" on public.book_tags for select using (true);

-- Profiles: public read, owner update.
create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Reading activity: public read (social feed), owner write.
-- Revisit when adding private profiles (see PLAN.md open questions).
create policy "user_books readable" on public.user_books for select using (true);
create policy "own user_books insert" on public.user_books for insert with check (user_id = auth.uid());
create policy "own user_books update" on public.user_books for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own user_books delete" on public.user_books for delete using (user_id = auth.uid());

create policy "chips readable" on public.user_book_chips for select using (true);
create policy "own chips insert" on public.user_book_chips for insert with check (user_id = auth.uid());
create policy "own chips delete" on public.user_book_chips for delete using (user_id = auth.uid());

create policy "comparisons readable" on public.comparisons for select using (true);
-- No insert policy: comparisons are written only through rank_book().

create policy "follows readable" on public.follows for select using (true);
create policy "own follows insert" on public.follows for insert with check (follower_id = auth.uid());
create policy "own follows delete" on public.follows for delete using (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
-- Supabase grants table-wide privileges to anon/authenticated by default, and a
-- column-level revoke does not override a table-wide grant. So revoke at table
-- level and grant back only the columns clients may write. Ranking fields
-- (category_id, bucket, rank_position, score) are written only by rank_book().
revoke insert, update on public.user_books from anon, authenticated;
grant insert (user_id, book_id, status, note, started_at, finished_at)
  on public.user_books to authenticated;
grant update (status, note, started_at, finished_at)
  on public.user_books to authenticated;

-- Catalog tables are written only by server functions and admins.
revoke insert, update, delete on public.categories, public.category_chips, public.books,
  public.tags, public.book_tags from anon, authenticated;
revoke insert, update, delete on public.comparisons from anon, authenticated;

-- Internal helpers are not part of the client API.
revoke execute on function public.recompute_list(uuid, smallint, public.rank_bucket)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rank_book(uuid, text, public.rank_bucket, integer, jsonb,
  public.comparison_context) from public, anon;
revoke execute on function public.unrank_book(uuid) from public, anon;
revoke execute on function public.upsert_open_library_book(text, text, text, text[], text, text[],
  smallint, integer, text, text) from public, anon;
grant execute on function public.rank_book(uuid, text, public.rank_bucket, integer, jsonb,
  public.comparison_context) to authenticated;
grant execute on function public.unrank_book(uuid) to authenticated;
grant execute on function public.upsert_open_library_book(text, text, text, text[], text, text[],
  smallint, integer, text, text) to authenticated;
