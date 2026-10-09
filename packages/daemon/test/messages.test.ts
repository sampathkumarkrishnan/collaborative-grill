import { describe, expect, it } from "vitest";
import { buildDaemonConnectMessage, buildAgentPublicationMessage } from "../src/messages.js";

describe("buildDaemonConnectMessage", () => {
  it("builds a daemon-connect wire message for one Room's Host credential", () => {
    const message = buildDaemonConnectMessage("room-1", "cred-1");

    expect(message).toEqual({
      type: "daemon-connect",
      roomId: "room-1",
      hostCredential: "cred-1"
    });
  });
});

describe("buildAgentPublicationMessage", () => {
  it("builds an agent-publication wire message carrying the final answer", () => {
    const message = buildAgentPublicationMessage("room-1", "cred-1", "the answer");

    expect(message).toEqual({
      type: "agent-publication",
      roomId: "room-1",
      hostCredential: "cred-1",
      body: "the answer"
    });
  });
});
