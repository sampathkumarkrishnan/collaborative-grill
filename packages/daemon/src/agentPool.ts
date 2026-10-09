import type { AgentHandle, AgentSdkAdapter } from "./sdkAdapter.js";

/**
 * Caches one `AgentHandle` per Room id for the life of the Daemon's
 * Server connection, so a Room's second and later Relays reuse the same
 * Agent conversation instead of a fresh one being created each time.
 */
export interface AgentPool {
  getOrCreate(roomId: string): Promise<AgentHandle>;
  /** Disposes every cached Agent and clears the pool. */
  disposeAll(): Promise<void>;
}

export function createAgentPool(adapter: AgentSdkAdapter): AgentPool {
  const agentsByRoomId = new Map<string, Promise<AgentHandle>>();

  function getOrCreate(roomId: string): Promise<AgentHandle> {
    const cached = agentsByRoomId.get(roomId);
    if (cached) {
      return cached;
    }

    const created = adapter.createAgent(roomId).catch((error: unknown) => {
      // Don't cache a failed creation; the next Relay for this Room gets
      // a fresh attempt rather than being stuck on a rejected promise.
      agentsByRoomId.delete(roomId);
      throw error;
    });
    agentsByRoomId.set(roomId, created);
    return created;
  }

  async function disposeAll(): Promise<void> {
    const pending = Array.from(agentsByRoomId.values());
    agentsByRoomId.clear();

    for (const agentPromise of pending) {
      const agent = await agentPromise.catch(() => undefined);
      await agent?.dispose?.();
    }
  }

  return { getOrCreate, disposeAll };
}
