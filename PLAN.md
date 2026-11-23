# ReadingApp — Build Plan

A mobile-first reading app: a Goodreads/Fable-style library and social layer, with
**Beli-style comparison ranking**. Users never type a score. They compare books
head-to-head, and the app works out a 1–10 score from where each book lands in
their personal ranking. Over time, those rankings drive a taste profile and
recommendations.

## Decisions so far

| Decision | Choice | Notes |
|---|---|---|
| Platform | Mobile-first (iOS + Android) | Web can come later from the same codebase |
| Team | Solo | Favor managed services and fewer moving parts |
| Ranking | Comparison-based (binary insertion) | Score is derived, never entered |
| Ambition | Side project / learning, launch-ready path | Don't over-build, but avoid choices that block a launch |

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| App | **Expo (React Native) + TypeScript + Expo Router** | One codebase for iOS and Android; test on your phone with Expo Go. Expo is free and open source |
| Backend | **Supabase** (Postgres, Auth, Storage, Edge Functions) | Real relational DB; Row Level Security; free tier is generous; `pgvector` for recommendations later |
| Book data | **Open Library API** (later add Google Books) | Free, no API key. Cache every book we touch in our own `books` table |
| Local state | TanStack Query | Caching, retries, and optimistic updates for server data |
| Testing | Jest for pure logic (ranking engine) | The ranking math must be well tested |

**Launch-ready choices made now (cheap now, expensive to fix later):**
- Use Postgres with Row Level Security from day one. No "temporary" local-only storage that would need migrating.
- Keep the raw comparison history, not just final positions.
- Use our own book IDs and map external IDs to them (Open Library, ISBN, Google Books), so we never depend on one provider.
- Use TypeScript everywhere, and generate DB types from Supabase.

**About Expo and EAS:** Expo (the framework, Expo Go, the CLI) is free and open
source. EAS, Expo's cloud build service, is **optional**: build locally for free
(`npx expo run:android`; iOS builds need a Mac), or use EAS's free tier when you
don't have a Mac. Paid EAS is a convenience, never a requirement.

**Intentionally deferred:** custom backend server, ML infrastructure, web app,
push notifications, monetization.

## The ranking system

### Core principle: compare like with like
A memoir and a space opera can't be compared fairly: "Which did you like more?"
has no meaningful answer across them. So ranking happens on **two levels**:

