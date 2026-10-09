import { parseRelayCandidate } from "@collaborative-grill/shared";
import { HttpResponse, http } from "msw";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/App.js";
import { ApiClient } from "../src/api.js";
import { FakeSocket } from "./fakeSocket.js";
import { server } from "./msw/server.js";

const BASE_URL = "https://server.test";

afterEach(() => {
  cleanup();
});

interface MockEntry {
  id: string;
  roomId: string;
  kind: "reply" | "relay" | "agent";
  body: string;
  authorDisplayName?: string;
  payload?: string;
  createdAt: string;
}

interface MockRoom {
  id: string;
  topic: string;
  link: string;
  linkToken: string;
  hostCredential: string;
  daemonConnected: boolean;
  transcript: MockEntry[];
}

/** Minimal in-memory mock Server, standing in for the real stub Server over HTTP. */
function installMockServer(): { rooms: Map<string, MockRoom> } {
  const rooms = new Map<string, MockRoom>();
  let nextId = 1;

  server.use(
    http.post(`${BASE_URL}/api/rooms`, async ({ request }) => {
      const body = (await request.json()) as { topic: string };
      const id = `room-${nextId}`;
      const linkToken = `token-${nextId}`;
      nextId += 1;
      const room: MockRoom = {
        id,
        topic: body.topic,
        link: `/r/${linkToken}`,
        linkToken,
        hostCredential: `host-cred-${id}`,
        daemonConnected: false,
        transcript: []
      };
      rooms.set(id, room);
      return HttpResponse.json(
        {
          room: {
            id,
            topic: room.topic,
            link: room.link,
            daemonConnected: false,
            createdAt: new Date().toISOString()
          },
          hostCredential: room.hostCredential
        },
        { status: 201 }
      );
    }),

    http.get(`${BASE_URL}/api/rooms/by-link/:linkToken`, ({ params }) => {
      const room = [...rooms.values()].find((candidate) => candidate.linkToken === params.linkToken);
      if (!room) {
        return HttpResponse.json({ error: "not-found" }, { status: 404 });
      }
      return HttpResponse.json({
        room: {
          id: room.id,
          topic: room.topic,
          link: room.link,
          daemonConnected: room.daemonConnected,
          createdAt: new Date().toISOString()
        },
        transcript: room.transcript
      });
    }),

    http.post(`${BASE_URL}/api/rooms/:roomId/messages`, async ({ request, params }) => {
      const room = rooms.get(params.roomId as string);
      if (!room) {
        return HttpResponse.json({ ok: false, error: "room-not-found" }, { status: 404 });
      }

      const body = (await request.json()) as Record<string, unknown>;

      if (body.kind === "reply") {
        const entry: MockEntry = {
          id: `entry-${room.transcript.length + 1}`,
          roomId: room.id,
          kind: "reply",
          body: body.body as string,
          authorDisplayName: body.displayName as string,
          createdAt: new Date().toISOString()
        };
        room.transcript.push(entry);
        return HttpResponse.json({ ok: true, entry }, { status: 201 });
      }

      if (body.hostCredential !== room.hostCredential) {
        return HttpResponse.json({ ok: false, error: "not-host" }, { status: 403 });
      }
      if (!room.daemonConnected) {
        return HttpResponse.json({ ok: false, error: "daemon-disconnected" }, { status: 409 });
      }

      const candidate = parseRelayCandidate(body.body as string);
      if (!candidate.isRelay || candidate.payload === null) {
        return HttpResponse.json({ ok: false, error: "missing-agent-marker" }, { status: 400 });
      }

      const entry: MockEntry = {
        id: `entry-${room.transcript.length + 1}`,
        roomId: room.id,
        kind: "relay",
        body: body.body as string,
        authorDisplayName: "Host",
        payload: candidate.payload,
        createdAt: new Date().toISOString()
      };
      room.transcript.push(entry);
      return HttpResponse.json({ ok: true, entry }, { status: 201 });
    })
  );

  return { rooms };
}

beforeEach(() => {
  FakeSocket.instances.length = 0;
});

