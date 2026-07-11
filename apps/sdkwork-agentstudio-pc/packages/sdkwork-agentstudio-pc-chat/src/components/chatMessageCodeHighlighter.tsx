/// <reference path="../types/react-syntax-highlighter.d.ts" />

import { memo } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-light';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import diff from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const LANGUAGE_ALIASES = new Map<string, string>([
  ['bash', 'bash'],
  ['sh', 'bash'],
  ['shell', 'bash'],
  ['shell-session', 'bash'],
  ['diff', 'diff'],
  ['java', 'java'],
  ['javascript', 'javascript'],
  ['js', 'javascript'],
  ['json', 'json'],
  ['jsx', 'jsx'],
  ['markdown', 'markdown'],
  ['md', 'markdown'],
  ['markup', 'markup'],
  ['html', 'markup'],
  ['xml', 'markup'],
  ['python', 'python'],
  ['py', 'python'],
  ['rust', 'rust'],
  ['rs', 'rust'],
  ['sql', 'sql'],
  ['typescript', 'typescript'],
  ['ts', 'typescript'],
  ['tsx', 'tsx'],
  ['yaml', 'yaml'],
  ['yml', 'yaml'],
]);

const LANGUAGE_REGISTRATIONS = [
  ['bash', bash],
  ['diff', diff],
  ['java', java],
  ['javascript', javascript],
  ['json', json],
  ['jsx', jsx],
  ['markdown', markdown],
  ['markup', markup],
  ['python', python],
  ['rust', rust],
  ['sql', sql],
  ['tsx', tsx],
  ['typescript', typescript],
  ['yaml', yaml],
] as const;

let languagesRegistered = false;

function ensureLanguagesRegistered() {
  if (languagesRegistered) {
    return;
  }

  for (const [name, language] of LANGUAGE_REGISTRATIONS) {
    SyntaxHighlighter.registerLanguage(name, language);
  }

  languagesRegistered = true;
}

function resolveLanguage(language: string) {
  return LANGUAGE_ALIASES.get(language.trim().toLowerCase()) ?? 'markup';
}

interface ChatMessageCodeHighlighterProps {
  language: string;
  code: string;
  props: Record<string, unknown>;
}

export const ChatMessageCodeHighlighter = memo(function ChatMessageCodeHighlighter({
  language,
  code,
  props,
}: ChatMessageCodeHighlighterProps) {
  ensureLanguagesRegistered();

  return (
    <SyntaxHighlighter
      {...props}
      style={vscDarkPlus}
      language={resolveLanguage(language)}
      PreTag="div"
      className="!m-0 !bg-transparent !p-4 text-[13px] leading-relaxed"
      showLineNumbers={true}
      lineNumberStyle={{
        minWidth: '2.5em',
        paddingRight: '1em',
        color: '#6e7681',
        textAlign: 'right',
        userSelect: 'none',
      }}
    >
      {code}
    </SyntaxHighlighter>
  );
});
