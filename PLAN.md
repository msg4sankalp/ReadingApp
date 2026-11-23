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
| App | **Expo (React Native) + TypeScript + Expo Router** | One codebase for iOS and Android; test on your phone with Expo Go; EAS Build handles app store releases later |
| Backend | **Supabase** (Postgres, Auth, Storage, Edge Functions) | Real relational DB; Row Level Security; free tier is generous; `pgvector` for recommendations later |
| Book data | **Open Library API** (later add Google Books) | Free, no API key. Cache every book we touch in our own `books` table |
| Local state | TanStack Query | Caching, retries, and optimistic updates for server data |
| Testing | Jest for pure logic (ranking engine) | The ranking math must be well tested |

**Launch-ready choices made now (cheap now, expensive to fix later):**
- Use Postgres with Row Level Security from day one. No "temporary" local-only storage that would need migrating.
- Keep the raw comparison history, not just final positions.
- Use our own book IDs and map external IDs to them (Open Library, ISBN, Google Books), so we never depend on one provider.
- Use TypeScript everywhere, and generate DB types from Supabase.

**Intentionally deferred:** custom backend server, ML infrastructure, web app,
push notifications, monetization.

## The ranking system

### User flow
1. The user marks a book as **Read**.
2. They pick a bucket: **Liked it / It was fine / Didn't like it**.
3. The app runs a **binary search** within that bucket's ranked list:
   "Which did you like more: *New Book* or *Existing Book*?"
   - Each answer halves the remaining range, so a 64-book bucket needs only about 6 questions.
   - Also offer "Too hard to say" (place next to it) and "Skip" (place at the current midpoint).
4. The book is inserted at the final position, and scores are recalculated.

### Score formula (v1)
Each bucket owns a score band:

| Bucket | Band |
|---|---|
| Liked | 6.7 – 10.0 |
| Fine | 3.4 – 6.6 |
| Disliked | 0.0 – 3.3 |

Within a bucket of `n` books, the book at position `i` (0 = best) gets:

```
score = high - (i / max(n - 1, 1)) * (high - low)      # single book → top of band
```

Round to one decimal place for display. Because scores are derived, the formula
can change at any time and everything can be recalculated from stored positions
and comparisons.

### Edge cases to handle
- **First book in a bucket:** no comparisons needed.
- **Re-ranking:** let a user remove a book and run the insertion again.
- **Rereads:** v1 keeps one ranking per book per user. Add reread history later.
- **Large imports (Goodreads CSV):** imported books go to an "unranked" shelf. Offer quick ranking sessions instead of forcing 200 rankings upfront.

## Data model (v1)

```sql
profiles     (id → auth.users, username unique, display_name, avatar_url, created_at)

books        (id uuid, title, authors text[], cover_url, description,
              subjects text[], first_publish_year, page_count,
              open_library_key unique, isbn_13, google_books_id, created_at)

user_books   (user_id, book_id, status: want_to_read | reading | read,
              bucket: liked | fine | disliked | null,
              rank_position int | null,          -- position within bucket, 0 = best
              score numeric(3,1) | null,         -- derived and cached
              note text, started_at, finished_at, created_at, updated_at,
              primary key (user_id, book_id))

comparisons  (id, user_id, winner_book_id, loser_book_id,
              context: insertion | rerank, created_at)

follows      (follower_id, followee_id, created_at)          -- Phase 2
```

Row Level Security:
- `user_books` and `comparisons`: writable only by the owner, readable publicly (social feed).
- `books`: readable by everyone. Inserts happen through a server function, to keep the catalog clean.

Rank positions are rewritten in one transaction by a Postgres function
(`insert_ranked_book(...)`), so the client never sends inconsistent positions.

## Roadmap

### Phase 0: Foundations
- [ ] Set up Expo + TypeScript + Expo Router; configure lint and formatting
- [ ] Create a Supabase project, add the initial migration (schema above), and enable RLS
- [ ] Add email and Apple/Google sign-in through Supabase Auth
- [ ] Build an Open Library search client and cache books in our DB
- [ ] Build the ranking engine as a pure TypeScript module, with Jest tests

### Phase 1: Personal library (the MVP)
- [ ] Book search screen and book detail screen
- [ ] Shelves: Want to Read / Reading / Read
- [ ] Comparison flow: bucket picker, head-to-head cards, insertion
- [ ] "My Rankings" screen: ordered list with scores, filterable by bucket
- [ ] Profile screen with basic stats
- [ ] Ship to about 10–20 readers through TestFlight or Expo internal distribution

### Phase 2: Social
- [ ] Follow other users
- [ ] Activity feed ("Alex ranked *Book* 8.7")
- [ ] Notes and short reviews on rankings
- [ ] Goodreads CSV import with an unranked queue
- [ ] Shareable ranking cards (image export), a strong growth channel

### Phase 3: Taste profile and recommendations
1. **Content-based (works for one user):** embed book descriptions and subjects
   with `pgvector`, then recommend neighbors of the user's top-ranked books,
   pushed away from their bottom-ranked ones.
2. **Taste summary:** an LLM writes a short description of the reader's taste
   from their top and bottom books.
3. **Collaborative filtering:** once there are a few hundred active users,
   find readers with similar rankings and suggest books they ranked highly.
   Pairwise comparison data works well for Bradley-Terry/Elo-style models.
4. **"Predicted score for you"** on every book page.

### Phase 4: Community (Fable-style)
- Book clubs, reading schedules, chapter-gated discussion threads.

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
