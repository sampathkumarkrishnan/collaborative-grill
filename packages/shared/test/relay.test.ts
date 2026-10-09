import { describe, expect, it } from "vitest";
import { AGENT_MARKER, parseRelayCandidate } from "../src/relay.js";

describe("parseRelayCandidate", () => {
  it("is not a Relay when the body has no @agent marker", () => {
    const result = parseRelayCandidate("just a normal Reply");
    expect(result).toEqual({ isRelay: false, payload: null });
  });

  it("is a Relay when the body contains the @agent marker", () => {
    const result = parseRelayCandidate("@agent summarize the thread");
    expect(result.isRelay).toBe(true);
  });

  it("trims the payload after the @agent marker", () => {
    const result = parseRelayCandidate("@agent   summarize the thread   ");
    expect(result.payload).toBe("summarize the thread");
  });

  it("extracts payload after the marker even when preceded by other text", () => {
    const result = parseRelayCandidate("hey @agent please look at this");
    expect(result.isRelay).toBe(true);
    expect(result.payload).toBe("please look at this");
  });

  it("supports multiline payloads as one entry", () => {
    const result = parseRelayCandidate("@agent line one\nline two\nline three");
    expect(result.payload).toBe("line one\nline two\nline three");
  });

  it("treats an empty payload after the marker as an empty string, not null", () => {
    const result = parseRelayCandidate("@agent");
    expect(result.isRelay).toBe(true);
    expect(result.payload).toBe("");
  });

  it("exposes the marker constant used across the contract", () => {
    expect(AGENT_MARKER).toBe("@agent");
  });
});
