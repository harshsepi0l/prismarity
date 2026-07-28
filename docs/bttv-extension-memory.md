# BetterTTV (BTTV) Extension — Feature Catalog & Reimplementation Notes

Source analyzed: `github.com/night/BetterTTV` (shallow clone, current `main`, v7.7.25), full `src/` tree
walked file-by-file (56 modules, ~31.6k lines across 415 files).

## License constraint (read first)

BTTV is **source-available**, not open source (NightDev custom license — see `LICENSE` in the repo).
Redistribution and for-profit reuse of their code are forbidden. Everything below is written from
**understanding their behavior and techniques**, not from their source. **No BTTV code, CSS, or markup
is copied anywhere in this document or should be copied into Prismarity.** Where pseudocode appears, it
is original, written to illustrate a technique in the abstract (event names, selectors, and exact
algorithms are paraphrased, not transcribed).

Two things are safe to actually use because they are public, documented, third-party services, not BTTV
source code:
- **BTTV's own public API** (`api.betterttv.net/3/...`) — documented at `betterttv.com/developers/api`,
  used read-only (global/channel emotes, badges, cached user info). This is a normal public API, like
  any other; consuming it isn't "copying the extension."
- **7TV's public API** (`7tv.io/v3/...` + `events.7tv.io` SSE) and **FrankerFaceZ's API** — both are
  separate projects with their own public, unauthenticated emote endpoints that BTTV itself merely
  *calls*, alongside its own emotes. Nothing about consuming these belongs to BTTV.

Directly copying BTTV's *own* emote catalog/brand into a competing product would still be questionable
(their emotes are their content); the useful thing to reuse is the **pattern** — "aggregate emotes from
BTTV + FFZ + 7TV public APIs into one picker" — which the existing project memory already flags as the
intended path (`bttv-integration-blocked.md`: reimplement UX ourselves against public emote APIs).

## Architecture in brief

BTTV is a single injected script (`betterttv.js`, built with Vite) loaded as a browser-extension content
script (or a Tampermonkey userscript in dev) on `twitch.tv`, `youtube.com`, and `clips.twitch.tv`. There
is no server-rendered anything — it is 100% client-side DOM/React manipulation layered on top of the
host site.

**Bootstrap** (`src/index.js`): guards against double-injection, loads i18n, loads global CSS, then
`import.meta.glob`-imports every `src/modules/**/index.{js,jsx}` file. Each module's `index.js` is a
self-invoking singleton (usually `export default new SomeModule()` or gated by
`loadModuleForPlatforms([PlatformTypes.TWITCH, () => new X()], [PlatformTypes.YOUTUBE, () => new Y()])`)
that wires itself into shared event buses in its constructor. There's no central registry beyond "the
file was imported."

**Detecting page structure — the "watcher" system** (`src/watcher.js`, `src/observers/dom.js`,
`src/observers/history.js`, `src/watchers/*.js`):
- A single global `MutationObserver` (`observers/dom.js`) watches `document` for added/removed nodes.
  Modules register interest via CSS-like selectors (`#id`, `.class`, `[data-test-selector="x"]`); the
  observer indexes those selector fragments internally so a single observer callback can dispatch to many
  listeners without each one re-scanning the DOM. Listeners can also ask to be re-armed as an *attribute*
  observer on the matched node (used for things like the mod-card open/close state).
- `observers/history.js` monkey-patches `history.pushState`/`replaceState` and listens to `popstate` to
  detect Twitch's client-side route changes (Twitch is a SPA; there's no full page navigation).
- `src/watchers/routes.js` classifies the current path into named routes (chat, VOD, channel, directory,
  homepage, dashboard, embed) via regex, polls a small set of "is this ready" predicates
  (e.g. "does the chat room container exist and does `getCurrentChat()` resolve") until true, then emits
  semantic `load.chat` / `load.vod` / `load.player` / `load.channel` / `load.homepage` events on the
  shared `watcher` event bus. Every feature module subscribes to these instead of re-deriving "is chat
  ready" itself.
- `src/watchers/chat.js`, `clips.js`, `conversations.js`, `youtube.js` do the platform-specific plumbing
  (see next paragraph) and re-emit as `chat.message`, `youtube.message`, `clips.message`,
  `conversation.message`, etc.

