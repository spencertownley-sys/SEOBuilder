import { lookup as dnsLookup } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import { Agent, EnvHttpProxyAgent, fetch, type Dispatcher } from "undici";

export const USER_AGENT = "SEOBuilderBot/0.1 (+https://github.com/spencertownley-sys/SEOBuilder)";

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Refuse to connect to loopback, private and link-local addresses (SSRF guard). Default true. */
  blockPrivateNetworks?: boolean;
  method?: "GET" | "HEAD";
}

export interface FetchResult {
  url: string;
  finalUrl: string;
  status: number;
  redirectChain: string[];
  contentType: string;
  body: string;
  error?: string;
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) {
    const rest = v6.slice(7);
    if (isIP(rest) === 4) return isPrivateAddress(rest);
    // Hex form, e.g. ::ffff:7f00:1 is 127.0.0.1.
    const m = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest);
    if (m) {
      const hi = parseInt(m[1]!, 16);
      const lo = parseInt(m[2]!, 16);
      return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return true;
  }
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

export async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`Unsupported protocol ${url.protocol}`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error(`Refusing to fetch private host ${host}`);
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  for (const { address } of addrs) {
    if (isPrivateAddress(address)) throw new Error(`Refusing to fetch private address ${address}`);
  }
}

/**
 * DNS lookup that refuses private addresses at connection time. Because the socket connects to
 * the address this function returns, a hostname can't pass the check with a public IP and then
 * connect to a private one (DNS rebinding).
 */
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as unknown as { address: string; family: number }[];
    const bad = list.find((a) => isPrivateAddress(a.address));
    if (bad || !list.length) return callback(new Error(`Refusing to connect to private address ${bad?.address ?? hostname}`), "", 0);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

let pinned: Dispatcher | undefined;
let open: Dispatcher | undefined;

/**
 * Where an egress proxy is configured (local sandboxes), connections go through it and the proxy
 * resolves names, so only the pre-flight check applies. In production there is no proxy and every
 * connection goes through the pinned lookup.
 */
function dispatcherFor(blockPrivate: boolean): Dispatcher {
  if (process.env.HTTPS_PROXY || process.env.https_proxy) return (open ??= new EnvHttpProxyAgent());
  if (!blockPrivate) return (open ??= new Agent());
  return (pinned ??= new Agent({ connect: { lookup: guardedLookup } }));
}

/** Fetch with manual redirects (so every hop is checked), a timeout and a size cap. */
export async function politeFetch(url: string, opts: FetchOptions = {}): Promise<FetchResult> {
  const { timeoutMs = 15000, maxBytes = 3_000_000, maxRedirects = 5, blockPrivateNetworks = true, method = "GET" } = opts;
  const chain: string[] = [];
  let current = url;
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const u = new URL(current);
      if (blockPrivateNetworks) await assertPublicHost(u);
      const res = await fetch(u, {
        dispatcher: dispatcherFor(blockPrivateNetworks),
        method,
        redirect: "manual",
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.5" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        chain.push(current);
        current = new URL(location, current).toString();
        await res.body?.cancel();
        continue;
      }
      const contentType = res.headers.get("content-type") ?? "";
      const body = method === "HEAD" ? "" : await readCapped(res, maxBytes);
      return { url, finalUrl: current, status: res.status, redirectChain: chain, contentType, body };
    }
    return { url, finalUrl: current, status: 0, redirectChain: chain, contentType: "", body: "", error: "Too many redirects" };
  } catch (e) {
    return { url, finalUrl: current, status: 0, redirectChain: chain, contentType: "", body: "", error: (e as Error).message };
  }
}

async function readCapped(res: Awaited<ReturnType<typeof fetch>>, maxBytes: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
