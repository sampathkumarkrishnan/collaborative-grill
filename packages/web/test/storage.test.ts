import { beforeEach, describe, expect, it } from "vitest";
import {
  getCreatedRooms,
  getDisplayName,
  getHostCredential,
  getLastDisplayName,
  getVisitedRooms,
  isHostOfRoom,
  rememberCreatedRoom,
  rememberDisplayName,
  rememberHostCredential,
  rememberVisitedRoom
} from "../src/storage.js";

beforeEach(() => {
  window.localStorage.clear();
});

describe("created-room and visited-room lists", () => {
  it("starts empty", () => {
    expect(getCreatedRooms()).toEqual([]);
    expect(getVisitedRooms()).toEqual([]);
  });

  it("remembers a created Room and lists it most-recent-first", () => {
    rememberCreatedRoom({ id: "room-1", topic: "First", link: "/r/one" });
    rememberCreatedRoom({ id: "room-2", topic: "Second", link: "/r/two" });

    expect(getCreatedRooms()).toEqual([
      { id: "room-2", topic: "Second", link: "/r/two" },
      { id: "room-1", topic: "First", link: "/r/one" }
    ]);
  });

  it("moves a re-created Room to the front instead of duplicating it", () => {
    rememberCreatedRoom({ id: "room-1", topic: "First", link: "/r/one" });
    rememberCreatedRoom({ id: "room-2", topic: "Second", link: "/r/two" });
    rememberCreatedRoom({ id: "room-1", topic: "First (renamed)", link: "/r/one" });

    expect(getCreatedRooms()).toEqual([
      { id: "room-1", topic: "First (renamed)", link: "/r/one" },
      { id: "room-2", topic: "Second", link: "/r/two" }
    ]);
  });

  it("keeps created and visited lists independent", () => {
    rememberCreatedRoom({ id: "room-1", topic: "Created", link: "/r/one" });
    rememberVisitedRoom({ id: "room-2", topic: "Visited", link: "/r/two" });

    expect(getCreatedRooms()).toEqual([{ id: "room-1", topic: "Created", link: "/r/one" }]);
    expect(getVisitedRooms()).toEqual([{ id: "room-2", topic: "Visited", link: "/r/two" }]);
  });
});

describe("Host credential storage", () => {
  it("has no Host credential for an unknown Room", () => {
    expect(getHostCredential("room-1")).toBeUndefined();
    expect(isHostOfRoom("room-1")).toBe(false);
  });

  it("remembers a Room's Host credential", () => {
    rememberHostCredential("room-1", "secret-token");

    expect(getHostCredential("room-1")).toBe("secret-token");
    expect(isHostOfRoom("room-1")).toBe(true);
  });

  it("keeps Host credentials for different Rooms separate", () => {
    rememberHostCredential("room-1", "secret-1");
    rememberHostCredential("room-2", "secret-2");

    expect(getHostCredential("room-1")).toBe("secret-1");
    expect(getHostCredential("room-2")).toBe("secret-2");
  });
});

describe("display name storage", () => {
  it("has no display name for an unvisited Room", () => {
    expect(getDisplayName("room-1")).toBeUndefined();
  });

  it("remembers a display name per-Room and as the browser-wide default", () => {
    rememberDisplayName("room-1", "Ada");

    expect(getDisplayName("room-1")).toBe("Ada");
    expect(getLastDisplayName()).toBe("Ada");
  });

  it("lets different Rooms use different display names", () => {
    rememberDisplayName("room-1", "Ada");
    rememberDisplayName("room-2", "Grace");

    expect(getDisplayName("room-1")).toBe("Ada");
    expect(getDisplayName("room-2")).toBe("Grace");
    expect(getLastDisplayName()).toBe("Grace");
  });
});
