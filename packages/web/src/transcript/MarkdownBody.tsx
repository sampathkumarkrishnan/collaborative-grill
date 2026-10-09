import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./MermaidDiagram.js";

const markdownComponents: Components = {
  pre({ children }) {
    return <>{children}</>;
  },
  code(props) {
    const { className, children, ...rest } = props;
    const language = /language-(\w+)/.exec(className ?? "")?.[1];
    const text = String(children).replace(/\n$/, "");

    if (language === "mermaid") {
      return <MermaidDiagram chart={text} />;
    }

    if (className) {
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    }

    return <code {...rest}>{children}</code>;
  }
};

export interface MarkdownBodyProps {
  markdown: string;
}

/** Shared markdown + Mermaid pipeline for every Transcript entry body. */
export function MarkdownBody({ markdown }: MarkdownBodyProps): JSX.Element {
  return (
    <div className="transcript-markdown" data-testid="transcript-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
