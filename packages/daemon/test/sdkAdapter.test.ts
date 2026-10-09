import { describe, expect, it } from "vitest";
import { createFakeSdkAdapter } from "../src/sdkAdapter.js";

describe("createFakeSdkAdapter", () => {
  it("reuses one Agent's turn count across follow-up sends on the same Room", async () => {
    const adapter = createFakeSdkAdapter();
    const agent = await adapter.createAgent("room-1");

    const first = await (await agent.send("hello")).text();
    const second = await (await agent.send("follow up")).text();

    expect(first).toContain("reply 1");
    expect(first).toContain("hello");
    expect(second).toContain("reply 2");
    expect(second).toContain("follow up");
  });

  it("gives independent Agents (and turn counts) to different Rooms", async () => {
    const adapter = createFakeSdkAdapter();

    const roomA = await adapter.createAgent("room-a");
    const roomB = await adapter.createAgent("room-b");

    await roomA.send("first for A");
    const bFirst = await (await roomB.send("first for B")).text();

    expect(bFirst).toContain("reply 1");
    expect(bFirst).toContain("room-b");
  });
});
