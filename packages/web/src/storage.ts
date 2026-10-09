/**
 * Browser-local persistence for the web app. Per `docs/spec-hackathon-poc.md`,
 * day-one identity is Link plus browser-local display name, and created /
 * visited Room lists plus the Host credential live in this browser only -
 * there are no accounts. Nothing here is an authorization check; the Server
 * is the source of truth for whether a Host credential is still valid.
 */

const STORAGE_PREFIX = "collaborative-grill:v1:";

const CREATED_ROOMS_KEY = `${STORAGE_PREFIX}created-rooms`;
const VISITED_ROOMS_KEY = `${STORAGE_PREFIX}visited-rooms`;
const HOST_CREDENTIALS_KEY = `${STORAGE_PREFIX}host-credentials`;
const DISPLAY_NAMES_KEY = `${STORAGE_PREFIX}display-names`;
const LAST_DISPLAY_NAME_KEY = `${STORAGE_PREFIX}last-display-name`;

/** The slice of a Room a browser needs to remember to relist it later. */
export interface StoredRoomRef {
  id: string;
  topic: string;
  link: string;
}

function readJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function readRoomList(key: string): StoredRoomRef[] {
  return readJson<StoredRoomRef[]>(key, []);
}

function rememberRoom(key: string, room: StoredRoomRef): void {
  const existing = readRoomList(key).filter((entry) => entry.id !== room.id);
  writeJson(key, [room, ...existing]);
}

/** Rooms this browser has created, most recently created first. */
export function getCreatedRooms(): StoredRoomRef[] {
  return readRoomList(CREATED_ROOMS_KEY);
}

/** Remembers a Room this browser just created (moves it to the front if already known). */
export function rememberCreatedRoom(room: StoredRoomRef): void {
  rememberRoom(CREATED_ROOMS_KEY, room);
}

/** Rooms this browser has joined via Link, most recently visited first. */
export function getVisitedRooms(): StoredRoomRef[] {
  return readRoomList(VISITED_ROOMS_KEY);
}

/** Remembers a Room this browser just joined via Link. */
export function rememberVisitedRoom(room: StoredRoomRef): void {
  rememberRoom(VISITED_ROOMS_KEY, room);
}

function readCredentialMap(): Record<string, string> {
  return readJson<Record<string, string>>(HOST_CREDENTIALS_KEY, {});
}

/** The Host credential this browser holds for a Room, if it created it. */
export function getHostCredential(roomId: string): string | undefined {
  return readCredentialMap()[roomId];
}

/** Remembers the Host credential minted for a Room this browser created. */
export function rememberHostCredential(roomId: string, hostCredential: string): void {
  const map = readCredentialMap();
  map[roomId] = hostCredential;
  writeJson(HOST_CREDENTIALS_KEY, map);
}

/** Whether this browser holds the Host credential for a Room. */
export function isHostOfRoom(roomId: string): boolean {
  return getHostCredential(roomId) !== undefined;
}

function readDisplayNameMap(): Record<string, string> {
  return readJson<Record<string, string>>(DISPLAY_NAMES_KEY, {});
}

/** The display name this browser has used in a specific Room, if any. */
export function getDisplayName(roomId: string): string | undefined {
  return readDisplayNameMap()[roomId];
}

/** Remembers the display name chosen for a Room, and as the browser-wide default. */
export function rememberDisplayName(roomId: string, displayName: string): void {
  const map = readDisplayNameMap();
  map[roomId] = displayName;
  writeJson(DISPLAY_NAMES_KEY, map);
  window.localStorage.setItem(LAST_DISPLAY_NAME_KEY, displayName);
}

/** The last display name used in any Room, offered as a default when joining a new one. */
export function getLastDisplayName(): string | undefined {
  return window.localStorage.getItem(LAST_DISPLAY_NAME_KEY) ?? undefined;
}
