# Flip — Build Plan

A mobile-first reading app: a Goodreads/Fable-style library and social layer, with
**Beli-style comparison ranking**. Users never type a score. They compare books
head-to-head, and the app works out a 1–10 score from where each book lands in
their personal ranking. Over time, those rankings drive a taste profile and
recommendations.

## Decisions so far

| Decision | Choice | Notes |
|---|---|---|
| Name | **Flip** | Flipping pages; flipping a coin between two books (the head-to-head ranking); flipping your rankings. Tagline: "Rank what you read." |
| Platform | Mobile-first (iOS + Android) | Web can come later from the same codebase |
| Team | Solo | Favor managed services and fewer moving parts |
| Ranking | Comparison-based (binary insertion) | Score is derived, never entered |
| Ambition | Side project / learning, launch-ready path | Don't over-build, but avoid choices that block a launch |

## Design

Inspired by Fable, an Iwu book-app concept and the Mayor onboarding concept; not a copy of any.
- **Palette: "Warm paper."** Cream background, near-white cards, charcoal main buttons, terracotta accent, a warm yellow for feature cards. Book covers supply most of the color. A matching dark palette follows the system setting.
- **Type:** Instrument Serif for headings, questions and scores; Inter for everything else.
- **Shape:** pill buttons and chips, 20px-radius cards, no heavy shadows.
- **Home** replaces the Library tab: greeting, Continue reading, books to rank, genre bubbles (your #1 book's cover), Picked for you, Want to read. Full shelves are one tap away.
- Tokens live in `src/constants/theme.ts`; shared components in `src/components/ui.tsx`.

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

Within a (category, bucket) list of `n` books, the book at position `i` (0 = best)
sits in the middle of its equal share of the band (the "midpoint rule"):

```
score = high - ((i + 0.5) / n) * (high - low)      # single liked book → 8.4
```

This was changed from an edge-to-edge formula (best = 10.0, worst = 6.7) after
testing showed small genres swinging wildly and every genre's #1 tying at 10.0.
With the midpoint rule, scores approach the band's edges as a list grows (the
#1 of 20 liked books scores 9.9).

Round to one decimal place for display. Because scores are derived, the formula
can change at any time and everything can be recalculated from stored positions
and comparisons.

### Sparse categories
Most readers will have a few large categories and several with 1–3 books.
- **Provisional scores:** with fewer than 5 ranked books in a category, show the score as provisional (for example "~8.5"). It isn't reliable yet.
- **Ranking a thin category:** keep the binary search inside the category anyway. A wrong cross-genre comparison does more harm than a provisional score.

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
- [x] Add email sign-in through Supabase Auth (Apple/Google later)
- [x] Replace the Expo starter screens with the app's tab layout
- [x] Build an Open Library search client and cache books in our DB
- [x] Seed categories and chips; map Open Library subjects to a default category
- [x] Build the ranking engine as a pure TypeScript module, with Jest tests

### Phase 1: Personal library (the MVP)
- [x] Book search screen and book detail screen
- [x] Shelves: Want to Read / Reading / Read
- [x] Comparison flow: category confirm, bucket picker, head-to-head cards, insertion, chips
- [x] "My Rankings" screen: per-genre lists, plus an "All books" view; provisional-score badges
- [x] Profile screen with basic stats
- [x] Demo mode with a sample library, for testing the concept without accounts
- [x] Start and finish dates (Start Reading / Mark Finished log today's local date)
- [x] Design pass, part 1: "Warm paper" palette (light + dark), Instrument Serif headings with Inter, shared components (pill buttons, chips, cards), new Home screen, all screens restyled
- [x] Steadier scores (midpoint rule) in app, demo and database (migration recomputes existing scores)
- [x] Editable start and finish dates (system date picker on phones, browser date input on web), with validation
- [x] Library tab replaces Rankings: Reading / Want to Read / Read switcher; Read is your rankings with genre chips, Liked/Fine/Didn't like groups, and an All view by score
- [x] Name (Flip) and app icon: terracotta "Flip" wordmark in Instrument Serif Italic with a cream page corner turning over; matching splash (light and dark) and favicon
- [ ] Design pass, part 2: ranking-moment polish (animation, haptics, score reveal), empty/loading states, checked on real iOS and Android
- [ ] Ship to about 10–20 readers through TestFlight or Expo internal distribution

### Phase 2: Social
- [ ] Follow other users
- [ ] Activity feed ("Alex ranked *Book* 8.7")
- [ ] Notes and short reviews on rankings
- [ ] Goodreads CSV import with an unranked queue
- [ ] Shareable ranking cards (image export), a strong growth channel

### Phase 3: Taste profile and recommendations
See **"Recommendation engine"** below for the design. Milestones:
- [x] R1. Taste profile: genre affinity and within-genre subject/author weights (not yet shown on Profile)
- [x] R2. Picked for you (Home card + full screen): Open Library candidates, scoring, reasons, Want to Read / Already read / Not interested
- [x] R3. "Predicted for you" on book pages; leave-one-out accuracy test (a no-harm guard: the sample reader's rankings are invented, so real accuracy needs real reading history)
- [ ] R4. AI tagging, taste summaries and description embeddings (needs Supabase for a server function)
- [ ] R5. Collaborative filtering: "readers like you loved…" (needs real users)

### Phase 4: Book clubs (Fable-style)
- [x] Demo-mode book clubs: Clubs tab, start a club (name, first book, weekly page-range schedule, invite code), join with a code, club home, spoiler-safe discussion by checkpoint, threads with likes, live catch-ups (video link or place) with RSVP and add-to-calendar
- [ ] Supabase version: tables `clubs`, `club_members` (role), `club_progress` (reached checkpoint), `club_checkpoints`, `club_posts` (parent_id for replies), `post_likes`, `club_meetings`, `meeting_rsvps`; RLS so only members can read a club; invite codes resolved by a server function
- [ ] Display names and avatars on profiles (needed for clubs with real people)
- [ ] Push notifications: new posts in unlocked checkpoints, catch-up reminders (1 day and 1 hour before)
- [ ] Next book for a club (vote on candidates, using recommendations), past books
- [ ] Moderation: report a post, owner removes members
- [ ] Later: public clubs you can discover; in-app video (decided against for now: link out to Zoom/Meet/FaceTime)

## Recommendation engine

### Goals
- Suggest what to read next, with a **reason** for every suggestion.
- Show a **predicted score for you** on any book.
- Work for a single user from day one, with no other users to learn from, and improve as users arrive.
- Run in demo mode, so it can be tested against the sample reader's taste.

### Signals we already collect

| Signal | What it tells us | Level |
|---|---|---|
| Bucket (liked / fine / disliked) | How you felt, comparable across genres | Across genres |
| Position in a genre list | How a book compares to others you read in that genre | Within genre |
| Raw comparisons | Direct "A beat B" preferences: the best learning signal | Within genre |
| "What made it work?" chips | *Why* you liked or disliked it | Within genre |
| Shelves | Want to Read = intent; Reading = current interest | Both |
| Books per genre | How much you read each genre | Across genres |
| Book metadata | Subjects, authors, year, length, description | Book features |

Recommendations use positions and comparisons rather than raw scores, so they
aren't distorted by how scores are drawn in small lists.

### How it works: candidates → scoring → selection

**1. Candidates: find about 200 unread books worth considering**
- **From your taste:** take the subjects that run through your top-ranked books in each genre (e.g. "hard science fiction" from *Project Hail Mary* and *The Martian*) and query Open Library for the best-rated books with those subjects. Tested November 2026: subject search sorted by rating works, including narrow subjects.
- **Authors you loved:** their other books.
- **Genre staples:** the best-rated books in your favorite genres.
- **Later:** books that readers similar to you loved (R5) and nearest neighbors by description embedding (R4).
- **Filters:** already in your library, dismissed before, derivative titles (summaries, study guides), too few ratings to trust, and later volumes of a series when you haven't read the first.
- Candidates are saved into the shared `books` catalog, which grows it for everyone.

**2. Scoring: a predicted 0–10 score for each candidate, in its genre**
```
predicted = genre baseline + taste adjustment + small quality nudge
```
- **Genre baseline:** your typical outcome in that genre, from your bucket mix ("you liked 80% of your fantasy"), pulled toward your overall average when you've read few books there.
- **Taste adjustment:** how much the candidate resembles your top-ranked books in that genre, minus how much it resembles your bottom-ranked ones.
  - v1: overlapping subjects and authors.
  - v2: description embeddings.
  - v3: weights learned from your comparisons. Each "A beat B" teaches which features win for you (a Bradley-Terry model).
- **Quality nudge:** the community rating, as a Bayesian average so books with few ratings aren't over-trusted. Kept small, so popularity doesn't drown out taste.
- **Confidence:** low when the genre has few ranked books; shown like provisional scores ("~8.4").

**3. Selection: build the list you see**
- Mostly the highest predicted scores, with diversity rules: at most 2 per author, genres mixed in proportion to how much you read them, and series started from book 1.
- One **stretch pick**: a strong prediction in a genre you rarely read.
- **Explanations:** "Because you loved *Project Hail Mary* and *The Martian*" (your most similar top-ranked books), or "You often choose *Ideas* for sci-fi" (from your chips).

### Screens
- **For You** tab with rows: *Top picks*, *More [genre] like [your #1]*, and a *Stretch pick*.
- **Book page:** "Predicted for you: 8.4", with the reason.
- **On every recommendation:** *Want to Read*, *Already read* (goes straight to ranking), and *Not interested* (optional reason: not my genre / not this author / not this book).

### Measuring whether it works
- **Our built-in advantage:** when you rank a book we recommended, we learn its real score and can compare it with our prediction. Track the average error and whether an "8" really means 8.
- **Offline test:** hide some of a reader's ranked books, predict them from the rest, and check the predicted order against the real one. This runs on the demo data, so the engine can be tested before any users exist.
- Also track how often recommendations are added to Want to Read and how often they're dismissed.

### Where it runs
- **R1–R3: on the device, in TypeScript.** Pure, testable functions like the ranking engine, plus Open Library calls. Libraries are small (hundreds of books), so the computing is trivial. Works in demo mode.
- **R4–R5: on the server** (Supabase Edge Functions + `pgvector`), once embeddings, AI calls (an API key can't live in the app) and other users' data are involved. Recommendations get precomputed in the background.

### Data model additions
```sql
recommendation_feedback (user_id, book_id, action: want_to_read | already_read | dismissed,
                         reason text, predicted_score numeric(3,1), created_at)
book_embeddings         (book_id, model, embedding vector)          -- R4
```

### AI's role (R4)
- **Tag books** with a controlled vocabulary (subgenre, pace, tone, themes) from their descriptions, once per book and shared by everyone. This fixes noisy Open Library subjects (e.g. Stephen King's *Full Dark, No Stars* is tagged "cozy mystery").
- **Write taste summaries:** "In sci-fi you love problem-solving and big ideas; you're lukewarm on romance-led fantasy."
- **Polish explanations** for a short list of top candidates.
- Cost: a few cents per few hundred books with a small model.

### Known pitfalls
- **Noisy subjects:** a few wrong subjects shouldn't move a prediction much; AI tagging (R4) is the real fix.
- **Series:** Open Library doesn't mark series reliably (*Death's End*, book 3, ranks above book 1). Use title patterns at first.
- **Popularity bias:** sorting by reading counts returns Harry Potter for everything, so sort by rating and keep the popularity term small.
- **Too little data:** one loved book shouldn't define a whole genre. Shrink predictions toward the baseline until there are several ranked books.

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
