const dot = document.getElementById("dot");
const statusText = document.getElementById("status-text");
const badge = document.getElementById("platform-badge");

async function refresh() {
  try {
    const res = await fetch("http://localhost:3000/api/beacon");
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.channel && data.platform) {
      dot.className = "dot active";
      statusText.textContent = data.channel;
      badge.textContent = data.platform === "twitch" ? "TWITCH" : "KICK";
      badge.className = `platform-badge ${data.platform}`;
      badge.style.display = "";
    } else {
      dot.className = "dot idle";
      statusText.textContent = "Watching for a stream…";
      badge.style.display = "none";
    }
  } catch {
    dot.className = "dot idle";
    statusText.textContent = "Prismarity not running";
    badge.style.display = "none";
  }
}

refresh();
setInterval(refresh, 2000);