**Reading Twitch's live React state — the core reverse-engineering trick** (`src/utils/twitch.js`,
~930 lines): Twitch's chat is a React app. React attaches an internal fiber/instance reference to every
DOM node it manages, keyed by an internal property name it randomizes per build
(`__reactFiber$<hash>` / `__reactInternalInstance$<hash>`). BTTV reads whichever key is present on a
node's own property list, then walks the fiber tree **up** (to find an ancestor component matching a
predicate, e.g. "the chat controller") or **down** (to find a descendant, e.g. "the message object for
this DOM row") with a depth cap. Once it has a component instance it can read its `props`/`state`
directly, or call `forceUpdate()` after mutating props to make React re-render with the new data. This
single technique underlies: getting the parsed chat-message object for a DOM row, finding the Apollo
GraphQL client (to fire authenticated GQL queries piggy-backing on the user's own Twitch session),
finding the video player instance (for volume/seek/theatre-mode control), finding the autocomplete
provider (to inject custom emote sets into it), and more.

**Intercepting the message pipeline**: rather than only reading the DOM after Twitch renders a message,
several modules **monkey-patch a method on the live chat-controller instance** — e.g. replacing
`messageHandlerAPI.handleMessage` with a wrapper that first emits a cancellable `chat.message.handler`
event (used to swallow "chat cleared", sub-notices, viewer-greetings, deleted-message notices before they
ever render), then calls through to Twitch's original handler. The same pattern patches
`chatConnectionAPI.sendMessage` on the way *out*, giving every module a chance to rewrite or block the
user's outgoing message (tab-completion substitution, anon-chat guard, emoji-shortcode expansion) before
it hits the wire.

**Rendering BTTV content without breaking the host page's styling** (`src/modules/shadow_dom/index.jsx`):
overlays that need real CSS isolation (emote menu, tooltips, settings modal, autocomplete popovers) are
mounted into a single closed **Shadow DOM** host element (a dynamically-named custom element, one per
page), with its own adopted stylesheet and a React root rendered via Mantine's `ThemeProvider`. The host
element is re-parented into `document.fullscreenElement` on fullscreen change so overlays keep working in
fullscreen player mode, and it's kept `display:none` until its stylesheet's `load` event fires, to avoid
a flash of unstyled giant content.

**Settings storage** (`src/settings.js`, `src/storage.js`): a flat key/value store persisted to
`localStorage` under a single JSON blob (`bttv_settings`), with a `cookies-js` fallback if localStorage
is unavailable. Many related booleans are packed into a single integer via **bitflags**
(`SettingIds.CHAT`, `.EMOTES`, `.USERNAMES`, `.AUTO_PLAY`, `.SIDEBAR`, `.CHANNEL_POINTS`, `.AUTO_CLAIM` —
see `EmoteTypeFlags`, `ChatFlags`, `UsernameFlags`, etc. in `constants.js`), stored as a
`[currentFlags, changedBitsMask]` tuple so a later version bump can add a new flag *on* by default without
silently re-enabling it for someone who had explicitly turned the whole group off. `Settings.upgrade()`
runs a small migration ladder keyed by `semver.lt(storedVersion, 'x.y.z')`. Every setting change fires a
generic `changed` event plus a specific `changed.<id>` event on an `EventEmitter`-derived `settings`
singleton; every module just subscribes to the ids it cares about.

**Cross-device settings sync — "Cloud Backup"** (`src/modules/cloud_backup/index.js`, Pro-only): a
version-numbered settings blob synced through BTTV's own account API
(`getExtensionSettings`/`updateExtensionSettings`), with the write path debounced (1s) and optimistic-
concurrency versioned (each write includes the version it expects to overwrite; a 409-style version
mismatch prompts the user to pick local-wins vs. server-wins). Real-time push of settings changes made on
*another* device arrives over BTTV's own WebSocket (see below) as a `settings_update` event.

**Real-time channel/emote push — BTTV's own WebSocket** (`src/socket-client.js`,
`wss://sockets.betterttv.net/ws`): a hand-rolled reconnecting WebSocket client (capped exponential
backoff with jitter) that authenticates with the user's OAuth access token, lets modules `joinChannel` /
`partChannel` a `provider:providerId` room, and dispatches typed events: `emote_create`/`update`/`delete`
(live channel-emote changes — announced in chat automatically), `lookup_user` (subscription/badge/effect
info for a chatter as they're seen), `new_subscriber`, `user_update`, `settings_update`, and an
interesting **session-lock** primitive: multiple open tabs/devices of the same logged-in user can each
*request* a named lock (e.g. `self_bot`); the server grants it to exactly one holder at a time and
notifies others when it's released, so only one tab replies to self-bot triggers even if the user has
chat open in three tabs. This is a clean pattern worth stealing at the *design* level for any
multi-tab-safe feature Prismarity adds later.

**Third-party emote provider integration**: BTTV's own emotes come from its API + this same WebSocket
push. FrankerFaceZ emotes are fetched through BTTV's *own* API as a passthrough
(`cached/frankerfacez/...` — BTTV proxies/caches FFZ so cross-origin/rate-limit concerns are handled
server-side). 7TV emotes are fetched **directly** from 7TV's own public API (`7tv.io/v3/...`) with a
Server-Sent-Events subscription (`events.7tv.io`, `reconnecting-eventsource` package) for live add/update/
remove pushes to the channel's emote set — BTTV does not proxy 7TV. Every provider implements the same
tiny interface (`AbstractEmotes`: `category`, `getEmotes()`, `getEligibleEmote(code)`,
`getEligibleEmoteById(id)`), which is exactly the shape Prismarity's own multi-provider emote picker
should copy (conceptually) if it aggregates BTTV + FFZ + 7TV public APIs.

**Message rendering pipeline** (`src/modules/chat/index.js`, `src/modules/emotes/emote.jsx`): for every
new chat line, BTTV walks the message's text/element child nodes, splits on spaces, and for each token
checks (in priority order across providers) whether it's an eligible emote *for this user in this
channel* (restriction callbacks handle sub-only/personal-emote gating), detects **emote modifiers**
— suffix/prefix tokens like `w!` (wide), `h!`/`v!` (flip), `z!` (zero-width overlay), `c!` (cursed —
random per-frame transform), `l!`/`r!` (rotate), `p!`/`s!` (party/shake animation), plus FFZ's own
`ffzW`/`ffzX`/`ffzY`/`ffzCursed` — and composes them onto the base emote as extra CSS classes. It also
recognizes a Steam lobby-join URL pattern and turns it into a clickable link, and (separately) computes a
per-user **readable username color**.

## Summary table

| Feature | Category | Platform | Prismarity Priority |
|---|---|---|---|
| Third-party emote aggregation (BTTV/FFZ/7TV public APIs) | Emotes | Twitch + Kick + YouTube (concept) | **High** |
| Emote rendering + modifiers (w!/h!/v!/z!/c!/etc.) | Emotes | Universal (concept) | Medium |
| Emote menu / picker (favorites, frecency, search, grid) | Emotes | Universal (concept) | **High** |
| Emote autocomplete (tab/typing in composer) | Emotes | Universal (concept) | **High** |
| Twitch-native emote-picker injection (custom emote sets) | Emotes | Twitch-only technique | Skip (N/A off-Twitch) |
| Animated↔static emote hover swap | Emotes | Universal (concept) | Low |
| Emoji picker/shortcodes (`:slightly_smiling:`) | Emotes | Universal (concept) | Low |
| Readable username-color contrast algorithm | Chat UX | Universal (concept) | **High** |
| Highlight keywords (users/phrases/regex/badges + color + sound) | Chat UX | Universal (concept) | **High** |
| Blacklist keywords (hide messages by user/phrase/badge) | Chat UX / Moderation | Universal (concept) | **High** |
| Pinned/floating highlight banner | Chat UX | Universal (concept) | Medium |
| First-time-chatter highlight | Chat UX | Universal (concept, needs platform signal) | Medium |
| Chat message history (↑/↓ recall in composer) | Chat UX | Universal (concept) | Medium |
| Tab-completion (users + emotes) | Chat UX | Universal (concept) | Medium |
| Double-click username → @mention | Chat UX | Universal (concept) | Low |
| Chat direction reverse (newest at top) | Chat UX | Universal (concept) — **note: Twitch owns native autoscroll, BTTV only retargets it** | Medium |
| Split/alternating chat row background | Chat UX | Universal (concept) | Low |
| Chat font family/size override | Chat UX | Universal (concept) | Low |
| Custom nicknames for users (local only) | Chat UX | Universal (concept) | Low |
| Deleted-message show/hide/highlight | Moderation / Chat UX | Twitch-specific plumbing, concept universal | Medium |
| Blacklist/mods-only/subs-only/ASCII-only local filters | Chat UX | Universal (concept) | Low |
| Chat replies visibility toggle | Chat UX | Twitch-native feature, BTTV just gates visibility | Skip |
| Whispers/conversations emote+color rendering | Chat UX | Twitch-specific (whispers deprecated on Twitch) | Skip |
| VOD chat replay emote/color rendering | Chat UX | Twitch-specific (VOD chat) | Low (YT has no VOD chat replay) |
| Clips chat rendering | Chat UX | Twitch-specific | Low |
| Custom self-bot (auto-reply to `!command`) | Chat UX / Bots | Universal (concept) | Medium |
| Chatbot command autocomplete (Nightbot/Fossabot/Moobot/SE) | Chat UX / Bots | Twitch (YT: Nightbot only) — needs 3rd-party bot APIs | Low (dependency-heavy) |
| Custom `/`-style client-side commands (uptime, viewers, clip, etc.) | Chat UX / Misc | Twitch GQL-dependent; concept universal via platform APIs | Medium |
| Moderator card enrichment (follow count, join date, gift info) | Moderation | Twitch private GQL-dependent | Low |
| Radial right-click custom timeout/ban/delete picker | Moderation | Universal (concept), needs mod API | Medium |
| Auto-claim channel points bonus / drops | Channel-specific | Twitch-only (channel points don't exist elsewhere) | Skip |
| Hide channel points / bits / prime promos / community highlights | Appearance | Twitch-only UI chrome | Skip (N/A — not our UI) |
| Disable/localize/color-strip usernames, badges | Appearance | Universal (concept) | Low |
| Custom accent/primary color theming | Appearance | Universal (concept) — **Prismarity already has this** | Skip (done) |
| Dark/auto theme mode | Appearance | Universal (concept) — **Prismarity already has this** | Skip (done) |
| Username cosmetic effects (glow/flare/iridescence/etc., Pro) | Appearance | Universal (concept), needs eligibility backend | Low |
| Subscriber cosmetic badge (Pro) | Appearance | Universal (concept), needs backend | Low |
| Sidebar section hide/reorder (recommended/similar/offline/stories) | Directory/Homepage | Twitch-only UI chrome | Skip |
| Directory "following live" auto-tab | Directory/Homepage | Twitch-only UI chrome | Skip |
| Homepage/offline-channel autoplay-video mute+pause | Player | Twitch-only UI chrome | Skip |
| VOD-recommendation autoplay cancel | Player | Twitch-only UI chrome | Skip |
| Scroll-to-seek / scroll-to-volume on player | Player | Universal (concept) | Low |
| Click-to-pause player | Player | Universal (concept) | Low |
| Picture-in-picture toggle button | Player | Universal (concept), native browser API | Low |
| Auto-mute player when tab hidden | Player | Universal (concept) | Low |
| Auto theater mode | Player | Twitch-only (theater mode is a Twitch UI concept) | Skip |
| Auto-join/leave raids | Channel-specific | Twitch-only (raids don't exist elsewhere) | Skip |
| Anonymous chat mode (read without being logged in) | Moderation/Privacy | Twitch-specific technique, concept universal | Low |
| Auto-open moderator view | Moderation | Twitch-only UI chrome | Skip |
| Settings UI injected into native chat-settings popover | Settings infra | Twitch-only integration point | N/A (Prismarity has its own settings) |
| Global settings modal (categorized, searchable) | Settings infra | Universal (concept) — **Prismarity already has this** | Skip (done) |
| Cloud settings backup/sync (Pro) | Settings infra | Universal (concept), needs backend + auth | Low |
| Real-time WS push (emotes/settings/subs) + session locks | Settings infra / Misc | Universal (concept), needs backend | Medium (infra investment) |
| i18n via FormatJS + Crowdin | Misc | Universal (concept) | Low (until localization is prioritized) |
| Update mechanism (extension auto-update) | Misc | N/A — browser-extension-specific | Skip (Prismarity is a web app) |
| Bot detection badge override (Nightbot/Moobot) | Chat UX | Twitch-specific | Low |
| Custom nickname / local-only overrides | Chat UX | Universal (concept) | Low |
| SevenTV Vue-instance bridge (interop with 7TV's own extension) | Misc / Interop | Twitch-only, cross-extension interop | Skip |

## Emotes

### Multi-provider emote aggregation
- **What it does**: shows BTTV, FrankerFaceZ, 7TV, and platform-native emotes in one unified chat
  render, autocomplete, and picker, each independently toggle-able.
- **How it works**: each provider is a small class implementing `getEmotes()` /
  `getEligibleEmote(code)` / `getEligibleEmoteById(id)`; a top-level aggregator concatenates them in
  provider-priority order, applying per-user "is this emote usable right now" restriction checks
  (sub-only sets, personal emotes gated to their owner). BTTV's own + FFZ emotes come through BTTV's own
  REST API (`GET /3/cached/emotes/global`, `/3/cached/frankerfacez/...`); 7TV emotes are fetched directly
  from 7TV's public REST API and kept live via 7TV's public SSE stream.
- **Platform relevance**: the *pattern* is fully platform-agnostic. FFZ/7TV are Twitch-community
  projects with no first-class Kick/YouTube presence today, so on those platforms this would mean "BTTV +
  7TV emotes as an overlay on top of native Kick/YouTube emotes" rather than three peer providers.
- **Reimplementation notes**: build a small `EmoteProvider` interface in our stack (React/TS) with one
  implementation per source (7TV's public API is the most valuable, it's popular and actively maintained;
  FFZ's public API is also open; BTTV's own API is fine to call read-only too). Cache per-channel results
  client-side with a short TTL; use 7TV's SSE endpoint for live updates if we want parity, or just poll on
  interval if not.
- **Priority**: **High** — this is the single highest-leverage feature: it's the reason viewers install
  BTTV/7TV in the first place, it's legitimately buildable against public APIs, and it directly extends
  Prismarity's existing composer/emote system.

### Emote picker / menu
- **What it does**: a floating grid picker (opened via a button next to the composer) with a left
  sidebar of category icons (favorites, frecent/"frequently + recently used", per-provider global/channel
  sections, emoji categories), a search box, hover preview, and keyboard grid navigation (arrow keys +
  Enter).
- **How it works**: "frecency" is a custom scoring function — recent uses are bucketed by age
  (last 4h, 1d, 3d, 7d, 30d, 90d, older) into a fixed score per bucket, multiplied by total-use count, and
  the whole per-emote history is capped (100 timestamps, 250 tracked emotes) and persisted to
  `localStorage`. Favorites are a simple list of canonical emote ids (`provider-id`). The grid itself is
  virtualized (only renders visible rows) and organizes emotes into a row/column matrix for O(1)
  keyboard-arrow lookups. On first load of a brand-new user it seeds the frecency table from Twitch's own
  native "recently used emotes" local storage key, or a small hardcoded default set, so the picker isn't
  empty on day one.
- **Platform relevance**: fully portable concept; Prismarity's composer already needs *some* multi-
  platform emote entry point, so this directly maps onto that.
- **Reimplementation notes**: the frecency algorithm (bucketed recency × total-uses, capped history) is a
  nice, self-contained piece of original logic we can reimplement in our own words (it's just a decayed
  popularity score) — no need to copy anything, the shape is simple: `score = totalUses * sum(bucketScore(t) for t in recentUses) / recentUses.length`.
  Pair it with a virtualized grid (React already has libraries for this) and our own favorites/search.
- **Priority**: **High** — meaningfully upgrades the composer UX, and the algorithm is cheap to
  reimplement from a one-paragraph description.

### Emote autocomplete (typed `:code` / partial-name completion)
- **What it does**: as the user types an emote code fragment into the composer, shows a suggestion
  dropdown; on Twitch it goes further and actually **injects a synthetic "emote set"** into Twitch's own
  native autocomplete/emote-picker internals so third-party emotes look native to Twitch's own systems
  (including the message-composer's rich-text emote chips).
- **How it works** (Twitch-specific half): finds the live autocomplete-provider React component via the
  fiber-walk technique, pushes a fake "emote set" object whose emote ids are base64-encoded provider/id/
  code triples with a private prefix, so it can reverse the encoding later when Twitch's own image tag
  renders that id — at that point it swaps in the real image URL. This is the most "invasive" trick in
  the codebase and is entirely dependent on Twitch's internal component shapes.
- **Platform relevance**: the *user-facing* feature (typeahead suggestion list showing matching emotes
  with live preview images) is universal; the "inject into the host's own internals" half is Twitch-only
  and not something to imitate — it's fragile even for BTTV (breaks on every Twitch redesign).
- **Reimplementation notes**: build our own dropdown suggestion component that queries our own aggregated
  emote list — same UX outcome, none of the fragility, and it works identically on Twitch, Kick, and
  YouTube since it's entirely our own composer, not the host site's.
- **Priority**: **High** for the suggestion-list UX; explicitly **skip** the host-injection technique.

### Emote render modifiers
- **What it does**: lets any emote be suffixed/prefixed with a small set of tokens (`w!` wide, `h!`/`v!`
  flip, `z!` zero-width/overlay, `c!` "cursed" random distortion, `l!`/`r!` rotate, `p!`/`s!`
  party/shake animation) that apply as extra CSS transform classes to the rendered emote image, stacking
  with FFZ's equivalent modifier codes.
- **How it works**: pure client-side text parsing + CSS class composition; no network calls.
- **Platform relevance**: universal — it's just CSS classes on an `<img>`.
- **Reimplementation notes**: define our own modifier token table and a handful of CSS keyframe/transform
  classes; apply during message tokenization, same as BTTV, in our own emote-render function.
- **Priority**: Medium — fun, cheap, but not core value.

### Emoji shortcode support (`:slightly_smiling_face:`)
- **What it does**: renders typed `:shortcode:` text as an emoji image (Twemoji SVGs) in both chat
  display and outgoing messages (expands to the literal Unicode character before send), with a blacklist
  to drop a few problematic glyphs.
- **How it works**: a static shortcode→Unicode table (from the `emoji-toolkit`/Twemoji data set, a
  standard open dataset) drives both directions; rendering swaps to `<img>` using Twemoji's public CDN
  path convention.
- **Platform relevance**: universal; Twemoji itself is Apache/MIT-licensed and safe to depend on directly
  (it's not BTTV's data).
- **Priority**: Low — nice-to-have, not differentiating, but trivially cheap if we ever want it (a
  Twemoji npm package + shortcode table gets 90% of this for free).

## Chat UX

### Readable username color (contrast fixup)
- **What it does**: takes a chatter's raw hex color (Twitch lets users pick literally any hex value,
  including near-black-on-black or near-white-on-white) and nudges it toward better contrast against the
  current chat background, separately tuned for light vs. dark chat themes, without changing its hue.
- **How it works**: converts hex→HSL, computes perceived luminance (YIQ formula) to classify the current
  color as reading "light" or "dark" against a threshold, and if it's on the wrong side for the active
  theme, iteratively nudges lightness by a small step (10%) in HSL space — never touching hue/saturation,
  so the user's chosen color family is preserved — repeating up to ~20 times (effectively "keep lightening/
  darkening until it clears the threshold or we give up"). Results are memoized per `(color, theme)` pair
  in a capped LRU-ish cache (evicts oldest past 1000 entries) since it runs on every message render.
- **Platform relevance**: fully universal — every platform's chat has a "chatter picks a color, sometimes
  badly" problem.
- **Reimplementation notes**: this is a small, well-specified, easily-original algorithm — implement our
  own `hexToHsl`/`hslToHex` + iterative-lighten loop, gate it behind a Prismarity setting ("readable chat
  colors"), and cache per color+theme like BTTV does (it's a hot path).
- **Priority**: **High** — cheap, clearly valuable, zero external dependency, directly improves chat
  legibility which is core to a chat-dashboard product.

### Highlight keywords
- **What it does**: lets the user define keywords/phrases/regex, specific usernames, or specific badge
  names that — when matched in an incoming message — highlight that message (background tint, optional
  custom color per rule), optionally play a sound, optionally pin it to a floating banner for a limited
  time, with a "self" default rule seeded automatically (your own name) and a first-time-chatter
  highlight toggle.
- **How it works**: each keyword rule has a type (plain substring w/ word-boundary regex, wildcard `*`,
  quoted-exact `<...>`/legacy exact type, or `~/regex/flags` for power users, validated through a
  ReDoS-safety check before compiling), plus an optional list of channels it's scoped to and an optional
  override color. Matching runs three passes per incoming message — badges, sender name, message text —
  short-circuiting the "don't highlight yourself unless it's a self-name rule" case. A small in-memory
  ring buffer of `(timestamp,from,message)` keys suppresses re-pinning the same highlight if a duplicate
  slips through the render pipeline. Settings persist as an id-keyed map (not an array) so a rule can be
  edited/deleted by stable id from the settings UI.
- **Platform relevance**: fully universal — arguably *more* valuable for Prismarity than for BTTV, since
  Prismarity already unifies multiple chats into one feed and "highlight when any platform mentions me"
  is a natural cross-platform feature.
- **Reimplementation notes**: build our own rule schema (type, keyword, channels[], color), our own regex
  compiler (support plain/wildcard/exact/raw-regex with a safe-regex check — the `safe-regex2` npm
  package BTTV itself depends on is a fine, generic dependency to reuse), and wire it into our existing
  chat feed's per-message render. The "channels" scoping generalizes nicely to "platform + channel"
  scoping in a multi-platform product.
- **Priority**: **High** — a flagship "why would I use a dashboard over native chat" feature; the design
  is already fully specified above, so build cost is mostly UI + regex-safety plumbing, not research.

### Blacklist keywords
- **What it does**: the inverse of highlights — hides messages matching a keyword/user/badge rule
  entirely (used for muting spam phrases, bots, or the classic "hide unwanted username").
- **How it works**: same rule schema and matching engine as highlights, evaluated first (blacklist wins
  over highlight if both would match), applied by setting the message element's display to none rather
  than removing it from the DOM (keeps ordering intact if unmuted later isn't needed, but here it's a
  one-way hide since messages aren't currently mutable after the fact).
- **Platform relevance**: universal.
- **Reimplementation notes**: share the rule-matching engine with highlight keywords (same shape, just a
  different consumer action); this is a natural pairing to build together.
- **Priority**: **High** — same reasoning as highlights; low incremental cost once the matching engine
  exists.

### Pinned/floating highlight banner
- **What it does**: when a highlight rule fires (and the pinned-highlights setting is on), also renders a
  small floating card (timestamp, sender, message) stacked at the top of chat, auto-dismissing after a
  configurable window, capped to N concurrent pins, dismissible by an explicit close button.
- **How it works**: plain DOM node creation/removal with a `setTimeout` cleanup; position accounts for
  other floating chrome above it (BTTV nudges it below Twitch's own "community highlight" card if
  present — for us this generalizes to "stack below whatever else is pinned at the top of our own feed").
- **Platform relevance**: universal, and cleaner to build in Prismarity than in BTTV since we own the
  whole chat feed DOM rather than injecting into someone else's.
- **Priority**: Medium — a nice companion to highlight keywords, not essential on its own.

### First-time-chatter highlight
- **What it does**: automatically highlights a chatter's first message in the session/stream.
- **How it works**: reads a boolean flag the platform already provides on the message payload
  (Twitch marks `isFirstMsg`); BTTV doesn't compute this itself.
- **Platform relevance**: depends entirely on the platform surfacing this signal; Twitch does, Kick's
  public/anon socket does not obviously expose it (would need verification), YouTube Live Chat does mark
  "New member"/first-time signals differently. Treat as platform-dependent, not guaranteed portable.
- **Priority**: Medium — valuable where the signal exists, needs a per-platform capability check.

### Chat message history recall (↑ / ↓ in composer)
- **What it does**: pressing Up/Down in an empty or cursor-at-edge composer cycles through previously
  sent messages, like a shell history, stashing the current unsent draft as history-slot zero if you start
  typing something new mid-recall.
- **How it works**: a simple in-memory array (most-recent-first) populated on every successful send,
  combined with cursor-position checks (only recall when the caret is at the very start/end of the input,
  so normal up/down-arrow text editing isn't hijacked) and skipping recall while the native
  autocomplete dropdown is open.
- **Platform relevance**: universal, trivial to implement against our own composer's key handling.
- **Priority**: Medium — small UX nicety, cheap to build.

### Tab-completion (usernames + emotes)
- **What it does**: pressing Tab while a word-fragment is under the caret cycles through matching
  usernames seen in chat and matching emote codes (configurable priority order), Shift+Tab cycles
  backward, Escape reverts.
- **How it works**: maintains a rolling `Set` of usernames observed in the current channel's chat plus the
  aggregated emote code list; on first Tab press it captures the word boundaries around the caret, builds
  the sorted candidate list once, then just walks an index on subsequent Tab presses without recomputing.
- **Platform relevance**: universal composer feature.
- **Priority**: Medium — solid QoL, not urgent versus emotes/highlights.

### Chat direction reverse (newest-message-at-top)
- **What it does**: flips the chat feed so new messages appear at the top instead of the bottom (useful
  for viewers who want the newest message always in a fixed reading position).
- **How it works**: **this is entirely a repositioning of native scroll behavior, not new rendering** —
  BTTV literally reaches into the platform's own scroller component instance and overrides its
  `scrollToBottom`/`atBottom` methods to instead target the top, plus a `scroll` event listener hack so
  the native "resume autoscroll" logic still triggers correctly when the user scrolls back to the "live"
  edge (which is now the top instead of the bottom). **Important finding for the catalog**: chat
  autoscroll/pause-at-scroll behavior itself is owned by the *host platform's* chat scroller, not BTTV —
  BTTV only redirects which edge counts as "live."
- **Platform relevance**: universal concept, but the implementation approach (patch the platform's own
  scroller) is Twitch-specific. In Prismarity we own the ChatFeed's scroll container fully (per existing
  project memory: `overflow-anchor:none`, nested-flex `minH:0`, hover-pause guard), so this is actually
  *easier* for us — it's just "append new rows above vs. below" plus flipping which edge the
  pause-on-scroll/resume-on-reach-edge logic watches.
- **Priority**: Medium — a real feature some viewers want, and cheap for us specifically because we
  already own the scroll container (unlike BTTV, which has to hack someone else's).

### Split/alternating chat row background
- **What it does**: gives every other message a faint alternating background tint, purely to make dense
  chat easier to visually parse row-by-row (like table zebra-striping).
- **How it works**: a module-level boolean flips on each new message and stamps a class + optional custom
  color onto the row; the flag is stored on the message object itself so re-renders of the same message
  don't re-flip it.
- **Platform relevance**: universal, trivial CSS-only feature.
- **Priority**: Low — nice, but `:nth-child(even)` CSS in our own feed gets 95% of the value for free.

### Chat font family/size override
- **What it does**: lets the user override chat's font-family and font-size via a prompt-based UI,
  applied as an injected `<style>` tag.
- **How it works**: plain `prompt()` dialogs writing to `localStorage`; a single style element is
  regenerated on change.
- **Platform relevance**: universal, but Prismarity already has broader theming (per project memory:
  M PLUS Rounded 1c app font, amber accent theme system) — a raw arbitrary-font-string prompt is a step
  backward from a designed theme system.
- **Priority**: Low — covered better by existing Prismarity theming; only relevant as a narrow "chat-only
  font size" accessibility toggle if requested.

### Custom nicknames (local aliasing)
- **What it does**: lets you rename how a specific chatter's name displays to *you only* (stored locally,
  never sent anywhere), accessible from the moderator-card UI.
- **How it works**: a `Map<username, nickname>` in `localStorage`; substituted in at render time
  wherever a username is displayed for that chatter.
- **Platform relevance**: universal, trivial.
- **Priority**: Low — easy but niche; consider only if requested.

### Double-click username → mention
- **What it does**: double-clicking a username in chat inserts `@username` into the composer (appending
  to existing text, or starting a fresh `@name, ` greeting if the composer is empty).
- **How it works**: a delegated `dblclick` listener scoped to username spans; reads the message object for
  the row to prefer the canonical login over a possibly-different display name.
- **Platform relevance**: universal, trivial to add to our own message rows.
- **Priority**: Low — cheap QoL, easy to bundle with the participants/@mentions work already in Prismarity
  per project memory (`chat-composer-refactor.md`).

## Moderation

### Deleted-message handling (show/hide/highlight)
- **What it does**: instead of Twitch's default "message deleted" placeholder, optionally still show the
  original message text (struck through, links defused) or hide it outright, or hide-and-highlight it.
- **How it works**: intercepts the moderation event before Twitch's own handler renders the "deleted"
  placeholder (same message-handler-patch technique described in Architecture), locates the *original*
  message element(s) from that user (optionally scoped to the specific message id) still present in the
  DOM, and applies the chosen treatment — including stripping `href` from any links and removing embedded
  clip cards so a "shown" deleted message can't still be clicked through.
- **Platform relevance**: universal concept; requires the platform to actually deliver a deletion/
  moderation event to the client, which Twitch, Kick, and YouTube all do in some form (YouTube's Live
  Chat API surfaces message-deleted events too).
- **Reimplementation notes**: for platforms where Prismarity already ingests the raw event stream (per
  project memory: YouTube live-chat read via InnerTube, Kick anonymous socket, Twitch), this is "keep the
  message in our own feed state instead of dropping it, and re-style it" rather than any DOM trickery —
  actually simpler for us than for BTTV, since we control our own render list.
- **Priority**: Medium — useful moderation/context feature, moderate effort per platform to confirm the
  deletion event shape.

### Radial custom-timeout picker
- **What it does**: right-click on a username in chat (as a moderator) opens a radial/drag UI where
  moving the mouse vertically continuously scales a timeout duration (via an exponential curve) through
  purge → seconds → minutes → hours → days → ban, released on mouse-up; Shift+click prompts for a public
  reason first.
- **How it works**: pure client UI math (`time = 1.5^((distance-offset)/step) * baseSeconds`) mapping
  cursor Y-position to a duration, plus a GraphQL mutation (private, undocumented Twitch API) for the
  "delete single message" action specifically (ban/timeout go through the normal `/ban`,`/timeout` chat
  commands the user already has permission to run).
- **Platform relevance**: the *interaction pattern* (fast, low-friction moderation gesture) is universal;
  the specific backing actions (ban/timeout/delete-message) require each platform's own moderation API —
  Twitch has this via chat commands + GQL, Kick and YouTube moderation capabilities are more limited from
  a third-party client and would need to be verified per-platform before committing to full parity.
- **Priority**: Medium — valuable if Prismarity leans into being a moderator tool, but gate the scope
  per-platform on what moderation actions are actually available to us.

### Moderator-card enrichment
- **What it does**: adds follower count, account-creation date, and "gifted by / gift date" (if the sub
  was gifted) to the native viewer/moderator card, plus quick-action buttons (permit, purge, 10m/1h/8h/24h
  timeout) and a collapsible "this user's recent messages" panel.
- **How it works**: fires a private/undocumented Twitch GraphQL query for the extra profile fields; the
  recent-messages panel just clones already-rendered message DOM nodes it has cached client-side (nothing
  fetched retroactively).
- **Platform relevance**: Twitch-specific (rides on Twitch's own viewer-card UI and undocumented GQL
  schema); the *concept* — a quick per-chatter context card with recent-message history and quick mod
  actions — generalizes to a from-scratch component Prismarity could build using only its own known chat
  history plus whatever public profile data each platform exposes (follower counts are generally public
  via each platform's API).
- **Priority**: Low — high effort (undocumented GQL is fragile and Twitch-only), and Prismarity would
  need an equivalent, separately-designed UI anyway rather than "injecting into" a card it doesn't own.

### Self-bot (auto-reply to configured commands)
- **What it does**: broadcaster-only — define `!command` → response pairs, optionally gated by minimum
  user level (everyone/VIP/subscriber/mod), with a per-command cooldown; when someone in your own channel
  types a matching command, your session auto-replies as you (as a chat reply).
- **How it works**: matches exact command or command-followed-by-space, per-command cooldown map
  (in-memory, 2s default), and — notably — coordinates across multiple open tabs/devices of the same
  account using the session-lock primitive on BTTV's own WebSocket, so only one tab actually replies even
  if the streamer has chat open on stream *and* mobile *and* a dashboard.
- **Platform relevance**: universal concept; "simple auto-responder commands" is valuable for any
  streamer-facing dashboard, arguably more natural to build into Prismarity (a dashboard product) than
  into a browser extension.
- **Reimplementation notes**: this needs Prismarity's own equivalent of the session-lock idea *if* we want
  multi-tab safety, or we can simply scope it to "runs from wherever the dashboard is the primary open
  session" for a first version and skip the distributed-lock complexity.
- **Priority**: Medium — solid value-add for a streamer dashboard specifically, moderate build effort
  (mostly UI for command management + the send pipeline hook, which Prismarity already has via its
  composer/send path).

## Appearance / Themes

Most of this category (accent color theming, dark/light/auto mode, readable badges) **Prismarity has
already shipped** per project memory (`theme-greywash-amber.md`, `font-mplus-rounded.md`) — noted below
for completeness but not re-recommended.

### Custom accent/primary color
- **What it does**: lets the user pick a primary color that re-themes the whole site's buttons/links/
  accents via CSS custom-property overrides, Pro-gated.
- **How it works**: derives a full color ramp (light→dark tints) from a single chosen swatch via a color
  library, writes the ramp as CSS variables scoped to a wrapper class.
- **Priority**: Skip — Prismarity's amber-accent semantic-token system already covers this, and arguably
  more elegantly (systematic accentMix/accentLine/accentBorder helpers vs. one-shot CSS var injection).

### Username cosmetic effects (glow / flare / iridescence / supernova / midas / glacier / intergalactic)
- **What it does**: Pro-only decorative text effects applied to a user's own display name across chat —
  animated gradient fills and a matching drop-shadow-style SVG filter outline per effect.
- **How it works**: each effect is a CSS class (gradient/animation) paired with a small SVG `<filter>`
  (dilate + offset + flood + composite = a colored outline with directional shadow) injected once into
  both the main page DOM and the shadow-DOM settings preview (SVG filter references only resolve within
  the same DOM tree, so it has to be duplicated per root). Eligibility for which effects a user can pick
  is a Pro-gated setting resolved against BTTV's own account system.
- **Platform relevance**: universal, purely cosmetic CSS/SVG technique — no platform dependency at all.
- **Reimplementation notes**: the SVG-filter-outline trick is a genuinely nice, reusable technique worth
  learning from (gradient-fill text + a filter-based outline reads much better than plain `text-shadow`
  on busy backgrounds); build a small independent set of effect classes if/when Prismarity wants premium
  cosmetics — needs no external dependency, just our own CSS/SVG.
- **Priority**: Low — purely cosmetic, only worth it if/when Prismarity wants a "supporter perk" tier.

## Player

Player-related modules (theater mode, autoplay muting on homepage/offline-channel carousels, scroll-to-
seek/volume, click-to-pause, picture-in-picture button, auto-mute when tab hidden, hide-cursor-on-idle)
are almost entirely about controlling **Twitch's own native `<video>` player instance and UI chrome** —
not something Prismarity currently owns, since Prismarity is a chat-first dashboard, not a video player
wrapper. Two are worth flagging individually as portable if Prismarity ever embeds a platform player:

### Auto-mute player when tab/window not visible
- **What it does**: mutes the video when the browser tab is hidden (backgrounded) and restores the prior
  mute state when it becomes visible again, without touching the persisted volume slider (only the raw
  media element).
- **How it works**: `document.visibilitychange` listener + directly setting `video.muted` (bypassing
  whatever state the platform's own volume UI tracks).
- **Platform relevance**: universal to any embedded `<video>`.
- **Priority**: Low today (Prismarity doesn't embed players) — revisit if that changes; ties in with the
  existing battery/thermal optimization work per project memory (`perf-battery-thermal.md`) if Prismarity
  ever does embed streams.

### Picture-in-picture toggle
- **What it does**: adds a PiP button next to the platform's native player controls, using the standard
  browser Picture-in-Picture API (not a custom implementation).
- **Platform relevance**: universal (native browser API, works on any `<video>` element).
- **Priority**: Low today for the same "no embedded player yet" reason.

## Directory / Homepage

Sidebar section hiding (recommended/similar/offline-followed/stories/recommended-categories), the
"auto-switch directory to following-live tab" trick, and homepage-carousel autoplay muting are all pure
Twitch-chrome manipulation — they modify parts of twitch.tv's own layout that have no equivalent surface
in Prismarity (which doesn't render Twitch's directory or homepage at all). **All skip** — not applicable
to our product shape.

## Settings infra

### Categorized, searchable global settings modal
- **What it does**: a single modal with a left category rail (Appearance, Emotes, Bots, Chat, Channel,
  Moderation, Interface, Other) and per-category setting rows (toggle/radio/color-picker/tag-input/
  keyword-list variants), reachable both from a floating button and injected into the host site's own
  chat-settings popover.
- **Platform relevance**: universal — this is exactly a settings-page information architecture question.
- **Priority**: Skip as "build this" — Prismarity already has its own settings surface; only the
  *category taxonomy* (Appearance/Emotes/Chat/Moderation/Interface/Other) is worth glancing at as
  inspiration for organizing Prismarity's own settings as the feature list grows.

### Cloud settings backup/sync
- **What it does**: Pro-gated sync of the full settings blob across devices/browsers, with real-time push
  when changed elsewhere and a conflict-resolution prompt on version mismatch.
- **How it works**: see Architecture section above (`cloud_backup` module) — versioned optimistic-
  concurrency writes, debounced local→server push, WebSocket push for server→local.
- **Platform relevance**: universal concept, needs Prismarity's own backend + auth (which already exists
  in some form given the multi-platform OAuth work per project memory).
- **Priority**: Low-Medium — genuinely useful once Prismarity has enough settings surface area to make
  losing them on a new device painful, but it's backend work, not a quick UI win. Revisit once the
  settings surface is bigger.

## Misc

### `/`-style custom client commands
- **What it does**: a set of client-side-only slash commands layered on top of the platform's own chat
  input: `/uptime`, `/viewers`, `/followed`, `/follows`, `/chatters`, `/clip [title]`, `/screenshot`,
  `/b <user> [reason]` (ban shortcut), `/purge`/`/p <user> [reason]` (1s timeout shortcut), `/localmod`,
  `/localsub`, `/localascii` (+`off` variants — client-side-only "only show mod/sub/ascii messages to me"
  filters), `/sub`/`/suboff` (shortcuts), `/unban` (bulk-unban with rate-limited batching + confirmation),
  plus novelty ones (`/shrug`, `/lurk`, `/barrelroll`, `/party`).
- **How it works**: each command is a small object (`name`, argument spec, handler) registered into a
  shared command store; most handlers either fire a GraphQL query against the platform's private API
  (uptime/viewers/followed/chatters/follows) and echo the result back as a local-only "admin message" (a
  message that renders in the user's own chat feed but is never actually sent to the channel), or
  translate to an equivalent native chat command. `/clip` and `/screenshot` are the most substantial:
  `/clip` calls the platform's clip-creation endpoint; `/screenshot` grabs the current decoded video frame
  via `<canvas>.drawImage(video, ...)` and downloads it as a PNG (falls back gracefully if the frame is
  cross-origin-tainted, e.g. certain ad creatives).
- **Platform relevance**: the *pattern* (lightweight client commands that echo a locally-rendered result)
  is universal; the specific commands are Twitch-GQL-dependent today. Kick/YouTube equivalents (uptime,
  viewer count, clip creation) would need each platform's own public/documented API where available.
- **Priority**: Medium — `/screenshot` and "local admin message" echo pattern are cheap, self-contained,
  and platform-agnostic; the GQL-backed info commands (`/uptime`, `/viewers`, etc.) are worth doing only
  for platforms with a legitimate public API for that data (YouTube exposes concurrent viewers via its
  API; Twitch's Helix API exposes stream start time and viewer count too, no need for private GQL).

### Anonymous chat mode
- **What it does**: temporarily "logs out" of chat (joins as an anonymous `justinfanNNNNN`-style viewer)
  so the user can lurk/read without their name appearing as present, `/join`/`/part` chat commands to
  toggle it, plus a channel allow/deny list and a URL flag to force it on.
- **How it works**: directly swaps the username on the live chat IRC-over-WebSocket connection object and
  forces a reconnect (`QUIT`) so the new identity takes effect immediately, without a full page reload.
- **Platform relevance**: Twitch-specific technique (reaches into Twitch's own chat socket client
  instance); the *concept* — "read-only lurk mode that doesn't announce presence" — could map to
  Prismarity's own read/send platform model (per project memory: `read-vs-send-platform-model.md`) as a
  toggle on the *read* side, but each platform's underlying chat-join semantics differ enough (Kick's
  anonymous socket per `kick-alerts-pusher.md` is already effectively anonymous; YouTube read is via
  InnerTube, also not "logged in" as such) that this may already be moot for Prismarity's existing
  architecture.
- **Priority**: Low — likely already implicitly covered by Prismarity's existing per-platform read
  implementations; worth a short audit rather than new build.

### i18n infrastructure
- **What it does**: all user-facing strings authored as FormatJS `formatMessage({defaultMessage: '...'})`
  calls, extracted at build time into per-locale message catalogs, translated via a public Crowdin project
  (community-translated, 17+ locales), compiled into the bundle at build time (not runtime-fetched).
- **Platform relevance**: universal engineering pattern, not platform-specific at all.
- **Priority**: Low for now (no indication Prismarity needs multi-locale support today) — but if it ever
  does, "FormatJS + Crowdin, extracted at build time" is a proven, low-maintenance pattern worth copying
  the *approach* of.

### Update mechanism
- Standard browser-extension auto-update via the extension store; **not applicable** — Prismarity is a
  deployed web app (Vercel/Azure per project memory), which updates by nature of being server-hosted.
  Skip.

## Recommended for Prismarity (shortlist, ordered)

1. **Multi-provider emote aggregation (BTTV + FFZ + 7TV public APIs) feeding Prismarity's own emote
   render + picker + autocomplete.** Highest leverage item on this whole list — it's the actual reason
   people install BTTV, it's legitimately buildable against public documented APIs (not BTTV's source),
   and it plugs directly into work Prismarity's memory already flags as intended
   (`bttv-integration-blocked.md`). Effort: medium-high (three provider integrations + a unified render
   pipeline + picker UI), no backend dependency beyond the public APIs themselves.

2. **Highlight + blacklist keyword engine**, shared matching core (plain/wildcard/exact/regex, scoped to
   user/message/badge, optional per-platform-channel scoping), wired into Prismarity's existing chat feed.
   A flagship differentiator for a *dashboard* specifically (cross-platform "highlight when I'm
   mentioned anywhere"). Effort: medium (mostly UI + a well-specified, self-contained matching engine —
   the `safe-regex2` npm package is a fine generic dependency to reuse for the regex-safety check).

3. **Readable username-color contrast fixup.** Small, self-contained, zero dependencies, immediately
   improves chat legibility, and the algorithm is fully specified above (HSL lighten/darken loop against
   a YIQ luminance threshold, memoized). Effort: low — a half-day feature.

4. **Emote picker UX (favorites + frecency-scored recents + search + keyboard nav), including the
   frecency scoring formula.** Natural companion to item 1 — once the aggregated emote list exists, this
   is the highest-value way to expose it in the composer. Effort: medium, mostly UI/virtualization work,
   the algorithm itself is cheap.

5. **Self-bot (configurable `!command` → response, user-level gated, with cooldown).** Distinctive
   value-add for a *streamer* dashboard (as opposed to a viewer extension) — lets a streamer running
   Prismarity get lightweight auto-responder functionality without a separate bot service. Effort:
   medium; skip the distributed session-lock complexity for a first version (single "primary session"
   assumption is fine) and revisit multi-tab-safety only if it becomes a real problem.

## Notable findings worth flagging

- **Chat autoscroll/pause-at-scroll is owned by the host platform (Twitch), not BTTV.** BTTV's "reverse
  chat direction" feature only *retargets* which edge counts as "the live edge" on Twitch's own scroller
  component — it doesn't implement scrolling itself. Prismarity, by contrast, already owns its ChatFeed's
  scroll behavior end-to-end (per `perf-battery-thermal.md`: `overflow-anchor:none`, nested-flex `minH:0`,
  hover-pause guard), so a "reverse direction" feature is actually *easier* to build correctly here than
  it was for BTTV.
- **A meaningful fraction of the catalog (≈15 of 56 modules) is pure Twitch-website-chrome manipulation**
  with no Prismarity equivalent surface at all — sidebar sections, homepage/directory autoplay, channel
  points, raids, theater mode, moderator-view auto-open, prime-gaming promos. These are marked Skip not
  because they're bad ideas, but because they modify a page Prismarity doesn't render.
- **Two features are explicitly gated on Twitch's *undocumented/private* GraphQL API** (moderator-card
  follower/creation-date enrichment, message-delete-by-id mutation) — these are reverse-engineered
  endpoints, not public APIs, and are the most fragile/liability-prone things in the whole codebase (they
  break on Twitch's own internal changes, independent of any license concern). Flagged Low priority
  specifically because of this fragility, separate from the license question.
- **7TV emotes are fetched directly from 7TV's own public API/SSE — BTTV does not proxy them.** This
  confirms 7TV's API is a legitimately independent, directly-usable dependency for Prismarity (no BTTV
  intermediary needed at all).
- **The "session lock" WebSocket primitive** (first-holder-wins, server-mediated, survives reconnects) is
  a clean, reusable *design pattern* for any future Prismarity feature that must not double-fire across
  multiple open tabs/devices of the same account (self-bot is the only current user of it in BTTV, but
  the primitive itself is generic).
