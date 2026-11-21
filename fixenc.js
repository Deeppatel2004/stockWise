// Repairs files whose emojis and symbols turned into junk text (UTF-8 text that was read as
// Windows-1252 and saved again). Run it in the project folder:  node fixenc.js .
const fs = require("fs");
const path = require("path");

// The characters Windows-1252 uses for bytes 0x80 to 0x9F, in order
const SPECIAL = [
  0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f,
  0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178,
].map((c) => String.fromCodePoint(c));

const DAMAGE_MARK = new RegExp("[" + String.fromCharCode(0xf0, 0xe2, 0xc3, 0xc2) + "]");

function toBytes(text) {
  const bytes = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const special = SPECIAL.indexOf(ch);
    if (special >= 0) bytes.push(0x80 + special);
    else if (code < 256) bytes.push(code);
    else return null; // a character Windows-1252 does not have: this file is not damaged this way
  }
  return Buffer.from(bytes);
}

function repair(text) {
  let current = text;
  let changed = false;
  for (let round = 0; round < 3; round++) { // some files were damaged more than once
    if (!DAMAGE_MARK.test(current)) break;
    const bytes = toBytes(current);
    if (!bytes) break;
    const fixed = bytes.toString("utf8");
    if (fixed.includes(String.fromCharCode(0xfffd)) || fixed === current) break;
    current = fixed;
    changed = true;
  }
  return changed ? current : null;
}

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (/\.(html|js|css|json|md)$/i.test(name)) out.push(full);
  }
  return out;
}

let count = 0;
for (const file of walk(process.argv[2] || ".", [])) {
  let text = fs.readFileSync(file, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // remove the BOM
  const fixed = repair(text);
  if (fixed !== null) {
    fs.writeFileSync(file, fixed, "utf8");
    console.log("Repaired:", file);
    count++;
  }
}
console.log(count ? "Done. " + count + " file(s) repaired." : "No damaged files found.");
