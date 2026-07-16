# Development

Setup, architecture, and deployment notes for Prismarity. For the product overview, see the
[README](../README.md).

## Prerequisites

- **Node.js 22.x** (see `engines` in `package.json`)
- **npm**

## Local setup

```bash
git clone <your-fork-url>
cd prismarity
npm install
cp .env.local.example .env.local   # then fill in the values (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/chat`. You can browse
the app immediately; connecting your own Twitch/Kick accounts requires the OAuth setup below.

## How authentication works

Auth is **fully server-side** — client secrets and access tokens never reach the browser:

- OAuth uses PKCE; the callback exchanges the code on the server.
- Access/refresh tokens are encrypted at rest with **AES-256-GCM** (`lib/auth/crypto.ts`) before
  being persisted.
- The session cookie holds only a **signed user id** (`lib/auth/session.ts`), not any token.
- Persistence is a small JSON store under `.data/` (gitignored). It's fine for local/single
  instance; production needs a host with a persistent, writable filesystem (see
  [Deployment](#deployment)).

## Connecting accounts

Prismarity ships with a shared client ID for read-only bits, but to connect *your* accounts you
register a developer app per platform, then connect in-app via **Settings → Connect**.

### Twitch

1. Open the [Twitch Developer Console](https://dev.twitch.tv/console/apps) → **Register Your
   Application**.
2. **OAuth Redirect URL:** `http://localhost:3000/api/auth/twitch/callback` (exact match).
3. **Category:** Website Integration. Create the app, then copy the **Client ID** and generate a
   **Client Secret**.

### Kick

1. In Kick, open your account's **Developer / API** settings and create an application.
2. **Redirect URL:** `http://localhost:3000/api/auth/kick/callback` (exact match).
3. Copy the **Client ID** and **Client Secret**.

Then run the app, open **Settings → Connect** for each platform, and complete the popup. You'll
see "Connected as {name}".

> The redirect URL is **derived from `NEXT_PUBLIC_BASE_URL`** (`<base>/api/auth/<platform>/callback`).
> Whatever you register in the console must match that exactly — same scheme, host, port, and
> path, no trailing slash.

## Environment variables

Copy `.env.local.example` → `.env.local` and fill these in. Server-side only unless prefixed
`NEXT_PUBLIC_`.

| Variable | Required | Description |
|----------|----------|-------------|
| `TWITCH_CLIENT_ID` | optional | Your Twitch app Client ID. Falls back to a shared default if unset. |
| `TWITCH_CLIENT_SECRET` | for Twitch login | Your Twitch app Client Secret. |
| `KICK_CLIENT_ID` | optional | Your Kick app Client ID. Falls back to a shared default if unset. |
| `KICK_CLIENT_SECRET` | for Kick login | Your Kick app Client Secret. |
| `NEXT_PUBLIC_BASE_URL` | yes | Public origin, bare (e.g. `http://localhost:3000`). The OAuth redirect URI is built from this — it must match what you registered. |
| `SESSION_SECRET` | yes | Signs the session cookie. Generate: `openssl rand -hex 32`. |
| `TOKEN_ENCRYPTION_KEY` | yes | AES-256-GCM key for token encryption at rest. Generate: `openssl rand -base64 32` (must decode to 32 bytes). **Keep it stable** — changing it makes previously stored tokens undecryptable. |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server (port 3000). |
| `npm run build` | Production build. |
| `npm run start` | Start the production server. |
| `npm run lint` | Run ESLint. |

## Routes

| Path | Description |
|------|-------------|
| `/` | Redirects to `/chat`. |
| `/chat` | Unified chat — real Twitch **and** Kick chat, unified read feed + per-platform send, split view, About panel, emote/command search. |
| `/loyalty` | Cross-platform loyalty leaderboard. |
| `/vods` | VOD library with platform filters and expiry warnings. |

## Project structure

```
app/
  layout.tsx                 # Root <html>, fonts, ChakraProvider
  theme.ts                   # Chakra system: design tokens, fonts, global CSS
  provider.tsx               # ChakraProvider client wrapper
  page.tsx                   # Redirects / -> /chat
  (dashboard)/               # Route group sharing the TopBar + NavRail shell
    layout.tsx               # Persistent shell; loads the current user
    _ctx/                    # Client context providers (session, chat, stats, layout, …)
    components/              # Shell + shared UI (TopBar, NavRail, PlatformIcon, ui)
    chat/                    # Chat screen + hooks (useTwitchChat, useKickChat) + components
    loyalty/                 # Loyalty screen
    vods/                    # VODs screen
  api/
    auth/                    # OAuth login/callback/disconnect/logout ([platform] routes)
    twitch/                  # Twitch data (chat, stats, clips, badges, shared-chat, …)
    kick/                    # Kick data (chat, stats, badges, leaderboard, resolve)
    emotes/  search/  settings/  beacon/
lib/
  auth/                      # OAuth, crypto (AES-256-GCM), session, JSON store
  twitch/  kick/             # Platform API clients
  settings/                  # Settings store (client ids/secrets, base URL)
public/                      # Static assets
.env.local.example           # Env var template (committed)
```

## Design system

Chakra UI is configured in `app/theme.ts` (`createSystem` + `defineConfig`) with the design
tokens (`bg`, `panel`, `raised`, `line`, `text`, `muted`, `faint`, plus `twitch`/`youtube`/`kick`)
and three fonts (Space Grotesk headings, IBM Plex Sans body, IBM Plex Mono for numbers/labels).
`app/provider.tsx` wraps the app in `ChakraProvider`.

## Deployment

The app persists auth/settings to the local filesystem (`.data/`), so it needs a host with a
**persistent, writable filesystem** — e.g. **Azure App Service**. Serverless/static hosts with a
read-only or ephemeral filesystem (such as Azure Static Web Apps' managed functions) will fail on
the first write during login. Point `NEXT_PUBLIC_BASE_URL` at your deployed origin, set the same
env vars as runtime application settings, and register your deployed callback URLs
(`https://<host>/api/auth/{twitch,kick}/callback`) in each platform console.
