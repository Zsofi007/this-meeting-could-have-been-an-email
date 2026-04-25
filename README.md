# this-meeting-could-have-been-an-email

Portfolio-quality realtime chat with room links, built with **React + TypeScript + Vite**, **Tailwind**, and **Supabase** (Auth, Realtime, Postgres).

## Local development
- Install deps: `npm install`
- Start dev server: `npm run dev`

## Supabase setup (required)
1. Create a Supabase project.
2. Enable **Google** provider in **Auth → Providers** and set your OAuth credentials.
3. Add redirect URLs for local dev and Vercel:
   - Local: `http://localhost:5173`
   - Prod: your Vercel domain (and optionally `*.vercel.app`)
4. Create the database schema + RLS policies (we’ll keep the SQL in `supabase/schema.sql`).

## Environment variables
Copy `.env.example` to `.env.local` and fill in:
- `VITE_SUPABASE_URL`
- `VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never commit real keys.

## Vercel deployment
- Add the environment variables from `.env.example` in Vercel.
- In Supabase Auth settings, include your Vercel domain in allowed redirect URLs.
