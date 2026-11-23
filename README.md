# ReadingApp

A mobile reading app: track your books, rank them Beli-style with head-to-head
comparisons within each genre, and (eventually) get recommendations based on
your taste. See **[PLAN.md](PLAN.md)** for the product design and roadmap.

Built with [Expo](https://expo.dev) (React Native + TypeScript), with
[Supabase](https://supabase.com) as the backend and [Open Library](https://openlibrary.org/developers/api)
for book data.

## Project layout

```
src/app/                  Screens (Expo Router: every file is a route).
                          Still the Expo starter screens; replaced in Phase 1.
src/lib/ranking/          Ranking engine: binary-insertion sessions and score formula
src/lib/catalog/          Ranking categories (genres), "what made it work?" chips,
                          and Open Library subject → category mapping
src/lib/books/            Open Library client
src/lib/supabase/         Supabase client
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

## Setting up the database (Supabase)

The app runs without a database for now. You'll need one once we build sign-in
and rankings.

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project's **SQL Editor**, run the contents of
   `supabase/migrations/20261123000000_initial_schema.sql`, then `supabase/seed.sql`.
3. Copy `.env.example` to `.env` and fill in the project URL and anon key from the
   project's API settings. `.env` is git-ignored. Never put the `service_role` key in the app.

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
