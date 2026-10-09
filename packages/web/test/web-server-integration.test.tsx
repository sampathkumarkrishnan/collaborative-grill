import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "@collaborative-grill/server/app";
import { createServerRuntime, type ServerRuntime } from "@collaborative-grill/server/runtime";
import { attachWebSocketServer } from "@collaborative-grill/server/ws";
import { App } from "../src/App.js";
import { ApiClient } from "../src/api.js";
import { createBrowserStorage, createInMemoryStorage } from "../src/storage.js";

async function listen(server: HttpServer): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  return (server.address() as AddressInfo).port;
}

describe("Web and Server integration", () => {
  let runtime: ServerRuntime;
  let server: HttpServer;
  let serverUrl: string;
  let wsUrl: string;

  beforeEach(async () => {
    runtime = createServerRuntime();
    const app = createApp(runtime.room, runtime.hub);
    server = createServer(app);
    attachWebSocketServer(server, runtime.room, runtime.hub);
    const port = await listen(server);
    serverUrl = `http://127.0.0.1:${port}`;
    wsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    runtime.close();
  });

  it("creates and joins a Room against the running Server with SQLite", async () => {
    const user = userEvent.setup();
    const hostStorage = createBrowserStorage(createInMemoryStorage());
    const hostClient = new ApiClient({ baseUrl: serverUrl });

    // Host creates a Room
    const hostView = render(
      <App
        apiClient={hostClient}
        socketUrl={wsUrl}
        storage={hostStorage}
        initialPath="/"
      />
    );

    await user.type(hostView.getByLabelText("Topic"), "Collaborative grilling");
    await user.click(hostView.getByRole("button", { name: "Create Room" }));

    // Host enters display name
    await hostView.findByRole("heading", { name: "Collaborative grilling" });
    await user.type(hostView.getByLabelText("Display name"), "Host");
    await user.click(hostView.getByRole("button", { name: "Join Room" }));

    // Host sees the share link
    const shareInput = (await hostView.findByLabelText(
      "Share this Link to invite Members"
    )) as HTMLInputElement;
    expect(shareInput.value).toContain("/r/");
    const linkPath = new URL(shareInput.value, "http://localhost").pathname;

    // Verify room is recorded in SQLite
    const roomSummary = runtime.room.joinByLink(linkPath.replace("/r/", ""));
    expect(roomSummary).not.toBeNull();
    expect(roomSummary?.room.topic).toBe("Collaborative grilling");

    // Member joins using the Link path in a second browser session
    const memberStorage = createBrowserStorage(createInMemoryStorage());
    const memberClient = new ApiClient({ baseUrl: serverUrl });
    const memberView = render(
      <App
        apiClient={memberClient}
        socketUrl={wsUrl}
        storage={memberStorage}
        initialPath={linkPath}
      />
    );

    const memberNameInput = await memberView.findByLabelText("Display name");
    await user.type(memberNameInput, "Ada");
    await user.click(memberView.getByRole("button", { name: "Join Room" }));

    // Member does not hold host credential
    expect(memberStorage.isHostOfRoom(roomSummary!.room.id)).toBe(false);
    expect(hostStorage.isHostOfRoom(roomSummary!.room.id)).toBe(true);
  });

  it("delivers two-browser Reply flow live over WebSocket without reload", async () => {
    const user = userEvent.setup();
    const hostStorage = createBrowserStorage(createInMemoryStorage());
    const hostClient = new ApiClient({ baseUrl: serverUrl });
    const hostContainer = document.createElement("div");
    document.body.appendChild(hostContainer);

    render(
      <App
        apiClient={hostClient}
        socketUrl={wsUrl}
        storage={hostStorage}
        initialPath="/"
      />,
      { container: hostContainer }
    );

    // Host creates room and joins
    await user.type(within(hostContainer).getByLabelText("Topic"), "Two browser discussion");
    await user.click(within(hostContainer).getByRole("button", { name: "Create Room" }));
    await within(hostContainer).findByRole("heading", { name: "Two browser discussion" });
    await user.type(within(hostContainer).getByLabelText("Display name"), "Host");
    await user.click(within(hostContainer).getByRole("button", { name: "Join Room" }));

    const shareInput = (await within(hostContainer).findByLabelText(
      "Share this Link to invite Members"
    )) as HTMLInputElement;
    const linkPath = new URL(shareInput.value, "http://localhost").pathname;

    // Member joins via Link in separate container
    const memberStorage = createBrowserStorage(createInMemoryStorage());
    const memberClient = new ApiClient({ baseUrl: serverUrl });
    const memberContainer = document.createElement("div");
    document.body.appendChild(memberContainer);

    render(
      <App
        apiClient={memberClient}
        socketUrl={wsUrl}
        storage={memberStorage}
        initialPath={linkPath}
      />,
      { container: memberContainer }
    );

    const memberNameInput = await within(memberContainer).findByLabelText("Display name");
    await user.type(memberNameInput, "Ada");
    await user.click(within(memberContainer).getByRole("button", { name: "Join Room" }));

    // Host sends a Reply
    const hostComposer = await within(hostContainer).findByLabelText("Message");
    await user.type(hostComposer, "Hello from Host");
    await user.click(within(hostContainer).getByRole("button", { name: "Send" }));

    // Host sees its own Reply in transcript
    const hostTranscript = await within(hostContainer).findByLabelText("Transcript");
    expect(within(hostTranscript).getByText("Hello from Host")).toBeInTheDocument();

    // Member receives Host's Reply live over WebSocket without reload
    const memberTranscript = await within(memberContainer).findByLabelText("Transcript");
    expect(await within(memberTranscript).findByText("Hello from Host")).toBeInTheDocument();

    // Member sends a Reply back
    const memberComposer = within(memberContainer).getByLabelText("Message");
    await user.type(memberComposer, "Hello back from Ada");
    await user.click(within(memberContainer).getByRole("button", { name: "Send" }));

    // Member sees its own Reply
    expect(await within(memberTranscript).findByText("Hello back from Ada")).toBeInTheDocument();

    // Host receives Member's Reply live over WebSocket without reload
    expect(await within(hostTranscript).findByText("Hello back from Ada")).toBeInTheDocument();

    // Verify Transcript in SQLite contains both messages in order
    const roomId = linkPath.replace("/r/", "");
    const roomTranscript = runtime.room.getTranscript(
      runtime.room.joinByLink(roomId)!.room.id
    );
    expect(roomTranscript.map((entry) => ({ author: entry.authorDisplayName, body: entry.body }))).toEqual([
      { author: "Host", body: "Hello from Host" },
      { author: "Ada", body: "Hello back from Ada" }
    ]);
  });

  it("shows Relay rejection to Host when Daemon is disconnected and does not record it", async () => {
    const user = userEvent.setup();
    const hostStorage = createBrowserStorage(createInMemoryStorage());
    const hostClient = new ApiClient({ baseUrl: serverUrl });
    const hostContainer = document.createElement("div");
    document.body.appendChild(hostContainer);

    render(
      <App
        apiClient={hostClient}
        socketUrl={wsUrl}
        storage={hostStorage}
        initialPath="/"
      />,
      { container: hostContainer }
    );

    // Host creates room and joins
    await user.type(within(hostContainer).getByLabelText("Topic"), "Relay rejection test");
    await user.click(within(hostContainer).getByRole("button", { name: "Create Room" }));
    await within(hostContainer).findByRole("heading", { name: "Relay rejection test" });
    await user.type(within(hostContainer).getByLabelText("Display name"), "Host");
    await user.click(within(hostContainer).getByRole("button", { name: "Join Room" }));

    const shareInput = (await within(hostContainer).findByLabelText(
      "Share this Link to invite Members"
    )) as HTMLInputElement;
    const linkPath = new URL(shareInput.value, "http://localhost").pathname;

    // Member joins via Link
    const memberStorage = createBrowserStorage(createInMemoryStorage());
    const memberClient = new ApiClient({ baseUrl: serverUrl });
    const memberContainer = document.createElement("div");
    document.body.appendChild(memberContainer);

    render(
      <App
        apiClient={memberClient}
        socketUrl={wsUrl}
        storage={memberStorage}
        initialPath={linkPath}
      />,
      { container: memberContainer }
    );

    const memberNameInput = await within(memberContainer).findByLabelText("Display name");
    await user.type(memberNameInput, "Ada");
    await user.click(within(memberContainer).getByRole("button", { name: "Join Room" }));

    // Confirm Daemon is disconnected on presence badge
    expect(within(hostContainer).getByTestId("presence-badge")).toHaveTextContent("disconnected");
    expect(within(memberContainer).getByTestId("presence-badge")).toHaveTextContent("disconnected");

    // Host attempts a Relay
    const hostComposer = await within(hostContainer).findByLabelText("Message");
    await user.type(hostComposer, "@agent investigate this bug");
    await user.click(within(hostContainer).getByRole("button", { name: "Send" }));

    // Host sees visible alert error
    const alert = await within(hostContainer).findByRole("alert");
    expect(alert).toHaveTextContent(/daemon is disconnected/i);

    // Neither Host nor Member sees the rejected Relay in the Transcript
    const hostTranscript = within(hostContainer).queryByLabelText("Transcript");
    expect(hostTranscript).toBeNull(); // Still "No messages yet."
    const memberTranscript = within(memberContainer).queryByLabelText("Transcript");
    expect(memberTranscript).toBeNull();

    // Verify Transcript in SQLite is empty
    const roomId = linkPath.replace("/r/", "");
    const roomTranscript = runtime.room.getTranscript(
      runtime.room.joinByLink(roomId)!.room.id
    );
    expect(roomTranscript).toHaveLength(0);

    // Member can still post a Reply
    const memberComposer = await within(memberContainer).findByLabelText("Message");
    await user.type(memberComposer, "We can continue discussion while agent is offline");
    await user.click(within(memberContainer).getByRole("button", { name: "Send" }));

    // Both see Member's Reply
    expect(await within(hostContainer).findByText("We can continue discussion while agent is offline")).toBeInTheDocument();
    expect(await within(memberContainer).findByText("We can continue discussion while agent is offline")).toBeInTheDocument();
  });

  it("updates Daemon presence and broadcasts accepted Relay and Agent entries live to both browsers", async () => {
    const user = userEvent.setup();
    const hostStorage = createBrowserStorage(createInMemoryStorage());
    const hostClient = new ApiClient({ baseUrl: serverUrl });
    const hostContainer = document.createElement("div");
    document.body.appendChild(hostContainer);

    render(
      <App
        apiClient={hostClient}
        socketUrl={wsUrl}
        storage={hostStorage}
        initialPath="/"
      />,
      { container: hostContainer }
    );

    // Host creates room and joins
    await user.type(within(hostContainer).getByLabelText("Topic"), "Presence and Relay test");
    await user.click(within(hostContainer).getByRole("button", { name: "Create Room" }));
    await within(hostContainer).findByRole("heading", { name: "Presence and Relay test" });
    await user.type(within(hostContainer).getByLabelText("Display name"), "Host");
    await user.click(within(hostContainer).getByRole("button", { name: "Join Room" }));

    const shareInput = (await within(hostContainer).findByLabelText(
      "Share this Link to invite Members"
    )) as HTMLInputElement;
    const linkPath = new URL(shareInput.value, "http://localhost").pathname;
    const roomId = linkPath.replace("/r/", "");
    const joined = runtime.room.joinByLink(roomId)!;
    const hostCredential = hostStorage.getHostCredential(joined.room.id)!;
    expect(hostCredential).toBeDefined();

    // Member joins via Link
    const memberStorage = createBrowserStorage(createInMemoryStorage());
    const memberClient = new ApiClient({ baseUrl: serverUrl });
    const memberContainer = document.createElement("div");
    document.body.appendChild(memberContainer);

    render(
      <App
        apiClient={memberClient}
        socketUrl={wsUrl}
        storage={memberStorage}
        initialPath={linkPath}
      />,
      { container: memberContainer }
    );

    const memberNameInput = await within(memberContainer).findByLabelText("Display name");
    await user.type(memberNameInput, "Ada");
    await user.click(within(memberContainer).getByRole("button", { name: "Join Room" }));

    // Initially both see Daemon disconnected
    expect(within(hostContainer).getByTestId("presence-badge")).toHaveTextContent("disconnected");
    expect(within(memberContainer).getByTestId("presence-badge")).toHaveTextContent("disconnected");

    // Daemon connects with Host credential
    const daemonSocket = new WebSocket(wsUrl);
    await new Promise<void>((resolve) =>
      daemonSocket.addEventListener("open", () => resolve(), { once: true })
    );
    daemonSocket.send(
      JSON.stringify({
        type: "daemon-connect",
        roomId: joined.room.id,
        hostCredential
      })
    );

    // Both browsers reflect connected presence live without reload
    await expect.poll(() => within(hostContainer).getByTestId("presence-badge").textContent).toContain("connected");
    await expect.poll(() => within(memberContainer).getByTestId("presence-badge").textContent).toContain("connected");

    // Host sends an @agent Relay
    const hostComposer = await within(hostContainer).findByLabelText("Message");
    await user.type(hostComposer, "@agent please analyze architecture");
    await user.click(within(hostContainer).getByRole("button", { name: "Send" }));

    // Both browsers receive the Relay entry live
    expect(await within(hostContainer).findByText("@agent please analyze architecture")).toBeInTheDocument();
    expect(await within(memberContainer).findByText("@agent please analyze architecture")).toBeInTheDocument();

    // Daemon receives relay-delivery over socket
    // Daemon publishes Agent answer
    daemonSocket.send(
      JSON.stringify({
        type: "agent-publication",
        roomId: joined.room.id,
        hostCredential,
        body: "Architecture looks solid and clean."
      })
    );

    // Both browsers receive the Agent entry live without reload
    expect(await within(hostContainer).findByText("Architecture looks solid and clean.")).toBeInTheDocument();
    expect(await within(memberContainer).findByText("Architecture looks solid and clean.")).toBeInTheDocument();

    // Daemon closes socket -> presence updates to disconnected in both browsers
    daemonSocket.close();
    await expect.poll(() => within(hostContainer).getByTestId("presence-badge").textContent).toContain("disconnected");
    await expect.poll(() => within(memberContainer).getByTestId("presence-badge").textContent).toContain("disconnected");

    // Verify Transcript in SQLite contains both Relay and Agent entries in order
    const storedEntries = runtime.room.getTranscript(joined.room.id);
    expect(storedEntries.map((e) => ({ kind: e.kind, body: e.body }))).toEqual([
      { kind: "relay", body: "@agent please analyze architecture" },
      { kind: "agent", body: "Architecture looks solid and clean." }
    ]);
  });
});
