// Price source: Yahoo Finance (no API key needed).
// If Yahoo fails, the server falls back to simulated prices so the app keeps working.

const STOCKS = [
  { symbol: "RELIANCE",   name: "Reliance Industries", price: 2945.5,  percent: 1.8,  volume: 8200000 },
  { symbol: "TCS",        name: "Tata Consultancy",    price: 4120.0,  percent: -0.9, volume: 2100000 },
  { symbol: "INFY",       name: "Infosys",             price: 1890.3,  percent: 2.4,  volume: 5400000 },
  { symbol: "HDFCBANK",   name: "HDFC Bank",           price: 1650.75, percent: -1.2, volume: 9100000 },
  { symbol: "ICICIBANK",  name: "ICICI Bank",          price: 1210.4,  percent: 3.1,  volume: 7600000 },
  { symbol: "SBIN",       name: "State Bank of India", price: 815.9,   percent: -2.3, volume: 12500000 },
  { symbol: "ITC",        name: "ITC Limited",         price: 468.2,   percent: 0.6,  volume: 6900000 },
  { symbol: "WIPRO",      name: "Wipro",               price: 540.1,   percent: -3.4, volume: 4300000 },
  { symbol: "TATAMOTORS", name: "Tata Motors",         price: 985.6,   percent: 4.2,  volume: 11200000, yahoo: "TMPV.NS" },
  { symbol: "ADANIENT",   name: "Adani Enterprises",   price: 3120.0,  percent: -1.7, volume: 3300000 },
];

const INDICES = [
  { name: "NIFTY 50",   yahoo: "^NSEI",    value: 24350.45, change: 120.3 },
  { name: "SENSEX",     yahoo: "^BSESN",   value: 80120.8,  change: 310.2 },
  { name: "BANK NIFTY", yahoo: "^NSEBANK", value: 52410.1,  change: -95.6 },
];

const CACHE_MS = 30 * 1000;                  // reuse results for 30 seconds
const RETRY_YAHOO_AFTER_MS = 5 * 60 * 1000;  // after a failure, wait 5 minutes before trying Yahoo again
const TIMEOUT_MS = 8000;
const LIBRARY_RETRY_MS = 10 * 60 * 1000; // if Yahoo's quote API blocks us, use the chart endpoint for 10 minutes

let cache = { at: 0, data: null };
let inflight = null;
let yahooDownUntil = 0;
let yahooClient = null;
let libraryBlockedUntil = 0;
const warned = new Set(); // so each missing symbol is reported only once

const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Timed out")), ms))]);

// Yahoo's symbol for a stock (NSE stocks end with .NS)
const yahooSymbol = (s) => s.yahoo || s.symbol + ".NS";

function warnOnce(key, text) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(text);
}

// Works with both old (instance export) and new (class export) versions of yahoo-finance2
async function getYahoo() {
  if (yahooClient) return yahooClient;
  const mod = await import("yahoo-finance2");
  const Y = mod.default;
  if (typeof Y === "function") {
    yahooClient = new Y({ suppressNotices: ["yahooSurvey"] });
  } else {
    Y.suppressNotices?.(["yahooSurvey"]);
    yahooClient = Y;
  }
  return yahooClient;
}

﻿// ---------- Crumb-free fallback ----------
// Yahoo often refuses the normal quote API ("Failed to get crumb ... 429") when the
// request comes from a cloud server. The chart endpoint has no crumb, so it still works.
const CHART_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json",
};

