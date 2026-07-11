declare module 'react-markdown' {
  import type { ComponentType } from 'react';

  const ReactMarkdown: ComponentType<any>;
  export default ReactMarkdown;
}

declare module 'remark-gfm' {
  const remarkGfm: any;
  export default remarkGfm;
}

declare module 'react-syntax-highlighter' {
  import type { ComponentType } from 'react';

  export const Prism: ComponentType<any>;
  const SyntaxHighlighter: ComponentType<any>;
  export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const vscDarkPlus: Record<string, unknown>;
}
