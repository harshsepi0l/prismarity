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

## Twitch login (server-side OAuth)

Authentication is fully server-side: the client secret and tokens never reach
the browser. Tokens are encrypted at rest (AES-256-GCM) and the session cookie
holds only a signed user id.

### 1. Register a Twitch application

1. Go to the [Twitch Developer Console](https://dev.twitch.tv/console/apps) and
   click **Register Your Application**.
2. **Name:** anything (e.g. `Prismarity (dev)`).
3. **OAuth Redirect URLs:** add exactly
   `http://localhost:3000/api/auth/twitch/callback`
4. **Category:** Website Integration. Create, then open the app and copy the
   **Client ID** and generate a **Client Secret**.

### 2. Fill in `.env.local`

```bash
TWITCH_CLIENT_ID=<from the console>
TWITCH_CLIENT_SECRET=<from the console>
TWITCH_REDIRECT_URI=http://localhost:3000/api/auth/twitch/callback

SESSION_SECRET=$(openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY=$(openssl rand -base64 32)   # must decode to 32 bytes
```

> The redirect URI in `.env.local` must match the one registered in the Twitch
> console **exactly**.

### 3. Log in

Start the dev server and click **Log in with Twitch** in the top bar. After
authorizing you'll see "Connected as {name}" and your derived role (`creator`
for your own channel).

> **Note:** session/state cookies are set with `Secure`, so the cookie path
> works over HTTPS (the production target). For local testing of the full login
> round-trip, use an HTTPS tunnel; plain `http://localhost` won't persist the
> cookie in all browsers.

Encrypted tokens are stored locally in `.data/auth.json` (gitignored) for now —
**TODO: move to a real database.**

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
