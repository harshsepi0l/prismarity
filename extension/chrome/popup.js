const dot = document.getElementById("dot");
const statusText = document.getElementById("status-text");
const badge = document.getElementById("platform-badge");
const tokenInput = document.getElementById("token-input");
const tokenSave = document.getElementById("token-save");
const pairHint = document.getElementById("pair-hint");
const originInput = document.getElementById("origin-input");
const originSave = document.getElementById("origin-save");
const originHint = document.getElementById("origin-hint");

const DEFAULT_ORIGIN = "http://localhost:3000";

function normalizeOrigin(raw) {
  const v = (raw || "").trim().replace(/\/+$/, "").replace(/\/api\/beacon$/, "");
  return v || DEFAULT_ORIGIN;
}

// The popup can't read GET /api/beacon (it's cookie-authed and cross-origin), so
// status comes from what the background script mirrored into storage.
function render() {
  chrome.storage.local.get(["token", "status", "origin"], ({ token, status, origin }) => {
    originHint.textContent = `Sending to ${normalizeOrigin(origin)}`;
    if (!token) {
      pairHint.textContent = "Not paired — paste your key to link this extension.";
    } else {
      pairHint.textContent = "Paired. Links this extension to your account.";
    }

    if (status && status.channel && status.platform) {
      badge.textContent = status.platform === "twitch" ? "TWITCH" : "KICK";
      badge.className = `platform-badge ${status.platform}`;
      badge.style.display = "";
      if (!token) {
        dot.className = "dot idle";
        statusText.textContent = `${status.channel} — pair to sync`;
      } else if (status.sentOk) {
        dot.className = "dot active";
        statusText.textContent = status.channel;
      } else {
        dot.className = "dot idle";
        statusText.textContent = "Prismarity not running";
      }
    } else {
      dot.className = "dot idle";
      statusText.textContent = token ? "Watching for a stream…" : "Paste your pairing key";
      badge.style.display = "none";
    }
  });
}

tokenSave.addEventListener("click", () => {
  const token = tokenInput.value.trim();
  chrome.storage.local.set({ token }, () => {
    tokenInput.value = "";
    render();
  });
});

tokenInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tokenSave.click();
});

originSave.addEventListener("click", () => {
  const origin = normalizeOrigin(originInput.value);
  chrome.storage.local.set({ origin }, () => render());
});

originInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") originSave.click();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.status || changes.token)) render();
});

render();
