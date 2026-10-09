import cors from "cors";
import express, { type Express } from "express";
import {
  validateCreateRoomRequest,
  validateDisplayName,
  type PostMessageRequest,
  type RelayRejectionReason
} from "@collaborative-grill/shared";
import type { RoomStore } from "./store.js";

const REJECTION_STATUS: Record<RelayRejectionReason, number> = {
  "room-not-found": 404,
  "not-host": 403,
  "daemon-disconnected": 409,
  "missing-agent-marker": 400
};

function statusForRejection(reason: RelayRejectionReason): number {
  return REJECTION_STATUS[reason];
}

/**
 * Builds the Server HTTP app for a given Room store. Kept separate from
 * `index.ts` so tests can exercise routes without binding a port.
 */
export function createApp(store: RoomStore): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.post("/api/rooms", (req, res) => {
    const validated = validateCreateRoomRequest(req.body);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const { room, hostCredential } = store.createRoom(validated.value.topic);
    res.status(201).json({ room, hostCredential });
  });

  app.get("/api/rooms/by-link/:linkToken", (req, res) => {
    const room = store.getRoomByLink(req.params.linkToken);
    if (!room) {
      res.status(404).json({ error: "not-found" });
      return;
    }

    res.status(200).json({
      room: store.toSummary(room),
      transcript: room.transcript
    });
  });

  app.get("/api/rooms/:roomId/transcript", (req, res) => {
    const room = store.getRoomById(req.params.roomId);
    if (!room) {
      res.status(404).json({ error: "not-found" });
      return;
    }

    res.status(200).json({ transcript: room.transcript });
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
      const result = store.postMessage(req.params.roomId, request);
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
      const result = store.postMessage(req.params.roomId, request);
      res.status(result.ok ? 201 : statusForRejection(result.error)).json(result);
      return;
    }

    res.status(400).json({ error: "kind must be 'reply' or 'relay'" });
  });

  return app;
}
