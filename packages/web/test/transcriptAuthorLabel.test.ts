import type { TranscriptEntry } from "@collaborative-grill/shared";
import { describe, expect, it } from "vitest";
import { transcriptAuthorLabel } from "../src/transcript/authorLabel.js";

const base = {
  id: "e1",
  roomId: "room-1",
  createdAt: "2026-10-09T12:00:00.000Z",
  body: "hello"
};

describe("transcriptAuthorLabel", () => {
  it("uses the Member display name for a Reply", () => {
    const entry: TranscriptEntry = {
      ...base,
      kind: "reply",
      authorDisplayName: "Jamie"
    };
    expect(transcriptAuthorLabel(entry)).toEqual({
      text: "Jamie",
      role: "member"
    });
  });

  it("marks a Relay as Host while keeping the Host display name", () => {
    const entry: TranscriptEntry = {
      ...base,
      kind: "relay",
      authorDisplayName: "Alex",
      payload: "summarize"
    };
    expect(transcriptAuthorLabel(entry)).toEqual({
      text: "Alex",
      role: "host"
    });
  });

  it("labels Agent publications as Agent", () => {
    const entry: TranscriptEntry = {
      ...base,
      kind: "agent"
    };
    expect(transcriptAuthorLabel(entry)).toEqual({
      text: "Agent",
      role: "agent"
    });
  });
});
