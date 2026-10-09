import { describe, expect, it } from "vitest";
import { buildJoinUrl, linkTokenFromLink } from "../src/links.js";

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

describe("linkTokenFromLink", () => {
  it("extracts the token from a Link path", () => {
    expect(linkTokenFromLink("/r/abc123")).toBe("abc123");
  });

  it("extracts the token from a full joined URL", () => {
    expect(linkTokenFromLink("https://grill.example/r/abc123")).toBe("abc123");
  });

  it("returns a bare token unchanged", () => {
    expect(linkTokenFromLink("abc123")).toBe("abc123");
  });
});