1. **Across genres: absolute sentiment.** The bucket (*Liked / Fine / Didn't like*)
   is an absolute judgement that means the same thing in every genre. It is the
   only signal compared across genres.
2. **Within a genre: relative ranking.** Head-to-head comparisons happen only
   between books in the **same ranking category**. Your Sci-Fi list and your
   Memoir list are separate ordered lists.

A score of 9.4 therefore means "near the top of the books you loved *in this
genre*". It does not mean "better than your 9.1 history book".

### Ranking categories (a coarse, fixed set)
Each ranked book has exactly **one** ranking category, so it has one position in
one list. Keep the set small (about 12). Finer categories mean fewer books per
list, and short lists produce unreliable scores.

| Fiction | Nonfiction | Other |
|---|---|---|
| Literary & General Fiction | Memoir & Biography | Poetry |
| Science Fiction & Fantasy | History | Graphic Novels & Comics |
| Mystery & Thriller | Science, Tech & Nature | |
| Romance | Society, Politics & Ideas | |
| Horror | Business & Self-Improvement | |
| Historical Fiction | | |

- The default category comes from mapping the book's Open Library subjects (later, an LLM classifier).
- The user confirms or changes it when ranking, for example to file a genre-blending book like literary sci-fi.
- That choice is per user: the same book can sit in different lists for different readers.
- Young Adult is a **tag**, not a category. A YA fantasy is ranked against other fantasy.

### Subgenres and attributes live in tags, not lists
Detail within a genre (hard sci-fi vs. space opera, cozy vs. psychological
thriller, political vs. sports memoir) is captured as **tags** on books, not as
separate lists. Tags drive the within-genre taste model (see Phase 3).

- **Subgenre tags:** controlled vocabulary per category (for example, SFF: hard SF, space opera, epic fantasy, urban fantasy, dystopian, ...)
- **Attribute tags:** pace (slow, medium, fast), tone (dark, hopeful, funny), length, era, POV, audience (YA, adult)
- **Sources:** Open Library subjects, then LLM tagging from descriptions, then user corrections. Every tag records its `source`.

### "What made it work?" chips
After placing a book, offer optional one-tap chips. Each category has its own set:

| Category | Example chips |
|---|---|
| SFF | Ideas · World-building · Characters · Plot · Prose |
| Romance | Chemistry · Tropes · Banter · Spice level · Emotional payoff |
| Memoir & Biography | Voice · Life story · Insight · Honesty · Humor |
| Mystery & Thriller | Twists · Pacing · Atmosphere · Detective · Ending |
| History | Narrative · Research depth · New perspective · Readability |

Tapping chips takes seconds. It records *why* a book landed where it did, which
is the most useful taste signal we can collect.

### User flow
1. The user marks a book as **Read**.
2. They confirm the **category**, which is pre-filled.
3. They pick a bucket: **Liked it / It was fine / Didn't like it**.
4. The app runs a **binary search** within that (category, bucket) list:
   "Which did you like more: *New Book* or *Existing Book*?"
   - Each answer halves the remaining range, so a 64-book list needs only about 6 questions.
   - Also offer "Too hard to say" (place next to it) and "Skip" (place at the current midpoint).
5. The book is inserted, scores in that list are recalculated, and the optional chips are shown.

### Score formula (v1)
Each bucket owns a score band:

| Bucket | Band |
|---|---|
| Liked | 6.7 – 10.0 |
| Fine | 3.4 – 6.6 |
| Disliked | 0.0 – 3.3 |

Within a (category, bucket) list of `n` books, the book at position `i` (0 = best) gets:

```
score = high - (i / max(n - 1, 1)) * (high - low)      # single book → top of band
```

Round to one decimal place for display. Because scores are derived, the formula
can change at any time and everything can be recalculated from stored positions
and comparisons.

### Sparse categories
Most readers will have a few large categories and several with 1–3 books.
- **Provisional scores:** with fewer than 5 ranked books in a category, show the score as provisional (for example "~8.5"). It isn't reliable yet.
- **Ranking a thin category:** keep the binary search inside the category anyway. A wrong cross-genre comparison does more harm than a provisional score.
- **Later idea:** if the band formula feels harsh for tiny lists (the first book always gets 10.0), compress small lists toward the middle of the band.

### Views
- **By genre (the main view):** "My Sci-Fi & Fantasy", "My Memoirs", ...
- **All books:** every ranked book sorted by score, labeled by category. It works as a rough overall list, since the buckets are absolute.
- **Later: "Desert Island" list.** An optional, fun cross-genre ranking of the user's category favorites, built with explicit cross-genre comparisons. It is kept separate, so it never distorts the genre lists.

### Edge cases to handle
- **First book in a list:** no comparisons needed.
- **Changing a book's category:** remove it from the old list and run insertion in the new one. Keep old comparisons for history, but exclude them from the new list.
- **Re-ranking:** let a user remove a book and run the insertion again.
- **Rereads:** v1 keeps one ranking per book per user. Add reread history later.
- **Large imports (Goodreads CSV):** imported books go to an "unranked" queue with categories pre-filled. Offer quick per-genre ranking sessions instead of forcing 200 rankings upfront.

## Data model (v1)

```sql
profiles        (id → auth.users, username unique, display_name, avatar_url, created_at)

categories      (id, slug unique, name, sort_order)            -- the ~12 ranking categories
category_chips  (id, category_id, slug, label)                 -- "what made it work?" options

books           (id uuid, title, authors text[], cover_url, description,
                 subjects text[], first_publish_year, page_count,
                 default_category_id → categories,
                 open_library_key unique, isbn_13, google_books_id, created_at)

tags            (id, slug unique, label, kind: subgenre | pace | tone | audience | ...,
                 category_id → categories | null)              -- subgenres belong to one category
book_tags       (book_id, tag_id, source: open_library | llm | user, confidence,
                 primary key (book_id, tag_id))

user_books      (user_id, book_id, status: want_to_read | reading | read,
                 category_id → categories | null,             -- the user's ranking category
                 bucket: liked | fine | disliked | null,
                 rank_position int | null,          -- position within (user, category, bucket), 0 = best
                 score numeric(3,1) | null,         -- derived and cached
                 note text, started_at, finished_at, created_at, updated_at,
                 primary key (user_id, book_id),
                 unique (user_id, category_id, bucket, rank_position) deferrable)

user_book_chips (user_id, book_id, chip_id, created_at)

comparisons     (id, user_id, category_id, winner_book_id, loser_book_id,
                 context: insertion | rerank | desert_island, created_at)

follows         (follower_id, followee_id, created_at)          -- Phase 2
```

Row Level Security:
- `user_books`, `user_book_chips` and `comparisons`: writable only by the owner, readable publicly (social feed).
- `books`, `tags` and `categories`: readable by everyone. Writes happen through server functions, to keep the catalog clean.

Rank positions are rewritten in one transaction by a Postgres function
(`rank_book(book, category, bucket, position, comparisons)`, plus `unrank_book`), so the client
never sends inconsistent positions.

## Roadmap

### Phase 0: Foundations
- [x] Set up Expo + TypeScript + Expo Router; configure lint and formatting
- [x] Write the initial migration (schema above) with RLS and ranking functions
- [ ] Create the Supabase project and apply the migration and seed
- [ ] Add email and Apple/Google sign-in through Supabase Auth
- [ ] Replace the Expo starter screens with the app's tab layout
- [x] Build an Open Library search client and cache books in our DB
- [x] Seed categories and chips; map Open Library subjects to a default category
- [x] Build the ranking engine as a pure TypeScript module, with Jest tests

### Phase 1: Personal library (the MVP)
- [ ] Book search screen and book detail screen
- [ ] Shelves: Want to Read / Reading / Read
- [ ] Comparison flow: category confirm, bucket picker, head-to-head cards, insertion, chips
- [ ] "My Rankings" screen: per-genre lists, plus an "All books" view; provisional-score badges
- [ ] Profile screen with basic stats
- [ ] Ship to about 10–20 readers through TestFlight or Expo internal distribution

### Phase 2: Social
- [ ] Follow other users
- [ ] Activity feed ("Alex ranked *Book* 8.7")
- [ ] Notes and short reviews on rankings
- [ ] Goodreads CSV import with an unranked queue
- [ ] Shareable ranking cards (image export), a strong growth channel

### Phase 3: Taste profile and recommendations
Taste is modeled on the same two levels as ranking.

**Across genres: which genres you like.** This is never based on comparing scores across genres:
- **Engagement:** share of books read per category, recent trend, and Want-to-Read additions.
- **Satisfaction:** bucket mix per category. "You loved 80% of your fantasy, but only 30% of your thrillers."
- Combined into a per-category **affinity** score.

**Within a genre: what you like inside it.**
- Every within-category comparison is a training example: winner tags vs. loser tags.
- A Bradley-Terry / logistic model learns, per user and per category, which tags and attributes push a book up the list. For example, "in SFF, you favor hard SF and slow-burn world-building; in thrillers, fast pace and a twist ending."
- Chips add the *why* signal on top.
- With little data, fall back to signals pooled from similar users and from all users (hierarchical shrinkage).

**Recommendations:**
1. **Content-based (works for one user):** embed book descriptions and tags with `pgvector`. Candidate score = category affinity × within-category tag-model prediction × embedding similarity to the user's top books in that genre.
2. **Taste summary:** an LLM writes a short description of the reader's taste per genre and overall.
3. **Collaborative filtering:** once there are a few hundred active users, find readers whose within-genre rankings agree with yours, and suggest what they ranked highly.
4. **"Predicted score for you"** on every book page, computed in the book's category.
5. **Recommendation surfaces:** "More like your top fantasy", "A genre you might be missing", and "Stretch picks" (high predicted score in a genre you rarely read).

### Phase 4: Community (Fable-style)
- Book clubs, reading schedules, chapter-gated discussion threads.

## Costs (approximate; check current pricing)

| Stage | Cost |
|---|---|
| Building and testing | **$0/month**: Supabase free tier, Expo Go, Open Library. Free Supabase projects pause after about a week idle |
| Testers and app stores | Apple Developer Program **$99/year** (TestFlight, App Store); Google Play **$25 one-time** |
| Real users | Supabase Pro about **$25/month** (no pausing, backups). Optional: paid EAS, a domain (about $10–20/year) |
| Recommendations (Phase 3) | LLM tagging and embeddings: one-time per book, cheap with a small model |

## Learning milestones

Each phase teaches a self-contained skill:
- Phase 0: React Native basics, Postgres schema design, RLS, unit testing
- Phase 1: navigation, server state (TanStack Query), interactive UX, app distribution
- Phase 2: social graph queries, feeds, file parsing
- Phase 3: embeddings, vector search, basic recommender systems, LLM APIs

## Open questions
- App name and branding
- Should ranking lists be public by default, or private with opt-in sharing?
- Should audiobooks or DNFs (did-not-finish) get their own handling?
- Is the category list right? Should Sci-Fi and Fantasy be split once users have enough books?
- Should users be able to create custom lists (for example, "Books about grief") in addition to the fixed categories?
