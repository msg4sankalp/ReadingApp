-- Explicit table privileges.
--
-- Supabase historically granted select/insert/update/delete on every new table
-- in `public` to the anon and authenticated roles, and the initial migration
-- relied on that. Supabase is making those default grants opt-in, so a newer
-- project would answer every app request with "permission denied". Grant
-- exactly what the app needs here, so the schema works either way.
--
-- Privileges decide which operations a role may attempt; Row Level Security
-- policies (initial migration) then decide which rows. Both must allow a request.

grant usage on schema public to anon, authenticated;

-- Everything the app shows is readable by everyone; RLS policies say which rows.
grant select on
  public.profiles,
  public.categories,
  public.category_chips,
  public.books,
  public.tags,
  public.book_tags,
  public.user_books,
  public.user_book_chips,
  public.comparisons,
  public.follows
to anon, authenticated;

-- Profiles: users edit their own display fields, never their id.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url) on public.profiles to authenticated;

-- Library: shelving, notes and dates. Ranking fields stay with rank_book().
-- (Repeats the column grants from the initial migration, which is harmless.)
grant insert (user_id, book_id, status, note, started_at, finished_at)
  on public.user_books to authenticated;
grant update (status, note, started_at, finished_at)
  on public.user_books to authenticated;
grant delete on public.user_books to authenticated;

-- "What made it work?" chips and follows.
revoke update on public.user_book_chips, public.follows from anon, authenticated;
grant insert, delete on public.user_book_chips to authenticated;
grant insert, delete on public.follows to authenticated;

-- Signed-out visitors can read but never write.
revoke insert, update, delete on
  public.user_books, public.user_book_chips, public.follows
from anon;
