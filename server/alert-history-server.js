// Run this inside the server folder:  node alert-history-server.js
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
  "models/Alert.js",
  [
    [
      "    triggered: { type: Boolean, default: false },\n",
      "    triggered: { type: Boolean, default: false },\n    triggeredAt: { type: Date }, // when the alert fired\n    triggeredPrice: { type: Number }, // the price when it fired\n",
    ],
  ],
  "triggeredPrice"
);

patch(
  "jobs/alertJob.js",
  [
    [
      "{ _id: a._id, triggered: false }, { triggered: true }",
      "{ _id: a._id, triggered: false }, { triggered: true, triggeredAt: new Date(), triggeredPrice: price }",
    ],
  ],
  "triggeredPrice"
);