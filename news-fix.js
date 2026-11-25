// Fixes the news feed. Run this in the main folder (D:\\stockWise):  node news-fix.js
const fs = require("fs");

function edit(file, fn, marker) {
  let s = fs.readFileSync(file, "utf8");
  if (marker && s.includes(marker)) {
    console.log(file + ": already done, skipped");
    return;
  }
  const crlf = s.includes("\r\n");
  s = fn(s.replace(/\r\n/g, "\n"));
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log(file + ": updated");
}

// ---------- 1. Server: news from feeds that work from a server ----------
const NEWS_BLOCK = "// ---------- News headlines (Yahoo Finance and Google News feeds) ----------\nconst NEWS_TTL = 10 * 60 * 1000;\nconst newsCache = new Map();\n\nconst decodeXml = (s) =>\n  s\n    .replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g, \"$1\")\n    .replace(/&lt;/g, \"<\")\n    .replace(/&gt;/g, \">\")\n    .replace(/&quot;/g, '\"')\n    .replace(/&#39;|&apos;/g, \"'\")\n    .replace(/&amp;/g, \"&\")\n    .trim();\n\nfunction parseRss(xml, defaultPublisher) {\n  const items = [];\n  for (const m of xml.matchAll(/<item>([\\s\\S]*?)<\\/item>/g)) {\n    const block = m[1];\n    const pick = (tag) => {\n      const r = block.match(new RegExp(\"<\" + tag + \"(?:\\\\s[^>]*)?>([\\\\s\\\\S]*?)</\" + tag + \">\"));\n      return r ? decodeXml(r[1]) : \"\";\n    };\n    let title = pick(\"title\");\n    const publisher = pick(\"source\") || defaultPublisher;\n    if (publisher && title.endsWith(\" - \" + publisher)) title = title.slice(0, -(publisher.length + 3));\n    const when = new Date(pick(\"pubDate\"));\n    items.push({\n      title: title.slice(0, 300),\n      publisher: publisher.slice(0, 80),\n      link: pick(\"link\"),\n      time: isNaN(when) ? null : when.toISOString(),\n    });\n  }\n  return items.filter((n) => n.title && /^https?:\\/\\//.test(n.link));\n}\n\nasync function fetchFeed(url) {\n  const controller = new AbortController();\n  const timer = setTimeout(() => controller.abort(), 7000);\n  try {\n    const res = await fetch(url, { headers: { \"User-Agent\": \"Mozilla/5.0 (compatible; StockWise)\" }, signal: controller.signal });\n    if (!res.ok) throw new Error(\"status \" + res.status);\n    return parseRss(await res.text(), url.includes(\"yahoo.com\") ? \"Yahoo Finance\" : \"\");\n  } finally {\n    clearTimeout(timer);\n  }\n}\n\nasync function getNews(symbol) {\n  const key = symbol || \"market\";\n  const hit = newsCache.get(key);\n  if (hit && Date.now() - hit.at < NEWS_TTL) return hit.data;\n\n  const google = (q) => \"https://news.google.com/rss/search?q=\" + encodeURIComponent(q) + \"&hl=en-IN&gl=IN&ceid=IN:en\";\n  const yahoo = (s) => \"https://feeds.finance.yahoo.com/rss/2.0/headline?s=\" + encodeURIComponent(s) + \"&region=IN&lang=en-IN\";\n  const base = symbol ? symbol.replace(/-BO$/, \"\") : \"\";\n  const sources = symbol\n    ? [yahoo(yahooFor(symbol)), google(base + \" share price\")]\n    : [google(\"Sensex Nifty stock market India\"), yahoo(\"^NSEI\")];\n\n  let data = [];\n  let failures = 0;\n  for (const url of sources) {\n    try {\n      data = await fetchFeed(url);\n      if (data.length) break;\n    } catch (err) {\n      failures++;\n    }\n  }\n\n  if (data.length) {\n    data = data\n      .sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0))\n      .slice(0, 10);\n    newsCache.set(key, { at: Date.now(), data });\n    return data;\n  }\n  if (hit) return hit.data; // an older list is better than nothing\n  if (failures === sources.length) {\n    const e = new Error(\"News is not available right now\");\n    e.status = 503;\n    throw e;\n  }\n  return []; // the feeds answered, but there is no news\n}\n\n";

edit(
  "server/services/marketData.js",
  (s) => {
    const start = s.indexOf("// ---------- News headlines");
    const end = s.indexOf("module.exports = {");
    if (start < 0 || end < start) throw new Error("marketData.js: could not find the news part (apply news-server.js first)");
    return s.slice(0, start) + NEWS_BLOCK + s.slice(end);
  },
  "fetchFeed"
);

// ---------- 2. Website: wording, and the News link on the News page ----------
edit(
  "news.js",
  (s) => s.split("Headlines come from Yahoo Finance and open").join("Headlines come from Yahoo Finance and Google News and open"),
  "Google News"
);

edit(
  "news.html",
  (s) => {
    let out = s.split("Latest headlines from Yahoo Finance.").join("Latest headlines from Yahoo Finance and Google News.");
    const link = '<a class="nav-link" href="compare.html">Compare</a>';
    if (!out.includes('href="news.html"')) {
      const anchor = out.includes(link) ? link : '<a class="nav-link" href="portfolio.html">Portfolio</a>';
      if (out.includes(anchor)) out = out.replace(anchor, () => anchor + '\n      <a class="nav-link" href="news.html">News</a>');
    }
    return out;
  },
  "Google News"
);