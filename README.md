# this-meeting-could-have-been-an-email

Inbox-first, room-based chat — share a link, keep decisions out of meetings.

## Overview

This app is a small “team inbox” for conversations that would otherwise become calendar invites.

- **What it does**: Create a room, share the URL, and chat in real time — with presence and reactions.
- **Who it’s for**: Small teams / collaborators who want lightweight, link-based threads.
- **Core idea**: **“Inbox, not meetings.”** Rooms are shareable links; access is gated by membership.

## Features

- **Room links**: Rooms are addressable by URL (`/room/:roomId`) and easy to share.
- **Real-time messaging**: New messages and edits stream live via Supabase Realtime (`postgres_changes`).
- **Optimistic UI**: Messages appear instantly with client IDs and reconcile when persisted.
- **Presence**: Online users are tracked via Realtime Presence and shown in the People panel.
- **Reactions**: Emoji reactions with live updates.
- **Join requests**: Rooms can require approval — request access, approve/reject in-app.
- **Quality-of-life UX**:
  - Copy room link
  - Rename rooms (via RPC)
  - “Leave room” removes membership and hides it from your dashboard until you post again
  - Archived/inactive room indicator
- **Security-first defaults**:
  - Row Level Security (RLS) on all tables
  - Membership-checked reads/writes
  - Immutable message identity fields enforced in the DB

## Tech Stack

### Frontend
- **React 19** + **TypeScript**
- **Vite** (build/dev)
- **React Router** (routing)
- **Tailwind CSS** (UI)
- **lucide-react** + **react-icons** (icons)
- **framer-motion** (micro-interactions for reactions)

### Backend
- **Supabase**
  - **Auth** (Google OAuth + email/password)
  - **Postgres**
  - **Realtime**
  - **RLS policies + RPCs** for privileged actions

### Deployment
- Works well on **Vercel** (static frontend + Supabase backend)

## Architecture

The codebase is intentionally split by concern:

- **`src/pages/`**: Route-level pages (`HomePage`, `RoomPage`)
- **`src/features/`**: Feature UIs (chat, auth, dashboard)
- **`src/hooks/`**: Custom hooks that own data-fetching and Realtime subscriptions
- **`src/services/`**: Supabase access layer (typed DB shapes + RPC wrappers)
- **`src/lib/`**: Small pure helpers (labels, formatting)

Design principles used throughout:
- **Feature boundaries**: UI components stay inside `features/*` unless they’re truly shared.
- **Hooks for data orchestration**: Subscriptions, optimistic updates, and derived state live in hooks.
- **Services for IO**: Supabase queries and RPC calls are centralized in `services/*`.

## How It Works

### Rooms + access model
- A room is identified by a stable text ID (`/room/:roomId`).
- Rooms have members (`room_members`). If you aren’t a member:
  - you can **request access** (`request_join_room` RPC)
  - members can **approve/reject** (`decide_room_join_request` RPC)
- Leaving a room is done via an RPC (`leave_room`) which removes membership and clears prior join decisions.

### Real-time messaging flow
- Initial load fetches recent messages for the room.
- A Realtime channel subscribes to message `INSERT` and `UPDATE` events filtered by room.
- The UI keeps an **optimistic message map**:
  - sends insert with `client_id`
  - reconciles “UI message” → “DB message” when the server responds or when Realtime delivers the row

### Presence
- Presence uses a Realtime presence channel keyed by user ID.
- The People panel merges:
  - known “members” (derived from recent messages)
  - currently online presence state

### Reactions
- Reactions are stored in `message_reactions` keyed by `(message_id, user_id, emoji)`.
- UI streams inserts/deletes via Realtime and summarizes by emoji for each message.
- The emoji picker is **code-split** to keep the initial bundle fast.

## Getting Started

### Prerequisites
- **Node.js** (recommended: current LTS)
- A **Supabase project**

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
VITE_SUPABASE_URL=
VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Notes:
- The publishable key is the Supabase **anon/publishable** key intended for client-side use.
- Don’t commit real credentials.

### 3) Supabase setup

1. Create a Supabase project.
2. In **Auth → Providers**, enable **Google** (optional but recommended for the intended UX).
3. Add redirect URLs:
   - Local: `http://localhost:5173`
   - Production: your Vercel domain (and optionally `*.vercel.app`)
4. Apply the database schema:
   - Run `supabase/schema.sql` in the Supabase SQL editor (or convert it into migrations if you prefer).

What the schema includes:
- Tables: `rooms`, `messages`, `message_reactions`, `room_members`, `room_join_requests`, `user_profiles`, `user_room_dismissals`
- RLS enabled and policies applied
- RPCs used by the frontend (see “Security” section)
- Realtime publication setup for the relevant tables

### 4) Run the app

```bash
npm run dev
```

Open `http://localhost:5173`.

## Deployment (Vercel)

1. Create a new Vercel project from this repo.
2. Add env vars from `.env.example` to Vercel’s project settings.
3. In Supabase Auth settings, ensure your production URL is in **Allowed Redirect URLs**.
4. Deploy.

## Security

This app is designed around **database-enforced access control**.

- **Row Level Security** is enabled on all tables.
- **Membership-gated reads/writes**:
  - messages can only be read/inserted by room members
  - reactions require membership in the message’s room
  - room members / join requests are not writable directly from the client (RPCs only)
- **Privileged operations via RPCs**:
  - `request_join_room`
  - `decide_room_join_request`
  - `leave_room`
  - `get_my_rooms_with_preview`
  - `set_room_name`
  - `set_my_username`
- **DB integrity hardening**:
  - message identity fields are enforced as immutable on update (prevents cross-room mutation attacks)

## Future Improvements

Realistic next steps that would improve production readiness:

- **Better membership source**: derive members from `room_members` (with profiles) instead of “recent message authors”.
- **Typing indicator**: presence-based typing events for a more “chat-like” feel.
- **Pagination / infinite scroll**: message history loading beyond the latest N messages.
- **Moderation tools**: per-room roles + owner-only join approvals + member removal.
- **Observability**: error boundary + structured logging + Sentry integration.
