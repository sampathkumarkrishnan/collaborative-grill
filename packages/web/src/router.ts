/** The web app's only two client-side routes: Home, and an open Room by Link. */
export type Route = { type: "home" } | { type: "room"; link: string };

const ROOM_PATH_PATTERN = /^\/r\/[^/]+\/?$/;

/** Parses a `window.location.pathname`-shaped string into a `Route`. */
export function parseRoute(pathname: string): Route {
  if (ROOM_PATH_PATTERN.test(pathname)) {
    return { type: "room", link: pathname.replace(/\/+$/, "") };
  }
  return { type: "home" };
}
