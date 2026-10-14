import { describe, expect, it } from "vitest";
import app from "./index";
import { testEnv } from "./testing/d1";

const preflight = (origin: string) =>
  app.request("/v1/sync", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" } }, testEnv());

describe("CORS(ローカル開発用)", () => {
  it("localhost からは許可する", async () => {
    const res = await preflight("http://localhost:8081");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:8081");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("ほかのサイトには許可を出さない", async () => {
    const res = await preflight("https://evil.example.com");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
