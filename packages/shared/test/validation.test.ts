import { describe, expect, it } from "vitest";
import { validateCreateRoomRequest, validateDisplayName } from "../src/validation.js";

describe("validateCreateRoomRequest", () => {
  it("accepts a non-empty Topic and trims it", () => {
    const result = validateCreateRoomRequest({ topic: "  Collaborative grilling  " });
    expect(result).toEqual({ ok: true, value: { topic: "Collaborative grilling" } });
  });

  it("rejects a missing topic", () => {
    const result = validateCreateRoomRequest({});
    expect(result.ok).toBe(false);
  });

  it("rejects a blank topic", () => {
    const result = validateCreateRoomRequest({ topic: "   " });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-string topic", () => {
    const result = validateCreateRoomRequest({ topic: 42 });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-object body", () => {
    const result = validateCreateRoomRequest(null);
    expect(result.ok).toBe(false);
  });
});

describe("validateDisplayName", () => {
  it("accepts a non-empty display name and trims it", () => {
    const result = validateDisplayName("  Ada  ");
    expect(result).toEqual({ ok: true, value: "Ada" });
  });

  it("rejects a blank display name", () => {
    const result = validateDisplayName("   ");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-string display name", () => {
    const result = validateDisplayName(7 as unknown as string);
    expect(result.ok).toBe(false);
  });
});
