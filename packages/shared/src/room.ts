/**
 * The Host credential proves a Daemon or browser speaks for the Host of a
 * Room. It is opaque and unguessable; this shared package never generates
 * or verifies it, only shapes where it travels.
 */
export type HostCredential = string;

/** The unguessable token in a Link, admitting its opener to one Room. */
export type LinkToken = string;

/**
 * The public shape of a Room, safe to send to any client that has already
 * been admitted (by Link) or that created it (and thus holds the Host
 * credential separately).
 */
export interface RoomSummary {
  id: string;
  topic: string;
  /** The full Link path/URL a Member opens to join, e.g. `/r/<linkToken>`. */
  link: string;
  /** Whether this Room's Daemon is currently connected. */
  daemonConnected: boolean;
  createdAt: string;
}

/** A Member's browser-local identity within one Room. Label only. */
export interface MemberSession {
  roomId: string;
  displayName: string;
}
