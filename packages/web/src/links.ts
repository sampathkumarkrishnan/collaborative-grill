/** Combines the web app's origin with a Room's Link path into one shareable URL. */
export function buildJoinUrl(origin: string, link: string): string {
  return `${origin.replace(/\/+$/, "")}${link}`;
}

/**
 * Extracts the Link token from either a bare token, a Link path
 * (`/r/<token>`), or a full joined URL. Used before calling
 * `GET /api/rooms/by-link/:linkToken`.
 */
export function linkTokenFromLink(link: string): string {
  const withoutQuery = link.split(/[?#]/)[0];
  const segments = withoutQuery.split("/").filter(Boolean);
  return segments.at(-1) ?? "";
}
