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

const source = readFileSync(new URL('./ChatSidebar.tsx', import.meta.url), 'utf8');
const primitivesSource = readFileSync(
  new URL('./chatSidebarItemPrimitives.ts', import.meta.url),
  'utf8',
);
const createMenuSource = readFileSync(
  new URL('./ChatSidebarCreateAgentMenu.tsx', import.meta.url),
  'utf8',
);

await runTest(
  'ChatSidebar composes unified session rows from shared view-state and keeps hover actions overlayed without consuming layout space',
  () => {
    assert.match(source, /resolveChatSidebarViewState\(\{/);
    assert.match(source, /sessionPreferencesBySessionKey,/);
    assert.match(source, /locale: i18n\.resolvedLanguage,/);
    assert.match(source, /timeZone,/);
    assert.match(source, /from '\.\/chatSidebarItemPrimitives';/);
    assert.match(source, /CHAT_SIDEBAR_ROW_BUTTON_CLASS/);
    assert.match(source, /CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS/);
    assert.match(source, /CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS/);
    assert.match(source, /CHAT_SIDEBAR_PRIMARY_BADGE_CLASS/);
    assert.match(source, /SESSION_OWNER_SLOT_CLASS/);
    assert.match(source, /SESSION_KERNEL_SLOT_CLASS/);
    assert.match(source, /resolveKernelBadgeLabel/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_ROW_BUTTON_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_PRIMARY_BADGE_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_PREVIEW_TEXT_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_TIME_LABEL_CLASS =/);
    assert.match(primitivesSource, /export const SESSION_OWNER_SLOT_CLASS =/);
    assert.match(primitivesSource, /export const SESSION_KERNEL_SLOT_CLASS =/);
    assert.match(primitivesSource, /export function resolveKernelBadgeLabel\(/);
    assert.match(
      source,
      /sidebarChrome\.showAgentRail[\s\S]*visibleAgentRailItems\.map\(renderAgentRailItem\)/s,
    );
    assert.match(
      source,
      /sidebarChrome\.sections\.map\(\(\{ section, titleKey \}\) => \([\s\S]*renderSessionGroup\(section, t\(titleKey\)\)[\s\S]*<\/React\.Fragment>[\s\S]*\)\)/s,
    );
    assert.doesNotMatch(source, /const SESSION_OWNER_SLOT_CLASS =/);
    assert.doesNotMatch(source, /const SESSION_KERNEL_SLOT_CLASS =/);
    assert.doesNotMatch(source, /function resolveKernelBadgeLabel\(/);
    assert.match(source, /className="group relative"/);
    assert.match(
      source,
      /className=\{cn\(\s*CHAT_SIDEBAR_ROW_BUTTON_CLASS,/,
    );
    assert.match(
      source,
      /className=\{cn\(\s*CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS,/,
    );
    assert.match(
      source,
      /className=\{cn\(\s*CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS,/,
    );
    assert.match(source, /<div className="min-w-0 flex-1 overflow-hidden">/);
    assert.match(source, /<div className="flex min-w-0 items-center gap-1\.5">/);
    assert.match(source, /className=\{SESSION_OWNER_SLOT_CLASS\}/);
    assert.match(
      source,
      /item\.ownerKernelLabel \?\s*\(\s*<span className=\{SESSION_KERNEL_SLOT_CLASS\} title=\{item\.ownerKernelLabel\}>[\s\S]*\{resolveKernelBadgeLabel\(item\.ownerKernelLabel\)\}[\s\S]*<\/span>\s*\) : null/,
    );
    assert.match(source, /item\.pinOrigin === 'system' \?\s*\(/);
    assert.match(source, /item\.pinOrigin === 'user' \?\s*\(/);
    assert.match(source, /item\.isFavorited \?\s*\(/);
    assert.match(source, /item\.hasUnread \?\s*\(/);
    assert.match(source, /item\.showStatusDot \?\s*\(/);
    assert.match(
      source,
      /<span[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_TIME_LABEL_CLASS,[\s\S]*'transition-opacity',[\s\S]*\)\}[\s\S]*>\s*\{item\.relativeTimeLabel\}\s*<\/span>/,
    );
    assert.match(source, /group-hover:opacity-0 group-focus-within:opacity-0/);
    assert.match(
      source,
      /<button[\s\S]*type="button"[\s\S]*onKeyDown=\{\(event\) => \{[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_ROW_BUTTON_CLASS,[\s\S]*\)\}/,
    );
    assert.match(source, /event\.key === 'Enter'/);
    assert.match(source, /event\.key === ' '/);
    assert.match(source, /event\.key === 'ContextMenu'/);
    assert.match(source, /event\.shiftKey && event\.key === 'F10'/);
    assert.match(
      source,
      /openSessionMenuAtElement\(event\.currentTarget, item, event\.currentTarget\)/,
    );
    assert.match(
      source,
      /className=\{cn\(\s*'absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-zinc-900\/\[0\.06\] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white\/\[0\.08\] dark:hover:text-zinc-200',[\s\S]*\)\}/,
    );
    assert.match(source, /aria-haspopup="menu"/);
    assert.match(source, /aria-expanded=\{isSessionMenuOpen\}/);
    assert.match(
      source,
      /group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100/,
    );
    assert.match(
      source,
      /<p[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_PREVIEW_TEXT_CLASS,[\s\S]*\)\}[\s\S]*>\s*\{previewText\}\s*<\/p>/,
    );
    assert.match(source, /const historyTabs = \[/);
    assert.match(source, /id: 'currentAgent'/);
    assert.match(source, /id: 'allSessions'/);
    assert.match(source, /const \[agentSearchQuery, setAgentSearchQuery\] = React\.useState\(''\);/);
    assert.match(source, /const sidebarScrollContainerRef = React\.useRef<HTMLDivElement \| null>\(null\);/);
    assert.match(source, /const dismissFloatingMenusForLayoutChange = React\.useEffectEvent\(\(\) => \{/);
    assert.match(source, /if \(!createAgentMenuState && !sessionMenuState\) \{/);
    assert.match(source, /window\.addEventListener\('resize', handleLayoutChange\);/);
    assert.match(source, /scrollContainer\?\.addEventListener\('scroll', handleLayoutChange, \{ passive: true \}\);/);
    assert.match(source, /window\.removeEventListener\('resize', handleLayoutChange\);/);
    assert.match(source, /scrollContainer\?\.removeEventListener\('scroll', handleLayoutChange\);/);
    assert.match(source, /const visibleAgentRailItems = React\.useMemo\(\(\) => \{/);
    assert.match(
      source,
      /sidebarChrome\.showAgentRail[\s\S]*visibleAgentRailItems\.map\(renderAgentRailItem\)/s,
    );
    assert.match(source, /placeholder=\{t\('chat\.sidebar\.agentSearchPlaceholder'\)\}/);
    assert.match(
      source,
      /className="max-h-\[22\.875rem\] overflow-y-auto pr-1"/,
    );
    assert.match(
      primitivesSource,
      /'flex w-full items-stretch gap-3 rounded-\[0\.75rem\] px-3 py-3 text-left transition-colors disabled:cursor-wait'/,
    );
    assert.match(
      source,
      /const agentPreviewText = agent\.preview \?\? t\('chat\.sidebar\.agentRailEmptyPreview'\);/,
    );
    assert.match(source, /agent\.relativeTimeLabel \?\s*\(/);
    assert.match(source, /<span className=\{SESSION_OWNER_SLOT_CLASS\} title=\{agent\.name\}>/);
    assert.match(
      source,
      /<p[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_PREVIEW_TEXT_CLASS,[\s\S]*\)\}[\s\S]*>\s*\{agentPreviewText\}\s*<\/p>/,
    );
    assert.match(source, /closeSessionMenu\(\);\s*setCreateAgentMenuState\(\{/);
    assert.match(
      source,
      /agent\.kernelLabel \?\s*\(\s*<span className=\{SESSION_KERNEL_SLOT_CLASS\} title=\{agent\.kernelLabel\}>[\s\S]*\{resolveKernelBadgeLabel\(agent\.kernelLabel\)\}[\s\S]*<\/span>\s*\) : null/,
    );
    assert.doesNotMatch(
      source,
      /agent\.kernelLabel \?\s*\(\s*<span className="mt-0\.5 block truncate text-\[10px\] font-medium uppercase tracking-\[0\.12em\] text-zinc-400 dark:text-zinc-500">\s*\{agent\.kernelLabel\}\s*<\/span>\s*\) : null/,
    );
    assert.match(source, /<ChatSidebarCreateAgentMenu/);
    assert.match(
      source,
      /onSelectAction=\{handleCreateAgentMenuAction\}/,
    );
    assert.doesNotMatch(source, /const SESSION_TIME_SLOT_CLASS =/);
    assert.doesNotMatch(source, /<div className=\{SESSION_TIME_SLOT_CLASS\}>/);
    assert.doesNotMatch(
      source,
      /className="absolute right-3 top-1\/2 flex h-7 w-7 -translate-y-1\/2 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-900\/\[0\.06\] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white\/\[0\.08\] dark:hover:text-zinc-200"/,
    );
  },
);

await runTest(
  'ChatSidebar promotes the top agent area into a searchable header with a create-agent dropdown and a six-row scroll standard',
  () => {
    assert.match(source, /import \{ cn, Input \} from '@sdkwork\/claw-ui';/);
    assert.match(source, /Search/);
    assert.match(source, /ChevronDown/);
    assert.match(
      source,
      /<div className="border-b border-zinc-200\/80 px-3 pb-3 pt-3 dark:border-zinc-800\/80">[\s\S]*agentSearchQuery[\s\S]*ChatSidebarCreateAgentMenu/s,
    );
    assert.match(
      source,
      /type="search"[\s\S]*value=\{agentSearchQuery\}[\s\S]*onChange=\{\(event\) => setAgentSearchQuery\(event\.target\.value\)\}/,
    );
    assert.match(source, /openCreateAgentMenuAtElement\(event\.currentTarget, event\.currentTarget\)/);
    assert.match(source, /if \(isCreateAgentMenuOpen\) \{\s*closeCreateAgentMenu\(\);\s*return;\s*\}/);
    assert.match(source, /title=\{t\('chat\.sidebar\.newAgentOptions'\)\}/);
    assert.match(source, /aria-label=\{t\('chat\.sidebar\.newAgentOptions'\)\}/);
    assert.match(source, /<span>\{t\('chat\.sidebar\.createButtonLabel'\)\}<\/span>/);
    assert.doesNotMatch(source, /hidden sm:inline/);
    assert.match(source, /visibleAgentRailItems\.length === 0 && agentSearchQuery\.trim\(\)/);
    assert.match(source, /<div ref=\{sidebarScrollContainerRef\} className="flex-1 overflow-y-auto py-4">/);
    assert.match(createMenuSource, /role="menu"/);
    assert.match(createMenuSource, /action\.id === 'custom'/);
    assert.match(createMenuSource, /action\.id === 'library'/);
    assert.match(createMenuSource, /action\.id === 'market'/);
    assert.match(createMenuSource, /action\.id === 'copy'/);
    assert.match(createMenuSource, /lastRestoreFocusElementRef/);
    assert.match(createMenuSource, /aria-label=\{closeLabel\}/);
    assert.match(createMenuSource, /resolveFloatingMenuPosition/);
    assert.match(createMenuSource, /horizontalStrategy: 'anchor-start'/);
    assert.match(createMenuSource, /verticalStrategy: 'anchor-bottom'/);
    assert.match(createMenuSource, /offsetY: 10/);
  },
);
