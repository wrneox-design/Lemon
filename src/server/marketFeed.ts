export type MarketCategory = 'Forex' | 'Metals' | 'Indices' | 'Crypto';
export type TimeFrame = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export interface MarketQuote {
  symbol: string;
  displayName: string;
  category: MarketCategory;
  basePrice: number;
  bid: number;
  ask: number;
  low: number;
  high: number;
  spreadPoints: number;
  changePoints: number;
  change24h: number;
  decimals: number;
  pipSplitCount: number;
  pipMultiplier: number;
  tickTrend: 'up' | 'down' | 'neutral';
  source: 'live-exchange' | 'live-fx' | 'simulated';
  updatedAt: number;
}

export interface MarketCandle {
  time: number; // Unix timestamp in seconds (bar open time)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface InstrumentSeed {
  symbol: string;
  displayName: string;
  category: MarketCategory;
  defaultPrice: number;
  spreadPoints: number;
  decimals: number;
  pipSplitCount: number;
  pipMultiplier: number;
  binanceSymbol?: string;
}

export const INSTRUMENT_SEEDS: InstrumentSeed[] = [
  {
    symbol: 'XAUUSD.',
    displayName: 'Gold vs US-Dollar',
    category: 'Metals',
    defaultPrice: 3632.55,
    spreadPoints: 132,
    decimals: 2,
    pipSplitCount: 2,
    pipMultiplier: 0.1,
    binanceSymbol: 'PAXGUSDT',
  },
  {
    symbol: 'EURUSD.',
    displayName: 'Euro vs US Dollar',
    category: 'Forex',
    defaultPrice: 1.09125,
    spreadPoints: 18,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
    binanceSymbol: 'EURUSDT',
  },
  {
    symbol: 'GBPUSD.',
    displayName: 'Great British Pound vs US Dollar',
    category: 'Forex',
    defaultPrice: 1.3041,
    spreadPoints: 22,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
  },
  {
    symbol: 'USDCHF.',
    displayName: 'US Dollar vs Swiss Franc',
    category: 'Forex',
    defaultPrice: 0.84122,
    spreadPoints: 22,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
  },
  {
    symbol: 'USDJPY.',
    displayName: 'US Dollar vs Japanese Yen',
    category: 'Forex',
    defaultPrice: 158.951,
    spreadPoints: 24,
    decimals: 3,
    pipSplitCount: 3,
    pipMultiplier: 0.01,
  },
  {
    symbol: 'USDCAD.',
    displayName: 'US Dollar vs Canadian Dollar',
    category: 'Forex',
    defaultPrice: 1.43599,
    spreadPoints: 22,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
  },
  {
    symbol: 'AUDCAD.',
    displayName: 'Australian Dollar vs Canadian Dollar',
    category: 'Forex',
    defaultPrice: 0.95131,
    spreadPoints: 28,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
  },
  {
    symbol: 'NZDUSD.',
    displayName: 'New Zealand Dollar vs US Dollar',
    category: 'Forex',
    defaultPrice: 0.54473,
    spreadPoints: 25,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
  },
  {
    symbol: 'EURGBP.',
    displayName: 'Euro vs Great British Pound',
    category: 'Forex',
    defaultPrice: 0.83661,
    spreadPoints: 24,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
  },
  {
    symbol: 'AUDUSD.',
    displayName: 'Australian Dollar vs US Dollar',
    category: 'Forex',
    defaultPrice: 0.66245,
    spreadPoints: 25,
    decimals: 5,
    pipSplitCount: 3,
    pipMultiplier: 0.0001,
  },
  {
    symbol: 'NAS100',
    displayName: 'US Tech 100 Cash',
    category: 'Indices',
    defaultPrice: 20850.0,
    spreadPoints: 20,
    decimals: 1,
    pipSplitCount: 1,
    pipMultiplier: 1.0,
  },
  {
    symbol: 'BTCUSD',
    displayName: 'Bitcoin vs US Dollar',
    category: 'Crypto',
    defaultPrice: 60580.0,
    spreadPoints: 180,
    decimals: 1,
    pipSplitCount: 1,
    pipMultiplier: 10.0,
    binanceSymbol: 'BTCUSDT',
  },
  {
    symbol: 'ETHUSD',
    displayName: 'Ethereum vs US Dollar',
    category: 'Crypto',
    defaultPrice: 1705.0,
    spreadPoints: 140,
    decimals: 2,
    pipSplitCount: 2,
    pipMultiplier: 0.5,
    binanceSymbol: 'ETHUSDT',
  },
];

