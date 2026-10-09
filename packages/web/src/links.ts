/** Combines the web app's origin with a Room's Link path into one shareable URL. */
export function buildJoinUrl(origin: string, link: string): string {
  return `${origin.replace(/\/+$/, "")}${link}`;
}
