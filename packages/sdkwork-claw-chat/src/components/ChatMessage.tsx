import React, { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Camera,
  Check,
  Copy,
  FileText,
  Image as ImageIcon,
  Link2,
  Mic,
  MonitorUp,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Video,
  Wrench,
} from 'lucide-react';
import type { StudioConversationAttachment } from '@sdkwork/claw-types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@sdkwork/claw-ui';
import {
  detectChatJsonBlock,
  type KernelChatNoticePresentation,
  type OpenClawToolCard,
} from '../services/index.ts';
import { ChatMessageCodeHighlighter } from './chatMessageCodeHighlighter.tsx';
import {
  CHAT_SURFACE_CONTROL_CLASS,
  CHAT_SURFACE_INSET_PANEL_CLASS,
  CHAT_SURFACE_PANEL_CLASS,
  CHAT_SURFACE_PANEL_HEADER_CLASS,
} from './chatChromeSurface';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  model?: string;
  timestamp: number;
  senderLabel?: string | null;
  onRegenerate?: () => void;
  isTyping?: boolean;
  attachments?: StudioConversationAttachment[];
  notices?: KernelChatNoticePresentation[];
  reasoning?: string | null;
  toolCards?: OpenClawToolCard[];
  showHeader?: boolean;
}

function formatFileSize(
  sizeBytes: number | undefined,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (!sizeBytes || sizeBytes <= 0) {
    return null;
  }

  if (sizeBytes < 1024) {
    return t('chat.message.fileSizeBytes', { count: sizeBytes });
  }
  if (sizeBytes < 1024 * 1024) {
    return t('chat.message.fileSizeKb', {
      size: (sizeBytes / 1024).toFixed(1),
    });
  }

  return t('chat.message.fileSizeMb', {
    size: (sizeBytes / (1024 * 1024)).toFixed(1),
  });
}

