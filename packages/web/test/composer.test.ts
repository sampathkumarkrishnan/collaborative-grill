import { describe, expect, it } from "vitest";
import { decideMessageRequest } from "../src/composer.js";

describe("decideMessageRequest", () => {
  it("treats a message without @agent as a Reply for anyone", () => {
    const decision = decideMessageRequest("just talking", {
      displayName: "Ada",
      isHost: false
    });

    expect(decision).toEqual({
      kind: "reply",
      request: { kind: "reply", displayName: "Ada", body: "just talking" }
    });
  });

  it("treats a Host's @agent message as a Relay using the Host credential", () => {
    const decision = decideMessageRequest("@agent summarize this", {
      displayName: "Host",
      isHost: true,
      hostCredential: "secret-token"
    });

    expect(decision).toEqual({
      kind: "relay",
      request: { kind: "relay", hostCredential: "secret-token", body: "@agent summarize this" }
    });
  });

  it("blocks a non-Host's @agent message client-side instead of sending it", () => {
    const decision = decideMessageRequest("@agent do something", {
      displayName: "Ada",
      isHost: false
    });

    expect(decision.kind).toBe("blocked");
    if (decision.kind === "blocked") {
      expect(decision.reason).toMatch(/Host/);
    }
  });

  it("blocks a Host's @agent message when no Host credential is available", () => {
    const decision = decideMessageRequest("@agent do something", {
      displayName: "Host",
      isHost: true
    });

    expect(decision.kind).toBe("blocked");
  });

  it("trims the body before deciding and sending", () => {
    const decision = decideMessageRequest("  hello world  ", {
      displayName: "Ada",
      isHost: false
    });

    expect(decision.request.body).toBe("hello world");
  });
});
