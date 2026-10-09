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

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
  clear?(): void;
}

export interface BrowserStorage {
  getCreatedRooms(): StoredRoomRef[];
  rememberCreatedRoom(room: StoredRoomRef): void;
  getVisitedRooms(): StoredRoomRef[];
  rememberVisitedRoom(room: StoredRoomRef): void;
  getHostCredential(roomId: string): string | undefined;
  rememberHostCredential(roomId: string, hostCredential: string): void;
  isHostOfRoom(roomId: string): boolean;
  getDisplayName(roomId: string): string | undefined;
  rememberDisplayName(roomId: string, displayName: string): void;
  getLastDisplayName(): string | undefined;
}

export function createInMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    }
  };
}

function resolveStorageBackend(storage?: StorageLike): StorageLike {
  if (storage) {
    return storage;
  }
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return createInMemoryStorage();
}

export function createBrowserStorage(backend?: StorageLike): BrowserStorage {
  const store = resolveStorageBackend(backend);

  function readJson<T>(key: string, fallback: T): T {
    const raw = store.getItem(key);
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
    store.setItem(key, JSON.stringify(value));
  }

  function readRoomList(key: string): StoredRoomRef[] {
    return readJson<StoredRoomRef[]>(key, []);
  }

  function rememberRoom(key: string, room: StoredRoomRef): void {
    const existing = readRoomList(key).filter((entry) => entry.id !== room.id);
    writeJson(key, [room, ...existing]);
  }

  function readCredentialMap(): Record<string, string> {
    return readJson<Record<string, string>>(HOST_CREDENTIALS_KEY, {});
  }

  function readDisplayNameMap(): Record<string, string> {
    return readJson<Record<string, string>>(DISPLAY_NAMES_KEY, {});
  }

  return {
    getCreatedRooms(): StoredRoomRef[] {
      return readRoomList(CREATED_ROOMS_KEY);
    },
    rememberCreatedRoom(room: StoredRoomRef): void {
      rememberRoom(CREATED_ROOMS_KEY, room);
    },
    getVisitedRooms(): StoredRoomRef[] {
      return readRoomList(VISITED_ROOMS_KEY);
    },
    rememberVisitedRoom(room: StoredRoomRef): void {
      rememberRoom(VISITED_ROOMS_KEY, room);
    },
    getHostCredential(roomId: string): string | undefined {
      return readCredentialMap()[roomId];
    },
    rememberHostCredential(roomId: string, hostCredential: string): void {
      const map = readCredentialMap();
      map[roomId] = hostCredential;
      writeJson(HOST_CREDENTIALS_KEY, map);
    },
    isHostOfRoom(roomId: string): boolean {
      return this.getHostCredential(roomId) !== undefined;
    },
    getDisplayName(roomId: string): string | undefined {
      return readDisplayNameMap()[roomId];
    },
    rememberDisplayName(roomId: string, displayName: string): void {
      const map = readDisplayNameMap();
      map[roomId] = displayName;
      writeJson(DISPLAY_NAMES_KEY, map);
      store.setItem(LAST_DISPLAY_NAME_KEY, displayName);
    },
    getLastDisplayName(): string | undefined {
      return store.getItem(LAST_DISPLAY_NAME_KEY) ?? undefined;
    }
  };
}

export const defaultBrowserStorage: BrowserStorage = createBrowserStorage();

/** Rooms this browser has created, most recently created first. */
export function getCreatedRooms(): StoredRoomRef[] {
  return defaultBrowserStorage.getCreatedRooms();
}

/** Remembers a Room this browser just created (moves it to the front if already known). */
export function rememberCreatedRoom(room: StoredRoomRef): void {
  defaultBrowserStorage.rememberCreatedRoom(room);
}

/** Rooms this browser has joined via Link, most recently visited first. */
export function getVisitedRooms(): StoredRoomRef[] {
  return defaultBrowserStorage.getVisitedRooms();
}

/** Remembers a Room this browser just joined via Link. */
export function rememberVisitedRoom(room: StoredRoomRef): void {
  defaultBrowserStorage.rememberVisitedRoom(room);
}

/** The Host credential this browser holds for a Room, if it created it. */
export function getHostCredential(roomId: string): string | undefined {
  return defaultBrowserStorage.getHostCredential(roomId);
}

/** Remembers the Host credential minted for a Room this browser created. */
export function rememberHostCredential(roomId: string, hostCredential: string): void {
  defaultBrowserStorage.rememberHostCredential(roomId, hostCredential);
}

/** Whether this browser holds the Host credential for a Room. */
export function isHostOfRoom(roomId: string): boolean {
  return defaultBrowserStorage.isHostOfRoom(roomId);
}

/** The display name this browser has used in a specific Room, if any. */
export function getDisplayName(roomId: string): string | undefined {
  return defaultBrowserStorage.getDisplayName(roomId);
}

/** Remembers the display name chosen for a Room, and as the browser-wide default. */
export function rememberDisplayName(roomId: string, displayName: string): void {
  defaultBrowserStorage.rememberDisplayName(roomId, displayName);
}

/** The last display name used in any Room, offered as a default when joining a new one. */
export function getLastDisplayName(): string | undefined {
  return defaultBrowserStorage.getLastDisplayName();
}