// Returns a quote shaped like yahoo-finance2's, or null if the symbol does not exist
async function chartQuote(sym) {
  let lastErr;
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
      const res = await fetch(url, { headers: CHART_HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Yahoo chart status " + res.status);
      const meta = (await res.json())?.chart?.result?.[0]?.meta;
      if (!meta || meta.regularMarketPrice == null) return null;

      const price = meta.regularMarketPrice;
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? price;
      return {
        symbol: sym,
        longName: meta.longName,
        shortName: meta.shortName,
        regularMarketPrice: price,
        regularMarketPreviousClose: prev,
        regularMarketChange: price - prev,
        regularMarketChangePercent: prev ? ((price - prev) / prev) * 100 : 0,
        regularMarketVolume: meta.regularMarketVolume ?? 0,
        regularMarketDayHigh: meta.regularMarketDayHigh ?? null,
        regularMarketDayLow: meta.regularMarketDayLow ?? null,
        fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
        fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

async function chartQuotes(symbols) {
  const settled = await Promise.allSettled(symbols.map(chartQuote));
  const found = settled.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
  const failed = settled.find((r) => r.status === "rejected");
  if (!found.length && failed) throw failed.reason; // nothing worked: report the real error
  return found;
}

// Quotes for many Yahoo symbols at once: the normal API first, the chart endpoint if it is blocked
async function quoteMany(symbols) {
  if (Date.now() >= libraryBlockedUntil) {
    try {
      const yf = await getYahoo();
      const r = await withTimeout(yf.quote(symbols), TIMEOUT_MS);
      return Array.isArray(r) ? r : r ? [r] : [];
    } catch (err) {
      if (!/crumb|429|too many|cookie/i.test(err.message)) throw err;
      libraryBlockedUntil = Date.now() + LIBRARY_RETRY_MS;
      console.warn(`Yahoo quote API blocked (${err.message}). Using the chart endpoint instead.`);
    }
  }
  return chartQuotes(symbols);
}

async function fetchFromYahoo() {
  const symbols = [...STOCKS.map(yahooSymbol), ...INDICES.map((i) => i.yahoo)];
  const results = await quoteMany(symbols);
  const bySymbol = new Map(results.map((r) => [r.symbol, r]));

  // A missing symbol is skipped (with one warning) instead of breaking everything
  const stocks = [];
  STOCKS.forEach((s) => {
    const q = bySymbol.get(yahooSymbol(s));
    if (!q || q.regularMarketPrice == null) {
      warnOnce(s.symbol, `No Yahoo quote for ${s.symbol} (${yahooSymbol(s)}), skipping it`);
      return;
    }
    stocks.push({
      symbol: s.symbol,
      name: s.name,
      price: q.regularMarketPrice,
      prevClose: q.regularMarketPreviousClose ?? q.regularMarketPrice,
      percent: q.regularMarketChangePercent ?? 0,
      volume: q.regularMarketVolume ?? 0,
    });
  });
  if (!stocks.length) throw new Error("Yahoo returned no stock quotes");

  const indices = [];
  INDICES.forEach((i) => {
    const q = bySymbol.get(i.yahoo);
    if (!q || q.regularMarketPrice == null) {
      warnOnce(i.name, `No Yahoo quote for ${i.name} (${i.yahoo}), skipping it`);
      return;
    }
    indices.push({
      name: i.name,
      value: q.regularMarketPrice,
      change: q.regularMarketChange ?? 0,
      percent: q.regularMarketChangePercent ?? 0,
    });
  });

  return { source: "yahoo", stocks, indices };
}

// ---------- Simulated prices (fallback) ----------
const mock = {
  stocks: STOCKS.map((s) => ({ ...s, prevClose: s.price / (1 + s.percent / 100) })),
  indices: INDICES.map((i) => ({ ...i, prevClose: i.value - i.change })),
};

function nextMock() {
  mock.stocks.forEach((s) => {
    s.price = +(s.price * (1 + (Math.random() - 0.5) * 0.006)).toFixed(2);
  });
  mock.indices.forEach((i) => {
    i.value = +(i.value * (1 + (Math.random() - 0.5) * 0.003)).toFixed(2);
  });
  return {
    source: "simulated",
    stocks: mock.stocks.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      price: s.price,
      prevClose: +s.prevClose.toFixed(2),
      percent: ((s.price - s.prevClose) / s.prevClose) * 100,
      volume: s.volume,
    })),
    indices: mock.indices.map((i) => ({
      name: i.name,
      value: i.value,
      change: i.value - i.prevClose,
      percent: ((i.value - i.prevClose) / i.prevClose) * 100,
    })),
  };
}

// ---------- Public function ----------
async function getQuotes() {
  if (cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (inflight) return inflight;

  inflight = (async () => {
    let data;
    if (Date.now() >= yahooDownUntil) {
      try {
        data = await fetchFromYahoo();
      } catch (err) {
        console.warn("Yahoo Finance failed, using simulated prices:", err.message);
        yahooDownUntil = Date.now() + RETRY_YAHOO_AFTER_MS;
      }
    }
    if (!data) data = nextMock();
    cache = { at: Date.now(), data };
    return data;
  })().finally(() => {
    inflight = null;
  });

  return inflight;
}

module.exports = {
  getQuotes,
  STOCKS,
  yahooSymbol,
  getYahoo,
  quoteMany,
  isYahooDown: () => Date.now() < yahooDownUntil,
  isQuoteApiBlocked: () => Date.now() < libraryBlockedUntil,
  withTimeout,
};

