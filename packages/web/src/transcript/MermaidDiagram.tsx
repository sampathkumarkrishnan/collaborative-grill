import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

let mermaidInitialized = false;

function ensureMermaid(): void {
  if (mermaidInitialized) {
    return;
  }
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "neutral"
  });
  mermaidInitialized = true;
}

export interface MermaidDiagramProps {
  chart: string;
}

/** Renders one Mermaid diagram from fenced code in a Transcript body. */
export function MermaidDiagram({ chart }: MermaidDiagramProps): JSX.Element {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ensureMermaid();

    const renderId = `mermaid-${reactId.replace(/:/g, "")}`;

    void mermaid
      .render(renderId, chart.trim())
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setSvg(null);
          setError(cause instanceof Error ? cause.message : "Could not render diagram");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <pre className="transcript-mermaid-error" data-testid="mermaid-error">
        {error}
      </pre>
    );
  }

  if (!svg) {
    return <div className="transcript-mermaid-loading" data-testid="mermaid-loading" />;
  }

  return (
    <div
      className="transcript-mermaid"
      data-testid="mermaid-diagram"
      // Mermaid returns trusted SVG for the chart we asked it to render.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
