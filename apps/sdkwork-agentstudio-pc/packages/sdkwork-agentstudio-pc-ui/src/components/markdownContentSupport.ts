import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Commercial surfaces render untrusted markdown. Do not enable raw HTML parsing here.
export const markdownContentReactMarkdownProps: ComponentProps<typeof ReactMarkdown> = {
  remarkPlugins: [remarkGfm],
};
