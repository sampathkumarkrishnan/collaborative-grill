import { describe, expect, it } from "vitest";
import { createAgentPool } from "../src/agentPool.js";
import type { AgentHandle, AgentSdkAdapter } from "../src/sdkAdapter.js";

function createCountingAdapter(): { adapter: AgentSdkAdapter; createCount: () => number } {
  let count = 0;

  const adapter: AgentSdkAdapter = {
    async createAgent(roomId: string): Promise<AgentHandle> {
      count += 1;
      return {
        async send(payload: string) {
          return { text: async () => `${roomId}:${payload}` };
        }
      };
    }
  };

  return { adapter, createCount: () => count };
}

describe("createAgentPool", () => {
  it("creates one Agent per Room id and reuses it on subsequent calls", async () => {
    const { adapter, createCount } = createCountingAdapter();
    const pool = createAgentPool(adapter);

    const first = await pool.getOrCreate("room-1");
    const second = await pool.getOrCreate("room-1");
    const other = await pool.getOrCreate("room-2");

    expect(first).toBe(second);
    expect(other).not.toBe(first);
    expect(createCount()).toBe(2);
  });

  it("does not cache a failed Agent creation, so the next call retries", async () => {
    let attempts = 0;
    const adapter: AgentSdkAdapter = {
      async createAgent(): Promise<AgentHandle> {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("boom");
        }
        return { send: async (payload: string) => ({ text: async () => payload }) };
      }
    };
    const pool = createAgentPool(adapter);

    await expect(pool.getOrCreate("room-1")).rejects.toThrow("boom");
    await expect(pool.getOrCreate("room-1")).resolves.toBeDefined();
    expect(attempts).toBe(2);
  });

  it("disposes every cached Agent and clears the pool", async () => {
    const disposed: string[] = [];
    const adapter: AgentSdkAdapter = {
      async createAgent(roomId: string): Promise<AgentHandle> {
        return {
          send: async (payload: string) => ({ text: async () => payload }),
          dispose: async () => {
            disposed.push(roomId);
          }
        };
      }
    };
    const pool = createAgentPool(adapter);
    await pool.getOrCreate("room-1");
    await pool.getOrCreate("room-2");

    await pool.disposeAll();

    expect(disposed.sort()).toEqual(["room-1", "room-2"]);
  });
});
