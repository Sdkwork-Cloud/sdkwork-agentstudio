import React from 'react';
import { Bookmark, Loader2, MoreHorizontal, Pin } from 'lucide-react';
import { cn } from '@sdkwork/agentstudio-pc-ui';
import type { ChatSidebarHistorySectionPresentation } from '../services';
import {
  CHAT_SIDEBAR_PRIMARY_BADGE_CLASS,
  CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS,
  CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS,
  CHAT_SIDEBAR_ROW_BUTTON_CLASS,
  CHAT_SIDEBAR_TITLE_TEXT_CLASS,
  SESSION_OWNER_SLOT_CLASS,
} from './chatSidebarItemPrimitives';

type ChatSidebarSessionItemPresentation =
  ChatSidebarHistorySectionPresentation['items'][number];

export interface ChatSidebarSessionItemProps {
  item: ChatSidebarSessionItemPresentation;
  sessionTitleText: string;
  isSelectionPending: boolean;
  isSessionPending: boolean;
  isSessionMenuOpen: boolean;
  moreActionsLabel: string;
  mainAgentBadgeLabel: string;
  onSelectSession: (item: ChatSidebarSessionItemPresentation) => void;
  onOpenMenuAtPoint: (
    event: React.MouseEvent<HTMLElement>,
    item: ChatSidebarSessionItemPresentation,
  ) => void;
  onOpenMenuAtElement: (
    element: HTMLElement,
    item: ChatSidebarSessionItemPresentation,
  ) => void;
  onCloseMenu: () => void;
}

export function ChatSidebarSessionItem({
  item,
  sessionTitleText,
  isSelectionPending,
  isSessionPending,
  isSessionMenuOpen,
  moreActionsLabel,
  mainAgentBadgeLabel,
  onSelectSession,
  onOpenMenuAtPoint,
  onOpenMenuAtElement,
  onCloseMenu,
}: ChatSidebarSessionItemProps) {
  const sessionOwnerName = item.ownerName.trim();
  const hasSessionHeader =
    Boolean(sessionOwnerName) ||
    item.pinOrigin !== 'none' ||
    item.isFavorited ||
    item.hasUnread;

  return (
    <div
      className="group relative"
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenMenuAtPoint(event, item);
      }}
    >
      <button
        type="button"
        disabled={isSelectionPending}
        onClick={() => {
          onSelectSession(item);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectSession(item);
            return;
          }

          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault();
            onOpenMenuAtElement(event.currentTarget, item);
          }
        }}
        className={cn(
          CHAT_SIDEBAR_ROW_BUTTON_CLASS,
          item.isSelected
            ? 'bg-primary-500/14 text-primary-900 dark:bg-primary-500/18 dark:text-primary-50'
            : 'text-zinc-700 hover:bg-zinc-900/[0.035] dark:text-zinc-300 dark:hover:bg-white/[0.04]',
        )}
        aria-current={item.isSelected ? 'page' : undefined}
        aria-label={sessionTitleText}
      >
        <div
          className={cn(
            CHAT_SIDEBAR_ROW_AVATAR_SHELL_CLASS,
            item.isSelected
              ? 'bg-primary-500/20 text-primary-800 dark:bg-primary-500/24 dark:text-primary-100'
              : 'bg-zinc-900/[0.055] text-zinc-700 dark:bg-white/[0.09] dark:text-zinc-200',
          )}
          title={item.ownerName}
        >
          <span
            className={cn(
              CHAT_SIDEBAR_ROW_AVATAR_INNER_CLASS,
              'bg-transparent',
            )}
          >
            {item.ownerAvatarLabel ?? 'AI'}
          </span>
          {item.showStatusDot ? (
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-zinc-50 dark:border-zinc-950',
                item.isRunning
                  ? 'animate-pulse bg-emerald-500'
                  : 'bg-primary-400/90 dark:bg-primary-300/90',
              )}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1 overflow-hidden pr-8">
          {hasSessionHeader ? (
            <div className="mb-1 flex min-h-5 min-w-0 items-center gap-1.5">
              {sessionOwnerName ? (
                <span className={SESSION_OWNER_SLOT_CLASS} title={item.ownerName}>
                  <span className="truncate">{item.ownerName}</span>
                </span>
              ) : null}
              {item.pinOrigin === 'system' ? (
                <span className={CHAT_SIDEBAR_PRIMARY_BADGE_CLASS}>
                  {mainAgentBadgeLabel}
                </span>
              ) : null}
              {item.pinOrigin === 'user' ? (
                <Pin className="h-3.5 w-3.5 shrink-0 text-primary-600 dark:text-primary-300" />
              ) : null}
              {item.isFavorited ? (
                <Bookmark className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-300" />
              ) : null}
              {item.hasUnread ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500/90 dark:bg-primary-300/90" />
              ) : null}
            </div>
          ) : null}
          <p
            className={cn(
              CHAT_SIDEBAR_TITLE_TEXT_CLASS,
              item.hasUnread
                ? 'font-semibold text-zinc-900 dark:text-zinc-50'
                : 'text-zinc-700 dark:text-zinc-200',
            )}
            title={sessionTitleText}
          >
            {sessionTitleText}
          </p>
        </div>
      </button>

      <button
        type="button"
        disabled={isSelectionPending}
        onClick={(event) => {
          event.stopPropagation();
          if (isSessionMenuOpen) {
            onCloseMenu();
            return;
          }

          onOpenMenuAtElement(event.currentTarget, item);
        }}
        className={cn(
          'absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-zinc-900/[0.06] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200',
          isSessionMenuOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
        )}
        title={moreActionsLabel}
        aria-label={moreActionsLabel}
        aria-haspopup="menu"
        aria-expanded={isSessionMenuOpen}
        aria-controls={isSessionMenuOpen ? 'chat-sidebar-session-actions-menu' : undefined}
      >
        {isSessionPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <MoreHorizontal className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
