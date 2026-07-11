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

const sidebarSource = readFileSync(new URL('./ChatSidebar.tsx', import.meta.url), 'utf8');
const agentItemUrl = new URL('./ChatSidebarAgentItem.tsx', import.meta.url);
const sessionItemUrl = new URL('./ChatSidebarSessionItem.tsx', import.meta.url);
const agentItemSource = existsSync(agentItemUrl) ? readFileSync(agentItemUrl, 'utf8') : '';
const sessionItemSource = existsSync(sessionItemUrl) ? readFileSync(sessionItemUrl, 'utf8') : '';
const primitivesSource = readFileSync(
  new URL('./chatSidebarItemPrimitives.ts', import.meta.url),
  'utf8',
);
const menuSource = readFileSync(
  new URL('./ChatSidebarSessionActionMenu.tsx', import.meta.url),
  'utf8',
);

await runTest(
  'ChatSidebar replaces the inline delete icon with a shared more-actions surface and opens it from both click and right-click entry points',
  () => {
    assert.match(sessionItemSource, /MoreHorizontal/);
    assert.match(sessionItemSource, /onContextMenu=\{\(event\) => \{/);
    assert.match(sidebarSource, /resolveChatSidebarSessionActionsPresentation\(/);
    assert.match(sidebarSource, /<ChatSidebarSessionActionMenu/);
    assert.doesNotMatch(sidebarSource, /Trash2/);
    assert.doesNotMatch(sessionItemSource, /Trash2/);
  },
);

await runTest(
  'ChatSidebar renders each session item with avatar on the left, conversation title as the primary row text, and a right-edge more-actions trigger',
  () => {
    assert.match(primitivesSource, /export const CHAT_SIDEBAR_TITLE_TEXT_CLASS =/);
    assert.equal(existsSync(sessionItemUrl), true);
    assert.match(sidebarSource, /import \{ ChatSidebarSessionItem \} from '\.\/ChatSidebarSessionItem';/);
    assert.match(
      primitivesSource,
      /'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-\[0\.56rem\] text-\[11px\] font-semibold uppercase transition-colors'/,
    );
    assert.match(sessionItemSource, /CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS/);
    assert.match(sessionItemSource, /CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS/);
    assert.match(
      sidebarSource,
      /const sessionTitleText = resolveChatSidebarSessionTitleText\(\{\s*itemDisplayTitle: item\.displayTitle,\s*session: sessionRecord,\s*\}\);/,
    );
    assert.doesNotMatch(sessionItemSource, /const previewText = item\.preview \?\? item\.displayTitle;/);
    assert.match(sessionItemSource, /<span className=\{SESSION_OWNER_SLOT_CLASS\} title=\{item\.ownerName\}>/);
    assert.match(sessionItemSource, /<span className="truncate">\{item\.ownerName\}<\/span>/);
    assert.doesNotMatch(sessionItemSource, /item\.ownerKernelLabel \?\s*\(/);
    assert.doesNotMatch(sessionItemSource, /\{item\.relativeTimeLabel\}/);
    assert.match(
      sessionItemSource,
      /<p[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_TITLE_TEXT_CLASS,[\s\S]*\)\}[\s\S]*title=\{sessionTitleText\}[\s\S]*>\s*\{sessionTitleText\}\s*<\/p>/,
    );
    assert.match(
      sessionItemSource,
      /className=\{cn\(\s*'absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-zinc-900\/\[0\.06\] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white\/\[0\.08\] dark:hover:text-zinc-200',[\s\S]*\)\}/,
    );
    assert.match(
      sessionItemSource,
      /group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100/,
    );
    assert.match(sessionItemSource, /event\.key === 'ContextMenu'/);
    assert.match(sessionItemSource, /event\.shiftKey && event\.key === 'F10'/);
    assert.match(sidebarSource, /closeCreateAgentMenu\(\);\s*setSessionMenuState\(\{/);
    assert.match(
      sessionItemSource,
      /onOpenMenuAtElement\(event\.currentTarget, item\)/,
    );
    assert.match(
      sessionItemSource,
      /if \(isSessionMenuOpen\) \{\s*onCloseMenu\(\);\s*return;\s*\}[\s\S]*onOpenMenuAtElement\(event\.currentTarget, item\);/,
    );
    assert.match(sessionItemSource, /aria-haspopup="menu"/);
    assert.match(sessionItemSource, /aria-expanded=\{isSessionMenuOpen\}/);
  },
);

await runTest(
  'ChatSidebar keeps the conversation title visible when indicators are present or displayTitle is empty',
  () => {
    assert.match(sidebarSource, /resolveChatSidebarSessionTitleText/);
    assert.doesNotMatch(sidebarSource, /function resolveSidebarSessionTitleText\(/);
    assert.match(
      sidebarSource,
      /const sessionRecord = resolveSessionRecord\(item\.sessionId\);/,
    );
    assert.match(
      sidebarSource,
      /const sessionTitleText = resolveChatSidebarSessionTitleText\(\{\s*itemDisplayTitle: item\.displayTitle,\s*session: sessionRecord,\s*\}\);/,
    );
    assert.match(
      sessionItemSource,
      /const hasSessionHeader =\s*Boolean\(sessionOwnerName\) \|\|\s*item\.pinOrigin !== 'none' \|\|\s*item\.isFavorited \|\|\s*item\.hasUnread;/,
    );
    assert.match(
      primitivesSource,
      /'block w-full min-w-0 truncate text-\[13px\] font-medium leading-5 transition-colors'/,
    );
    assert.doesNotMatch(
      primitivesSource,
      /CHAT_SIDEBAR_TITLE_TEXT_CLASS =\s*\n\s*'min-w-0 flex-1 truncate/,
    );
    assert.match(
      sessionItemSource,
      /\{hasSessionHeader \? \([\s\S]*<div className="mb-1 flex min-h-5 min-w-0 items-center gap-1\.5">[\s\S]*sessionOwnerName \? \([\s\S]*<span className=\{SESSION_OWNER_SLOT_CLASS\} title=\{item\.ownerName\}>[\s\S]*\{item\.ownerName\}[\s\S]*<\/span>[\s\S]*item\.pinOrigin === 'system'[\s\S]*item\.pinOrigin === 'user'[\s\S]*item\.isFavorited[\s\S]*item\.hasUnread[\s\S]*<\/div>\s*\) : null\}\s*<p[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_TITLE_TEXT_CLASS,[\s\S]*\)\}[\s\S]*title=\{sessionTitleText\}[\s\S]*>\s*\{sessionTitleText\}\s*<\/p>/,
    );
    assert.doesNotMatch(sidebarSource, /<p[\s\S]*<\/p>\s*\{hasSessionIndicators \? \(/);
  },
);

await runTest(
  'ChatSidebarSessionActionMenu renders accessible grouped menu actions with keyboard menu navigation and the destructive delete action isolated at the bottom',
  () => {
    assert.match(menuSource, /role="menu"/);
    assert.match(menuSource, /aria-orientation="vertical"/);
    assert.match(menuSource, /role="menuitem"/);
    assert.match(menuSource, /resolveFloatingMenuPosition/);
    assert.match(menuSource, /horizontalStrategy: anchorPoint \? 'point' : 'anchor-end-plus-offset'/);
    assert.match(menuSource, /verticalStrategy: anchorPoint \? 'point' : 'anchor-center'/);
    assert.match(menuSource, /offsetX: anchorPoint \? 0 : 8/);
    assert.match(menuSource, /event\.key === 'ArrowDown'/);
    assert.match(menuSource, /event\.key === 'ArrowUp'/);
    assert.match(menuSource, /event\.key === 'Home'/);
    assert.match(menuSource, /event\.key === 'End'/);
    assert.match(menuSource, /section\.id === 'danger'/);
    assert.match(menuSource, /item\.tone === 'danger'/);
  },
);

await runTest(
  'ChatSidebarSessionActionMenu localizes its dismiss affordance and restores focus to the invoking trigger when the menu closes',
  () => {
    assert.match(sidebarSource, /dismissSessionActionsMenu/);
    assert.match(sidebarSource, /closeLabel=\{t\('chat\.sidebar\.dismissSessionActionsMenu'\)\}/);
    assert.match(sidebarSource, /restoreFocusElement:/);
    assert.match(sidebarSource, /restoreFocusElement=\{sessionMenuState\?\.restoreFocusElement \?\? null\}/);
    assert.match(menuSource, /closeLabel: string;/);
    assert.match(menuSource, /restoreFocusElement\?: HTMLElement \| null;/);
    assert.match(menuSource, /aria-label=\{closeLabel\}/);
    assert.match(menuSource, /lastRestoreFocusElementRef/);
    assert.match(menuSource, /lastRestoreFocusElementRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  },
);

await runTest(
  'ChatSidebar keeps the agent rail compact and omits kernel abbreviation badges',
  () => {
    assert.equal(existsSync(agentItemUrl), true);
    assert.match(sidebarSource, /import \{ ChatSidebarAgentItem \} from '\.\/ChatSidebarAgentItem';/);
    assert.doesNotMatch(agentItemSource, /resolveKernelBadgeLabel/);
    assert.doesNotMatch(agentItemSource, /CHAT_SIDEBAR_KERNEL_BADGE_CLASS/);
    assert.match(primitivesSource, /export function resolveKernelBadgeLabel\(/);
    assert.match(
      primitivesSource,
      /'relative flex h-10 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left transition-all disabled:cursor-wait'/,
    );
    assert.match(
      primitivesSource,
      /'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-\[0\.65rem\] text-\[9px\] font-semibold uppercase transition-colors'/,
    );
    assert.match(agentItemSource, /<div className="flex min-w-0 flex-1 items-center gap-1 pr-7">/);
    assert.doesNotMatch(agentItemSource, /agent\.kernelLabel \?\s*\(/);
  },
);
