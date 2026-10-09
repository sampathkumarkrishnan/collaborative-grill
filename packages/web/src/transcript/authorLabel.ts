import type { TranscriptEntry } from "@collaborative-grill/shared";

export type TranscriptAuthorRole = "member" | "host" | "agent";

export interface TranscriptAuthorLabel {
  text: string;
  role: TranscriptAuthorRole;
}

/** Visible speaker label for one Transcript entry. */
export function transcriptAuthorLabel(entry: TranscriptEntry): TranscriptAuthorLabel {
  switch (entry.kind) {
    case "reply":
      return { text: entry.authorDisplayName, role: "member" };
    case "relay":
      return { text: entry.authorDisplayName, role: "host" };
    case "agent":
      return { text: "Agent", role: "agent" };
  }
}
