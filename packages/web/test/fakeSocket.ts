import type { SocketLike } from "../src/ws.js";

/** A minimal fake socket the tests drive directly, standing in for a real Server connection. */
export class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  sent: string[] = [];
  closed = false;
  private listeners: Record<string, Array<(event?: { data: unknown }) => void>> = {};

  constructor() {
    FakeSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event?: { data: unknown }) => void): void {
    (this.listeners[type] ??= []).push(listener);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  triggerOpen(): void {
    for (const listener of this.listeners.open ?? []) {
      listener();
    }
  }

  triggerMessage(data: unknown): void {
    for (const listener of this.listeners.message ?? []) {
      listener({ data });
    }
  }
}
