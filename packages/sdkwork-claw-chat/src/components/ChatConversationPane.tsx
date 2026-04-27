import type { ComponentProps, RefObject, UIEventHandler } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { cn } from '@sdkwork/claw-ui';
import type { ChatConversationPaneMessageGroupPresentation } from '../services';
import { ChatComposerPanel } from './ChatComposerPanel';
import { ChatEmptyState } from './ChatEmptyState';
import { ChatMessage } from './ChatMessage';
import { ChatTopControls } from './ChatTopControls';
import {
  CHAT_CHROME_COMPOSER_LAYER_CLASS,
  CHAT_SURFACE_ELEVATED_PANEL_CLASS,
  CHAT_SURFACE_PANEL_CLASS,
} from './chatChromeSurface';

export interface ChatConversationPaneProps {
  surfaceState:
    | {
        mode: 'missingInstance';
        title: string;
        description: string;
        actionLabel: string;
      }
    | {
        mode: 'unsupported';
        title: string;
        description: string;
        actionLabel: string;
      }
    | {
        mode: 'loading';
        title: string;
        description: string;
      }
    | {
        mode: 'empty';
      }
    | {
        mode: 'messages';
      };
  inlineNoticeMessage: string | null;
  showComposer: boolean;
  messagesScrollContainerRef: RefObject<HTMLDivElement | null>;
  onMessageListScroll: UIEventHandler<HTMLDivElement>;
  messageGroups: ChatConversationPaneMessageGroupPresentation[];
  topControlsProps: ComponentProps<typeof ChatTopControls>;
  emptyStateProps: ComponentProps<typeof ChatEmptyState>;
  composerPanelProps: ComponentProps<typeof ChatComposerPanel>;
  onManageInstances: () => void;
}

export function ChatConversationPane({
  surfaceState,
  inlineNoticeMessage,
  showComposer,
  messagesScrollContainerRef,
  onMessageListScroll,
  messageGroups,
  topControlsProps,
  emptyStateProps,
  composerPanelProps,
  onManageInstances,
}: ChatConversationPaneProps) {
  if (surfaceState.mode === 'missingInstance') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center sm:p-8 lg:p-10">
        <div
          className={cn(
            CHAT_SURFACE_ELEVATED_PANEL_CLASS,
            'w-full max-w-2xl p-6 sm:p-8 lg:p-10',
          )}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-primary-500/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-300">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            {surfaceState.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-500 dark:text-zinc-400 sm:text-base">
            {surfaceState.description}
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={onManageInstances}
              className="rounded-xl bg-primary-600 px-6 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              {surfaceState.actionLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      <ChatTopControls {...topControlsProps} />

      <div
        ref={messagesScrollContainerRef}
        onScroll={onMessageListScroll}
        data-chat-scroll-region="messages"
        className="min-h-0 flex-1 overflow-y-auto scrollbar-hide"
      >
        {inlineNoticeMessage && surfaceState.mode !== 'unsupported' ? (
          <div className="px-3 pt-4 sm:px-4 sm:pt-5">
            <div
              className={cn(
                CHAT_SURFACE_PANEL_CLASS,
                'mx-auto flex w-full max-w-6xl items-start gap-3 border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200',
              )}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="min-w-0 leading-6">{inlineNoticeMessage}</p>
            </div>
          </div>
        ) : null}

        {surfaceState.mode === 'unsupported' ? (
          <div className="flex min-h-full flex-1 items-center justify-center px-3 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
            <div
              className={cn(
                CHAT_SURFACE_ELEVATED_PANEL_CLASS,
                'w-full max-w-3xl border-amber-200/80 p-6 text-center dark:border-amber-900/40 sm:p-8 lg:p-10',
              )}
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-amber-500/10 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h2 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
                {surfaceState.title}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-500 dark:text-zinc-400 sm:text-base">
                {surfaceState.description}
              </p>
              <div className="mt-8 flex justify-center">
                <button
                  onClick={onManageInstances}
                  className="rounded-xl bg-primary-600 px-6 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-primary-700"
                >
                  {surfaceState.actionLabel}
                </button>
              </div>
            </div>
          </div>
        ) : surfaceState.mode === 'loading' ? (
          <div className="flex min-h-full flex-1 items-center justify-center px-3 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
            <div
              className={cn(
                CHAT_SURFACE_PANEL_CLASS,
                'flex flex-col items-center gap-3 px-5 py-5 text-center',
              )}
            >
              <LoaderCircle className="h-5 w-5 animate-spin text-zinc-500 dark:text-zinc-400" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {surfaceState.title}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {surfaceState.description}
                </p>
              </div>
            </div>
          </div>
        ) : surfaceState.mode === 'empty' ? (
          <div className="flex min-h-full flex-1 items-center justify-center px-3 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pt-10">
            <ChatEmptyState {...emptyStateProps} />
          </div>
        ) : (
          <div className="flex-1 space-y-3 px-3 py-4 sm:space-y-4 sm:px-4 sm:py-5">
            {messageGroups.map((group) => {
              return (
                <div key={group.key} className="space-y-1.5 sm:space-y-2">
                  {group.items.map((item) => {
                    const message = item.message;

                    return (
                      <ChatMessage
                        key={item.key}
                        role={message.role}
                        content={message.content}
                        model={message.model}
                        timestamp={message.timestamp}
                        senderLabel={message.senderLabel}
                        operationalEvent={message.operationalEvent}
                        isTyping={item.isTyping}
                        attachments={message.attachments.length > 0 ? message.attachments : undefined}
                        notices={message.notices.length > 0 ? message.notices : undefined}
                        reasoning={message.reasoning}
                        toolCards={message.toolCards.length > 0 ? message.toolCards : undefined}
                        showHeader={false}
                      />
                    );
                  })}
                  {group.footer.isVisible ? (
                    <div
                      className={cn(
                        'mx-auto flex w-full max-w-6xl text-[10px] tracking-normal text-zinc-400 dark:text-zinc-500',
                        group.role === 'user'
                          ? 'justify-end pl-4 pr-2 sm:pl-6 sm:pr-3 lg:pl-8 lg:pr-4'
                          : 'justify-start px-4 sm:px-6 lg:px-8',
                      )}
                    >
                      <div
                        className={cn(
                          'flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5',
                          group.role === 'user' ? 'justify-end' : null,
                        )}
                      >
                        <span className="truncate font-medium text-zinc-500 dark:text-zinc-400">
                          {group.footer.label}
                        </span>
                        {group.footer.timestampLabel ? (
                          <>
                            <span className="shrink-0 text-zinc-300 dark:text-zinc-600">/</span>
                            <span className="text-zinc-400 dark:text-zinc-500">
                              {group.footer.timestampLabel}
                            </span>
                          </>
                        ) : null}
                        {group.footer.modelLabel ? (
                          <>
                            <span className="shrink-0 text-zinc-300 dark:text-zinc-600">/</span>
                            <span className="truncate text-zinc-400 dark:text-zinc-500">
                              {group.footer.modelLabel}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showComposer ? (
        <div className={CHAT_CHROME_COMPOSER_LAYER_CLASS}>
          <ChatComposerPanel {...composerPanelProps} />
        </div>
      ) : null}
    </div>
  );
}