function formatDuration(durationMs: number | undefined) {
  if (!durationMs || durationMs <= 0) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function attachmentIcon(kind: StudioConversationAttachment['kind']) {
  switch (kind) {
    case 'image':
      return ImageIcon;
    case 'audio':
      return Mic;
    case 'video':
      return Video;
    case 'screenshot':
      return Camera;
    case 'screen-recording':
      return MonitorUp;
    case 'link':
      return Link2;
    default:
      return FileText;
  }
}

function attachmentLabel(
  attachment: StudioConversationAttachment,
  t: (key: string) => string,
) {
  switch (attachment.kind) {
    case 'image':
      return t('chat.message.attachmentKinds.image');
    case 'audio':
      return t('chat.message.attachmentKinds.audio');
    case 'video':
      return t('chat.message.attachmentKinds.video');
    case 'screenshot':
      return t('chat.message.attachmentKinds.screenshot');
    case 'screen-recording':
      return t('chat.message.attachmentKinds.screenRecording');
    case 'link':
      return t('chat.message.attachmentKinds.link');
    default:
      return t('chat.message.attachmentKinds.file');
  }
}

const CodeBlock = memo(
  ({
    match,
    children,
    props,
  }: {
    match: RegExpExecArray;
    children: React.ReactNode;
    props: Record<string, unknown>;
  }) => {
    const [copied, setCopied] = useState(false);
    const { t } = useTranslation();

    const handleCopy = () => {
      navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div
        className={cn(
          CHAT_SURFACE_PANEL_CLASS,
          'relative mb-4 mt-3 min-w-0 overflow-hidden rounded-xl dark:bg-[#1E1E1E]',
        )}
      >
        <div
          className={cn(
            CHAT_SURFACE_PANEL_HEADER_CLASS,
            'flex flex-wrap items-center justify-between gap-2 px-4 py-2',
          )}
        >
          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{match[1]}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span className={copied ? 'text-emerald-500' : ''}>
              {copied ? t('chat.message.copied') : t('chat.message.copyCode')}
            </span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <ChatMessageCodeHighlighter
            language={match[1]}
            code={String(children).replace(/\n$/, '')}
            props={props}
          />
        </div>
      </div>
    );
  },
);

const AttachmentTile = memo(function AttachmentTile({
  attachment,
  isUser,
}: {
  attachment: StudioConversationAttachment;
  isUser: boolean;
}) {
  const { t } = useTranslation();
  const Icon = attachmentIcon(attachment.kind);
  const previewUrl = attachment.previewUrl || attachment.url;
  const displayUrl = attachment.url || attachment.originalUrl;
  const detailItems = [
    attachmentLabel(attachment, t),
    formatFileSize(attachment.sizeBytes, t),
    formatDuration(attachment.durationMs),
  ].filter(Boolean);
  const surfaceClassName = isUser
    ? cn(
        CHAT_SURFACE_PANEL_CLASS,
        'border-zinc-300/80 bg-zinc-50/96 dark:border-zinc-700 dark:bg-zinc-900/78',
      )
    : CHAT_SURFACE_PANEL_CLASS;

  if (
    previewUrl &&
    (attachment.kind === 'image' || attachment.kind === 'screenshot')
  ) {
    return (
      <a
        href={displayUrl || previewUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg',
          surfaceClassName,
        )}
      >
        <img
          src={previewUrl}
          alt={attachment.name}
          className="max-h-72 w-full object-cover"
        />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {attachment.name}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {detailItems.join(' / ')}
            </div>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950/80 text-white dark:bg-zinc-100 dark:text-zinc-950">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </a>
    );
  }

  if (previewUrl && attachment.kind === 'audio') {
    return (
      <div
        className={cn(
          'p-4',
          surfaceClassName,
        )}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Mic className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {attachment.name}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {detailItems.join(' / ')}
            </div>
          </div>
        </div>
        <audio controls preload="metadata" className="w-full" src={previewUrl} />
      </div>
    );
  }

  if (
    previewUrl &&
    (attachment.kind === 'video' || attachment.kind === 'screen-recording')
  ) {
    return (
      <div
        className={cn(
          'overflow-hidden',
          surfaceClassName,
        )}
      >
        <video controls preload="metadata" className="max-h-80 w-full bg-zinc-950" src={previewUrl} />
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
            <Video className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {attachment.name}
            </div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {detailItems.join(' / ')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <a
      href={displayUrl || '#'}
      target={displayUrl ? '_blank' : undefined}
      rel={displayUrl ? 'noreferrer' : undefined}
      className={cn(
        'flex min-w-0 items-start gap-3 p-4 transition-colors hover:border-primary-500/40',
        surfaceClassName,
      )}
    >
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-900/8 text-zinc-700 dark:bg-zinc-100/10 dark:text-zinc-200">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {attachment.name}
        </div>
        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          {detailItems.join(' / ')}
        </div>
        {attachment.originalUrl ? (
          <div className="mt-2 truncate text-xs text-primary-600 dark:text-primary-300">
            {attachment.originalUrl}
          </div>
        ) : null}
      </div>
      {displayUrl ? (
        <div className="text-xs font-medium text-primary-600 dark:text-primary-300">
          {t('chat.message.openAttachment')}
        </div>
      ) : null}
    </a>
  );
});

const JsonContentBlock = memo(function JsonContentBlock({
  content,
}: {
  content: string;
}) {
  const { t } = useTranslation();
  const jsonBlock = detectChatJsonBlock(content);
  if (!jsonBlock) {
    return null;
  }

  const summaryLabel =
    jsonBlock.kind === 'array'
      ? t('chat.message.jsonArray', { count: jsonBlock.itemCount })
      : jsonBlock.keyCount > 0 && jsonBlock.keyCount <= 4
        ? `{ ${jsonBlock.keys.join(', ')} }`
        : t('chat.message.jsonObjectCount', { count: jsonBlock.keyCount });

  return (
    <details className={cn(CHAT_SURFACE_INSET_PANEL_CLASS, 'overflow-hidden')}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
        <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white dark:bg-zinc-100 dark:text-zinc-950">
          {t('chat.message.json')}
        </span>
        <span className="min-w-0 truncate text-sm font-medium text-zinc-600 dark:text-zinc-300">
          {summaryLabel}
        </span>
      </summary>
      <div className="border-t border-zinc-200/70 dark:border-zinc-800">
        <pre className="overflow-x-auto px-4 py-3 text-xs leading-6 text-zinc-700 dark:text-zinc-200">
          <code>{jsonBlock.pretty}</code>
        </pre>
      </div>
    </details>
  );
});

const NoticeList = memo(function NoticeList({
  notices,
}: {
  notices: KernelChatNoticePresentation[];
}) {
  return (
    <div className="mb-2.5 space-y-2">
      {notices.map((notice, index) => (
        <div
          key={`${notice.code}:${index}`}
          className={cn(
            'rounded-2xl border px-4 py-3 text-[12px] leading-6 backdrop-blur-sm',
            notice.level === 'error'
              ? 'border-rose-200/80 bg-rose-50/85 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200'
              : notice.level === 'warning'
                ? 'border-amber-200/80 bg-amber-50/85 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200'
                : 'border-sky-200/80 bg-sky-50/85 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200',
          )}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
              {notice.code}
            </span>
          </div>
          <div className="mt-1 whitespace-pre-wrap break-words">{notice.text}</div>
        </div>
      ))}
    </div>
  );
});

const ToolLinksPanel = memo(function ToolLinksPanel({
  toolCards,
}: {
  toolCards: OpenClawToolCard[];
}) {
  const { t } = useTranslation();
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);
  const occurrenceByName = new Map<string, number>();
  const linkItems = toolCards.map((toolCard, index) => {
    const toolName = toolCard.name.trim() || 'Tool';
    const occurrence = (occurrenceByName.get(toolName) ?? 0) + 1;
    occurrenceByName.set(toolName, occurrence);
    const stableToolId = toolCard.toolCallId?.trim() || `${toolCard.kind}:${toolName}:${index}`;

    return {
      ...toolCard,
      id: stableToolId,
      label: occurrence > 1 ? `${toolName} ${occurrence}` : toolName,
      typeLabel: toolCard.kind === 'call'
        ? t('chat.message.toolCall')
        : t('chat.message.toolResult'),
    };
  });
  const expandedTool = linkItems.find((toolCard) => toolCard.id === expandedToolId) ?? null;

  return (
    <div className="text-xs leading-5">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="shrink-0 text-zinc-500 dark:text-zinc-400">
          {toolCards.length === 1
            ? t('chat.message.toolSingle')
            : t('chat.message.toolsMultiple', { count: toolCards.length })}
        </span>

        <span className="shrink-0 text-zinc-300 dark:text-zinc-600">
          /
        </span>

        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
          {linkItems.map((toolCard) => {
            const isExpanded = toolCard.id === expandedToolId;

            return (
              <button
                key={toolCard.id}
                type="button"
                aria-pressed={isExpanded}
                onClick={() => setExpandedToolId(isExpanded ? null : toolCard.id)}
                className={cn(
                  'inline-flex min-w-0 max-w-full items-center text-xs transition-colors hover:underline underline-offset-2',
                  isExpanded
                    ? 'font-semibold text-primary-700 dark:text-primary-200'
                    : 'text-primary-600 dark:text-primary-300',
                )}
                title={toolCard.name}
              >
                <span className="max-w-[14rem] truncate">{toolCard.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {expandedTool ? (
        <div className="mt-1.5 pl-4">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-5">
            <span className="truncate font-semibold text-zinc-600 dark:text-zinc-300">
              {expandedTool.name}
            </span>
            <span className="text-zinc-400 dark:text-zinc-500">/</span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {expandedTool.typeLabel}
            </span>
          </div>

          {expandedTool.detail ? (
            <div className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] leading-5 text-zinc-600 dark:text-zinc-300">
              {expandedTool.detail}
            </div>
          ) : null}

          {expandedTool.preview ? (
            <div
              className={cn(
                'mt-1 whitespace-pre-wrap break-words text-[11px] leading-5',
                expandedTool.isError
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-zinc-600 dark:text-zinc-300',
              )}
            >
              {expandedTool.preview}
            </div>
          ) : expandedTool.kind === 'result' ? (
            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {t('chat.message.completed')}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  model,
  timestamp,
  senderLabel,
  onRegenerate,
  isTyping,
  attachments = [],
  notices = [],
  reasoning,
  toolCards = [],
  showHeader = true,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const { t, i18n } = useTranslation();
  const formatTimeLabel = (value: number) =>
    new Intl.DateTimeFormat(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderCopyButton = (className: string) => (
    <button
      type="button"
      onClick={handleCopy}
      className={className}
      title={t('chat.message.copyMessage')}
      aria-label={t('chat.message.copyMessage')}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 sm:h-4 sm:w-4" />
      ) : (
        <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
      )}
    </button>
  );

  const isUser = role === 'user';
  const isTool = role === 'tool';
  const trimmedContent = content.trim();
  const hasRenderableContent = trimmedContent.length > 0 || isTyping;
  const isCompactToolLinksOnlyMessage =
    isTool &&
    !hasRenderableContent &&
    attachments.length === 0 &&
    !reasoning &&
    toolCards.length > 0;
  const showAssistantActions = role === 'assistant';
  const canCopyMessage = trimmedContent.length > 0;
  const showFloatingCopyAction = !showHeader && canCopyMessage && (isUser || role === 'assistant');
  const normalizedModel = model?.trim();
  const normalizedSenderLabel =
    typeof senderLabel === 'string' && senderLabel.trim() ? senderLabel.trim() : null;
  const messageLabel = isTool
    ? t('chat.message.toolOutput')
    : normalizedModel
      ? (normalizedModel.includes('/') ? normalizedModel.split('/').pop() : normalizedModel)
      : t('chat.message.assistant');
  const hasJsonBlock = !isTyping && Boolean(detectChatJsonBlock(trimmedContent));
  const messageActions =
    showHeader && (canCopyMessage || showAssistantActions || onRegenerate) ? (
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:gap-1',
          showHeader && isUser ? 'sm:mr-3' : null,
        )}
      >
        {canCopyMessage
          ? renderCopyButton(
              'rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100',
            )
          : null}
        {showAssistantActions ? (
          <button
            type="button"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100"
          >
            <ThumbsUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        ) : null}
        {showAssistantActions ? (
          <button
            type="button"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100"
          >
            <ThumbsDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        ) : null}
        {showAssistantActions && onRegenerate ? (
          <button
            type="button"
            onClick={onRegenerate}
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/50 hover:text-zinc-900 dark:hover:bg-zinc-700/50 dark:hover:text-zinc-100"
            title={t('chat.message.regenerateResponse')}
          >
            <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        ) : null}
      </div>
    ) : null;

  return (
    <div
      className={cn(
        'group mx-auto flex w-full max-w-6xl transition-all duration-300',
        isUser
          ? 'justify-end pl-4 pr-2 sm:pl-6 sm:pr-3 lg:pl-8 lg:pr-4'
          : 'justify-start px-4 sm:px-6 lg:px-8',
      )}
    >
      <div
        className={cn(
          'flex max-w-full rounded-3xl',
          isCompactToolLinksOnlyMessage && 'w-full rounded-none bg-transparent p-0',
          isUser
            ? 'rounded-br-md bg-zinc-100 px-3.5 py-1.5 text-zinc-900 sm:max-w-[95%] dark:bg-zinc-800 dark:text-zinc-100'
            : isTool
              ? 'w-full px-0 py-0 text-zinc-900 dark:text-zinc-100'
              : 'w-full px-0 py-0 text-zinc-900 dark:text-zinc-100',
        )}
      >
        <div className={cn('min-w-0 flex-1', showFloatingCopyAction && 'relative pr-11 sm:pr-12')}>
          {showFloatingCopyAction ? (
            <div
              className={cn(
                'absolute right-0 top-0 z-10 flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100',
                isUser ? null : null,
              )}
            >
              {renderCopyButton(
                cn(
                  CHAT_SURFACE_CONTROL_CLASS,
                  'rounded-md border p-1.5 text-zinc-500 shadow-sm backdrop-blur transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100',
                ),
              )}
            </div>
          ) : null}
          {isUser && showHeader ? (
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center justify-end gap-2">
                {normalizedSenderLabel ? (
                  <span className="max-w-[12rem] truncate text-[12px] font-semibold tracking-tight text-zinc-500 dark:text-zinc-400 sm:text-[13px]">
                    {normalizedSenderLabel}
                  </span>
                ) : null}
                <span className="text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500 sm:text-xs">
                  {formatTimeLabel(timestamp)}
                </span>
              </div>
              {messageActions}
            </div>
          ) : !isUser && showHeader ? (
            <div className="mb-1.5 flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:gap-3">
                <span className="max-w-full truncate text-[14px] font-semibold tracking-tight sm:text-[15px]">
                  {messageLabel}
                </span>
                <span className="text-[11px] font-medium tracking-wide text-zinc-400 dark:text-zinc-500 sm:text-xs">
                  {formatTimeLabel(timestamp)}
                </span>
              </div>
              {messageActions}
            </div>
          ) : null}

          {attachments.length > 0 ? (
            <div className="mb-2.5 grid gap-3 sm:grid-cols-2">
              {attachments.map((attachment) => (
                <AttachmentTile
                  key={attachment.id}
                  attachment={attachment}
                  isUser={isUser}
                />
              ))}
            </div>
          ) : null}

          {notices.length > 0 ? (
            <NoticeList notices={notices} />
          ) : null}

          {reasoning ? (
            <details
              className={cn(
                CHAT_SURFACE_INSET_PANEL_CLASS,
                'mb-2.5 overflow-hidden dark:bg-zinc-900/65',
              )}
            >
              <summary className="cursor-pointer px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                {t('chat.message.reasoning')}
              </summary>
              <div className="border-t border-zinc-200/70 px-4 py-3 text-[13px] leading-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300 sm:text-[14px]">
                <div className="whitespace-pre-wrap break-words">{reasoning}</div>
              </div>
            </details>
          ) : null}

          {hasRenderableContent ? (
            <div>
              {content === '' && isTyping ? (
                <div className="flex h-6 items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 dark:bg-zinc-500"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              ) : hasJsonBlock ? (
                <JsonContentBlock content={trimmedContent} />
              ) : (
                <div
                  className={cn(
                    'prose prose-zinc prose-sm relative max-w-none break-words text-[14px] leading-6 dark:prose-invert sm:prose-sm',
                    'prose-headings:font-semibold prose-headings:tracking-tight prose-headings:mb-2 prose-headings:mt-4 prose-a:text-primary-500 hover:prose-a:text-primary-600',
                    'prose-code:before:content-none prose-code:after:content-none prose-p:my-2 prose-p:leading-6 prose-pre:my-3 prose-pre:bg-transparent prose-pre:p-0 prose-ul:my-2 prose-ol:my-2',
                    isTyping &&
                      content !== '' &&
                      "[&>*:last-child]:after:ml-1 [&>*:last-child]:after:animate-pulse [&>*:last-child]:after:content-['|'] [&>*:last-child]:after:text-primary-500",
                  )}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match && !className?.includes('language-');

                        if (!isInline && match) {
                          return <CodeBlock match={match} children={children} props={props} />;
                        }

                        return (
                          <code
                            {...props}
                            className={cn(
                              'rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 font-mono text-[13px] text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
                              className,
                            )}
                          >
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          ) : null}

          {toolCards.length > 0 ? (
            <div className={hasRenderableContent ? 'mt-1.5' : undefined}>
              <ToolLinksPanel toolCards={toolCards} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
