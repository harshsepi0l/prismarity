# prismarity

A unified broadcast control room for streamers — Next.js (App Router) +
TypeScript + Chakra UI. Dark "control room" design language with platform
colors used as data (Twitch purple, YouTube red, Kick green).

## Requirements

- Node.js 18+
- npm 9+

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and fill in values
cp .env.local.example .env.local

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/chat`.

## Routes

| Path       | Description                                                        |
|------------|--------------------------------------------------------------------|
| `/`        | Redirects to `/chat`                                               |
| `/chat`    | Unified chat. **Real** anonymous Twitch chat via WebSocket; YouTube/Kick are demo messages. Creator/Viewer modes (persisted). |
| `/loyalty` | Cross-platform loyalty leaderboard (mock data)                     |
| `/vods`    | VOD library with platform filters and expiry warnings (mock data)  |

## Scripts

| Command         | Description                  |
|-----------------|------------------------------|
| `npm run dev`   | Start dev server (port 3000) |
| `npm run build` | Production build             |
| `npm run start` | Start production server      |
| `npm run lint`  | Run ESLint                   |

## Design system

Chakra UI is configured in `app/theme.ts` (`createSystem` + `defineConfig`)
with the design tokens (`bg`, `panel`, `raised`, `line`, `text`, `muted`,
`faint`, plus `twitch`/`youtube`/`kick`) and the three fonts (Space Grotesk
headings, IBM Plex Sans body, IBM Plex Mono numbers/labels). `app/provider.tsx`
wraps the app in `ChakraProvider`.

## Project structure

```
app/
  layout.tsx              # Root <html>, next/font wiring, ChakraProvider
  theme.ts                # Chakra system: design tokens, fonts, global CSS
  provider.tsx            # ChakraProvider client wrapper
  page.tsx                # Redirects / -> /chat
  (dashboard)/            # Route group sharing the TopBar + NavRail shell
    layout.tsx            # Persistent shell (TopBar, NavRail)
    components/           # Shell components (TopBar, NavRail, Logo, ui)
    chat/                 # Chat screen + hooks (useTwitchChat, useMode)
    loyalty/page.tsx      # Loyalty screen
    vods/page.tsx         # VODs screen
public/                   # Static assets
.env.local.example        # Env var template (committed)
next.config.ts            # Next.js config (optimizePackageImports)
tsconfig.json             # TypeScript strict mode
```
