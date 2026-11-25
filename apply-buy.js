const fs = require("fs");
function patch(file, edits) {
  let s = fs.readFileSync(file, "utf8");
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  for (const [a, b, mark] of edits) {
    if (s.includes(mark)) { console.log(file + ": already patched (" + mark + ")"); continue; }
    if (!s.includes(a)) throw new Error(file + ": anchor not found: " + a.slice(0, 50));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log(file + ": ok");
}
patch("portfolio.html", [
  ['<form id="holdingForm" class="inline-form">',
   '<button class="btn" type="button" id="addHoldingBtn" data-trade="buy">+ Add holding</button>\n      <form id="holdingForm" class="inline-form" style="display:none">', "addHoldingBtn"],
  ['<script src="portfolio.js"></script>', '<script src="portfolio.js"></script>\n  <script src="buy.js"></script>', 'src="buy.js"'],
]);
patch("portfolio.js", [
  ['<td><button class="link-btn" data-remove="${r._id}">Remove</button></td>',
   '<td style="white-space:nowrap"><button class="link-btn" data-trade="buy" data-sym="${escHtml(r.symbol)}">Buy</button> <button class="link-btn" data-trade="sell" data-sym="${escHtml(r.symbol)}">Sell</button> <button class="link-btn" data-remove="${r._id}">Remove</button></td>', 'data-trade="sell"'],
]);
patch("stock.html", [
  ['<script src="news.js"></script>', '<script src="news.js"></script>\n  <script src="buy.js"></script>', 'src="buy.js"'],
]);