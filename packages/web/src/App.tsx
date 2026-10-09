import type { RoomSummary } from "@collaborative-grill/shared";
import { fixtureTranscript } from "./transcript/fixtures.js";
import { TranscriptView } from "./transcript/TranscriptView.js";

/**
 * Placeholder shell with a fixture Transcript preview. Ticket "3: Web app module"
 * wires live Server data; this ticket (#7) owns markdown and Mermaid rendering.
 */
export function App(): JSX.Element {
  const placeholderRoom: Pick<RoomSummary, "topic" | "daemonConnected"> = {
    topic: "Collaborative grilling (hackathon POC)",
    daemonConnected: false
  };

  return (
    <main>
      <h1>Collaborative Grill</h1>
      <p>{placeholderRoom.topic}</p>
      <p>Daemon connected: {String(placeholderRoom.daemonConnected)}</p>
      <h2>Transcript preview</h2>
      <TranscriptView entries={fixtureTranscript} />
    </main>
  );
}
