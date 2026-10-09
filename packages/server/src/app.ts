import cors from "cors";
import express, { type Express } from "express";
import type { RoomModule } from "@collaborative-grill/room";
import {
  validateCreateRoomRequest,
  validateDisplayName,
  type PostMessageRequest,
  type PostMessageResponse,
  type RelayRejectionReason
} from "@collaborative-grill/shared";
import type { BroadcastHub } from "./hub.js";

const REJECTION_STATUS: Record<RelayRejectionReason, number> = {
  "room-not-found": 404,
  "not-host": 403,
  "daemon-disconnected": 409,
  "missing-agent-marker": 400
};

function statusForRejection(reason: RelayRejectionReason): number {
  return REJECTION_STATUS[reason];
}

function broadcastTranscript(
  hub: BroadcastHub,
  roomId: string,
  result: PostMessageResponse
): void {
  if (result.ok) {
    hub.broadcast(roomId, { type: "transcript-entry", roomId, entry: result.entry });
  }
}

/**
 * Builds the Server HTTP app against the Room module. Successful posts
 * fan out through the hub so WebSocket subscribers see Transcript lines.
 */
export function createApp(roomModule: RoomModule, hub: BroadcastHub): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/api/rooms", (req, res) => {
    const validated = validateCreateRoomRequest(req.body);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const { room, hostCredential } = roomModule.createRoom(validated.value.topic);
    res.status(201).json({ room, hostCredential });
  });

  app.get("/api/rooms/by-link/:linkToken", (req, res) => {
    const joined = roomModule.joinByLink(req.params.linkToken);
    if (!joined) {
      res.status(404).json({ error: "not-found" });
      return;
    }

    res.status(200).json({
      room: joined.room,
      transcript: joined.transcript
    });
  });

  app.get("/api/rooms/:roomId/transcript", (req, res) => {
    const summary = roomModule.getRoomSummary(req.params.roomId);
    if (!summary) {
      res.status(404).json({ error: "not-found" });
      return;
    }

    res.status(200).json({ transcript: roomModule.getTranscript(req.params.roomId) });
  });

  app.post("/api/rooms/:roomId/messages", (req, res) => {
    const body = req.body as Record<string, unknown>;

    if (body.kind === "reply") {
      const displayName = validateDisplayName(body.displayName);
      if (!displayName.ok) {
        res.status(400).json({ error: displayName.error });
        return;
      }
      if (typeof body.body !== "string" || body.body.trim().length === 0) {
        res.status(400).json({ error: "body is required" });
        return;
      }

      const request: PostMessageRequest = {
        kind: "reply",
        displayName: displayName.value,
        body: body.body
      };
      const result = roomModule.postMessage(req.params.roomId, request);
      broadcastTranscript(hub, req.params.roomId, result);
      res.status(result.ok ? 201 : 404).json(result);
      return;
    }

    if (body.kind === "relay") {
      if (typeof body.hostCredential !== "string" || typeof body.body !== "string") {
        res.status(400).json({ error: "hostCredential and body are required" });
        return;
      }

      const request: PostMessageRequest = {
        kind: "relay",
        hostCredential: body.hostCredential,
        body: body.body
      };
      const result = roomModule.postMessage(req.params.roomId, request);
      broadcastTranscript(hub, req.params.roomId, result);
      res.status(result.ok ? 201 : statusForRejection(result.error)).json(result);
      return;
    }

    res.status(400).json({ error: "kind must be 'reply' or 'relay'" });
  });

  return app;
}
