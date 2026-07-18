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

// Callback-based chrome.* calls work in both Chrome and Firefox/Gecko (Zen).
function signal(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;
    const stream = parseStream(tab.url || "");
    if (!stream) return;
    const key = `${stream.platform}:${stream.channel}`;
    if (key === lastSent) return;
    lastSent = key;
    fetch(PRISMARITY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stream),
    }).catch(() => {
      // Prismarity not running — silently ignore.
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

// Catch the stream you're already watching when the extension loads/wakes.
checkActiveTab();

