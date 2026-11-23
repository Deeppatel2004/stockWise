// Makes the site installable on a phone or computer. Run it in the folder that has index.html:  node pwa-setup.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ---------- 1. Icons (drawn here, no extra programs needed) ----------
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
// Shapes in a 100 x 100 square: [x, y, width, height, colour]
const GREEN = [22, 199, 132];
const RED = [234, 57, 67];
const SHAPES = [
  [27, 38, 4, 40, GREEN], [20, 48, 18, 20, GREEN],
  [48, 28, 4, 44, RED], [41, 36, 18, 22, RED],
  [69, 22, 4, 40, GREEN], [62, 30, 18, 20, GREEN],
];
function pixel(u, v) {
  for (const [x, y, w, h, col] of SHAPES) if (u >= x && u < x + w && v >= y && v < y + h) return col;
  const t = (u + v) / 200; // blue gradient background
  return [Math.round(11 + 20 * t), Math.round(18 + 70 * t), Math.round(32 + 200 * t)];
}
function makePng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        const p = pixel(((x + sx / 2) / size) * 100, ((y + sy / 2) / size) * 100);
        r += p[0]; g += p[1]; b += p[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r / 4; raw[o + 1] = g / 4; raw[o + 2] = b / 4; raw[o + 3] = 255;
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8; head[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
fs.writeFileSync("icon-192.png", makePng(192));
fs.writeFileSync("icon-512.png", makePng(512));
fs.writeFileSync("apple-touch-icon.png", makePng(180));
console.log("icons: created");

// ---------- 2. The app description ----------
fs.writeFileSync(
  "manifest.webmanifest",
  JSON.stringify(
    {
      name: "StockWise",
      short_name: "StockWise",
      description: "Indian stock market prices, charts, portfolio and alerts",
      start_url: "index.html",
      scope: "./",
      display: "standalone",
      background_color: "#0b1220",
      theme_color: "#2962ff",
      icons: [
        { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2
  )
);
console.log("manifest: created");

// ---------- 3. Small script: install button ----------
fs.writeFileSync(
  "pwa.js",
  `// Install button (Chrome and Edge). On an iPhone: Share, then Add to Home Screen.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

let installEvent = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  try {
    if (localStorage.getItem("installDismissed") === "1") return;
  } catch {
    /* storage can be blocked */
  }
  installEvent = e;
  if (document.getElementById("installBtn")) return;
  const box = document.createElement("div");
  box.id = "installBtn";
  box.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;gap:6px;align-items:center;background:#2962ff;color:#fff;border-radius:10px;padding:8px 12px;box-shadow:0 4px 16px rgba(0,0,0,.35);font:600 14px sans-serif";
  box.innerHTML = '<span style="cursor:pointer">Install StockWise app</span><span title="Hide" style="cursor:pointer;opacity:.8;padding-left:6px">&#10005;</span>';
  box.firstChild.addEventListener("click", async () => {
    installEvent.prompt();
    await installEvent.userChoice;
    box.remove();
  });
  box.lastChild.addEventListener("click", () => {
    try {
      localStorage.setItem("installDismissed", "1");
    } catch {
      /* storage can be blocked */
    }
    box.remove();
  });
  document.body.appendChild(box);
});
window.addEventListener("appinstalled", () => {
  const b = document.getElementById("installBtn");
  if (b) b.remove();
});
`
);
console.log("pwa.js: created");

// ---------- 4. Add it to every page ----------
const TAGS =
  '  <link rel="manifest" href="manifest.webmanifest">\n  <link rel="apple-touch-icon" href="apple-touch-icon.png">\n  <meta name="theme-color" content="#2962ff">\n  <script src="pwa.js" defer></script>\n';
for (const name of fs.readdirSync(".")) {
  if (!/\.html$/i.test(name)) continue;
  let h = fs.readFileSync(name, "utf8");
  if (h.includes("manifest.webmanifest")) {
    console.log(name + ": already done, skipped");
    continue;
  }
  if (!/<\/head>/i.test(h)) {
    console.log(name + ": no </head>, skipped");
    continue;
  }
  h = h.replace(/<\/head>/i, () => TAGS + "</head>");
  fs.writeFileSync(name, h);
  console.log(name + ": patched");
}

// ---------- 5. Service worker needs a fetch listener for installing ----------
if (fs.existsSync("sw.js")) {
  let w = fs.readFileSync("sw.js", "utf8");
  if (!w.includes('addEventListener("fetch"')) {
    fs.writeFileSync(w.endsWith("\n") ? "sw.js" : "sw.js", w + (w.endsWith("\n") ? "" : "\n") + '\n// Needed so the browser allows installing the app. It does nothing else: pages still come from the network.\nself.addEventListener("fetch", () => {});\n');
    console.log("sw.js: patched");
  } else {
    console.log("sw.js: already done, skipped");
  }
} else {
  console.log("sw.js: not found here. Run this in the folder that has sw.js");
}