import { describe, expect, it } from "vitest";
import type { AgentPublicationMessage, RelayDeliveryMessage } from "@collaborative-grill/shared";
import { createAgentPool } from "../src/agentPool.js";
import { createRelayRouter } from "../src/relayRouter.js";
import { createFakeSdkAdapter } from "../src/sdkAdapter.js";

describe("createRelayRouter", () => {
  it("sends exactly one agent-publication per relay-delivery, carrying the buffered final text", async () => {
    const pool = createAgentPool(createFakeSdkAdapter());
    const published: AgentPublicationMessage[] = [];
    const router = createRelayRouter(pool, "cred-1", (message) => published.push(message));

    const delivery: RelayDeliveryMessage = {
      type: "relay-delivery",
      roomId: "room-1",
      relayId: "relay-1",
      payload: "do something"
    };

    await router.routeRelayDelivery(delivery);

    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      type: "agent-publication",
      roomId: "room-1",
      hostCredential: "cred-1"
    });
    expect(published[0]?.body).toContain("do something");
  });

  it("reuses the same Room Agent across two Relays, so the second sees conversation context", async () => {
    const pool = createAgentPool(createFakeSdkAdapter());
    const published: AgentPublicationMessage[] = [];
    const router = createRelayRouter(pool, "cred-1", (message) => published.push(message));

    await router.routeRelayDelivery({
      type: "relay-delivery",
      roomId: "room-1",
      relayId: "relay-1",
      payload: "first question"
    });
    await router.routeRelayDelivery({
      type: "relay-delivery",
      roomId: "room-1",
      relayId: "relay-2",
      payload: "follow up"
    });

    expect(published).toHaveLength(2);
    expect(published[0]?.body).toContain("reply 1");
    expect(published[1]?.body).toContain("reply 2");
  });
});
