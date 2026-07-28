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
the app immediately; connecting your own Twitch, Kick, or YouTube accounts requires the OAuth
setup below.

## How authentication works

Auth is **fully server-side** — client secrets and access tokens never reach the browser:

- OAuth uses PKCE; the callback exchanges the code on the server.
- **Stateless sessions** — the whole user record (id, platform connections, and their
  access/refresh tokens) lives *inside* the session cookie, encrypted with **AES-256-GCM**
  (`lib/auth/session.ts` / `lib/auth/crypto.ts`, keyed by `TOKEN_ENCRYPTION_KEY`). GCM makes the
  cookie opaque and tamper-proof to the client.
- There is **no server-side store** — nothing is written to disk, so the app runs on any
  serverless host (e.g. Vercel). Cookies cap at ~4KB, which fits a couple of platform
  connections.

## Connecting accounts

Config is **env-driven** — no client IDs ship in source. Register a developer app per platform,
put its credentials in your env, then connect in-app via **Settings → Accounts**.

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

### YouTube (Google)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a project and enable
   the **YouTube Data API v3**.
2. Under **APIs & Services → Credentials**, create an **OAuth 2.0 Client ID** of type
   **Web application**.
3. **Authorized redirect URI:** `http://localhost:3000/api/auth/youtube/callback` (exact match).
4. Copy the **Client ID** and **Client Secret** — Google requires the secret at token exchange
   even with PKCE. Scope requested is `youtube.readonly` (live status + subscriber count).

Then run the app, open **Settings → Accounts** for each platform, and complete the popup. You'll
see "Connected as {name}".

> The redirect URL is **derived from `NEXT_PUBLIC_BASE_URL`** (`<base>/api/auth/<platform>/callback`).
> Whatever you register in the console must match that exactly — same scheme, host, port, and
> path, no trailing slash.

## Environment variables

Copy `.env.local.example` → `.env.local` and fill these in. Server-side only unless prefixed
`NEXT_PUBLIC_`.

| Variable | Required | Description |
|----------|----------|-------------|
| `TWITCH_CLIENT_ID` | for Twitch | Your Twitch app Client ID. No shared default is shipped. |
| `TWITCH_CLIENT_SECRET` | recommended | Your Twitch app Client Secret — needed for reliable token refresh. |
| `KICK_CLIENT_ID` | for Kick | Your Kick app Client ID. No shared default is shipped. |
| `KICK_CLIENT_SECRET` | for Kick login | Your Kick app Client Secret. |
| `YOUTUBE_CLIENT_ID` | for YouTube | Your Google OAuth "Web application" Client ID. |
| `YOUTUBE_CLIENT_SECRET` | for YouTube login | Your Google OAuth Client Secret (required at token exchange even with PKCE). |
| `TOKEN_ENCRYPTION_KEY` | yes | AES-256-GCM key that encrypts the whole session cookie. Generate: `openssl rand -base64 32` (must decode to 32 bytes). **Keep it stable** — changing it invalidates every existing session. |
| `NEXT_PUBLIC_BASE_URL` | optional | Public origin, bare (e.g. `https://your-app.vercel.app`). On Vercel the redirect URI auto-resolves from the request host; set this only to pin a custom domain. It must match the callback URLs you registered. |

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
| `/chat` | Unified chat — real Twitch, Kick, **and** YouTube chat, unified read feed + per-platform send, split view, About panel, emote/command search. |
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
    chat/                    # Chat screen + per-platform chat hooks + components
    loyalty/                 # Loyalty screen
    vods/                    # VODs screen
  api/
    auth/                    # OAuth login/callback/disconnect/logout ([platform] routes)
    twitch/                  # Twitch data (chat, stats, clips, badges, shared-chat, …)
    kick/                    # Kick data (chat, stats, badges, leaderboard, resolve)
    youtube/                 # YouTube data (live status, chat, subscriber count)
    emotes/  search/  settings/  beacon/
lib/
  auth/                      # OAuth, crypto (AES-256-GCM), stateless session cookie
  twitch/  kick/  youtube/   # Platform API clients
  settings/                  # Env-driven config resolver (client ids, base URL)
public/                      # Static assets
.env.local.example           # Env var template (committed)
```

## Design system

Chakra UI is configured in `app/theme.ts` (`createSystem` + `defineConfig`) with semantic design
tokens (`bg`, `panel`, `raised`, `line`, `text`, `muted`, `faint`, plus `twitch`/`kick`/`youtube`
and an amber `accent`) that drive light/dark/system theming. The whole app — headings, body, chat
feed, and the numeric/label "mono" slot — uses one rounded family (`--font-rounded`, falling back
to the native `ui-rounded` system font). `app/provider.tsx` wraps the app in `ChakraProvider`.

## Deployment

Sessions are **stateless** (the encrypted cookie is the only store), so there's no database or
writable filesystem to provision — deploy to **Vercel** (or any Next.js host). Set the env vars
above as project environment variables, and register your deployed callback URLs
(`https://<host>/api/auth/{twitch,kick,youtube}/callback`) in each platform console.
`NEXT_PUBLIC_BASE_URL` is optional — the redirect URI auto-resolves from the request host — set it
only to pin a custom domain.
