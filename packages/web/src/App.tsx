import type { RoomSummary } from "@collaborative-grill/shared";

/**
 * Placeholder shell confirming the web app resolves `@collaborative-grill/shared`
 * types. Ticket "3: Web app module" builds out Room lists, join-by-link,
 * the composer, the Transcript view, and the WebSocket client.
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
    </main>
  );
}
