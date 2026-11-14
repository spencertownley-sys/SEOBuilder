import { lookup as dnsLookup } from "node:dns";
import { lookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, EnvHttpProxyAgent, fetch, type Dispatcher } from "undici";

export const USER_AGENT = "MentionfulBot/0.1 (+https://mentionful.com/bot)";
/** The crawler's name before the Mentionful rename. robots.txt groups written for it are still obeyed. */
export const LEGACY_BOT_TOKEN = "SEOBuilderBot";

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

/**
 * True for every address that is not ordinary public unicast: private, loopback, link-local,
 * carrier-grade NAT, multicast, broadcast and all IANA special-purpose blocks (ipaddr.js
 * range() other than "unicast"). That includes 192.0.0.0/24, 198.18.0.0/15, fec0::/10,
 * ff00::/8, NAT64 (64:ff9b::/96) and 6to4 (2002::/16). IPv4-mapped IPv6 is unwrapped first.
 * Anything that doesn't parse is refused.
 */
export function isPrivateAddress(ip: string): boolean {
  let addr: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    addr = ipaddr.parse(ip);
  } catch {
    return true;
  }
  if (addr.kind() === "ipv6" && (addr as ipaddr.IPv6).isIPv4MappedAddress()) addr = (addr as ipaddr.IPv6).toIPv4Address();
  return addr.range() !== "unicast";
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
