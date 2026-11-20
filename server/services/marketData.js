// Real details, history, quotes and search for ANY NSE stock (Yahoo Finance).
// If Yahoo is unavailable these functions throw, and the website falls back gracefully.

const svc = require("./stockService");

const DETAILS_TTL = 30 * 1000;
const QUOTE_TTL = 5 * 1000;
const SEARCH_TTL = 5 * 60 * 1000;
const QUOTE_TIMEOUT = 8000;
const SEARCH_TIMEOUT = 6000;
const HISTORY_TIMEOUT = 15000;
const MAX_EXTRA_SYMBOLS = 60;

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
const quoteCache = new Map();   // symbol -> { at, data | null }
const searchCache = new Map();
const aboutCache = new Map();

// NSE symbols: letters, digits, & and - (for example TCS, M&M, BAJAJ-AUTO)
const SYMBOL_PATTERN = /^[A-Z0-9&-]{1,20}$/;
const OVERRIDES = new Map(svc.STOCKS.filter((s) => s.yahoo).map((s) => [s.symbol, s.yahoo]));

const isValidSymbol = (symbol) => SYMBOL_PATTERN.test(symbol);
const isValidRange = (range) => Object.prototype.hasOwnProperty.call(RANGES, range);
const isBase = (symbol) => svc.STOCKS.some((s) => s.symbol === symbol);
const yahooFor = (symbol) => OVERRIDES.get(symbol) || symbol + ".NS";

function notFound(symbol) {
  const err = new Error("Stock not found: " + symbol);
  err.status = 404;
  return err;
}

// Turns "Yahoo says this symbol does not exist" into a 404 instead of a 503
function asNotFound(err, symbol) {
  return /not found|no data|no fundamentals|invalid/i.test(err.message) ? notFound(symbol) : err;
}

function ensureYahooUp() {
  if (svc.isYahooDown()) throw new Error("Live data is unavailable right now");
}

// ---------- Details: price, open, high, low, 52-week range, market cap, P/E, about ----------
async function getAbout(symbol, yf) {
  if (aboutCache.has(symbol)) return aboutCache.get(symbol);
  if (svc.isQuoteApiBlocked()) return null; // the profile needs the blocked API; try again later
  let about = null;
  try {
    const res = await svc.withTimeout(
      yf.quoteSummary(yahooFor(symbol), { modules: ["assetProfile"] }),
      QUOTE_TIMEOUT
    );
    about = res?.assetProfile?.longBusinessSummary || null;
    if (about && about.length > 600) about = about.slice(0, 597).trimEnd() + "…";
  } catch {
    /* the profile is optional */
  }
  aboutCache.set(symbol, about);
  return about;
}

async function getDetails(symbol) {
  const hit = detailsCache.get(symbol);
  if (hit && Date.now() - hit.at < DETAILS_TTL) return hit.data;

  ensureYahooUp();

  let q;
  try {
    [q] = await svc.quoteMany([yahooFor(symbol)]);
  } catch (err) {
    throw asNotFound(err, symbol);
  }
  if (!q || q.regularMarketPrice == null) throw notFound(symbol);
  const yf = await svc.getYahoo();

  const data = {
    source: "yahoo",
    symbol,
    name: q.longName || q.shortName || symbol,
    price: q.regularMarketPrice,
    prevClose: q.regularMarketPreviousClose ?? null,
    percent: q.regularMarketChangePercent ?? 0,
    open: q.regularMarketOpen ?? null,
    high: q.regularMarketDayHigh ?? null,
    low: q.regularMarketDayLow ?? null,
    high52: q.fiftyTwoWeekHigh ?? null,
    low52: q.fiftyTwoWeekLow ?? null,
    volume: q.regularMarketVolume ?? null,
    marketCap: q.marketCap ?? null,
    pe: q.trailingPE ?? null,
    about: await getAbout(symbol, yf),
  };
  detailsCache.set(symbol, { at: Date.now(), data });
  return data;
}

