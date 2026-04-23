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

const sidebarSource = readFileSync(new URL('./ChatSidebar.tsx', import.meta.url), 'utf8');
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
    assert.match(sidebarSource, /MoreHorizontal/);
    assert.match(sidebarSource, /onContextMenu=\{\(event\) => \{/);
    assert.match(sidebarSource, /resolveChatSidebarSessionActionsPresentation\(/);
    assert.match(sidebarSource, /<ChatSidebarSessionActionMenu/);
    assert.doesNotMatch(sidebarSource, /Trash2/);
  },
);

await runTest(
  'ChatSidebar renders each session item with avatar on the left, metadata in the top row, conversation info below, and a right-edge more-actions trigger',
  () => {
    assert.match(
      primitivesSource,
      /'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-\[0\.56rem\] text-\[11px\] font-semibold uppercase transition-colors'/,
    );
    assert.match(sidebarSource, /CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS/);
    assert.match(sidebarSource, /CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS/);
    assert.match(
      sidebarSource,
      /<div className="min-w-0 flex-1 overflow-hidden">[\s\S]*<div className="flex min-w-0 items-center gap-1\.5">[\s\S]*SESSION_OWNER_SLOT_CLASS[\s\S]*SESSION_KERNEL_SLOT_CLASS[\s\S]*<span[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_TIME_LABEL_CLASS,[\s\S]*'transition-opacity',[\s\S]*\)\}[\s\S]*>\s*\{item\.relativeTimeLabel\}\s*<\/span>/,
    );
    assert.match(
      sidebarSource,
      /<p[\s\S]*className=\{cn\(\s*CHAT_SIDEBAR_PREVIEW_TEXT_CLASS,[\s\S]*\)\}[\s\S]*>\s*\{previewText\}\s*<\/p>/,
    );
    assert.match(
      sidebarSource,
      /className=\{cn\(\s*'absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-zinc-900\/\[0\.06\] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white\/\[0\.08\] dark:hover:text-zinc-200',[\s\S]*\)\}/,
    );
    assert.match(sidebarSource, /group-hover:opacity-0 group-focus-within:opacity-0/);
    assert.match(
      sidebarSource,
      /group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100/,
    );
    assert.match(sidebarSource, /event\.key === 'ContextMenu'/);
    assert.match(sidebarSource, /event\.shiftKey && event\.key === 'F10'/);
    assert.match(sidebarSource, /closeCreateAgentMenu\(\);\s*setSessionMenuState\(\{/);
    assert.match(
      sidebarSource,
      /openSessionMenuAtElement\(event\.currentTarget, item, event\.currentTarget\)/,
    );
    assert.match(
      sidebarSource,
      /if \(isSessionMenuOpen\) \{\s*closeSessionMenu\(\);\s*return;\s*\}[\s\S]*openSessionMenuAtElement\(event\.currentTarget, item, event\.currentTarget\);/,
    );
    assert.match(sidebarSource, /aria-haspopup="menu"/);
    assert.match(sidebarSource, /aria-expanded=\{isSessionMenuOpen\}/);
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
  'ChatSidebar compresses long kernel names into a compact badge while preserving the full label as hover metadata',
  () => {
    assert.match(sidebarSource, /resolveKernelBadgeLabel/);
    assert.match(primitivesSource, /export function resolveKernelBadgeLabel\(/);
    assert.match(
      sidebarSource,
      /item\.ownerKernelLabel \?\s*\(\s*<span className=\{SESSION_KERNEL_SLOT_CLASS\} title=\{item\.ownerKernelLabel\}>[\s\S]*\{resolveKernelBadgeLabel\(item\.ownerKernelLabel\)\}[\s\S]*<\/span>\s*\) : null/,
    );
  },
);
