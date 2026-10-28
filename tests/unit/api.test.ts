import { describe, expect, it } from "vitest";
import { rateLimit, ok, fail } from "@/server/api";

describe("api helpers", () => {
  it("fail() returns the structured error envelope", async () => {
    const res = fail(404, "not_found", "Missing thing.");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Missing thing.");
  });

  it("ok() wraps data and honors status overrides", async () => {
    const res = ok({ hello: true }, { status: 201 });
    expect(res.status).toBe(201);
  });
});

describe("rateLimit", () => {
  it("allows below the limit and blocks afterwards", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000)).toBeNull();
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked).not.toBeNull();
    expect((blocked as Response).status).toBe(429);
  });

  it("isolates buckets per key", () => {
    const a = `testA:${Math.random()}`;
    const b = `testB:${Math.random()}`;
    expect(rateLimit(a, 1, 60_000)).toBeNull();
    expect(rateLimit(b, 1, 60_000)).toBeNull();
    expect(rateLimit(a, 1, 60_000)).not.toBeNull();
  });
});
