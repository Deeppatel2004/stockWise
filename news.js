// News headlines: a card on each stock page, and the News page
const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function timeAgo(iso) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return mins + " min ago";
  if (mins < 60 * 24) return Math.round(mins / 60) + " h ago";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function newsHtml(items) {
  if (!items.length) return '<p class="empty">No recent news found.</p>';
  return items
    .map(
      (n) => `<div class="setting-row">
        <div>
          <b><a href="${escHtml(n.link)}" target="_blank" rel="noopener noreferrer">${escHtml(n.title)}</a></b>
          <span>${escHtml(n.publisher)}${n.publisher && n.time ? " · " : ""}${escHtml(timeAgo(n.time))}</span>
        </div>
      </div>`
    )
    .join("");
}

async function loadNews(box, path) {
  box.innerHTML = '<p class="empty">Loading news...</p>';
  try {
    box.innerHTML = newsHtml(await api(path));
  } catch (err) {
    box.innerHTML = '<p class="empty">News is not available right now. Try again in a few minutes.</p>';
  }
}

const params = new URLSearchParams(location.search);

if (document.getElementById("newsPage")) {
  // ----- The News page -----
  const box = document.getElementById("newsList");
  const title = document.getElementById("newsTitle");
  const input = document.getElementById("newsInput");

  const show = (sym) => {
    const ok = /^[A-Z0-9&-]{1,20}$/.test(sym || "");
    title.textContent = ok ? "News about " + sym : "Market news";
    loadNews(box, ok ? "/stocks/" + encodeURIComponent(sym) + "/news" : "/stocks/market-news");
    try {
      history.replaceState(null, "", ok ? "news.html?symbol=" + encodeURIComponent(sym) : "news.html");
    } catch {
      /* ignore */
    }
  };
  const go = () => show(input.value.trim().toUpperCase().split(/\s+/)[0]);

  document.getElementById("newsGo").addEventListener("click", go);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") go();
  });
  document.getElementById("newsMarket").addEventListener("click", () => {
    input.value = "";
    show("");
  });
  const start = (params.get("symbol") || "").toUpperCase();
  input.value = start;
  show(start);
} else if (/stock\.html$/.test(location.pathname)) {
  // ----- A card at the bottom of each stock page -----
  const sym = (params.get("symbol") || "").toUpperCase();
  if (/^[A-Z0-9&-]{1,20}$/.test(sym)) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML =
      '<h2>Latest news</h2><div id="stockNews"></div>' +
      '<small>Headlines come from Yahoo Finance and open the publisher\'s website. <a href="news.html?symbol=' + encodeURIComponent(sym) + '">More news</a></small>';
    (document.querySelector("main") || document.body).appendChild(card);
    loadNews(document.getElementById("stockNews"), "/stocks/" + encodeURIComponent(sym) + "/news");
  }
}
