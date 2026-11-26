const fs = require("fs");
let s = fs.readFileSync("script.js", "utf8");
const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n");
if (s.includes("tickerTrack").valueOf() && !s.includes("track.dataset.n")) {
  const re = /document\.getElementById\("tickerTrack"\)\.innerHTML = html( \+ html)?;/;
  if (!re.test(s)) throw new Error("ticker line not found in script.js");
  s = s.replace(re, () => `const track = document.getElementById("tickerTrack");
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const fresh = [...tmp.children];
  if (track.dataset.n === String(fresh.length) && track.children.length === fresh.length * 2) {
    // same items: only update the numbers, so the scrolling never restarts
    [...track.children].forEach((el, i) => { el.innerHTML = fresh[i % fresh.length].innerHTML; });
  } else {
    track.innerHTML = html + html;
    track.dataset.n = String(fresh.length);
  }`);
  fs.writeFileSync("script.js", crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log("script.js: ticker patched");
} else console.log("script.js: already patched");
