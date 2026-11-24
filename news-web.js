// Run this inside the website folder (the one with settings.html):  node news-web.js
const fs = require("fs");

// ---------- 1. The news script (used by the News page and by every stock page) ----------
const NEWS_JS = "// News headlines: a card on each stock page, and the News page\nconst escHtml = (s) =>\n  String(s).replace(/[&<>\"']/g, (c) => ({ \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\", \"'\": \"&#39;\" })[c]);\n\nfunction timeAgo(iso) {\n  if (!iso) return \"\";\n  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));\n  if (mins < 60) return mins + \" min ago\";\n  if (mins < 60 * 24) return Math.round(mins / 60) + \" h ago\";\n  return new Date(iso).toLocaleDateString(\"en-IN\", { day: \"numeric\", month: \"short\" });\n}\n\nfunction newsHtml(items) {\n  if (!items.length) return '<p class=\"empty\">No recent news found.</p>';\n  return items\n    .map(\n      (n) => `<div class=\"setting-row\">\n        <div>\n          <b><a href=\"${escHtml(n.link)}\" target=\"_blank\" rel=\"noopener noreferrer\">${escHtml(n.title)}</a></b>\n          <span>${escHtml(n.publisher)}${n.publisher && n.time ? \" \u00b7 \" : \"\"}${escHtml(timeAgo(n.time))}</span>\n        </div>\n      </div>`\n    )\n    .join(\"\");\n}\n\nasync function loadNews(box, path) {\n  box.innerHTML = '<p class=\"empty\">Loading news...</p>';\n  try {\n    box.innerHTML = newsHtml(await api(path));\n  } catch (err) {\n    box.innerHTML = '<p class=\"empty\">News is not available right now. Try again in a few minutes.</p>';\n  }\n}\n\nconst params = new URLSearchParams(location.search);\n\nif (document.getElementById(\"newsPage\")) {\n  // ----- The News page -----\n  const box = document.getElementById(\"newsList\");\n  const title = document.getElementById(\"newsTitle\");\n  const input = document.getElementById(\"newsInput\");\n\n  const show = (sym) => {\n    const ok = /^[A-Z0-9&-]{1,20}$/.test(sym || \"\");\n    title.textContent = ok ? \"News about \" + sym : \"Market news\";\n    loadNews(box, ok ? \"/stocks/\" + encodeURIComponent(sym) + \"/news\" : \"/stocks/market-news\");\n    try {\n      history.replaceState(null, \"\", ok ? \"news.html?symbol=\" + encodeURIComponent(sym) : \"news.html\");\n    } catch {\n      /* ignore */\n    }\n  };\n  const go = () => show(input.value.trim().toUpperCase().split(/\\s+/)[0]);\n\n  document.getElementById(\"newsGo\").addEventListener(\"click\", go);\n  input.addEventListener(\"keydown\", (e) => {\n    if (e.key === \"Enter\") go();\n  });\n  document.getElementById(\"newsMarket\").addEventListener(\"click\", () => {\n    input.value = \"\";\n    show(\"\");\n  });\n  const start = (params.get(\"symbol\") || \"\").toUpperCase();\n  input.value = start;\n  show(start);\n} else if (/stock\\.html$/.test(location.pathname)) {\n  // ----- A card at the bottom of each stock page -----\n  const sym = (params.get(\"symbol\") || \"\").toUpperCase();\n  if (/^[A-Z0-9&-]{1,20}$/.test(sym)) {\n    const card = document.createElement(\"div\");\n    card.className = \"card\";\n    card.innerHTML =\n      '<h2>Latest news</h2><div id=\"stockNews\"></div>' +\n      '<small>Headlines come from Yahoo Finance and open the publisher\\'s website. <a href=\"news.html?symbol=' + encodeURIComponent(sym) + '\">More news</a></small>';\n    (document.querySelector(\"main\") || document.body).appendChild(card);\n    loadNews(document.getElementById(\"stockNews\"), \"/stocks/\" + encodeURIComponent(sym) + \"/news\");\n  }\n}\n";
fs.writeFileSync("news.js", NEWS_JS);
console.log("news.js: created");

// ---------- 2. The News page: your Settings page, with a new middle part ----------
let page = fs.readFileSync("settings.html", "utf8");
if (!/<main[\s\S]*<\/main>/.test(page) || !page.includes('<script src="settings.js"></script>')) {
  throw new Error("settings.html: could not find its main part or settings.js");
}
const MAIN = `<main class="container" id="newsPage">
    <h2 id="newsTitle">Market news</h2>
    <p class="settings-intro">Latest headlines from Yahoo Finance. They open the publisher's website.</p>
    <div class="card">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        <input id="newsInput" type="text" placeholder="News for a stock (e.g. TCS)" autocomplete="off" style="padding:6px 10px;border-radius:8px;border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit" />
        <button class="btn" id="newsGo">Show</button>
        <button class="btn" id="newsMarket">Market news</button>
      </div>
      <div id="newsList"></div>
    </div>
  </main>`;
page = page
  .replace(/<title>[\s\S]*?<\/title>/, "<title>StockWise - News</title>")
  .replace(/<main[\s\S]*<\/main>/, () => MAIN)
  .replace('<script src="settings.js"></script>', '<script src="news.js"></script>');
fs.writeFileSync("news.html", page);
console.log("news.html: created");

// ---------- 3. A "News" link in the top bar, and the news card on stock pages ----------
const anchorLink = '<a class="nav-link" href="portfolio.html">Portfolio</a>';
for (const name of fs.readdirSync(".")) {
  if (!/\.html$/i.test(name) || name === "news.html") continue;
  let h = fs.readFileSync(name, "utf8");
  let changed = false;
  if (h.includes(anchorLink) && !h.includes('href="news.html"')) {
    h = h.replace(anchorLink, () => anchorLink + '\n      <a class="nav-link" href="news.html">News</a>');
    changed = true;
  }
  if (name === "stock.html" && !h.includes("news.js")) {
    if (!/<\/body>/i.test(h)) throw new Error("stock.html: no </body> found");
    h = h.replace(/<\/body>/i, () => '  <script src="news.js"></script>\n</body>');
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(name, h);
    console.log(name + ": updated");
  } else {
    console.log(name + ": already done, skipped");
  }
}