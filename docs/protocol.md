Status: shared contract, hackathon POC

# Shared protocol and monorepo shell

This document is the cross-module contract for the hackathon POC. Server,
web app, and Daemon are built in parallel against the shapes defined here
and implemented in `@collaborative-grill/shared`
(`packages/shared/src/*.ts`). Vocabulary matches the root `CONTEXT.md`.

This ticket (`#2`) does not implement full Room rules, production SQLite,
the Cursor SDK, or markdown/Mermaid rendering. The stub Server in
`packages/server` is a mock for local development only; it exists so the
web app and Daemon have something real to talk to before the Room module
(`#3`) and its Server integration (`#5`/`#8`) land.

## Monorepo shape

```
packages/
  shared/   @collaborative-grill/shared  - Transcript kinds, wire protocol types, validators
  room/     @collaborative-grill/room    - Room module (product rules and test seam)
  server/   @collaborative-grill/server  - stub HTTP + WebSocket Server (mock Room store)
  web/      @collaborative-grill/web     - React web app shell
  daemon/   @collaborative-grill/daemon  - Daemon process shell
```

All packages are pnpm workspace members (`pnpm-workspace.yaml`). Install
once at the repo root:

```sh
pnpm install
pnpm -r run build        # build every package
pnpm -r run typecheck     # typecheck every package
pnpm -r run test          # unit tests for every package
pnpm dev:server           # run the stub Server on :4000
pnpm dev:web               # run the web app on :5173
pnpm dev:daemon            # run the Daemon shell
```

## Transcript entry kinds

A Transcript entry has one `kind`: `"reply"`, `"relay"`, or `"agent"`
(`packages/shared/src/transcript.ts`).

| kind    | who produces it                      | extra fields                          |
| ------- | ------------------------------------- | -------------------------------------- |
| `reply` | any Member, posted directly           | `authorDisplayName`                    |
| `relay` | the Host, accepted by the Server      | `authorDisplayName`, `payload`         |
| `agent` | the Daemon, after an Agent run        | (none beyond the base fields)          |

`payload` on a `relay` entry is the message body **after** the `@agent`
marker, trimmed. `AGENT_MARKER` and `parseRelayCandidate(body)` in
`packages/shared/src/relay.ts` are the single source of truth for that
extraction; Server and Daemon should both import it rather than
re-implementing marker parsing.

## HTTP contract

All request/response bodies are typed in `packages/shared/src/protocol.ts`.

| Method | Path                              | Body                 | Response                                            |
| ------ | ---------------------------------- | --------------------- | ---------------------------------------------------- |
| POST   | `/api/rooms`                       | `CreateRoomRequest`   | `201 CreateRoomResponse` (mints Link + Host credential) |
| GET    | `/api/rooms/by-link/:linkToken`    | -                      | `200 JoinRoomResponse` or `404` (no data leaked)      |
| GET    | `/api/rooms/:roomId/transcript`    | -                      | `200 GetTranscriptResponse`                           |
| POST   | `/api/rooms/:roomId/messages`      | `PostMessageRequest`  | see below                                             |

`POST /api/rooms/:roomId/messages` takes a discriminated `PostMessageRequest`.
An unknown `roomId` returns `404 { ok: false, error: "room-not-found" }`
for either kind.

- `{ kind: "reply", displayName, body }` - always appended once the Room
  exists. Returns `201 { ok: true, entry }`.
- `{ kind: "relay", hostCredential, body }` - appended only when all of
  these hold, in order:
  1. `hostCredential` matches the Room's Host credential, else
     `403 { ok: false, error: "not-host" }`.
  2. The Room's Daemon is connected, else
     `409 { ok: false, error: "daemon-disconnected" }`.
  3. `body` contains the `@agent` marker, else
     `400 { ok: false, error: "missing-agent-marker" }`.

  On success: `201 { ok: true, entry }`, where `entry.payload` is the
  trimmed text after `@agent`. A rejected Relay is **not** stored.

## Host credential rules

- Minted once, server-side, in the `CreateRoomResponse` for the browser
  that created the Room. It is opaque (`HostCredential = string`); this
  shared package never generates or verifies it beyond shape.
- It is the only thing that may:
  - post a `relay` message over HTTP,
  - open a `daemon-connect` / `daemon-disconnect` WebSocket session for a
    Room,
  - send an `agent-publication` WebSocket message for a Room.
- A display name is a label only and never substitutes for the Host
  credential.
- A caller presenting the wrong (or no) Host credential for a Room gets
  `not-host` / is dropped silently on the WebSocket path - never a
  different Room's data.

## WebSocket contract

Single endpoint, `/ws`. Messages are JSON, discriminated by `type`
(`packages/shared/src/protocol.ts`).

**Client → Server** (`ClientToServerMessage`):

| type                 | sender      | fields                                   | effect                                                        |
| -------------------- | ----------- | ----------------------------------------- | -------------------------------------------------------------- |
| `subscribe`          | web client  | `roomId`                                  | start receiving broadcasts for that Room                       |
| `daemon-connect`     | Daemon      | `roomId`, `hostCredential`                | marks the Room's Daemon connected; broadcasts `presence`       |
| `daemon-disconnect`  | Daemon      | `roomId`, `hostCredential`                | marks the Room's Daemon disconnected; broadcasts `presence`    |
| `agent-publication`  | Daemon      | `roomId`, `hostCredential`, `body`        | appends an `agent` Transcript entry; broadcasts `transcript-entry` |

**Server → Client** (`ServerToClientMessage`):

| type               | recipients                     | fields                                | meaning                                             |
| ------------------ | ------------------------------- | --------------------------------------- | ----------------------------------------------------- |
| `transcript-entry` | subscribers of that Room        | `roomId`, `entry`                       | a new Transcript entry (Reply, Relay, or Agent)       |
| `presence`         | subscribers of that Room        | `roomId`, `daemonConnected`             | the Room's Daemon connectivity changed                |
| `relay-delivery`   | that Room's connected Daemon only | `roomId`, `relayId`, `payload`        | an accepted Relay's payload text, to forward to the Agent |
| `error`            | the sender of the bad message   | `message`                               | the message was malformed or unauthorized              |

`relay-delivery` is Server → Daemon only, never broadcast to web
subscribers. The current stub Server implements `subscribe`,
`daemon-connect`/`daemon-disconnect`, and `agent-publication`; wiring
`relay-delivery` to the HTTP Relay-acceptance path needs a registry of
which socket holds which Room's Daemon connection, which belongs to the
Server/Room integration ticket (`#8`), not this one.

## What the stub Server deliberately does not do

- No persistence (in-memory only; restarting the process loses every
  Room). Production SQLite is ticket `#2`'s sibling work inside the real
  Server module.
- No Cursor SDK integration; `agent-publication` is accepted at face
  value from whoever holds the Host credential.
- No markdown or Mermaid rendering; that is entirely a web app concern
  (`#8`).
- Minimal Relay rules only (Host credential, Daemon presence, `@agent`
  marker). It does not implement one-Agent-per-Room semantics, isolation
  tests across Rooms, or the full acceptance-rule test matrix in
  `docs/spec-hackathon-poc.md` - those land with the real Room module
  (`#3`) and its Server integration (`#5`, `#8`).
