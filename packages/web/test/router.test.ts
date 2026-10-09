import { describe, expect, it } from "vitest";
import { parseRoute } from "../src/router.js";

describe("parseRoute", () => {
  it("routes a Room Link path to the room route", () => {
    expect(parseRoute("/r/abc123")).toEqual({ type: "room", link: "/r/abc123" });
  });

  it("drops a trailing slash on a Room Link path", () => {
    expect(parseRoute("/r/abc123/")).toEqual({ type: "room", link: "/r/abc123" });
  });

  it("routes the root path home", () => {
    expect(parseRoute("/")).toEqual({ type: "home" });
  });

  it("routes an unrecognized path home", () => {
    expect(parseRoute("/something-else")).toEqual({ type: "home" });
  });

  it("does not match a bare /r with no token", () => {
    expect(parseRoute("/r/")).toEqual({ type: "home" });
  });
});
