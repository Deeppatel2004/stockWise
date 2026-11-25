// Makes news headlines easy to read. Run this in the main folder (D:\stockWise):  node news-style.js
const fs = require("fs");
let s = fs.readFileSync("news.js", "utf8");
if (s.includes("news-link")) {
  console.log("news.js: already done, skipped");
} else {
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  const steps = [
    ['<a href="${escHtml(n.link)}"', '<a class="news-link" href="${escHtml(n.link)}"'],
    [
      "const params = new URLSearchParams(location.search);\n",
      'const params = new URLSearchParams(location.search);\n\n// Headlines use the normal text colour; they turn blue and underlined when you point at them\nconst newsStyle = document.createElement("style");\nnewsStyle.textContent = ".news-link{color:inherit;text-decoration:none}.news-link:hover{color:#4c8dff;text-decoration:underline}";\ndocument.head.appendChild(newsStyle);\n',
    ],
  ];
  for (const [from, to] of steps) {
    if (!s.includes(from)) throw new Error("news.js: could not find this text:\n" + from);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync("news.js", crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("news.js: updated");
}