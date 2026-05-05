import React from 'react';
import { Loader2, MoreHorizontal } from 'lucide-react';
import { cn } from '@sdkwork/claw-ui';
import type { ChatSidebarAgentRailItemPresentation } from '../services';
import {
  CHAT_SIDEBAR_AGENT_AVATAR_SHELL_CLASS,
  CHAT_SIDEBAR_AGENT_NAME_CLASS,
  CHAT_SIDEBAR_AGENT_ROW_BUTTON_CLASS,
  CHAT_SIDEBAR_KERNEL_BADGE_CLASS,
  CHAT_SIDEBAR_PRIMARY_BADGE_CLASS,
  resolveKernelBadgeLabel,
} from './chatSidebarItemPrimitives';

export interface ChatSidebarAgentItemProps {
  agent: ChatSidebarAgentRailItemPresentation;
  isSelectionPending: boolean;
  isAgentPending: boolean;
  isAgentMenuOpen: boolean;
  canOpenAgentMenu: boolean;
  moreActionsLabel: string;
  mainAgentBadgeLabel: string;
  onSelectAgent: (agent: ChatSidebarAgentRailItemPresentation) => void;
  onOpenMenuAtPoint: (
    event: React.MouseEvent<HTMLElement>,
    agent: ChatSidebarAgentRailItemPresentation,
  ) => void;
  onOpenMenuAtElement: (
    element: HTMLElement,
    agent: ChatSidebarAgentRailItemPresentation,
  ) => void;
  onCloseMenu: () => void;
}

export function ChatSidebarAgentItem({
  agent,
  isSelectionPending,
  isAgentPending,
  isAgentMenuOpen,
  canOpenAgentMenu,
  moreActionsLabel,
  mainAgentBadgeLabel,
  onSelectAgent,
  onOpenMenuAtPoint,
  onOpenMenuAtElement,
  onCloseMenu,
}: ChatSidebarAgentItemProps) {
  return (
    <div
      className="group relative"
      onContextMenu={(event) => {
        if (!canOpenAgentMenu) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onOpenMenuAtPoint(event, agent);
      }}
    >
      <button
        type="button"
        disabled={isSelectionPending}
        onClick={() => {
          onSelectAgent(agent);
        }}
        onKeyDown={(event) => {
          if (!canOpenAgentMenu) {
            return;
          }

          if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
            event.preventDefault();
            onOpenMenuAtElement(event.currentTarget, agent);
          }
        }}
        className={cn(
          CHAT_SIDEBAR_AGENT_ROW_BUTTON_CLASS,
          agent.isSelected
            ? 'bg-zinc-900/[0.06] text-zinc-950 shadow-none dark:bg-white/[0.075] dark:text-zinc-50'
            : 'text-zinc-700 hover:bg-white/70 hover:shadow-[0_1px_2px_rgba(15,23,42,0.04)] disabled:hover:bg-transparent disabled:hover:shadow-none dark:text-zinc-300 dark:hover:bg-white/[0.06] dark:hover:shadow-none dark:disabled:hover:bg-transparent',
        )}
        aria-label={agent.name}
        aria-busy={isAgentPending}
      >
        <div
          className={cn(
            CHAT_SIDEBAR_AGENT_AVATAR_SHELL_CLASS,
            agent.isSelected
              ? 'bg-primary-500/12 text-primary-800 dark:bg-primary-300/16 dark:text-primary-100'
              : 'bg-zinc-900/[0.055] text-zinc-700 ring-1 ring-zinc-900/[0.03] dark:bg-white/[0.09] dark:text-zinc-200 dark:ring-white/[0.05]',
          )}
        >
          {agent.avatarLabel ?? 'AI'}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-1.5 pr-8">
          <span
            className={cn(
              CHAT_SIDEBAR_AGENT_NAME_CLASS,
              agent.isSelected
                ? 'text-zinc-950 dark:text-zinc-50'
                : 'text-zinc-700 dark:text-zinc-200',
            )}
            title={agent.name}
          >
            {agent.name}
          </span>
          {agent.kernelLabel ? (
            <span className={CHAT_SIDEBAR_KERNEL_BADGE_CLASS} title={agent.kernelLabel}>
              {resolveKernelBadgeLabel(agent.kernelLabel)}
            </span>
          ) : null}
          {agent.isPrimary ? (
            <span className={CHAT_SIDEBAR_PRIMARY_BADGE_CLASS}>
              {mainAgentBadgeLabel}
            </span>
          ) : null}
          {isAgentPending ? (
            <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin text-zinc-500 dark:text-zinc-300" />
          ) : null}
        </div>
      </button>

      {canOpenAgentMenu ? (
        <button
          type="button"
          disabled={isSelectionPending}
          onClick={(event) => {
            event.stopPropagation();
            if (isAgentMenuOpen) {
              onCloseMenu();
              return;
            }

            onOpenMenuAtElement(event.currentTarget, agent);
          }}
          className={cn(
            'absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 transition-all hover:bg-zinc-900/[0.06] hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-white/[0.08] dark:hover:text-zinc-200',
            isAgentMenuOpen
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
          )}
          title={moreActionsLabel}
          aria-label={moreActionsLabel}
          aria-haspopup="menu"
          aria-expanded={isAgentMenuOpen}
          aria-controls={isAgentMenuOpen ? 'chat-sidebar-agent-actions-menu' : undefined}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
