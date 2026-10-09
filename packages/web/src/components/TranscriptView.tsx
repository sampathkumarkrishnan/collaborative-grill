import type { TranscriptEntry } from "@collaborative-grill/shared";

export interface TranscriptViewProps {
  transcript: TranscriptEntry[];
}

function speakerLabel(entry: TranscriptEntry): string {
  if (entry.kind === "agent") {
    return "Agent";
  }
  return entry.authorDisplayName;
}

function kindLabel(entry: TranscriptEntry): string {
  switch (entry.kind) {
    case "reply":
      return "Reply";
    case "relay":
      return "Relay";
    case "agent":
      return "Agent";
  }
}

/**
 * Plain-text Transcript view (ticket 3 scope; markdown/Mermaid rendering is
 * ticket 8). Renders Replies, Relays, and Agent messages in Server order.
 */
export function TranscriptView({ transcript }: TranscriptViewProps): JSX.Element {
  if (transcript.length === 0) {
    return <p>No messages yet.</p>;
  }

  return (
    <ol aria-label="Transcript">
      {transcript.map((entry) => (
        <li key={entry.id} data-kind={entry.kind}>
          <strong>{speakerLabel(entry)}</strong> <em>[{kindLabel(entry)}]</em>
          <p style={{ whiteSpace: "pre-wrap" }}>{entry.body}</p>
        </li>
      ))}
    </ol>
  );
}
