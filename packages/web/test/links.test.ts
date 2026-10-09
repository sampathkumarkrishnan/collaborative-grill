import { describe, expect, it } from "vitest";
import { buildJoinUrl } from "../src/links.js";

describe("buildJoinUrl", () => {
  it("joins an origin and a Room's Link path into one openable URL", () => {
    expect(buildJoinUrl("https://grill.example", "/r/abc123")).toBe(
      "https://grill.example/r/abc123"
    );
  });

  it("avoids a double slash when the origin has a trailing slash", () => {
    expect(buildJoinUrl("https://grill.example/", "/r/abc123")).toBe(
      "https://grill.example/r/abc123"
    );
  });
});
