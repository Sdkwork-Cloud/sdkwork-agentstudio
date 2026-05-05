import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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
const agentItemUrl = new URL('./ChatSidebarAgentItem.tsx', import.meta.url);
const sessionItemUrl = new URL('./ChatSidebarSessionItem.tsx', import.meta.url);
const agentItemSource = existsSync(agentItemUrl) ? readFileSync(agentItemUrl, 'utf8') : '';
const sessionItemSource = existsSync(sessionItemUrl) ? readFileSync(sessionItemUrl, 'utf8') : '';
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
    assert.match(agentItemSource, /from '\.\/chatSidebarItemPrimitives';/);
    assert.match(sessionItemSource, /from '\.\/chatSidebarItemPrimitives';/);
    assert.match(agentItemSource, /CHAT_SIDEBAR_AGENT_ROW_BUTTON_CLASS/);
    assert.match(sessionItemSource, /CHAT_SIDEBAR_ROW_BUTTON_CLASS/);
    assert.match(agentItemSource, /CHAT_SIDEBAR_AGENT_AVATAR_SHELL_CLASS/);
    assert.match(sessionItemSource, /CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS/);
    assert.match(sessionItemSource, /CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS/);
    assert.match(agentItemSource, /CHAT_SIDEBAR_AGENT_NAME_CLASS/);
    assert.match(agentItemSource, /CHAT_SIDEBAR_PRIMARY_BADGE_CLASS/);
    assert.match(sessionItemSource, /CHAT_SIDEBAR_PRIMARY_BADGE_CLASS/);
    assert.match(sessionItemSource, /SESSION_OWNER_SLOT_CLASS/);
    assert.match(agentItemSource, /CHAT_SIDEBAR_KERNEL_BADGE_CLASS/);
    assert.match(agentItemSource, /resolveKernelBadgeLabel/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_ROW_BUTTON_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_AGENT_ROW_BUTTON_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_AGENT_AVATAR_SHELL_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_AGENT_NAME_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_PRIMARY_BADGE_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_TITLE_TEXT_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_PREVIEW_TEXT_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_TIME_LABEL_CLASS =/);
    assert.match(primitivesSource, /export const SESSION_OWNER_SLOT_CLASS =/);
    assert.match(primitivesSource, /export const SESSION_KERNEL_SLOT_CLASS =/);
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_KERNEL_BADGE_CLASS =/);
    assert.match(primitivesSource, /export function resolveKernelBadgeLabel\(/);
    assert.match(
      source,
      /sidebarChrome\.showAgentRail[\s\S]*visibleAgentRailItems\.map\(\(agent\) => \{/s,
    );
    assert.match(
      source,
      /sidebarChrome\.sections\.map\(\(\{ section, titleKey \}\) => \{[\s\S]*section\.items\.map\(\(item, itemIndex\) => \{[\s\S]*<ChatSidebarSessionItem/s,
    );
    assert.doesNotMatch(source, /const SESSION_OWNER_SLOT_CLASS =/);
    assert.doesNotMatch(source, /const SESSION_KERNEL_SLOT_CLASS =/);
    assert.doesNotMatch(source, /function resolveKernelBadgeLabel\(/);
    assert.match(agentItemSource, /className="group relative"/);
    assert.match(sessionItemSource, /className="group relative"/);
    assert.match(
      agentItemSource,
      /className=\{cn\(\s*CHAT_SIDEBAR_AGENT_ROW_BUTTON_CLASS,/,
    );
    assert.match(
      sessionItemSource,
      /className=\{cn\(\s*CHAT_SIDEBAR_ROW_BUTTON_CLASS,/,
    );
    assert.match(
      agentItemSource,
      /className=\{cn\(\s*CHAT_SIDEBAR_AGENT_AVATAR_SHELL_CLASS,/,
    );
    assert.match(
      sessionItemSource,
      /className=\{cn\(\s*CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS,/,
    );
    assert.match(
      sessionItemSource,
      /className=\{cn\(\s*CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS,/,
    );
    assert.equal(existsSync(agentItemUrl), true);
    assert.equal(existsSync(sessionItemUrl), true);
    assert.match(source, /import \{ ChatSidebarAgentItem \} from '\.\/ChatSidebarAgentItem';/);
    assert.match(source, /import \{ ChatSidebarSessionItem \} from '\.\/ChatSidebarSessionItem';/);
    assert.doesNotMatch(source, /const renderAgentRailItem =/);
    assert.doesNotMatch(source, /const renderSessionGroup =/);
    assert.match(sessionItemSource, /<div className="min-w-0 flex-1 overflow-hidden pr-8">/);
    assert.match(sessionItemSource, /<div className="mb-1 flex min-h-5 min-w-0 items-center gap-1\.5">/);
    assert.match(sessionItemSource, /<span className=\{SESSION_OWNER_SLOT_CLASS\} title=\{item\.ownerName\}>/);
    assert.match(sessionItemSource, /<span className="truncate">\{item\.ownerName\}<\/span>/);
    assert.doesNotMatch(sessionItemSource, /item\.ownerKernelLabel \?\s*\(/);
    assert.match(sessionItemSource, /item\.pinOrigin === 'system' \?\s*\(/);
    assert.match(sessionItemSource, /item\.pinOrigin === 'user' \?\s*\(/);
    assert.match(sessionItemSource, /item\.isFavorited \?\s*\(/);
    assert.match(sessionItemSource, /item\.hasUnread \?\s*\(/);
    assert.match(sessionItemSource, /item\.showStatusDot \?\s*\(/);
    assert.doesNotMatch(sessionItemSource, /\{item\.relativeTimeLabel\}/);
    assert.match(
      sessionItemSource,
      /<button[\s\S]*type="button"[\s\S]*onKeyDown=\{\(event\) => \{[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_ROW_BUTTON_CLASS,[\s\S]*\)\}/,
    );
    assert.match(sessionItemSource, /event\.key === 'Enter'/);
    assert.match(sessionItemSource, /event\.key === ' '/);
    assert.match(sessionItemSource, /event\.key === 'ContextMenu'/);
    assert.match(sessionItemSource, /event\.shiftKey && event\.key === 'F10'/);
    assert.match(
      sessionItemSource,
      /onOpenMenuAtElement\(event\.currentTarget, item\)/,
    );
    assert.match(
      sessionItemSource,
      /className=\{cn\(\s*'absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-zinc-900\/\[0\.06\] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white\/\[0\.08\] dark:hover:text-zinc-200',[\s\S]*\)\}/,
    );
    assert.match(sessionItemSource, /aria-haspopup="menu"/);
    assert.match(sessionItemSource, /aria-expanded=\{isSessionMenuOpen\}/);
    assert.match(
      sessionItemSource,
      /group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100/,
    );
    assert.match(
      source,
      /const sessionRecord = resolveSessionRecord\(item\.sessionId\);[\s\S]*const sessionTitleText = resolveChatSidebarSessionTitleText\(\{\s*itemDisplayTitle: item\.displayTitle,\s*session: sessionRecord,\s*\}\);/,
    );
    assert.doesNotMatch(sessionItemSource, /const previewText = item\.preview \?\? item\.displayTitle;/);
    assert.match(
      sessionItemSource,
      /<p[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_TITLE_TEXT_CLASS,[\s\S]*\)\}[\s\S]*title=\{sessionTitleText\}[\s\S]*>\s*\{sessionTitleText\}\s*<\/p>/,
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
      /sidebarChrome\.showAgentRail[\s\S]*visibleAgentRailItems\.map\(\(agent\) => \{/s,
    );
    assert.match(source, /placeholder=\{t\('chat\.sidebar\.agentSearchPlaceholder'\)\}/);
    assert.match(
      source,
      /className="max-h-\[22\.875rem\] overflow-y-auto pr-1"/,
    );
    assert.match(
      primitivesSource,
      /'flex w-full min-w-0 items-center gap-3 rounded-\[0\.75rem\] px-3 py-3 text-left transition-colors disabled:cursor-wait'/,
    );
    assert.doesNotMatch(source, /agentRailEmptyPreviewLabel/);
    assert.doesNotMatch(source, /const agentPreviewText =/);
    assert.doesNotMatch(agentItemSource, /agent\.preview/);
    assert.doesNotMatch(agentItemSource, /agent\.relativeTimeLabel/);
    assert.doesNotMatch(agentItemSource, /displayTitle/);
    assert.doesNotMatch(agentItemSource, /sessionTitleText/);
    assert.doesNotMatch(agentItemSource, /updatedAt/);
    assert.doesNotMatch(agentItemSource, /CHAT_SIDEBAR_PREVIEW_TEXT_CLASS/);
    assert.doesNotMatch(agentItemSource, /SESSION_OWNER_SLOT_CLASS/);
    assert.doesNotMatch(agentItemSource, /CHAT_SIDEBAR_ROW_BUTTON_CLASS/);
    assert.doesNotMatch(agentItemSource, /absolute bottom-2 left-0 top-2 w-0\.5/);
    assert.doesNotMatch(agentItemSource, /bg-primary-500\/80 opacity-100/);
    assert.match(primitivesSource, /'relative flex h-12 w-full min-w-0 items-center gap-2\.5 rounded-lg px-2\.5 text-left transition-all disabled:cursor-wait'/);
    assert.match(primitivesSource, /'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-\[10px\] font-semibold uppercase transition-colors'/);
    assert.match(agentItemSource, /className=\{cn\(\s*CHAT_SIDEBAR_AGENT_NAME_CLASS,/);
    assert.match(
      agentItemSource,
      /\{isAgentPending \? \(\s*<Loader2 className="ml-auto h-3\.5 w-3\.5 shrink-0 animate-spin text-zinc-500 dark:text-zinc-300" \/>\s*\) : null\}/,
    );
    assert.doesNotMatch(
      agentItemSource,
      /\{isAgentPending \? \(\s*<Loader2 className="h-3\.5 w-3\.5 animate-spin" \/>\s*\) : \(\s*<MoreHorizontal/,
    );
    assert.match(agentItemSource, /title=\{agent\.name\}/);
    assert.match(
      agentItemSource,
      /\{agent\.name\}/,
    );
    assert.match(source, /closeSessionMenu\(\);\s*setCreateAgentMenuState\(\{/);
    assert.match(
      agentItemSource,
      /agent\.kernelLabel \?\s*\(\s*<span className=\{CHAT_SIDEBAR_KERNEL_BADGE_CLASS\} title=\{agent\.kernelLabel\}>[\s\S]*\{resolveKernelBadgeLabel\(agent\.kernelLabel\)\}[\s\S]*<\/span>\s*\) : null/,
    );
    assert.doesNotMatch(
      agentItemSource,
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

await runTest(
  'ChatSidebar memoizes expensive view-state projection so selection loading chrome does not rebuild sidebar history',
  () => {
    assert.match(
      source,
      /const sidebarViewState = React\.useMemo\(\s*\(\) =>\s*resolveChatSidebarViewState\(\{/s,
    );
    assert.match(
      source,
      /const\s*\{\s*currentAgentName,\s*agentRail,\s*activeSidebarHistory,\s*activeHistorySessions,\s*sidebarChrome,\s*historyTabState,\s*\}\s*=\s*sidebarViewState;/s,
    );
    assert.match(
      source,
      /previewLabels = React\.useMemo\(/,
    );
    assert.match(
      source,
      /relativeTimeLabels = React\.useMemo\(/,
    );
    assert.doesNotMatch(
      source,
      /const\s*\{\s*currentAgentName,[\s\S]*\}\s*=\s*resolveChatSidebarViewState\(\{/s,
    );
  },
);
