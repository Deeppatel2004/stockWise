// Run this inside the server folder:  node watchlist-groups-server.js
const fs = require("fs");

function patch(file, steps, marker) {
  let s = fs.readFileSync(file, "utf8");
  if (s.includes(marker)) {
    console.log(file + ": already patched, skipped");
    return;
  }
  const crlf = s.includes("\r\n");
  s = s.replace(/\r\n/g, "\n");
  for (const [from, to] of steps) {
    if (!s.includes(from)) throw new Error(file + ": could not find this text:\n" + from);
    s = s.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? s.replace(/\n/g, "\r\n") : s);
  console.log(file + ": patched");
}

patch(
  "models/User.js",
  [
    [
      "    watchlist: { type: [String], default: [] },\n",
      `    watchlist: { type: [String], default: [] },
    watchlistGroups: [
      {
        name: { type: String, required: true, trim: true, maxlength: 30 },
        symbols: { type: [String], default: [] },
      },
    ],
`,
    ],
  ],
  "watchlistGroups"
);

patch(
  "routes/watchlist.js",
  [
    [
      "module.exports = router;",
      `// ---------- Groups: extra watchlists such as "Banks" or "Long term" ----------
const SYMBOL_OK = /^[A-Z0-9&-]{1,20}$/;
const groupsOf = (user) => user.watchlistGroups.map((g) => ({ _id: g._id, name: g.name, symbols: g.symbols }));
const cleanName = (v) => String(v || "").trim().slice(0, 30);

// GET /api/watchlist/groups
router.get("/groups", (req, res) => {
  res.json(groupsOf(req.user));
});

// POST /api/watchlist/groups  { name }
router.post("/groups", async (req, res) => {
  const name = cleanName((req.body || {}).name);
  if (!name) return res.status(400).json({ message: "Give the group a name" });
  if (req.user.watchlistGroups.length >= 10) return res.status(400).json({ message: "You can have up to 10 groups" });
  if (req.user.watchlistGroups.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ message: "You already have a group with that name" });
  }
  req.user.watchlistGroups.push({ name, symbols: [] });
  await req.user.save();
  res.status(201).json(groupsOf(req.user));
});

// PUT /api/watchlist/groups/:id  { name }
router.put("/groups/:id", async (req, res) => {
  const group = req.user.watchlistGroups.id(req.params.id);
  const name = cleanName((req.body || {}).name);
  if (!group) return res.status(404).json({ message: "Group not found" });
  if (!name) return res.status(400).json({ message: "Give the group a name" });
  if (req.user.watchlistGroups.some((g) => g.name.toLowerCase() === name.toLowerCase() && String(g._id) !== String(group._id))) {
    return res.status(400).json({ message: "You already have a group with that name" });
  }
  group.name = name;
  await req.user.save();
  res.json(groupsOf(req.user));
});

// DELETE /api/watchlist/groups/:id
router.delete("/groups/:id", async (req, res) => {
  const group = req.user.watchlistGroups.id(req.params.id);
  if (!group) return res.status(404).json({ message: "Group not found" });
  req.user.watchlistGroups.pull(group._id);
  await req.user.save();
  res.json(groupsOf(req.user));
});

// POST /api/watchlist/groups/:id/symbols  { symbol }
router.post("/groups/:id/symbols", async (req, res) => {
  const group = req.user.watchlistGroups.id(req.params.id);
  const symbol = String((req.body || {}).symbol || "").trim().toUpperCase();
  if (!group) return res.status(404).json({ message: "Group not found" });
  if (!SYMBOL_OK.test(symbol)) return res.status(400).json({ message: "That is not a valid stock symbol" });
  if (group.symbols.length >= 100) return res.status(400).json({ message: "A group can hold up to 100 stocks" });
  if (!group.symbols.includes(symbol)) group.symbols.push(symbol);
  await req.user.save();
  res.status(201).json(groupsOf(req.user));
});

// DELETE /api/watchlist/groups/:id/symbols/:symbol
router.delete("/groups/:id/symbols/:symbol", async (req, res) => {
  const group = req.user.watchlistGroups.id(req.params.id);
  if (!group) return res.status(404).json({ message: "Group not found" });
  const symbol = req.params.symbol.toUpperCase();
  group.symbols = group.symbols.filter((s) => s !== symbol);
  await req.user.save();
  res.json(groupsOf(req.user));
});

module.exports = router;`,
    ],
  ],
  "watchlistGroups"
);