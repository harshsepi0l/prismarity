# Prismarity Beacon

Companion browser extension that watches your active tab for Twitch and Kick
streams and signals Prismarity, so the dashboard auto-syncs to whatever you're
watching when **Beacon Mode** is on (Settings → Chat).

## Folders

- `chrome/` — Chrome / Edge / Brave (Manifest V3)
- `firefox/` — Firefox (Manifest V2)

Each folder is fully self-contained — load it directly, no swapping needed.
`background.js`, `popup.html`, and `popup.js` are identical in both; only the
manifest differs.

## Install on Chrome / Edge / Brave

1. Go to `chrome://extensions` (or `edge://extensions`, `brave://extensions`)
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select the `extension/chrome` folder

## Install on Firefox (also Zen, LibreWolf, Waterfox — any Gecko browser)

Zen is built on Firefox, so it uses the V2 `firefox/` folder, **not** `chrome/`.

1. Go to `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → select `extension/firefox/manifest.json`

(Temporary add-ons are removed when Firefox restarts. To make it permanent you'd
need to sign it through addons.mozilla.org.)

## Pair with your account

The extension must be paired before it will signal — this is what binds its
updates to your account (and keeps anyone else from writing to your beacon).

1. In Prismarity, open **Settings → Chat** and copy the **Pairing key** shown
   under the Beacon extension section.
2. Click the extension's toolbar icon, paste the key into **Pairing key**, and
   hit **Save**.

The key is a per-account secret — keep it private. Until it's saved, the popup
shows "Not paired" and the extension won't send anything.

## Notes

- The extension only talks to `http://localhost:3000`. If you run Prismarity on a
  different host/port, update the URL in `background.js`, `popup.js`, and the
  manifest's permissions — in **both** folders.
- When Prismarity isn't running, the extension fails silently — no errors.