// ---------- Live prices for stocks outside the built-in list ----------
async function getExtraQuotes(symbols) {
  const out = [];
  const need = [];

  for (const sym of symbols) {
    const hit = quoteCache.get(sym);
    if (hit && Date.now() - hit.at < QUOTE_TTL) {
      if (hit.data) out.push(hit.data);
    } else {
      need.push(sym);
    }
  }

  if (need.length && !svc.isYahooDown()) {
    try {
      const results = await svc.quoteMany(need.map(yahooFor));
      const byYahoo = new Map(results.filter(Boolean).map((r) => [r.symbol, r]));

      for (const sym of need) {
        const q = byYahoo.get(yahooFor(sym));
        const data =
          q && q.regularMarketPrice != null
            ? {
                symbol: sym,
                name: q.longName || q.shortName || sym,
                price: q.regularMarketPrice,
                prevClose: q.regularMarketPreviousClose ?? q.regularMarketPrice,
                percent: q.regularMarketChangePercent ?? 0,
                volume: q.regularMarketVolume ?? 0,
              }
            : null;
        quoteCache.set(sym, { at: Date.now(), data }); // unknown symbols are remembered too
        if (data) out.push(data);
      }
    } catch (err) {
      console.warn("Extra quotes failed:", err.message);
    }
  }
  return out;
}

// Real prices for alert checking. Simulated prices are never used here.
async function getPrices(symbols) {
  const prices = new Map();
  const base = symbols.filter(isBase);
  const extra = symbols.filter((s) => !isBase(s)).slice(0, MAX_EXTRA_SYMBOLS);

  if (base.length) {
    const quotes = await svc.getQuotes();
    if (quotes.source === "yahoo") quotes.stocks.forEach((s) => prices.set(s.symbol, s.price));
  }
  if (extra.length) {
    (await getExtraQuotes(extra)).forEach((q) => prices.set(q.symbol, q.price));
  }
  return prices;
}

// ---------- Search ----------
async function searchStocks(rawQuery) {
  const query = String(rawQuery || "").trim().slice(0, 40);
  if (!query) return [];

  const key = query.toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_TTL) return hit.data;

  const local = svc.STOCKS.filter(
    (s) => s.symbol.toLowerCase().includes(key) || s.name.toLowerCase().includes(key)
  ).map((s) => ({ symbol: s.symbol, name: s.name }));

  let remote = [];
  let ok = false;
  if (!svc.isYahooDown()) {
    try {
      const yf = await svc.getYahoo();
      const res = await svc.withTimeout(yf.search(query, { quotesCount: 15, newsCount: 0 }), SEARCH_TIMEOUT);
      remote = (res.quotes || [])
        .filter((q) => typeof q.symbol === "string" && q.symbol.endsWith(".NS"))
        .map((q) => ({ symbol: q.symbol.slice(0, -3), name: q.longname || q.shortname || q.symbol }))
        .filter((q) => isValidSymbol(q.symbol));
      ok = true;
    } catch (err) {
      console.warn("Search failed:", err.message);
    }
  }

  const seen = new Set(local.map((s) => s.symbol));
  const data = [...local, ...remote.filter((r) => !seen.has(r.symbol))].slice(0, 10);
  if (ok) searchCache.set(key, { at: Date.now(), data });
  return data;
}

// ---------- History for the chart ----------
const istDay = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

async function getHistory(symbol, range) {
  const cfg = RANGES[range];
  if (!cfg) throw new Error("Unknown range");

  const key = symbol + ":" + range;
  const hit = historyCache.get(key);
  if (hit && Date.now() - hit.at < cfg.ttl) return hit.data;

  ensureYahooUp();
  const yf = await svc.getYahoo();

  let result;
  try {
    result = await svc.withTimeout(
      yf.chart(yahooFor(symbol), {
        period1: new Date(Date.now() - cfg.days * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: cfg.interval,
      }),
      HISTORY_TIMEOUT
    );
  } catch (err) {
    throw asNotFound(err, symbol);
  }

  let points = (result.quotes || [])
    .filter((q) => q.close != null)
    .map((q) => ({ t: new Date(q.date).toISOString(), c: +q.close.toFixed(2) }));

  // "1D" shows only the latest trading day
  if (cfg.lastSessionOnly && points.length) {
    const lastDay = istDay(points[points.length - 1].t);
    points = points.filter((p) => istDay(p.t) === lastDay);
  }
  if (!points.length) throw notFound(symbol);

  const data = { source: "yahoo", symbol, range, points };
  historyCache.set(key, { at: Date.now(), data });
  return data;
}

module.exports = {
  isValidSymbol,
  isValidRange,
  isBase,
  getDetails,
  getHistory,
  getExtraQuotes,
  getPrices,
  searchStocks,
  MAX_EXTRA_SYMBOLS,
};

