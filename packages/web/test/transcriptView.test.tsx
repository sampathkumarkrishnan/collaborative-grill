import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureTranscript } from "../src/transcript/fixtures.js";
import { TranscriptView } from "../src/transcript/TranscriptView.js";

afterEach(() => {
  cleanup();
});

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({
      svg: "<svg data-mermaid-fixture='true'></svg>"
    }))
  }
}));

describe("TranscriptView", () => {
  it("renders Reply, Relay, and Agent lines through one markdown pipeline", async () => {
    render(<TranscriptView entries={fixtureTranscript} />);

    expect(screen.getByTestId("transcript-entry-reply")).toBeInTheDocument();
    expect(screen.getByTestId("transcript-entry-relay")).toBeInTheDocument();
    expect(screen.getByTestId("transcript-entry-agent")).toBeInTheDocument();

    const markdownBodies = screen.getAllByTestId("transcript-markdown");
    expect(markdownBodies).toHaveLength(3);
  });

  it("shows distinct author labels for Member, Host, and Agent", () => {
    render(<TranscriptView entries={fixtureTranscript} />);

    const roles = screen.getAllByTestId("transcript-author-role").map((node) => node.textContent);
    expect(roles).toEqual(["Member", "Host", "Agent"]);

    const authors = screen.getAllByTestId("transcript-author").map((node) => node.textContent);
    expect(authors).toEqual(["Jamie", "Alex", "Agent"]);
  });

  it("renders Mermaid blocks in Host and Agent messages", async () => {
    render(<TranscriptView entries={fixtureTranscript} />);

    await waitFor(() => {
      expect(screen.getAllByTestId("mermaid-diagram")).toHaveLength(2);
    });
  });
});