export function getTimeframeSeconds(tf: TimeFrame): number {
  switch (tf) {
    case 'M1':
      return 60;
    case 'M5':
      return 300;
    case 'M15':
      return 900;
    case 'H1':
      return 3600;
    case 'H4':
      return 14400;
    case 'D1':
      return 86400;
  }
}

function toBinanceInterval(tf: TimeFrame): string {
  switch (tf) {
    case 'M1':
      return '1m';
    case 'M5':
      return '5m';
    case 'M15':
      return '15m';
    case 'H1':
      return '1h';
    case 'H4':
      return '4h';
    case 'D1':
      return '1d';
  }
}

export class MarketFeedService {
  private quotes = new Map<string, MarketQuote>();
  private klineCache = new Map<string, { fetchedAt: number; candles: MarketCandle[] }>();
  private listeners = new Set<(quotes: MarketQuote[]) => void>();
  private pollTimer: NodeJS.Timeout | null = null;
  private fxLastFetch = 0;
  private externalSyncActive = false;

  constructor() {
    const now = Date.now();
    for (const seed of INSTRUMENT_SEEDS) {
      const spreadDiff = seed.spreadPoints * Math.pow(10, -seed.decimals);
      const halfSpread = spreadDiff / 2;
      const bid = Number((seed.defaultPrice - halfSpread).toFixed(seed.decimals));
      const ask = Number((bid + spreadDiff).toFixed(seed.decimals));
      this.quotes.set(seed.symbol, {
        symbol: seed.symbol,
        displayName: seed.displayName,
        category: seed.category,
        basePrice: seed.defaultPrice,
        bid,
        ask,
        low: Number((bid * 0.996).toFixed(seed.decimals)),
        high: Number((ask * 1.004).toFixed(seed.decimals)),
        spreadPoints: seed.spreadPoints,
        changePoints: 0,
        change24h: 0,
        decimals: seed.decimals,
        pipSplitCount: seed.pipSplitCount,
        pipMultiplier: seed.pipMultiplier,
        tickTrend: 'neutral',
        source: 'simulated',
        updatedAt: now,
      });
    }
  }

