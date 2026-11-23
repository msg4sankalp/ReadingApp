-- Steadier scores: the "midpoint rule".
--
-- Before: the best and worst books in a list sat at the edges of the bucket's
-- band, so a genre's only book scored a perfect 10.0 and small lists swung
-- wildly (one new book could drop another from 10.0 to 6.7).
-- Now: each book sits in the middle of its equal share of the band. A single
-- liked book scores 8.4, and scores approach the edges as the list grows.
--
-- Must match scoreForPosition() in src/lib/ranking/scores.ts.

create or replace function public.bucket_score(b public.rank_bucket, pos integer, n integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  -- score = hi - ((pos + 0.5) / n) * (hi - lo), with the multiplication done
  -- before the division so exact halves (e.g. 8.35) stay exact and round up.
  select round((hi * 2 * n - (2 * pos + 1) * (hi - lo)) / (2 * n), 1)
  from (
    select
      case b when 'liked' then 10.0 when 'fine' then 6.6 else 3.3 end as hi,
      case b when 'liked' then 6.7 when 'fine' then 3.4 else 0.0 end as lo
  ) band;
$$;

-- Recompute the cached scores of every existing ranked list.
select public.recompute_list(user_id, category_id, bucket)
from (
  select distinct user_id, category_id, bucket
  from public.user_books
  where rank_position is not null
) lists;
