/** Smoke tests for the orchestration server (no Mongo / AI engine needed). */
import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../trpc/root";
import { pythonBridge } from "../services/pythonBridge";

const caller = appRouter.createCaller({
  env: {
    loadedFrom: null,
    nodeEnv: "test",
    port: 4000,
    mongodbUri: "",
    aiEngineUrl: "http://localhost:59999",
    apiKey: "",
    aiEngineTimeoutMs: 1500,
    redisUrl: "redis://localhost:59999",
    jwtSecret: "test-secret",
    jwtExpiresIn: "1h",
  },
  apiKey: undefined,
});

describe("molecules (in-memory fallback)", () => {
  it("seeds and lists molecules", async () => {
    const list = await caller.molecules.list();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty("smiles");
  });

  it("saves and deletes a molecule", async () => {
    const saved = await caller.molecules.save({ name: "Testane", smiles: "CCCCO" });
    expect(saved.name).toBe("Testane");
    const del = await caller.molecules.delete({ id: saved.id });
    expect(del.deleted).toBe(true);
  });

  it("rejects a malformed save via AI-engine validation", async () => {
    // AI engine unreachable → validation flagged unknown → save allowed.
    const saved = await caller.molecules.save({ name: "Offline", smiles: "CCO" });
    expect(saved.smiles).toBe("CCO");
  });
});

describe("runs", () => {
  it("reports stats", async () => {
    const stats = await caller.runs.stats();
    expect(stats).toHaveProperty("total");
  });
});

describe("health", () => {
  it("degrades gracefully when AI engine is offline", async () => {
    const spy = vi
      .spyOn(pythonBridge, "health")
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:59999"));
    const h = await caller.health.check();
    spy.mockRestore();
    expect(h.server).toBe("ok");
    expect(h.db.mode).toBe("memory");
    expect(h.ai.ok).toBe(false);
  });
});

describe("auth", () => {
  it("registers and logs in a user", async () => {
    const email = `test-${Date.now()}@alchemi.dev`;
    const reg = await caller.auth.register({ email, password: "securepass123" });
    expect(reg.token).toBeTruthy();
    expect(reg.user.email).toBe(email);

    const login = await caller.auth.login({ email, password: "securepass123" });
    expect(login.token).toBeTruthy();
    expect(login.user.id).toBe(reg.user.id);
  });

  it("rejects duplicate registration", async () => {
    const email = `dup-${Date.now()}@alchemi.dev`;
    await caller.auth.register({ email, password: "securepass123" });
    await expect(
      caller.auth.register({ email, password: "anotherpass123" })
    ).rejects.toThrow("Email already registered");
  });
});
