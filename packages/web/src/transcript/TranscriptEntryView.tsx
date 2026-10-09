import type { TranscriptEntry } from "@collaborative-grill/shared";
import { transcriptAuthorLabel } from "./authorLabel.js";
import { MarkdownBody } from "./MarkdownBody.js";

export interface TranscriptEntryViewProps {
  entry: TranscriptEntry;
}

const roleCaption: Record<ReturnType<typeof transcriptAuthorLabel>["role"], string> = {
  member: "Member",
  host: "Host",
  agent: "Agent"
};

/** One Transcript line: author attribution plus markdown body. */
export function TranscriptEntryView({ entry }: TranscriptEntryViewProps): JSX.Element {
  const author = transcriptAuthorLabel(entry);

  return (
    <article
      className={`transcript-entry transcript-entry--${entry.kind}`}
      data-testid={`transcript-entry-${entry.kind}`}
      data-entry-id={entry.id}
    >
      <header className="transcript-entry__header">
        <span className="transcript-entry__author" data-testid="transcript-author">
          {author.text}
        </span>
        <span
          className={`transcript-entry__role transcript-entry__role--${author.role}`}
          data-testid="transcript-author-role"
        >
          {roleCaption[author.role]}
        </span>
      </header>
      <MarkdownBody markdown={entry.body} />
    </article>
  );
}
