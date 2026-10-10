import { describe, expect, it } from "vitest";
import { isPrivateAddress, politeFetch } from "../src/crawl/fetcher.js";

describe("SSRF guard", () => {
  it("classifies private addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "0.0.0.0"])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("refuses localhost and metadata endpoints by default", async () => {
    expect((await politeFetch("http://127.0.0.1:1/")).error).toMatch(/private/);
    expect((await politeFetch("http://localhost/")).error).toMatch(/private/);
    expect((await politeFetch("http://169.254.169.254/latest/meta-data")).error).toMatch(/private/);
    expect((await politeFetch("file:///etc/passwd")).error).toMatch(/protocol/);
  });
});

describe("connection-time DNS guard", () => {
  it("refuses names that resolve to private addresses", async () => {
    const { guardedLookup } = await import("../src/crawl/fetcher.js");
    const err = await new Promise<Error | null>((resolve) => guardedLookup("localhost", {}, (e) => resolve(e)));
    expect(err?.message).toMatch(/private address/);
  });
});
