import type {
  CreateRoomResponse,
  GetTranscriptResponse,
  JoinRoomResponse,
  PostMessageRequest,
  PostMessageResponse
} from "@collaborative-grill/shared";
import { getServerHttpUrl } from "./config.js";
import { linkTokenFromLink } from "./links.js";

/** Thrown by `joinByLink` for an unknown Link. The Server leaks no Room data on a 404. */
export class RoomNotFoundError extends Error {
  constructor() {
    super("Room not found");
    this.name = "RoomNotFoundError";
  }
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // Response body wasn't JSON; fall through to the generic message.
  }
  return fallback;
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

/**
 * HTTP client for the Server's REST contract (`docs/protocol.md`). The web
 * app never talks to the Daemon or the Cursor SDK directly; this is its
 * only outbound HTTP surface.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? getServerHttpUrl()).replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
  }

  /** `POST /api/rooms`: creates a Room with a Topic and mints a Host credential. */
  async createRoom(topic: string): Promise<CreateRoomResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic })
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, `Failed to create Room (${response.status})`));
    }

    return (await response.json()) as CreateRoomResponse;
  }

  /** `GET /api/rooms/by-link/:linkToken`: joins a Room by its Link. */
  async joinByLink(link: string): Promise<JoinRoomResponse> {
    const linkToken = linkTokenFromLink(link);
    const response = await this.fetchImpl(`${this.baseUrl}/api/rooms/by-link/${linkToken}`);

    if (response.status === 404) {
      throw new RoomNotFoundError();
    }
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, `Failed to join Room (${response.status})`));
    }

    return (await response.json()) as JoinRoomResponse;
  }

  /** `GET /api/rooms/:roomId/transcript`: refetches a Room's full Transcript. */
  async getTranscript(roomId: string): Promise<GetTranscriptResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/rooms/${roomId}/transcript`);

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, `Failed to load Transcript (${response.status})`));
    }

    return (await response.json()) as GetTranscriptResponse;
  }

  /**
   * `POST /api/rooms/:roomId/messages`: attempts a Reply or a Relay. Returns
   * the Server's `{ ok, ... }` body as-is (never throws for a rejected
   * Relay) so the caller can show the rejection reason to the user.
   */
  async postMessage(roomId: string, request: PostMessageRequest): Promise<PostMessageResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request)
    });

    return (await response.json()) as PostMessageResponse;
  }
}
