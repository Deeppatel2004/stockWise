const fs = require("fs");
const rd = (f) => { const s = fs.readFileSync(f, "utf8"); return [s.replace(/\r\n/g, "\n"), s.includes("\r\n")]; };
const wr = (f, s, crlf) => fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s);

for (const f of fs.readdirSync(".").filter((x) => x.endsWith(".html"))) {
  let [s, crlf] = rd(f); const o = s;
  if (s.includes('id="logoutBtn"')) {
    s = s.replace(/[ \t]*<button id="logoutBtn"[^>]*>[\s\S]*?<\/button>[ \t]*\n?/, "");
    s = s.replace(/[ \t]*<button id="themeToggle"[^>]*>[\s\S]*?<\/button>[ \t]*\n?/, "");
  }
  if (f === "settings.html" && !s.includes('id="acctCard"')) {
    const card = '    <h2 style="margin-top:24px">Appearance &amp; account</h2>\n' +
      '    <div class="card" id="acctCard">\n' +
      '      <div class="setting-row first"><div><b>Theme</b><br><small>Switch between dark and light mode</small></div><button id="themeToggle" class="btn">🌙</button></div>\n' +
      '      <div class="setting-row"><div><b>Logout</b><br><small>Sign out of StockWise on this device</small></div><button id="logoutBtn" class="btn">Logout</button></div>\n' +
      '    </div>\n';
    if (!s.includes("</main>")) throw new Error("settings.html: </main> not found");
    s = s.replace("</main>", () => card + "  </main>");
  }
  if ((f === "index.html" || f === "stock.html") && !s.includes('src="ui.js"')) {
    s = s.replace("</body>", () => '  <script src="ui.js"></script>\n</body>');
  }
  if (s !== o) { wr(f, s, crlf); console.log(f + ": patched"); }
}

let [d, c1] = rd("data.js");
if (!d.includes("if (themeBtn)")) {
  d = d.replace("themeBtn.textContent =", "if (themeBtn) themeBtn.textContent =").replace("themeBtn.addEventListener(", "if (themeBtn) themeBtn.addEventListener(");
  wr("data.js", d, c1); console.log("data.js: patched");
}
let [sc, c2] = rd("script.js");
if (sc.includes("html + html")) { sc = sc.replace("html + html", "html"); wr("script.js", sc, c2); console.log("script.js: patched"); }