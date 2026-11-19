// Real stock details and price history from Yahoo Finance.
// If Yahoo is unavailable these functions throw, and the website falls back to its simulated chart.

const svc = require("./stockService");

const DETAILS_TTL = 30 * 1000;
const DETAILS_TIMEOUT = 8000;
const HISTORY_TIMEOUT = 15000;

// days = how far back to fetch, interval = size of each point
const RANGES = {
  "1D": { days: 5,    interval: "5m",  ttl: 60 * 1000,        lastSessionOnly: true },
  "1W": { days: 7,    interval: "30m", ttl: 5 * 60 * 1000 },
  "1M": { days: 30,   interval: "1d",  ttl: 15 * 60 * 1000 },
  "6M": { days: 183,  interval: "1d",  ttl: 30 * 60 * 1000 },
  "1Y": { days: 365,  interval: "1d",  ttl: 30 * 60 * 1000 },
  "5Y": { days: 1826, interval: "1wk", ttl: 60 * 60 * 1000 },
};

const detailsCache = new Map();
const historyCache = new Map();

const find = (symbol) => svc.STOCKS.find((s) => s.symbol === symbol);
const isKnownSymbol = (symbol) => Boolean(find(symbol));
const isValidRange = (range) => Object.prototype.hasOwnProperty.call(RANGES, range);

function ensureYahooUp() {
  if (svc.isYahooDown()) throw new Error("Live data is unavailable right now");
}

// ---------- Details: open, high, low, 52-week range, market cap, P/E ----------
async function getDetails(symbol) {
  const stock = find(symbol);
  if (!stock) throw new Error("Unknown stock");

  const hit = detailsCache.get(symbol);
  if (hit && Date.now() - hit.at < DETAILS_TTL) return hit.data;

  ensureYahooUp();
  const yf = await svc.getYahoo();
  const q = await svc.withTimeout(yf.quote(svc.yahooSymbol(stock)), DETAILS_TIMEOUT);
  if (!q || q.regularMarketPrice == null) throw new Error("No quote for " + symbol);

  const data = {
    source: "yahoo",
    symbol,
    price: q.regularMarketPrice,
    prevClose: q.regularMarketPreviousClose ?? null,
    open: q.regularMarketOpen ?? null,
    high: q.regularMarketDayHigh ?? null,
    low: q.regularMarketDayLow ?? null,
    high52: q.fiftyTwoWeekHigh ?? null,
    low52: q.fiftyTwoWeekLow ?? null,
    volume: q.regularMarketVolume ?? null,
    marketCap: q.marketCap ?? null,
    pe: q.trailingPE ?? null,
  };
  detailsCache.set(symbol, { at: Date.now(), data });
  return data;
}

// ---------- History for the chart ----------
const istDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function getHistory(symbol, range) {
  const stock = find(symbol);
  const cfg = RANGES[range];
  if (!stock || !cfg) throw new Error("Unknown stock or range");

  const key = symbol + ":" + range;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < cfg.ttl) return hit.data;

  ensureYahooUp();
  const yf = await svc.getYahoo();
  const result = await svc.withTimeout(
    yf.chart(svc.yahooSymbol(stock), {
      period1: new Date(Date.now() - cfg.days * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: cfg.interval,
    }),
    HISTORY_TIMEOUT
  );

  let points = (result.quotes || [])
    .filter((q) => q.close != null)
    .map((q) => ({ t: new Date(q.date).toISOString(), c: +q.close.toFixed(2) }));

  // "1D" shows only the latest trading day
  if (cfg.lastSessionOnly && points.length) {
    const lastDay = istDay(points[points.length - 1].t);
    points = points.filter((p) => istDay(p.t) === lastDay);
  }
  if (!points.length) throw new Error("No history for " + symbol);

  const data = { source: "yahoo", symbol, range, points };
  historyCache.set(key, { at: Date.now(), data });
  return data;
}

module.exports = { isKnownSymbol, isValidRange, getDetails, getHistory };
