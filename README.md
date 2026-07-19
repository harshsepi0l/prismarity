# Prismarity

**One control room for every stream.**

Prismarity is a unified broadcast control room for multi-platform streamers. Go live on
**Twitch and Kick** at once and run both from a single dark, focused dashboard — one chat, one
set of stats, one place to keep an eye on everything. It's built around a "control room" design
language where each platform's color is used as data (Twitch purple, Kick green).

## Features

- **Unified chat** — read every platform's chat in one feed, and send to Twitch and Kick
  independently, choosing exactly where each message lands.
- **Co-stream aware** — detects shared-chat / collaboration sessions and merges participants so
  a joint stream reads as one conversation.
- **Split view** — flip to side-by-side per-platform columns whenever you want them separated.
- **Channel About panel** — bios, socials, and channel details without leaving chat.
- **Emote-native composer** — 7TV, BTTV, and FFZ emotes with inline `:shortcode` search and
  `@mentions`.
- **Live stats** — viewers, uptime, verified status, and leaderboards across platforms.
- **Loyalty & VODs** — a cross-platform loyalty leaderboard and a VOD library with expiry
  warnings.
- **Secure by default** — authentication is fully server-side; your access tokens are encrypted
  at rest and never reach the browser.

## Screenshots

> _Add screenshots here_ — e.g. `docs/images/chat.png`, `docs/images/split-view.png`.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Chakra UI 3.

## Quick start

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** — it opens straight into `/chat`.

Connecting your Twitch and Kick accounts takes a couple of minutes of one-time setup
(registering a developer app on each platform). The full walkthrough, environment variables, and
project layout live in **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**.

## Contributing

Local setup, architecture, and deployment notes are all in
**[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**.
