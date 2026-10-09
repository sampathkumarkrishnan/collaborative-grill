import type { TranscriptEntry } from "@collaborative-grill/shared";
import { TranscriptEntryView } from "../transcript/TranscriptEntryView.js";

export interface TranscriptViewProps {
  transcript: TranscriptEntry[];
}

/**
 * Transcript for an open Room. All entry kinds share one markdown and Mermaid
 * pipeline (see `transcript/MarkdownBody`).
 */
export function TranscriptView({ transcript }: TranscriptViewProps): JSX.Element {
  if (transcript.length === 0) {
    return <p>No messages yet.</p>;
  }

  return (
    <section className="transcript-view" aria-label="Transcript">
      {transcript.map((entry) => (
        <TranscriptEntryView key={entry.id} entry={entry} />
      ))}
    </section>
  );
}