  start(): void {
    if (this.pollTimer) return;
    void this.syncExternalPrices();
    this.pollTimer = setInterval(() => {
      void this.tickAndSync();
    }, 1000);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  subscribe(listener: (quotes: MarketQuote[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getQuotes(): MarketQuote[] {
    return INSTRUMENT_SEEDS.map((s) => this.quotes.get(s.symbol)!);
  }

  private tickCounter = 0;

  private async tickAndSync(): Promise<void> {
    this.tickCounter += 1;
    // Every 3 seconds fetch live spot tickers from Binance; every 60 seconds refresh FX spot rates
    if (this.tickCounter % 3 === 0) {
      await this.syncExternalPrices();
    } else {
      this.applyMicroTicks();
    }
    const snapshot = this.getQuotes();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private applyMicroTicks(): void {
    const now = Date.now();
    for (const seed of INSTRUMENT_SEEDS) {
      const q = this.quotes.get(seed.symbol);
      if (!q) continue;
      // Realistic subtle bid/ask fluctuation between exchange polls
      const vol =
        seed.category === 'Crypto'
          ? 0.00038
          : seed.category === 'Metals'
            ? 0.00018
            : seed.category === 'Indices'
              ? 0.00022
              : 0.00009;
      const delta = (Math.random() - 0.495) * q.bid * vol;
      const newBid = Number(Math.max(0.0001, q.bid + delta).toFixed(seed.decimals));
      const spreadDiff = seed.spreadPoints * Math.pow(10, -seed.decimals);
      const newAsk = Number((newBid + spreadDiff).toFixed(seed.decimals));
      const trend: 'up' | 'down' | 'neutral' =
        newBid > q.bid ? 'up' : newBid < q.bid ? 'down' : q.tickTrend;
      const chgPct = ((newBid - q.basePrice) / q.basePrice) * 100;
      const chgPts = Math.round((newBid - q.basePrice) * Math.pow(10, seed.decimals));

      this.quotes.set(seed.symbol, {
        ...q,
        bid: newBid,
        ask: newAsk,
        low: Math.min(q.low, newBid),
        high: Math.max(q.high, newAsk),
        change24h: Number(chgPct.toFixed(2)),
        changePoints: chgPts,
        tickTrend: trend,
        updatedAt: now,
      });
    }
  }

  private async syncExternalPrices(): Promise<void> {
    if (this.externalSyncActive) return;
    this.externalSyncActive = true;
    const now = Date.now();

    try {
      // 1. Live Binance Spot 24hr Ticker for PAXGUSDT (Gold), EURUSDT, BTCUSDT, ETHUSDT
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2400);
      try {
        const resp = await fetch(
          'https://api.binance.com/api/v3/ticker/24hr?symbols=["PAXGUSDT","EURUSDT","BTCUSDT","ETHUSDT"]',
          { signal: controller.signal }
        );
        if (resp.ok) {
          const rows = (await resp.json()) as Array<{
            symbol: string;
            lastPrice: string;
            highPrice: string;
            lowPrice: string;
            priceChangePercent: string;
            openPrice: string;
          }>;
          for (const row of rows) {
            const seed = INSTRUMENT_SEEDS.find((s) => s.binanceSymbol === row.symbol);
            if (!seed) continue;
            const prev = this.quotes.get(seed.symbol)!;
            const liveMid = Number(row.lastPrice);
            if (!Number.isFinite(liveMid) || liveMid <= 0) continue;

            const spreadDiff = seed.spreadPoints * Math.pow(10, -seed.decimals);
            // Tiny sub-pip tick variation so bid/ask stays alive every second even between Binance prints
            const jitter = (Math.random() - 0.5) * spreadDiff * 0.15;
            const bid = Number((liveMid - spreadDiff / 2 + jitter).toFixed(seed.decimals));
            const ask = Number((bid + spreadDiff).toFixed(seed.decimals));
            const openPrice = Number(row.openPrice) || prev.basePrice;
            const chgPct = Number(row.priceChangePercent);
            const chgPts = Math.round((bid - openPrice) * Math.pow(10, seed.decimals));

            this.quotes.set(seed.symbol, {
              ...prev,
              basePrice: openPrice,
              bid,
              ask,
              low: Number(row.lowPrice) || Math.min(prev.low, bid),
              high: Number(row.highPrice) || Math.max(prev.high, ask),
              change24h: Number.isFinite(chgPct) ? Number(chgPct.toFixed(2)) : prev.change24h,
              changePoints: chgPts,
              tickTrend: bid > prev.bid ? 'up' : bid < prev.bid ? 'down' : prev.tickTrend,
              source: 'live-exchange',
              updatedAt: now,
            });
          }
        }
      } finally {
        clearTimeout(timeout);
      }

      // 2. Live FX Spot Rates (every 60s)
      if (now - this.fxLastFetch > 60_000) {
        const fxController = new AbortController();
        const fxTimeout = setTimeout(() => fxController.abort(), 2400);
        try {
          const fxResp = await fetch('https://open.er-api.com/v6/latest/USD', {
            signal: fxController.signal,
          });
          if (fxResp.ok) {
            const data = (await fxResp.json()) as { rates?: Record<string, number> };
            const r = data.rates;
            if (r && r.EUR && r.GBP && r.CHF && r.JPY && r.CAD && r.AUD && r.NZD) {
              this.fxLastFetch = now;
              const derivedSpots: Record<string, number> = {
                'GBPUSD.': 1 / r.GBP,
                'USDCHF.': r.CHF,
                'USDJPY.': r.JPY,
                'USDCAD.': r.CAD,
                'AUDCAD.': r.CAD / r.AUD,
                'NZDUSD.': 1 / r.NZD,
                'EURGBP.': r.GBP / r.EUR,
                'AUDUSD.': 1 / r.AUD,
              };
              for (const [sym, spot] of Object.entries(derivedSpots)) {
                const seed = INSTRUMENT_SEEDS.find((s) => s.symbol === sym);
                const prev = this.quotes.get(sym);
                if (!seed || !prev || !Number.isFinite(spot) || spot <= 0) continue;
                const spreadDiff = seed.spreadPoints * Math.pow(10, -seed.decimals);
                const bid = Number((spot - spreadDiff / 2).toFixed(seed.decimals));
                const ask = Number((bid + spreadDiff).toFixed(seed.decimals));
                this.quotes.set(sym, {
                  ...prev,
                  basePrice: prev.source === 'simulated' ? spot : prev.basePrice,
                  bid,
                  ask,
                  low: Math.min(prev.low, bid),
                  high: Math.max(prev.high, ask),
                  tickTrend: bid > prev.bid ? 'up' : bid < prev.bid ? 'down' : 'neutral',
                  source: 'live-fx',
                  updatedAt: now,
                });
              }
            }
          }
        } finally {
          clearTimeout(fxTimeout);
        }
      }
    } catch {
      // Fallback smoothly to micro-ticks if external APIs are offline
      this.applyMicroTicks();
    } finally {
      this.externalSyncActive = false;
    }
  }

  async getCandles(symbol: string, timeframe: TimeFrame, limit = 140): Promise<{
    candles: MarketCandle[];
    source: string;
    quote: MarketQuote;
  }> {
    const seed = INSTRUMENT_SEEDS.find((s) => s.symbol === symbol) || INSTRUMENT_SEEDS[0];
    const quote = this.quotes.get(seed.symbol)!;
    const tfSec = getTimeframeSeconds(timeframe);
    const cacheKey = `${seed.symbol}:${timeframe}`;
    const cached = this.klineCache.get(cacheKey);
    const nowMs = Date.now();

    // Return cached external candles if fresh (< 12s) and merge live tick into latest bar
    if (cached && nowMs - cached.fetchedAt < 12_000 && cached.candles.length > 0) {
      return {
        candles: this.mergeLiveTickIntoCandles(cached.candles, quote.bid, tfSec, seed.decimals),
        source: quote.source,
        quote,
      };
    }

    // Try real Binance Klines if instrument maps directly (Gold PAXGUSDT, EURUSDT, BTCUSDT, ETHUSDT)
    if (seed.binanceSymbol) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2800);
      try {
        const url = `https://api.binance.com/api/v3/klines?symbol=${seed.binanceSymbol}&interval=${toBinanceInterval(
          timeframe
        )}&limit=${limit}`;
        const resp = await fetch(url, { signal: controller.signal });
        if (resp.ok) {
          const rows = (await resp.json()) as Array<
            [number, string, string, string, string, string]
          >;
          if (Array.isArray(rows) && rows.length > 0) {
            const parsed: MarketCandle[] = rows.map((k) => ({
              time: Math.floor(Number(k[0]) / 1000),
              open: Number(Number(k[1]).toFixed(seed.decimals)),
              high: Number(Number(k[2]).toFixed(seed.decimals)),
              low: Number(Number(k[3]).toFixed(seed.decimals)),
              close: Number(Number(k[4]).toFixed(seed.decimals)),
              volume: Math.round(Number(k[5])),
            }));
            this.klineCache.set(cacheKey, { fetchedAt: nowMs, candles: parsed });
            return {
              candles: this.mergeLiveTickIntoCandles(parsed, quote.bid, tfSec, seed.decimals),
              source: 'live-exchange',
              quote,
            };
          }
        }
      } catch {
        // Fall through to synthesized anchor series on transient error
      } finally {
        clearTimeout(timeout);
      }
    }

    // For Forex crosses / NAS100 without direct Binance ticker, build deterministic real-time anchored OHLC bars
    const synthetic = this.buildAnchoredHistory(seed, quote.bid, timeframe, limit);
    this.klineCache.set(cacheKey, { fetchedAt: nowMs, candles: synthetic });
    return {
      candles: this.mergeLiveTickIntoCandles(synthetic, quote.bid, tfSec, seed.decimals),
      source: quote.source,
      quote,
    };
  }

  private mergeLiveTickIntoCandles(
    candles: MarketCandle[],
    liveBid: number,
    tfSec: number,
    decimals: number
  ): MarketCandle[] {
    if (candles.length === 0) return [];
    const copy = candles.map((c) => ({ ...c }));
    const currentBucket = Math.floor(Date.now() / 1000 / tfSec) * tfSec;
    const last = copy[copy.length - 1];

    if (currentBucket > last.time) {
      copy.push({
        time: currentBucket,
        open: last.close,
        high: Number(Math.max(last.close, liveBid).toFixed(decimals)),
        low: Number(Math.min(last.close, liveBid).toFixed(decimals)),
        close: liveBid,
        volume: 120,
      });
    } else {
      last.close = liveBid;
      last.high = Number(Math.max(last.high, liveBid).toFixed(decimals));
      last.low = Number(Math.min(last.low, liveBid).toFixed(decimals));
    }
    return copy;
  }

  private buildAnchoredHistory(
    seed: InstrumentSeed,
    liveBid: number,
    timeframe: TimeFrame,
    limit: number
  ): MarketCandle[] {
    const tfSec = getTimeframeSeconds(timeframe);
    const currentBucket = Math.floor(Date.now() / 1000 / tfSec) * tfSec;
    const scale =
      timeframe === 'M1'
        ? 0.00045
        : timeframe === 'M5'
          ? 0.00095
          : timeframe === 'M15'
            ? 0.0015
            : timeframe === 'H1'
              ? 0.0026
              : timeframe === 'H4'
                ? 0.004
                : 0.0065;
    const vol = liveBid * scale;
    const symHash = seed.symbol.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);

    const raw: MarketCandle[] = [];
    let cursor = liveBid;
    for (let i = 0; i < limit; i++) {
      const barTime = currentBucket - (limit - 1 - i) * tfSec;
      const seedStep = barTime / tfSec + symHash;
      const move = (Math.sin(seedStep * 0.43) * 0.58 + Math.cos(seedStep * 1.13) * 0.34) * vol;
      const close = cursor + move;
      const wickUp = Math.abs(Math.sin(seedStep * 1.7)) * vol * 0.65;
      const wickDown = Math.abs(Math.cos(seedStep * 1.3)) * vol * 0.65;
      raw.push({
        time: barTime,
        open: cursor,
        high: Math.max(cursor, close) + wickUp,
        low: Math.min(cursor, close) - wickDown,
        close,
        volume: Math.floor(150 + Math.abs(Math.sin(seedStep)) * 450),
      });
      cursor = close;
    }

    const lastClose = raw[raw.length - 1].close;
    const offset = liveBid - lastClose;
    return raw.map((c) => ({
      ...c,
      open: Number((c.open + offset).toFixed(seed.decimals)),
      high: Number((c.high + offset).toFixed(seed.decimals)),
      low: Number((c.low + offset).toFixed(seed.decimals)),
      close: Number((c.close + offset).toFixed(seed.decimals)),
    }));
  }
}
