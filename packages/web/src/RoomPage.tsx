import { useEffect, useState } from "react";
import type { PostMessageRequest, RoomSummary, TranscriptEntry } from "@collaborative-grill/shared";
import { RoomNotFoundError, type ApiClient } from "./api.js";
import { Composer } from "./components/Composer.js";
import { DisplayNameForm } from "./components/DisplayNameForm.js";
import { PresenceBadge } from "./components/PresenceBadge.js";
import { ShareLink } from "./components/ShareLink.js";
import { TranscriptView } from "./components/TranscriptView.js";
import {
  getDisplayName,
  getHostCredential,
  getLastDisplayName,
  isHostOfRoom,
  rememberDisplayName,
  rememberVisitedRoom
} from "./storage.js";
import { RoomSocketClient, type SocketFactory } from "./ws.js";

export interface RoomPageProps {
  link: string;
  apiClient: ApiClient;
  onBack: () => void;
  /** Overrides for tests; production uses the real WebSocket and `/ws` URL. */
  createSocket?: SocketFactory;
  socketUrl?: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "needs-name"; room: RoomSummary }
  | {
      status: "ready";
      room: RoomSummary;
      displayName: string;
      isHost: boolean;
      hostCredential?: string;
    };

/**
 * One open Room: join-by-Link, Transcript, Composer, and Daemon presence.
 * This is the web app's only talk path to the Server; it never contacts
 * the Daemon or the Cursor SDK directly.
 */
export function RoomPage({ link, apiClient, onBack, createSocket, socketUrl }: RoomPageProps): JSX.Element {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [daemonConnected, setDaemonConnected] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  function appendEntry(entry: TranscriptEntry): void {
    setTranscript((prev) =>
      prev.some((existing) => existing.id === entry.id) ? prev : [...prev, entry]
    );
  }

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });

    apiClient
      .joinByLink(link)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setTranscript(response.transcript);
        setDaemonConnected(response.room.daemonConnected);

        const roomId = response.room.id;
        const isHost = isHostOfRoom(roomId);
        const existingName = getDisplayName(roomId);

        if (existingName) {
          if (!isHost) {
            rememberVisitedRoom({ id: roomId, topic: response.room.topic, link: response.room.link });
          }
          setState({
            status: "ready",
            room: response.room,
            displayName: existingName,
            isHost,
            hostCredential: getHostCredential(roomId)
          });
        } else {
          setState({ status: "needs-name", room: response.room });
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        if (err instanceof RoomNotFoundError) {
          setState({ status: "not-found" });
        } else {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load Room."
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [link, apiClient]);

  const roomId =
    state.status === "ready" || state.status === "needs-name" ? state.room.id : undefined;

  useEffect(() => {
    if (!roomId) {
      return;
    }

    const socket = new RoomSocketClient(socketUrl, createSocket);
    socket.connect(roomId, {
      onTranscriptEntry: appendEntry,
      onPresence: (connected) => setDaemonConnected(connected),
      onError: (message) => setLiveError(message)
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  if (state.status === "loading") {
    return <p>Loading Room…</p>;
  }

  if (state.status === "not-found") {
    return (
      <main>
        <p role="alert">This Link doesn&apos;t open a Room.</p>
        <button onClick={onBack}>Back</button>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main>
        <p role="alert">{state.message}</p>
        <button onClick={onBack}>Back</button>
      </main>
    );
  }

  if (state.status === "needs-name") {
    const room = state.room;
    return (
      <main>
        <button onClick={onBack}>Back</button>
        <h1>{room.topic}</h1>
        <DisplayNameForm
          defaultValue={getLastDisplayName()}
          onSubmit={(displayName) => {
            rememberDisplayName(room.id, displayName);
            const isHost = isHostOfRoom(room.id);
            if (!isHost) {
              rememberVisitedRoom({ id: room.id, topic: room.topic, link: room.link });
            }
            setState({
              status: "ready",
              room,
              displayName,
              isHost,
              hostCredential: getHostCredential(room.id)
            });
          }}
        />
      </main>
    );
  }

  const { room, displayName, isHost, hostCredential } = state;

  return (
    <main>
      <button onClick={onBack}>Back</button>
      <h1>{room.topic}</h1>
      <ShareLink link={room.link} />
      <PresenceBadge daemonConnected={daemonConnected} />
      {liveError && <p role="alert">{liveError}</p>}
      <TranscriptView transcript={transcript} />
      <Composer
        context={{ displayName, isHost, hostCredential }}
        sendMessage={async (request: PostMessageRequest) => {
          const response = await apiClient.postMessage(room.id, request);
          if (response.ok) {
            appendEntry(response.entry);
          }
          return response;
        }}
      />
    </main>
  );
}
