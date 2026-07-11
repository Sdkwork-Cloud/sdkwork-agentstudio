import ReactMarkdown from 'react-markdown';
import { markdownContentReactMarkdownProps } from './markdownContentSupport';

export function MarkdownContent({ content }: { content: string }) {
  return <ReactMarkdown {...markdownContentReactMarkdownProps}>{content}</ReactMarkdown>;
}
