const PRISMARITY = "http://localhost:3000/api/beacon";

// Pages to skip on each platform — everything that isn't a live channel page.
const TWITCH_SKIP = new Set([
  "directory", "settings", "subscriptions", "wallet", "inventory", "drops",
  "videos", "clips", "following", "friends", "popout", "moderator", "payments",
  "store", "downloads", "search", "u", "login", "signup", "prime",
]);
const KICK_SKIP = new Set([
  "home", "search", "categories", "following", "subscriptions",
  "settings", "browse", "dashboard", "stream", "login", "signup",
]);

function parseStream(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);

    if (host === "twitch.tv" && parts.length === 1 && !TWITCH_SKIP.has(parts[0])) {
      return { platform: "twitch", channel: parts[0].toLowerCase() };
    }
    if (host === "kick.com" && parts.length === 1 && !KICK_SKIP.has(parts[0])) {
      return { platform: "kick", channel: parts[0].toLowerCase() };
    }
  } catch {}
  return null;
}

let lastSent = "";

// Mirror the latest detection into storage so the popup can render status
// without hitting the now-authenticated GET /api/beacon (which the popup, being
// cross-origin, can't read).
function setStatus(patch) {
  chrome.storage.local.get(["status"], ({ status }) => {
    chrome.storage.local.set({ status: { ...(status || {}), ...patch } });
  });
}

// Callback-based chrome.* calls work in both Chrome and Firefox/Gecko (Zen).
function signal(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    const stream = parseStream(tab.url || "");
    if (!stream) return;
    const key = `${stream.platform}:${stream.channel}`;
    if (key === lastSent) return;
    lastSent = key;

    chrome.storage.local.get(["token"], ({ token }) => {
      if (!token) {
        // Detected a stream but the extension isn't paired yet — surface that in
        // the popup and don't bother the server with an unauthenticated write.
        setStatus({ ...stream, paired: false, sentOk: false });
        return;
      }
      fetch(PRISMARITY, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Beacon-Token": token },
        body: JSON.stringify(stream),
      }).then((res) => {
        setStatus({ ...stream, paired: true, sentOk: res.ok });
      }).catch(() => {
        // Prismarity not running — silently ignore.
        setStatus({ ...stream, paired: true, sentOk: false });
      });
    });
  });
}

function checkActiveTab(windowId) {
  const query = windowId ? { active: true, windowId } : { active: true, currentWindow: true };
  chrome.tabs.query(query, (tabs) => {
    if (tabs && tabs[0]) signal(tabs[0].id);
  });
}

chrome.tabs.onActivated.addListener(({ tabId }) => signal(tabId));
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status === "complete") signal(tabId);
});

// Follow window switches too — two streams in separate windows count as a swap.
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return; // focus left the browser entirely
  checkActiveTab(windowId);
});

// A freshly pasted pairing key should re-signal the current stream immediately,
// not wait for the next tab switch.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.token) {
    lastSent = "";
    checkActiveTab();
  }
});

// Catch the stream you're already watching when the extension loads/wakes.
checkActiveTab();
