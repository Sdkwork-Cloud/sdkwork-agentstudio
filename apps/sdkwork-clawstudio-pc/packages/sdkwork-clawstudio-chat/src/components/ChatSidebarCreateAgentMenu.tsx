import React from 'react';
import { createPortal } from 'react-dom';
import { CopyPlus, Library, PencilLine, ShoppingBag } from 'lucide-react';
import { cn } from '@sdkwork/clawstudio-ui';
import {
  resolveFloatingMenuPosition,
  type FloatingAnchorRect,
} from './floatingMenuPosition.ts';

export type ChatSidebarCreateAgentMenuActionId = 'custom' | 'library' | 'market' | 'copy';

export interface ChatSidebarCreateAgentMenuAction {
  id: ChatSidebarCreateAgentMenuActionId;
  label: string;
  description: string;
  disabled?: boolean;
}

export interface ChatSidebarCreateAgentMenuProps {
  open: boolean;
  actions: ChatSidebarCreateAgentMenuAction[];
  anchorRect?: FloatingAnchorRect | null;
  closeLabel: string;
  restoreFocusElement?: HTMLElement | null;
  onClose: () => void;
  onSelectAction: (actionId: ChatSidebarCreateAgentMenuActionId) => void;
}

function resolveCreateActionIcon(action: ChatSidebarCreateAgentMenuAction) {
  if (action.id === 'custom') {
    return PencilLine;
  }

  if (action.id === 'library') {
    return Library;
  }

  if (action.id === 'market') {
    return ShoppingBag;
  }

  if (action.id === 'copy') {
    return CopyPlus;
  }

  return PencilLine;
}

export function ChatSidebarCreateAgentMenu({
  open,
  actions,
  anchorRect = null,
  closeLabel,
  restoreFocusElement = null,
  onClose,
  onSelectAction,
}: ChatSidebarCreateAgentMenuProps) {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const wasOpenRef = React.useRef(false);
  const lastRestoreFocusElementRef = React.useRef<HTMLElement | null>(null);
  const shouldRestoreFocusOnCloseRef = React.useRef(true);
  const [style, setStyle] = React.useState<React.CSSProperties | null>(null);
  const commitActionSelection = React.useCallback(
    (actionId: ChatSidebarCreateAgentMenuActionId) => {
      shouldRestoreFocusOnCloseRef.current = false;
      onClose();
      onSelectAction(actionId);
    },
    [onClose, onSelectAction],
  );
  const resolveEnabledMenuItems = React.useCallback(() => {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
  }, []);

  const focusMenuItemAtIndex = React.useCallback(
    (index: number) => {
      const items = resolveEnabledMenuItems();
      if (items.length === 0) {
        return;
      }

      const normalizedIndex = ((index % items.length) + items.length) % items.length;
      items[normalizedIndex]?.focus();
    },
    [resolveEnabledMenuItems],
  );

  const focusMenuItemByOffset = React.useCallback(
    (offset: number) => {
      const items = resolveEnabledMenuItems();
      if (items.length === 0) {
        return;
      }

      const activeIndex = items.findIndex((item) => item === document.activeElement);
      const nextIndex = activeIndex === -1 ? 0 : activeIndex + offset;
      focusMenuItemAtIndex(nextIndex);
    },
    [focusMenuItemAtIndex, resolveEnabledMenuItems],
  );

  React.useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      shouldRestoreFocusOnCloseRef.current = true;
      if (restoreFocusElement?.isConnected) {
        lastRestoreFocusElementRef.current = restoreFocusElement;
      }
      return;
    }

    if (!wasOpenRef.current) {
      return;
    }

    wasOpenRef.current = false;
    if (shouldRestoreFocusOnCloseRef.current) {
      try {
        lastRestoreFocusElementRef.current?.focus({ preventScroll: true });
      } catch {
        lastRestoreFocusElementRef.current?.focus();
      }
    }
    shouldRestoreFocusOnCloseRef.current = true;
    lastRestoreFocusElementRef.current = null;
  }, [open, restoreFocusElement]);

  React.useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    const menu = menuRef.current;
    if (!menu || !anchorRect || typeof window === 'undefined') {
      return;
    }

    const viewportPadding = 12;
    const width = menu.offsetWidth || 320;
    const height = menu.offsetHeight || 248;
    const nextPosition = resolveFloatingMenuPosition({
      anchorRect,
      menuWidth: width,
      menuHeight: height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      viewportPadding,
      horizontalStrategy: 'anchor-start',
      verticalStrategy: 'anchor-bottom',
      offsetX: 8,
      offsetY: 10,
    });

    setStyle({
      left: `${nextPosition.left}px`,
      top: `${nextPosition.top}px`,
    });
  }, [anchorRect, open, actions]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    focusMenuItemAtIndex(0);
  }, [actions, focusMenuItemAtIndex, open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label={closeLabel}
        className="fixed inset-0 z-[85] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        id="chat-sidebar-create-agent-menu"
        ref={menuRef}
        role="menu"
        aria-orientation="vertical"
        style={style ?? { visibility: 'hidden' }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusMenuItemByOffset(1);
            return;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusMenuItemByOffset(-1);
            return;
          }

          if (event.key === 'Home') {
            event.preventDefault();
            focusMenuItemAtIndex(0);
            return;
          }

          if (event.key === 'End') {
            event.preventDefault();
            focusMenuItemAtIndex(-1);
            return;
          }

          if (event.key === 'Tab') {
            onClose();
          }
        }}
        className="fixed z-[90] min-w-[18rem] overflow-hidden rounded-[0.95rem] bg-zinc-50/98 p-1.5 shadow-[0_18px_44px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:bg-zinc-900/98 dark:shadow-[0_18px_44px_rgba(0,0,0,0.34)]"
      >
        {actions.map((action) => {
          const Icon = resolveCreateActionIcon(action);

          return (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) {
                  return;
                }

                // Selecting a menu action should not restore focus to the
                // trigger when the parent is about to open the next surface.
                commitActionSelection(action.id);
              }}
              className={cn(
                'group flex w-full items-start gap-3 rounded-[0.78rem] px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                action.disabled
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:bg-zinc-900/[0.045] dark:hover:bg-white/[0.055]',
              )}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.72rem] text-zinc-500 transition-colors group-hover:text-zinc-900 dark:text-zinc-300 dark:group-hover:text-zinc-100">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {action.label}
                </span>
                <span className="mt-1 block text-[12px] leading-5 text-zinc-500 dark:text-zinc-400">
                  {action.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}
