import type { TranscriptEntry } from "@collaborative-grill/shared";
import { TranscriptEntryView } from "./TranscriptEntryView.js";

export interface TranscriptViewProps {
  entries: TranscriptEntry[];
}

/** Ordered Transcript list for the Room. */
export function TranscriptView({ entries }: TranscriptViewProps): JSX.Element {
  return (
    <section className="transcript-view" aria-label="Transcript">
      {entries.map((entry) => (
        <TranscriptEntryView key={entry.id} entry={entry} />
      ))}
    </section>
  );
}
