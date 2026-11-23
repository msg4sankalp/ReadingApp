# Flip

*Rank what you read.* (The repository keeps its working name, ReadingApp.)

A mobile reading app: track your books, rank them Beli-style with head-to-head
comparisons within each genre, and (eventually) get recommendations based on
your taste. See **[PLAN.md](PLAN.md)** for the product design and roadmap.

Built with [Expo](https://expo.dev) (React Native + TypeScript), with
[Supabase](https://supabase.com) as the backend and [Open Library](https://openlibrary.org/developers/api)
for book data.

## Project layout

```
src/app/                  Screens (Expo Router: every file is a route)
  _layout.tsx             Root: fonts, data cache, auth session, signed-in/out route protection
  sign-in.tsx             Email + password sign-in and sign-up
  (tabs)/index.tsx        Home: continue reading, books to rank, your genres, picked for you
  (tabs)/library.tsx      Library: Reading, Want to Read, and Read (your rankings, by genre)
  (tabs)/search.tsx       Search (Open Library)
  (tabs)/profile.tsx      Profile and stats; demo reset
  book/[workId].tsx       Book page: details, shelf buttons, dates, score
  rank/[workId].tsx       Ranking flow: genre → feeling → head-to-head → score + reasons
src/components/           Shared UI (buttons, text fields, book rows and covers)
src/lib/ranking/          Ranking engine: binary-insertion sessions and score formula
src/lib/catalog/          Ranking categories (genres), "what made it work?" chips,
                          and Open Library subject → category mapping
src/lib/books/            Open Library client
src/lib/supabase/         Supabase client
src/lib/auth/             Sign-in session context
src/lib/library/          Library data: backend interface, Supabase backend, data hooks
src/lib/demo/             Demo mode: on-device backend and sample library
supabase/migrations/      Database schema, Row Level Security and ranking functions
supabase/seed.sql         Categories and chips (must match src/lib/catalog/categories.ts)
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the tests:

   ```bash
   npm test
   ```

3. Start the app, then scan the QR code with the **Expo Go** app on your phone:

   ```bash
   npx expo start
   ```

## Demo mode

With no Supabase project configured (or with `EXPO_PUBLIC_DEMO_MODE=1` in `.env`),
the app runs in **demo mode**: no sign-in, data stays on the device, and it
starts with a sample library of about 30 real books already ranked across
several genres (`src/lib/demo/seedData.ts`). Search still uses Open Library, so
you can add any book. Profile → **Reset demo data** restores the sample library.

## Setting up the database (Supabase)

The app needs a Supabase project to sign in.

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project's **SQL Editor**, run these files in order:
   1. `supabase/migrations/20261123000000_initial_schema.sql`
   2. `supabase/migrations/20261123000001_explicit_grants.sql`
   3. `supabase/seed.sql`
3. For development, turn off **Authentication → Sign In / Providers → Email →
   Confirm email**, so new accounts can sign in straight away.
4. Copy `.env.example` to `.env` and fill in the project URL and the
   **publishable** key (Project Settings → API Keys). `.env` is git-ignored.
   The publishable key is designed to be public; never put a **secret** key or
   the database password in the app.

Later we'll switch to the [Supabase CLI](https://supabase.com/docs/guides/cli),
so migrations are applied with a command instead of copy-paste.

## Useful commands

| Command | What it does |
|---|---|
| `npm test` | Run the Jest tests |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npx expo start` | Start the dev server |
| `npx expo install <pkg>` | Add a package at a version compatible with this Expo SDK |
