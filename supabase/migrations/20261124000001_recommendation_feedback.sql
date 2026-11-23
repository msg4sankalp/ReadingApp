-- What readers do with recommendations. Stores the predicted score at the
-- time, so later rankings can be compared with predictions (how accurate is
-- the engine?), and "Not interested" picks are never shown again.

create type public.recommendation_action as enum ('want_to_read', 'already_read', 'dismissed');

create table public.recommendation_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  action public.recommendation_action not null,
  predicted_score numeric(3, 1) check (predicted_score between 0 and 10),
  created_at timestamptz not null default now()
);

create index recommendation_feedback_user_idx on public.recommendation_feedback (user_id, action);

alter table public.recommendation_feedback enable row level security;

-- Private to each reader (unlike rankings, this isn't social).
create policy "own feedback read" on public.recommendation_feedback for select using (user_id = auth.uid());
create policy "own feedback insert" on public.recommendation_feedback for insert with check (user_id = auth.uid());

revoke all on public.recommendation_feedback from anon, authenticated;
grant select, insert on public.recommendation_feedback to authenticated;
