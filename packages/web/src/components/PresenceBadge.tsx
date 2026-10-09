export interface PresenceBadgeProps {
  daemonConnected: boolean;
}

/** The Daemon presence indicator (user story 22): tells a Member whether a Relay could work. */
export function PresenceBadge({ daemonConnected }: PresenceBadgeProps): JSX.Element {
  return (
    <p
      data-testid="presence-badge"
      aria-live="polite"
      className={`presence-badge ${daemonConnected ? "presence-badge--connected" : "presence-badge--disconnected"}`}
    >
      <span className="presence-badge__dot" aria-hidden="true" />
      Daemon {daemonConnected ? "connected" : "disconnected"}
    </p>
  );
}
