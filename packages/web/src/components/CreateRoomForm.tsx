import { useState } from "react";

export interface CreateRoomFormProps {
  onCreate: (topic: string) => Promise<void>;
}

/** "Create Room with Topic" (user story 1): the only way a new Room comes into existence. */
export function CreateRoomForm({ onCreate }: CreateRoomFormProps): JSX.Element {
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const trimmed = topic.trim();
    if (trimmed.length === 0) {
      setError("A Topic is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onCreate(trimmed);
      setTopic("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Room.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Create Room">
      <label htmlFor="topic-input">Topic</label>
      <input
        id="topic-input"
        value={topic}
        onChange={(event) => setTopic(event.target.value)}
        placeholder="What are we grilling?"
        disabled={submitting}
      />
      <button type="submit" disabled={submitting}>
        Create Room
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
