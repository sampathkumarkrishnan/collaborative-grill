import { useId, useState } from "react";
import type { PostMessageRequest, PostMessageResponse } from "@collaborative-grill/shared";
import { decideMessageRequest, type ComposerContext } from "../composer.js";

const REJECTION_MESSAGES: Record<string, string> = {
  "room-not-found": "This Room no longer exists.",
  "not-host": "Only the Host can send a Relay.",
  "daemon-disconnected": "The Daemon is disconnected; the Relay was not sent.",
  "missing-agent-marker": "A Relay needs an @agent marker."
};

export interface ComposerProps {
  context: ComposerContext;
  sendMessage: (request: PostMessageRequest) => Promise<PostMessageResponse>;
}

/**
 * Composer for Reply and Relay. Decides Reply vs Relay from the `@agent`
 * marker client-side (see `composer.ts`), but the Server has final say -
 * a rejected Relay surfaces as a user-visible error here and is never
 * added to the Transcript optimistically.
 */
export function Composer({ context, sendMessage }: ComposerProps): JSX.Element {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputId = useId();

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (body.trim().length === 0) {
      return;
    }

    const decision = decideMessageRequest(body, context);
    if (decision.kind === "blocked") {
      setError(decision.reason);
      return;
    }

    setSending(true);
    setError(null);
    try {
      const response = await sendMessage(decision.request);
      if (response.ok) {
        setBody("");
      } else {
        setError(REJECTION_MESSAGES[response.error] ?? response.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Composer" className="composer-panel stack">
      {context.isHost && (
        <p className="composer-panel__hint">
          Plain text posts a Reply. Include <code>@agent</code> to Relay (e.g.{" "}
          <code>@agent /grill-with-docs</code>).
        </p>
      )}
      <div className="field">
        <label htmlFor={inputId}>Message</label>
        <textarea
          id={inputId}
          aria-label="Message"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={context.isHost ? "Reply, or @agent to Relay..." : "Reply..."}
          disabled={sending}
        />
      </div>
      <div className="form-row">
        <button type="submit" className="btn btn--primary" disabled={sending}>
          Send
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
