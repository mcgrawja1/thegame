import { EnvHttpProxyAgent, ProxyAgent, fetch as undiciFetch, type Dispatcher } from 'undici';

export class SourceBlockedError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'SourceBlockedError';
  }
}

export class SourceTimeoutError extends Error {
  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'SourceTimeoutError';
  }
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
];

let dispatcher: Dispatcher | undefined;
function getDispatcher(): Dispatcher | undefined {
  if (dispatcher) return dispatcher;
  const scraperProxy = process.env.SCRAPER_PROXY_URL;
  if (scraperProxy) {
    dispatcher = new ProxyAgent(scraperProxy);
  } else if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy) {
    dispatcher = new EnvHttpProxyAgent();
  }
  return dispatcher;
}

export function browserHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  return {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    ...extra,
  };
}

const BLOCK_MARKERS = [
  'access denied',
  'are you a human',
  'robot or human',
  'verify you are human',
  'px-captcha',
  'captcha-delivery',
  'pardon our interruption',
  'unusual traffic',
  'request blocked',
  'bot detection',
  'incapsula',
  'cf-chl-',
  'challenge-platform',
];

export function looksBlocked(body: string): boolean {
  const head = body.slice(0, 20000).toLowerCase();
  return BLOCK_MARKERS.some((m) => head.includes(m));
}

export interface FetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
  body?: string;
  /** Number of additional attempts on network failure / 5xx. */
  retries?: number;
}

/** Walk an error's cause chain and return the most specific message/code. */
function describeCause(err: unknown): string {
  const parts: string[] = [];
  let cur = err as { message?: string; code?: string; cause?: unknown } | undefined;
  let depth = 0;
  while (cur && depth++ < 5) {
    const bits = [cur.code, cur.message].filter(Boolean).join(' ');
    if (bits && !parts.includes(bits)) parts.push(bits);
    cur = cur.cause as typeof cur;
  }
  return parts.filter((p) => p !== 'fetch failed').join(' <- ') || parts.join(' <- ');
}

function combineSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (a && b) return AbortSignal.any([a, b]);
  return a ?? b;
}

/**
 * Fetch a URL as text with browser-like headers, a timeout, proxy support and
 * bot-block detection. Throws SourceBlockedError / SourceTimeoutError so the
 * orchestrator can report a meaningful status per retailer.
 */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<{ status: number; body: string; url: string }> {
  const timeoutMs = opts.timeoutMs ?? Number(process.env.SOURCE_TIMEOUT_MS ?? 12000);
  const retries = opts.retries ?? 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = combineSignals(opts.signal, timeout);
    try {
      const res = await undiciFetch(url, {
        method: opts.method ?? 'GET',
        headers: browserHeaders(opts.headers),
        body: opts.body,
        signal,
        redirect: 'follow',
        dispatcher: getDispatcher(),
      } as Parameters<typeof undiciFetch>[1]);
      const body = await res.text();
      if (res.status === 403 || res.status === 429 || res.status === 503 || res.status === 407) {
        throw new SourceBlockedError(`HTTP ${res.status} from ${new URL(url).host}`, res.status);
      }
      if (res.status >= 500 && attempt < retries) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      if (looksBlocked(body)) {
        throw new SourceBlockedError(`Bot challenge served by ${new URL(url).host}`, res.status);
      }
      return { status: res.status, body, url: res.url || url };
    } catch (err) {
      if (err instanceof SourceBlockedError) throw err;
      const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
        if (opts.signal?.aborted) throw new SourceTimeoutError('Search cancelled');
        if (attempt < retries) {
          lastErr = err;
          continue;
        }
        throw new SourceTimeoutError(`Timed out after ${timeoutMs}ms`);
      }
      const causeMsg = describeCause(err);
      if (/403|407|proxy|tunnel/i.test(causeMsg)) {
        throw new SourceBlockedError(`Network policy or proxy blocked ${new URL(url).host}: ${causeMsg}`);
      }
      lastErr = new Error(`${new URL(url).host}: ${causeMsg || (e?.message ?? 'request failed')}`);
      if (attempt < retries) continue;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { body } = await fetchText(url, { ...opts, headers: { Accept: 'application/json', ...(opts.headers ?? {}) } });
  return JSON.parse(body) as T;
}
