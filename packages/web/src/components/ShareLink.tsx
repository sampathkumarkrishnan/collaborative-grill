import { buildJoinUrl } from "../links.js";

export interface ShareLinkProps {
  /** The Room's Link path, e.g. `/r/<linkToken>`. */
  link: string;
}

/**
 * Surfaces the Room's shareable Link (user story 3: "the Server to mint an
 * unguessable Link, so that I can share entry without accounts"). Read-only
 * so it's easy to select and copy without relying on clipboard permissions.
 */
export function ShareLink({ link }: ShareLinkProps): JSX.Element {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinUrl = buildJoinUrl(origin, link);

  return (
    <p>
      <label htmlFor="share-link-input">Share this Link to invite Members</label>
      <br />
      <input id="share-link-input" readOnly value={joinUrl} onFocus={(event) => event.target.select()} />
    </p>
  );
}
