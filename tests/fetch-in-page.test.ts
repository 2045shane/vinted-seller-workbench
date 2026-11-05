/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { performVintedFetch } from "../src/vinted/fetch-in-page";

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = "";
  document.cookie = "anon_id=; Max-Age=0";
});

describe("in-tab fetch", () => {
  it("calls the same origin with the session and the page csrf token", async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="csrf-test">';
    document.cookie = "anon_id=anon-test";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ user: { id: 1 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await performVintedFetch({ method: "GET", path: "/api/v2/users/current" });
    expect(result.kind).toBe("json");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v2/users/current");
    expect(init.credentials).toBe("include");
    const headers = new Headers(init.headers);
    expect(headers.get("X-CSRF-Token")).toBe("csrf-test");
    expect(headers.get("X-Anon-Id")).toBe("anon-test");
    expect(JSON.stringify(result)).not.toContain("csrf-test");
  });

  it("does not send a request for a foreign or open path", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const blocked = await performVintedFetch({ method: "GET", path: "https://evil.example/api/v2/users/current" });
    expect(blocked.kind).toBe("blocked");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
