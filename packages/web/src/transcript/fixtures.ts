import type { TranscriptEntry } from "@collaborative-grill/shared";

/** Sample Transcript JSON for Storybook-style dev preview before live Server data. */
export const fixtureTranscript: TranscriptEntry[] = [
  {
    id: "reply-1",
    roomId: "room-demo",
    kind: "reply",
    authorDisplayName: "Jamie",
    body: "Can we diagram the Relay path before the demo?",
    createdAt: "2026-10-09T10:00:00.000Z"
  },
  {
    id: "relay-1",
    roomId: "room-demo",
    kind: "relay",
    authorDisplayName: "Alex",
    body: `@agent Please refine this sketch:

\`\`\`mermaid
flowchart TB
  Web --> Server
\`\`\``,
    payload: `Please refine this sketch:

\`\`\`mermaid
flowchart TB
  Web --> Server
\`\`\``,
    createdAt: "2026-10-09T10:01:00.000Z"
  },
  {
    id: "agent-1",
    roomId: "room-demo",
    kind: "agent",
    body: `Here is the path:

\`\`\`mermaid
flowchart LR
  Host --> Server
  Server --> Daemon
  Daemon --> Agent
\`\`\`

Let me know if you want sequence form instead.`,
    createdAt: "2026-10-09T10:02:00.000Z"
  }
];
