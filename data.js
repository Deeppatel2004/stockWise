// ---------- Mock data ----------
const indices = [
  { name: "NIFTY 50",   value: 24350.45, change: 120.3,  percent: 0.50 },
  { name: "SENSEX",     value: 80120.8,  change: 310.2,  percent: 0.39 },
  { name: "BANK NIFTY", value: 52410.1,  change: -95.6,  percent: -0.18 },
];

const stocks = [
  { symbol: "RELIANCE",   name: "Reliance Industries", price: 2945.5,  percent: 1.8,  volume: 8200000 },
  { symbol: "TCS",        name: "Tata Consultancy",    price: 4120.0,  percent: -0.9, volume: 2100000 },
  { symbol: "INFY",       name: "Infosys",             price: 1890.3,  percent: 2.4,  volume: 5400000 },
  { symbol: "HDFCBANK",   name: "HDFC Bank",           price: 1650.75, percent: -1.2, volume: 9100000 },
  { symbol: "ICICIBANK",  name: "ICICI Bank",          price: 1210.4,  percent: 3.1,  volume: 7600000 },
  { symbol: "SBIN",       name: "State Bank of India", price: 815.9,   percent: -2.3, volume: 12500000 },
  { symbol: "ITC",        name: "ITC Limited",         price: 468.2,   percent: 0.6,  volume: 6900000 },
  { symbol: "WIPRO",      name: "Wipro",               price: 540.1,   percent: -3.4, volume: 4300000 },
  { symbol: "TATAMOTORS", name: "Tata Motors",         price: 985.6,   percent: 4.2,  volume: 11200000 },
  { symbol: "ADANIENT",   name: "Adani Enterprises",   price: 3120.0,  percent: -1.7, volume: 3300000 },
];

const details = {
  RELIANCE:   { mcap: "₹19.9 L Cr", pe: 28.4, about: "Diversified conglomerate with businesses in energy, retail and telecom." },
  TCS:        { mcap: "₹14.9 L Cr", pe: 31.2, about: "India's largest IT services and consulting company." },
  INFY:       { mcap: "₹7.8 L Cr",  pe: 27.6, about: "Global IT services, consulting and digital solutions provider." },
  HDFCBANK:   { mcap: "₹12.6 L Cr", pe: 19.8, about: "One of India's largest private sector banks." },
  ICICIBANK:  { mcap: "₹8.5 L Cr",  pe: 18.1, about: "Leading private sector bank offering retail and corporate banking." },
  SBIN:       { mcap: "₹7.3 L Cr",  pe: 10.5, about: "India's largest public sector bank." },
  ITC:        { mcap: "₹5.8 L Cr",  pe: 26.9, about: "Conglomerate in FMCG, hotels, paperboards and agri-business." },
  WIPRO:      { mcap: "₹2.8 L Cr",  pe: 22.3, about: "IT services and consulting company." },
  TATAMOTORS: { mcap: "₹3.6 L Cr",  pe: 9.7,  about: "Automobile maker with passenger, commercial and EV businesses." },
  ADANIENT:   { mcap: "₹3.5 L Cr",  pe: 62.0, about: "Incubator of businesses in mining, airports and new energy." },
};

// ---------- Helpers ----------
const fmtPrice = (n) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtVolume = (n) => (n / 100000).toFixed(1) + "L";
const sign = (n) => (n >= 0 ? "+" : "");
const dirClass = (n) => (n >= 0 ? "up" : "down");

// Seeded random so the same stock always gets the same mock chart
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Watchlist (saved in localStorage) ----------
function getWatchlist() {
  try {
    return JSON.parse(localStorage.getItem("watchlist")) || [];
  } catch {
    return [];
  }
}

function toggleWatchlist(symbol) {
  const list = getWatchlist();
  const i = list.indexOf(symbol);
  if (i >= 0) list.splice(i, 1);
  else list.push(symbol);
  localStorage.setItem("watchlist", JSON.stringify(list));
  return i < 0; // true = added, false = removed
}

// ---------- Dark / light theme ----------
const root = document.documentElement;
const themeBtn = document.getElementById("themeToggle");

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  themeBtn.textContent = theme === "dark" ? "🌙" : "☀️";
  localStorage.setItem("theme", theme);
  window.dispatchEvent(new Event("themechange")); // lets the chart redraw
}

themeBtn.addEventListener("click", () => {
  applyTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark");
});

applyTheme(localStorage.getItem("theme") || "dark");