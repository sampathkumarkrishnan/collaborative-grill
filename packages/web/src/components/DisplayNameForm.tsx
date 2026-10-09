import { useId, useState } from "react";

export interface DisplayNameFormProps {
  defaultValue?: string;
  onSubmit: (displayName: string) => void;
}

/** Collects a Member's browser-local display name before they enter a Room (user story 7). */
export function DisplayNameForm({ defaultValue, onSubmit }: DisplayNameFormProps): JSX.Element {
  const [displayName, setDisplayName] = useState(defaultValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed.length === 0) {
      setError("A display name is required to join.");
      return;
    }
    setError(null);
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Choose a display name" className="stack">
      <div className="field">
        <label htmlFor={inputId}>Display name</label>
        <input
          id={inputId}
          aria-label="Display name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="How should your Replies be labeled?"
        />
      </div>
      <button type="submit" className="btn btn--primary">
        Join Room
      </button>
      {error && (
        <p role="alert" className="alert alert--error">
          {error}
        </p>
      )}
    </form>
  );
}
