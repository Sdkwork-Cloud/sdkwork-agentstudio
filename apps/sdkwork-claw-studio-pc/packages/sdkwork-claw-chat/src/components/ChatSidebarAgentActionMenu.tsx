import React from 'react';
import { createPortal } from 'react-dom';
import { CircleMinus, Settings2, Store } from 'lucide-react';
import { cn } from '@sdkwork/claw-ui';
import type {
  ChatSidebarAgentActionId,
  ChatSidebarAgentActionsPresentation,
} from '../services';
import {
  resolveFloatingMenuPosition,
  type FloatingAnchorPoint,
  type FloatingAnchorRect,
} from './floatingMenuPosition.ts';

export interface ChatSidebarAgentActionMenuProps {
  open: boolean;
  sections: ChatSidebarAgentActionsPresentation['sections'];
  anchorRect?: FloatingAnchorRect | null;
  anchorPoint?: FloatingAnchorPoint | null;
  closeLabel: string;
  restoreFocusElement?: HTMLElement | null;
  onClose: () => void;
  onSelectAction: (actionId: ChatSidebarAgentActionId) => void;
}

function resolveActionIcon(actionId: ChatSidebarAgentActionId) {
  switch (actionId) {
    case 'publish':
      return Store;
    case 'settings':
      return Settings2;
    case 'remove':
      return CircleMinus;
    default:
      return Settings2;
  }
}

export function ChatSidebarAgentActionMenu({
  open,
  sections,
  anchorRect = null,
  anchorPoint = null,
  closeLabel,
  restoreFocusElement = null,
  onClose,
  onSelectAction,
}: ChatSidebarAgentActionMenuProps) {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const wasOpenRef = React.useRef(false);
  const lastRestoreFocusElementRef = React.useRef<HTMLElement | null>(null);
  const [style, setStyle] = React.useState<React.CSSProperties | null>(null);
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
      if (restoreFocusElement?.isConnected) {
        lastRestoreFocusElementRef.current = restoreFocusElement;
      }
      return;
    }

    if (!wasOpenRef.current) {
      return;
    }

    wasOpenRef.current = false;
    try {
      lastRestoreFocusElementRef.current?.focus({ preventScroll: true });
    } catch {
      lastRestoreFocusElementRef.current?.focus();
    }
    lastRestoreFocusElementRef.current = null;
  }, [open, restoreFocusElement]);

  React.useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }

    const menu = menuRef.current;
    if (!menu || typeof window === 'undefined') {
      return;
    }

    const viewportPadding = 12;
    const width = menu.offsetWidth || 224;
    const height = menu.offsetHeight || 160;
    const nextPosition = resolveFloatingMenuPosition({
      anchorRect,
      anchorPoint,
      menuWidth: width,
      menuHeight: height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      viewportPadding,
      horizontalStrategy: anchorPoint ? 'point' : 'anchor-end-plus-offset',
      verticalStrategy: anchorPoint ? 'point' : 'anchor-center',
      offsetX: anchorPoint ? 0 : 8,
    });

    setStyle({
      left: `${nextPosition.left}px`,
      top: `${nextPosition.top}px`,
    });
  }, [anchorPoint, anchorRect, open, sections]);

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
  }, [focusMenuItemAtIndex, open, sections]);

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
        id="chat-sidebar-agent-actions-menu"
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
        className="fixed z-[90] min-w-[12.5rem] overflow-hidden rounded-[0.9rem] bg-zinc-50/98 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.15)] backdrop-blur-xl dark:bg-zinc-900/98 dark:shadow-[0_16px_36px_rgba(0,0,0,0.32)]"
      >
        {sections.map((section, sectionIndex) => (
          <div
            key={section.id}
            className={cn(
              'py-1',
              (sectionIndex > 0 || section.id === 'danger') &&
                'border-t border-zinc-200/80 dark:border-zinc-800/80',
            )}
          >
            {section.items.map((item) => {
              const Icon = resolveActionIcon(item.id);

              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) {
                      return;
                    }

                    onSelectAction(item.id);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[0.72rem] px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                    item.tone === 'danger'
                      ? 'text-rose-600 hover:bg-rose-500/[0.08] dark:text-rose-300 dark:hover:bg-rose-500/14'
                      : 'text-zinc-700 hover:bg-zinc-900/[0.045] dark:text-zinc-200 dark:hover:bg-white/[0.055]',
                    item.disabled &&
                      'cursor-not-allowed opacity-50 hover:bg-transparent dark:hover:bg-transparent',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      item.tone === 'danger'
                        ? 'text-current'
                        : 'text-zinc-400 dark:text-zinc-500',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}
