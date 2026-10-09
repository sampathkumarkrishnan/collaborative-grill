/**
 * Agent SDK adapter: the seam between the Daemon's Relay routing
 * (`relayRouter.ts`) and the Cursor SDK. One `AgentHandle` is created per
 * Room and reused for the Server connection's lifetime, so follow-up
 * Relays keep conversation context, per `docs/spec-hackathon-poc.md`:
 * "one Agent conversation per Room... follow-up Relays keep context."
 *
 * `createFakeSdkAdapter` is the default: a deterministic in-memory
 * stand-in used in CI and local dev without Cursor installed.
 * `createCursorSdkAdapter` wraps the real `@cursor/sdk`; `cli.ts` (the
 * Daemon process entry) only builds it when `CURSOR_API_KEY` and a `cwd`
 * are both set.
 */

/** One completed Agent run. Only the buffered final text is ever read -
 *  the Daemon never forwards partial stream output to the Server. */
export interface AgentRun {
  text(): Promise<string>;
}

/** One Room's durable Agent conversation. */
export interface AgentHandle {
  send(payload: string): Promise<AgentRun>;
  /** Releases any resources the adapter holds for this Agent, if any. */
  dispose?(): Promise<void>;
}

/** Creates one `AgentHandle` for a Room. Callers (the Agent pool) decide caching. */
export interface AgentSdkAdapter {
  createAgent(roomId: string): Promise<AgentHandle>;
}

/**
 * Deterministic fake adapter. Each call to `createAgent` starts an
 * independent per-Room turn counter; `send` echoes a canned reply that
 * includes that counter, so tests can assert that follow-up Relays reuse
 * the same `AgentHandle` (and so see an incrementing turn count) rather
 * than a fresh Agent being created for every Relay.
 */
export function createFakeSdkAdapter(): AgentSdkAdapter {
  async function createAgent(roomId: string): Promise<AgentHandle> {
    let turn = 0;

    return {
      async send(payload: string): Promise<AgentRun> {
        turn += 1;
        const body = `[fake-agent reply ${turn} for room ${roomId}] ${payload}`;
        return { text: async () => body };
      }
    };
  }

  return { createAgent };
}

export interface CursorSdkAdapterOptions {
  /** Read from `CURSOR_API_KEY`; required to enable this adapter at all. */
  apiKey: string;
  /** The Host machine working directory the local Agent runs against. */
  cwd: string;
  model?: string;
}

/**
 * Real adapter: one `Agent.create` per Room (`local: { cwd }`), reused
 * across that Room's follow-up `send` calls - the Cursor SDK's "durable
 * with follow-ups" pattern. Each `send` awaits `run.wait()` rather than
 * reading `run.stream()`, so only the finished `RunResult.result` text
 * is ever buffered - never partial stream output. `@cursor/sdk` is
 * imported dynamically so this module (and the rest of the Daemon) loads
 * and typechecks without the package installed; the import only runs
 * once a Room's first Relay actually needs the real Agent.
 */
export function createCursorSdkAdapter(options: CursorSdkAdapterOptions): AgentSdkAdapter {
  async function createAgent(roomId: string): Promise<AgentHandle> {
    const { Agent } = await import("@cursor/sdk");
    const agent = await Agent.create({
      apiKey: options.apiKey,
      model: { id: options.model ?? "composer-2.5" },
      local: { cwd: options.cwd }
    });
    // eslint-disable-next-line no-console
    console.log(`Cursor Agent ${agent.agentId} created for Room ${roomId}.`);

    return {
      async send(payload: string): Promise<AgentRun> {
        const run = await agent.send(payload);
        // Per the Cursor SDK's production guidance: log the run id right
        // after `send()`, before awaiting the result - if the run hangs,
        // this id is what you look up in the dashboard or `Agent.getRun`.
        // eslint-disable-next-line no-console
        console.log(`Cursor run ${run.id} started for Room ${roomId}.`);
        return {
          async text(): Promise<string> {
            const result = await run.wait();
            if (result.status === "error") {
              // eslint-disable-next-line no-console
              console.error(
                `Cursor run ${run.id} for Room ${roomId} failed: ${result.error?.message ?? "(no message)"}`
              );
              throw new Error(result.error?.message ?? `Agent run ${result.id} failed`);
            }
            const text = result.result ?? "";
            // eslint-disable-next-line no-console
            console.log(
              `Cursor run ${run.id} for Room ${roomId} finished (status: ${result.status}, reply length: ${text.length}).`
            );
            return text;
          }
        };
      },
      async dispose(): Promise<void> {
        agent.close();
      }
    };
  }

  return { createAgent };
}