describe("web app module", () => {
  it("lets a Host create a Room and see it in the created-room list without signing in", async () => {
    installMockServer();
    const user = userEvent.setup();
    const apiClient = new ApiClient({ baseUrl: BASE_URL });

    render(<App apiClient={apiClient} createSocket={() => new FakeSocket()} initialPath="/" />);

    await user.type(screen.getByLabelText("Topic"), "Collaborative grilling");
    await user.click(screen.getByRole("button", { name: "Create Room" }));

    await screen.findByRole("heading", { name: "Collaborative grilling" });
    await user.type(screen.getByLabelText("Display name"), "Host");
    await user.click(screen.getByRole("button", { name: "Join Room" }));

    const shareLinkInput = screen.getByLabelText(
      "Share this Link to invite Members"
    ) as HTMLInputElement;
    expect(shareLinkInput.value).toContain("/r/");

    await user.click(await screen.findByRole("button", { name: "Back" }));

    const createdSection = screen.getByRole("heading", { name: "Rooms you created" }).closest("section")!;
    expect(within(createdSection).getByText("Collaborative grilling")).toBeInTheDocument();
  });

  it("lets a Member join via Link with a display name and see the visited-room list", async () => {
    installMockServer();
    const user = userEvent.setup();
    const apiClient = new ApiClient({ baseUrl: BASE_URL });
    const created = await apiClient.createRoom("Member joins topic");

    render(
      <App
        apiClient={apiClient}
        createSocket={() => new FakeSocket()}
        initialPath={created.room.link}
      />
    );

    await screen.findByRole("heading", { name: "Member joins topic" });
    await user.type(screen.getByLabelText("Display name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Join Room" }));

    await user.click(await screen.findByRole("button", { name: "Back" }));

    const visitedSection = screen.getByRole("heading", { name: "Rooms you've visited" }).closest("section")!;
    expect(within(visitedSection).getByText("Member joins topic")).toBeInTheDocument();
  });

  it("sends Reply vs Relay per the @agent rule, and shows a user-visible error for a rejected Relay", async () => {
    const { rooms } = installMockServer();
    const user = userEvent.setup();
    const apiClient = new ApiClient({ baseUrl: BASE_URL });

    render(<App apiClient={apiClient} createSocket={() => new FakeSocket()} initialPath="/" />);

    await user.type(screen.getByLabelText("Topic"), "Relay rules");
    await user.click(screen.getByRole("button", { name: "Create Room" }));
    await screen.findByRole("heading", { name: "Relay rules" });
    await user.type(screen.getByLabelText("Display name"), "Host");
    await user.click(screen.getByRole("button", { name: "Join Room" }));

    const room = [...rooms.values()][0];

    // Plain text is stored as a Reply.
    await user.type(screen.getByLabelText("Message"), "just talking");
    await user.click(screen.getByRole("button", { name: "Send" }));
    const transcript = await screen.findByLabelText("Transcript");
    expect(within(transcript).getByText("just talking")).toBeInTheDocument();
    expect(within(transcript).getByText("Member")).toBeInTheDocument();

    // @agent is accepted as a Relay once the Daemon is connected.
    room.daemonConnected = true;
    await user.type(screen.getByLabelText("Message"), "@agent summarize this");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await within(transcript).findByText("@agent summarize this")).toBeInTheDocument();
    const relayEntry = within(transcript).getByTestId("transcript-entry-relay");
    expect(within(relayEntry).getByTestId("transcript-author-role")).toHaveTextContent("Host");

    // @agent is rejected with a user-visible error while the Daemon is disconnected.
    room.daemonConnected = false;
    await user.type(screen.getByLabelText("Message"), "@agent are you there");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/disconnected/i);
  });

  it("updates the Transcript and Daemon presence from mock WebSocket events without reload", async () => {
    installMockServer();
    const user = userEvent.setup();
    const apiClient = new ApiClient({ baseUrl: BASE_URL });
    const created = await apiClient.createRoom("Live updates");

    render(
      <App
        apiClient={apiClient}
        createSocket={() => new FakeSocket()}
        initialPath={created.room.link}
      />
    );

    await screen.findByRole("heading", { name: "Live updates" });
    await user.type(screen.getByLabelText("Display name"), "Ada");
    await user.click(screen.getByRole("button", { name: "Join Room" }));

    expect(await screen.findByTestId("presence-badge")).toHaveTextContent("disconnected");

    const socket = FakeSocket.instances.at(-1)!;
    socket.triggerOpen();
    socket.triggerMessage(
      JSON.stringify({ type: "presence", roomId: created.room.id, daemonConnected: true })
    );

    expect(await screen.findByTestId("presence-badge")).toHaveTextContent("connected");

    socket.triggerMessage(
      JSON.stringify({
        type: "transcript-entry",
        roomId: created.room.id,
        entry: {
          id: "agent-entry-1",
          roomId: created.room.id,
          kind: "agent",
          body: "Here is my answer.",
          createdAt: new Date().toISOString()
        }
      })
    );

    expect(await screen.findByText("Here is my answer.")).toBeInTheDocument();
  });
});
