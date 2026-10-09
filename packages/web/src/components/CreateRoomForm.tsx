import { useId, useState } from "react";

export interface CreateRoomFormProps {
  onCreate: (topic: string) => Promise<void>;
}

/** "Create Room with Topic" (user story 1): the only way a new Room comes into existence. */
export function CreateRoomForm({ onCreate }: CreateRoomFormProps): JSX.Element {
  const [topic, setTopic] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

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
    <form onSubmit={handleSubmit} aria-label="Create Room" className="stack">
      <div className="form-row">
        <div className="field">
          <label htmlFor={inputId}>Topic</label>
          <input
            id={inputId}
            aria-label="Topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="What are we grilling?"
            disabled={submitting}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          Create Room
        </button>
      </div>
      {error && (
        <p role="alert" className="alert alert--error">
          {error}
        </p>
      )}
    </form>
  );
}
