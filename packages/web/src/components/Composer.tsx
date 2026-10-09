import { useState } from "react";
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
    <form onSubmit={handleSubmit} aria-label="Composer">
      <label htmlFor="composer-input">Message</label>
      <textarea
        id="composer-input"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={context.isHost ? "Reply, or @agent to Relay..." : "Reply..."}
        disabled={sending}
      />
      <button type="submit" disabled={sending}>
        Send
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
