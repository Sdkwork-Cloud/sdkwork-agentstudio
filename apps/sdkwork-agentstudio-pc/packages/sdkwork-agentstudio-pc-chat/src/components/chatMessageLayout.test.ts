import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const source = readFileSync(new URL('./ChatMessage.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../pages/Chat.tsx', import.meta.url), 'utf8');
const conversationPaneSource = readFileSync(
  new URL('./ChatConversationPane.tsx', import.meta.url),
  'utf8',
);
const chromeSurfaceSource = readFileSync(
  new URL('./chatChromeSurface.ts', import.meta.url),
  'utf8',
);
let drawerSource = '';
try {
  drawerSource = readFileSync(new URL('./ChatSessionContextDrawer.tsx', import.meta.url), 'utf8');
} catch {
  drawerSource = '';
}

await runTest(
  'ChatMessage does not reserve a grouped top action row when headers are hidden',
  () => {
    assert.doesNotMatch(source, /!\s*showHeader\s*&&\s*messageActions\s*\?/);
  },
);

await runTest(
  'ChatMessage renders tool invocations as compact inline links instead of stacked cards',
  () => {
    assert.match(source, /const\s+ToolLinksPanel\s*=\s*memo/);
    assert.doesNotMatch(source, /const\s+ToolCardsPanel\s*=\s*memo/);
    assert.match(source, /hover:underline/);
    assert.doesNotMatch(
      source,
      /details\s+className="mb-4\s+overflow-hidden\s+rounded-2xl\s+border\s+border-zinc-200\/80\s+bg-white\/70\s+shadow-sm\s+backdrop-blur-sm\s+dark:border-zinc-800\/80\s+dark:bg-zinc-900\/60"/,
    );
    assert.doesNotMatch(
      source,
      /expandedTool\s*\?\s*\(\s*<div\s+className="rounded-xl\s+border\s+border-zinc-200\/70\s+bg-zinc-50\/85/,
    );
    assert.doesNotMatch(
      source,
      /:\s*isTool\s*\?\s*'w-full\s+rounded-2xl\s+border\s+border-zinc-200\/80\s+bg-white\/65/,
    );
  },
);

await runTest(
  'ChatMessage uses a wider avatar-free layout with tighter message padding',
  () => {
    assert.match(
      source,
      /group mx-auto flex w-full max-w-6xl transition-all duration-300/,
    );
    assert.match(
      source,
      /isUser\s*\?\s*'justify-end pl-4 pr-2 sm:pl-6 sm:pr-3 lg:pl-8 lg:pr-4'\s*:\s*'justify-start px-4 sm:px-6 lg:px-8'/,
    );
    assert.match(
      source,
      /rounded-br-md bg-zinc-100 px-3\.5 py-1\.5 text-zinc-900 sm:max-w-\[95%\] dark:bg-zinc-800 dark:text-zinc-100/,
    );
    assert.match(
      source,
      /:\s*isTool\s*\?\s*'w-full px-0 py-0 text-zinc-900 dark:text-zinc-100'\s*:\s*'w-full px-0 py-0 text-zinc-900 dark:text-zinc-100'/,
    );
    assert.doesNotMatch(source, /showAvatar\?: boolean;/);
    assert.doesNotMatch(source, /reserveAvatarSpace\?: boolean;/);
    assert.doesNotMatch(source, /justify-start pr-4 sm:pr-12 lg:pr-24/);
    assert.doesNotMatch(source, /<Bot className=/);
  },
);

await runTest(
  'ChatMessage keeps markdown, code blocks, and tool links on a tighter vertical rhythm',
  () => {
    assert.match(
      source,
      /CHAT_SURFACE_PANEL_CLASS,\s*'relative mb-4 mt-3 min-w-0 overflow-hidden rounded-xl dark:bg-\[#1E1E1E\]'/,
    );
    assert.match(
      source,
      /prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mb-2 prose-headings:mt-4 prose-a:text-primary-500 hover:prose-a:text-primary-600/,
    );
    assert.match(
      source,
      /'prose prose-zinc prose-sm relative max-w-none break-words text-\[14px\] leading-6 dark:prose-invert sm:prose-sm'/,
    );
    assert.match(
      source,
      /prose-code:before:content-none prose-code:after:content-none prose-p:my-2 prose-p:leading-6 prose-pre:my-3 prose-pre:bg-transparent prose-pre:p-0 prose-ul:my-2 prose-ol:my-2/,
    );
    assert.match(source, /attachments\.length > 0 \? \(\s*<div className="mb-2\.5 grid gap-3 sm:grid-cols-2">/);
    assert.match(source, /const NoticeList = memo\(function NoticeList/);
    assert.match(source, /presentOpenClawToolLinkItems/);
    assert.doesNotMatch(source, /const stableToolId = toolCard\.toolCallId\?\.trim\(\) \|\|/);
    assert.match(source, /notices\.length > 0 \? \(\s*<NoticeList notices=\{notices\} \/>\s*\) : null/);
    assert.match(
      source,
      /reasoning \? \(\s*<details\s*className=\{cn\(\s*CHAT_SURFACE_INSET_PANEL_CLASS,\s*'mb-2\.5 overflow-hidden dark:bg-zinc-900\/65'/,
    );
    assert.match(
      source,
      /<div className=\{hasRenderableContent \? 'mt-1\.5' : (?:null|undefined)\}>/,
    );
    assert.doesNotMatch(source, /sm:prose-base/);
  },
);

await runTest(
  'ChatMessage exposes floating copy actions for user and assistant messages when headers are hidden',
  () => {
    assert.match(
      source,
      /const showFloatingCopyAction = !showHeader && canCopyMessage && \(isUser \|\| role === 'assistant'\);/,
    );
    assert.match(
      source,
      /'min-w-0 flex-1',\s*showFloatingCopyAction && 'relative pr-11 sm:pr-12'/,
    );
    assert.match(
      source,
      /className=\{cn\(\s*'absolute right-0 top-0 z-10 flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100'/,
    );
    assert.match(
      source,
      /title=\{t\('chat\.message\.copyMessage'\)\}/,
    );
  },
);

await runTest(
  'Chat page stops reserving avatar-driven message and footer offsets',
  () => {
    assert.doesNotMatch(pageSource, /showAvatar=\{isFirstInGroup\}/);
    assert.doesNotMatch(pageSource, /reserveAvatarSpace=\{!isFirstInGroup\}/);
    assert.match(
      conversationPaneSource,
      /mx-auto flex w-full max-w-6xl text-\[10px\] tracking-normal text-zinc-400 dark:text-zinc-500/,
    );
    assert.match(
      conversationPaneSource,
      /group\.role === 'user'\s*\?\s*'justify-end pl-4 pr-2 sm:pl-6 sm:pr-3 lg:pl-8 lg:pr-4'\s*:\s*'justify-start px-4 sm:px-6 lg:px-8'/,
    );
    assert.match(
      conversationPaneSource,
      /<div key=\{group\.key\} className="space-y-1\.5 sm:space-y-2">/,
    );
    assert.doesNotMatch(pageSource, /ml-11 sm:ml-14/);
  },
);

await runTest(
  'Chat page keeps the composer in layout so the latest message is never hidden behind an overlay',
  () => {
    assert.doesNotMatch(pageSource, /const composerSurfaceRef = useRef<HTMLDivElement \| null>\(null\);/);
    assert.doesNotMatch(pageSource, /const \[composerSurfaceHeight, setComposerSurfaceHeight\] = useState\(0\);/);
    assert.doesNotMatch(pageSource, /messageListBottomPadding/);
    assert.doesNotMatch(pageSource, /emptyStateBottomPadding/);
    assert.doesNotMatch(pageSource, /ResizeObserver/);
    assert.doesNotMatch(pageSource, /absolute bottom-0 left-0 right-0/);
    assert.match(
      conversationPaneSource,
      /className="min-h-0 flex-1 overflow-y-auto scrollbar-hide"/,
    );
    assert.match(
      conversationPaneSource,
      /<div className=\{CHAT_CHROME_COMPOSER_LAYER_CLASS\}>/,
    );
    assert.match(
      chromeSurfaceSource,
      /export const CHAT_CHROME_COMPOSER_LAYER_CLASS =\s*'flex-shrink-0 bg-transparent px-3 pb-3 pt-1\.5 sm:px-4 sm:pb-4 sm:pt-2 lg:px-6'/,
    );
  },
);

await runTest(
  'Chat page keeps the message rail on a tighter desktop rhythm with floating controls and no chat-local top header band',
  () => {
    assert.match(
      conversationPaneSource,
      /className="flex-1 space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-5"/,
    );
    assert.doesNotMatch(pageSource, /<header className="z-10 flex min-h-\[3\.75rem\]/);
    assert.match(conversationPaneSource, /className="relative flex h-full min-w-0 flex-1 flex-col"/);
    assert.doesNotMatch(pageSource, /className="relative flex h-full min-w-0 flex-1 flex-col pt-11 sm:pt-12"/);
    assert.doesNotMatch(
      pageSource,
      /className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6"/,
    );
  },
);

await runTest(
  'Chat page routes session controls through a right-side context drawer',
  () => {
    assert.match(
      pageSource,
      /import \{ ChatSessionContextDrawer \} from '\.\.\/components\/ChatSessionContextDrawer';/,
    );
    assert.match(
      pageSource,
      /import \{ useChatPageCompositionState \} from '\.\/useChatPageCompositionState';/,
    );
    assert.match(
      pageSource,
      /<ChatSessionContextDrawer \{\.\.\.sessionContextDrawerProps\} \/>/,
    );
    assert.match(drawerSource, /export function ChatSessionContextDrawer/);
    assert.match(drawerSource, /<OverlaySurface[\s\S]*variant="drawer"/);
    assert.match(drawerSource, /agentOptions:/);
    assert.match(drawerSource, /skillOptions:/);
  },
);

await runTest(
  'ChatInput removes the footer disclaimer so the composer ends with the input surface',
  () => {
    const chatInputSource = readFileSync(new URL('./ChatInput.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(chatInputSource, /chat\.input\.disclaimer/);
    assert.doesNotMatch(chatInputSource, /AI models can make mistakes/);
  },
);

await runTest(
  'Chat page renders footer metadata as subdued inline text instead of badge-heavy chrome',
  () => {
    assert.match(
      conversationPaneSource,
      /flex min-w-0 max-w-full flex-wrap items-center gap-x-1\.5 gap-y-0\.5/,
    );
    assert.match(
      conversationPaneSource,
      /<span className="truncate font-medium text-zinc-500 dark:text-zinc-400">/,
    );
    assert.match(
      conversationPaneSource,
      /<span className="shrink-0 text-zinc-300 dark:text-zinc-600">\/<\/span>/,
    );
    assert.match(
      conversationPaneSource,
      /<span className="truncate text-zinc-400 dark:text-zinc-500">\s*\{group\.footer\.modelLabel\}\s*<\/span>/,
    );
    assert.doesNotMatch(
      pageSource,
      /rounded-full border border-zinc-200 bg-white\/80 px-2 py-0\.5 text-\[10px\] font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900\/70 dark:text-zinc-300/,
    );
  },
);
