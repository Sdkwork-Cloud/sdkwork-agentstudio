import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  BrainCircuit,
  Camera,
  Check,
  ChevronDown,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Mic,
  MonitorUp,
  Paperclip,
  Send,
  Settings2,
  StopCircle,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import {
  chatUploadService,
  type LLMChannel,
  type LLMModel,
} from '@sdkwork/claw-core';
import { platform } from '@sdkwork/claw-infrastructure';
import type {
  StudioConversationAttachment,
  StudioConversationAttachmentKind,
} from '@sdkwork/claw-types';
import { cn, Input, Textarea } from '@sdkwork/claw-ui';
import type { ChatComposerSubmitPayload } from '../types/index.ts';
import {
  canImportChatComposerRemoteUrl,
  canSendChatComposerPayload,
  resolveChatComposerStatusState,
  resolveRecorderStartErrorKey,
  shouldPersistChatComposerRecording,
  shouldShowModelChannelRail,
  shouldConfirmChatComposerFieldOnEnter,
  shouldSendChatComposerMessageOnEnter,
  startNativeScreenshotSupportProbe,
} from '../services/index.ts';
import {
  CHAT_SURFACE_INPUT_CLASS,
  CHAT_SURFACE_PANEL_CLASS,
} from './chatChromeSurface';

type ComposerDraftStatus = 'uploading' | 'ready' | 'error';
type BrowserFilePickerMode = 'all' | 'image';

type ComposerDraftSource =
  | {
      type: 'blob';
      blob: Blob;
      fileName: string;
      contentType: string;
      kind?: StudioConversationAttachmentKind;
      width?: number;
      height?: number;
      durationMs?: number;
    }
  | {
      type: 'remoteUrl';
      url: string;
      fileName?: string;
      kind?: StudioConversationAttachmentKind;
    };

interface ComposerDraftAttachment {
  id: string;
  status: ComposerDraftStatus;
  kind: StudioConversationAttachmentKind;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  previewUrl?: string;
  attachment?: StudioConversationAttachment;
  error?: string;
  source: ComposerDraftSource;
}

interface ActiveRecorder {
  kind: 'audio' | 'screen-recording';
  startedAt: number;
  stop: (options?: { discard?: boolean }) => void;
}

interface ChatInputProps {
  onSend: (payload: ChatComposerSubmitPayload) => Promise<unknown> | void;
  isLoading?: boolean;
  canStop?: boolean;
  onStop?: () => void;
  channels: LLMChannel[];
  activeChannel?: LLMChannel;
  activeModel?: LLMModel;
  onChannelChange: (channelId: string) => void;
  onModelChange: (channelId: string, modelId: string) => void;
  onOpenModelConfig?: () => void;
  compactModelSelector?: boolean;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'];
const KNOWN_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  webm: 'video/webm',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  json: 'application/json',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  zip: 'application/zip',
};

function createDraftId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function inferAttachmentKind(
  mimeType: string,
  fileName: string,
  preferredKind?: StudioConversationAttachmentKind,
): StudioConversationAttachmentKind {
  if (preferredKind) {
    return preferredKind;
  }

  const normalizedMimeType = mimeType.toLowerCase();
  const normalizedFileName = fileName.toLowerCase();

  if (normalizedMimeType.startsWith('image/')) {
    return 'image';
  }
  if (normalizedMimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (normalizedMimeType.startsWith('video/')) {
    return 'video';
  }
  if (
    normalizedFileName.endsWith('.png') ||
    normalizedFileName.endsWith('.jpg') ||
    normalizedFileName.endsWith('.jpeg') ||
    normalizedFileName.endsWith('.webp')
  ) {
    return 'image';
  }
  if (
    normalizedFileName.endsWith('.mp3') ||
    normalizedFileName.endsWith('.wav') ||
    normalizedFileName.endsWith('.m4a') ||
    normalizedFileName.endsWith('.ogg')
  ) {
    return 'audio';
  }
  if (
    normalizedFileName.endsWith('.mp4') ||
    normalizedFileName.endsWith('.mov') ||
    normalizedFileName.endsWith('.webm')
  ) {
    return 'video';
  }

  return 'file';
}

function formatRecorderDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDraftSize(sizeBytes: number | undefined) {
  if (!sizeBytes || sizeBytes <= 0) {
    return null;
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sanitizeRecorderFileName(prefix: string, extension: string) {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join('');

  return `${prefix}-${stamp}.${extension}`;
}

function pickSupportedMimeType(candidates: string[]) {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

function releasePreviewUrl(url: string | undefined) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function isValidRemoteUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function mimeTypeFromFileName(fileName: string) {
  const segments = fileName.split('.');
  const extension = segments.length > 1 ? segments.at(-1)?.toLowerCase() : '';
  return (extension && KNOWN_MIME_TYPES[extension]) || 'application/octet-stream';
}

function extensionFromMimeType(mimeType: string, fallback: string) {
  const normalizedMimeType = mimeType.toLowerCase();
  const entry = Object.entries(KNOWN_MIME_TYPES).find(([, value]) => value === normalizedMimeType);
  return entry?.[0] || fallback;
}

function stopMediaStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => {
    track.stop();
  });
}

function extractTransferFiles(transfer: DataTransfer | null) {
  if (!transfer) {
    return [];
  }

  if (transfer.files.length > 0) {
    return Array.from(transfer.files);
  }

  return Array.from(transfer.items ?? [])
    .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
    .filter((file): file is File => file !== null);
}

function extractDroppedUrl(transfer: DataTransfer | null) {
  if (!transfer) {
    return null;
  }

  const uriList = transfer.getData('text/uri-list').trim();
  if (uriList && isValidRemoteUrl(uriList)) {
    return uriList;
  }

  const text = transfer.getData('text/plain').trim();
  if (text && isValidRemoteUrl(text)) {
    return text;
  }

  return null;
}

function attachmentKindLabelKey(kind: StudioConversationAttachmentKind) {
  switch (kind) {
    case 'image':
      return 'chat.input.attachmentKinds.image';
    case 'audio':
      return 'chat.input.attachmentKinds.audio';
    case 'video':
      return 'chat.input.attachmentKinds.video';
    case 'screenshot':
      return 'chat.input.attachmentKinds.screenshot';
    case 'screen-recording':
      return 'chat.input.attachmentKinds.screenRecording';
    case 'link':
      return 'chat.input.attachmentKinds.link';
    default:
      return 'chat.input.attachmentKinds.file';
  }
}

function attachmentKindIcon(kind: StudioConversationAttachmentKind) {
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
      return Paperclip;
  }
}

async function readImageDimensions(blob: Blob) {
  if (typeof window === 'undefined' || !blob.type.startsWith('image/')) {
    return {};
  }

  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Failed to read image metadata.'));
      element.src = objectUrl;
    });

    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readMediaDuration(blob: Blob) {
  if (typeof window === 'undefined') {
    return undefined;
  }

  if (!blob.type.startsWith('audio/') && !blob.type.startsWith('video/')) {
    return undefined;
  }

  const objectUrl = URL.createObjectURL(blob);

  try {
    const media = document.createElement(blob.type.startsWith('audio/') ? 'audio' : 'video');
    media.preload = 'metadata';
    const durationMs = await new Promise<number>((resolve, reject) => {
      media.onloadedmetadata = () => resolve(Math.round(media.duration * 1000));
      media.onerror = () => reject(new Error('Failed to read media metadata.'));
      media.src = objectUrl;
    });

    return Number.isFinite(durationMs) ? durationMs : undefined;
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function draftPreviewUrl(kind: StudioConversationAttachmentKind, blob: Blob) {
  if (
    kind === 'image' ||
    kind === 'screenshot' ||
    kind === 'audio' ||
    kind === 'video' ||
    kind === 'screen-recording'
  ) {
    return URL.createObjectURL(blob);
  }

  return undefined;
}

async function buildBlobSource(
  blob: Blob,
  fileName: string,
  preferredKind?: StudioConversationAttachmentKind,
) {
  const kind = inferAttachmentKind(
    blob.type || 'application/octet-stream',
    fileName,
    preferredKind,
  );
  const imageMetadata =
    kind === 'image' || kind === 'screenshot' ? await readImageDimensions(blob) : {};
  const durationMs =
    kind === 'audio' || kind === 'video' || kind === 'screen-recording'
      ? await readMediaDuration(blob)
      : undefined;

  return {
    type: 'blob' as const,
    blob,
    fileName,
    contentType: blob.type || 'application/octet-stream',
    kind,
    durationMs,
    ...imageMetadata,
  };
}

export function ChatInput({
  onSend,
  isLoading,
  canStop = false,
  onStop,
  channels,
  activeChannel,
  activeModel,
  onChannelChange,
  onModelChange,
  onOpenModelConfig,
  compactModelSelector = true,
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelDropdownStyle, setModelDropdownStyle] = useState<React.CSSProperties | null>(null);
  const [drafts, setDrafts] = useState<ComposerDraftAttachment[]>([]);
  const [showUrlImport, setShowUrlImport] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteUrlFileName, setRemoteUrlFileName] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeRecorder, setActiveRecorder] = useState<ActiveRecorder | null>(null);
  const [recorderElapsedMs, setRecorderElapsedMs] = useState(0);
  const [isRecordingFinalizing, setIsRecordingFinalizing] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isImportingRemoteUrl, setIsImportingRemoteUrl] = useState(false);
  const [browserFilePickerMode, setBrowserFilePickerMode] =
    useState<BrowserFilePickerMode>('all');
  const [supportsNativeScreenshot, setSupportsNativeScreenshot] = useState(() =>
    platform.supportsNativeScreenshot(),
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  const activeChannelOptionRef = useRef<HTMLButtonElement>(null);
  const activeModelOptionRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const draftsRef = useRef<ComposerDraftAttachment[]>([]);
  const activeRecorderRef = useRef<ActiveRecorder | null>(null);
  const isUnmountingRef = useRef(false);
  const sendInvocationLockRef = useRef(false);
  const modelDropdownId = useId();
  const { t } = useTranslation();
  const modelTriggerLabel = activeModel?.name || t('chat.page.selectModel');
  const modelTriggerClassName = cn(
    'inline-flex h-8 max-w-[11.5rem] items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors sm:h-9 sm:max-w-[13.5rem] lg:max-w-[15.5rem]',
    showModelDropdown
      ? 'bg-zinc-100/90 text-zinc-900 shadow-sm dark:bg-zinc-800/90 dark:text-zinc-50'
      : 'bg-zinc-100/78 text-zinc-700 hover:bg-zinc-100/95 hover:text-zinc-900 dark:bg-zinc-800/72 dark:text-zinc-100 dark:hover:bg-zinc-800/92 dark:hover:text-white',
  );
  const actionButtonClassName =
    'flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900 dark:bg-zinc-800/55 dark:text-zinc-200 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-50 sm:h-9 sm:w-9';
  const sendSideActionButtonClassName =
    'flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100/80 hover:text-zinc-900 dark:bg-zinc-800/55 dark:text-zinc-200 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-50';
  const isDesktopPlatform = platform.getPlatform() === 'desktop';
  const supportsScreenRecording =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getDisplayMedia === 'function' &&
    typeof MediaRecorder !== 'undefined';
  const supportsVoiceRecording =
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined';

  const readyAttachments = useMemo(
    () =>
      drafts
        .filter((draft) => draft.status === 'ready' && draft.attachment)
        .map((draft) => draft.attachment as StudioConversationAttachment),
    [drafts],
  );
  const hasUploadingDrafts = drafts.some((draft) => draft.status === 'uploading');
  const hasReadyContent = message.trim().length > 0 || readyAttachments.length > 0;
  const isRecording = activeRecorder !== null;
  const canSend = canSendChatComposerPayload({
    hasActiveModel: Boolean(activeModel),
    isLoading: Boolean(isLoading),
    hasUploadingDrafts,
    hasPendingSendRequest: isSendingMessage,
    isImportingRemoteUrl,
    isRecording,
    isRecordingFinalizing,
    hasReadyContent,
  });
  const showModelChannelRail = shouldShowModelChannelRail({
    channelCount: channels.length,
    compactModelSelector,
  });
  const showElevatedSurface =
    isFocused ||
    showModelDropdown ||
    showUrlImport ||
    isDragging ||
    drafts.length > 0 ||
    isRecording ||
    isRecordingFinalizing ||
    isImportingRemoteUrl ||
    Boolean(message.trim());

  draftsRef.current = drafts;
  activeRecorderRef.current = activeRecorder;

  const updateModelDropdownPosition = () => {
    if (typeof window === 'undefined') {
      return;
    }

    const trigger = modelTriggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = window.innerWidth < 640 ? 12 : 16;
    const dropdownWidth = Math.min(
      560,
      Math.max(window.innerWidth < 640 ? 280 : 320, window.innerWidth - viewportPadding * 2),
    );
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - dropdownWidth - viewportPadding),
    );
    const availableAbove = rect.top - viewportPadding - 12;
    const availableBelow = window.innerHeight - rect.bottom - viewportPadding - 12;
    const placeAbove = availableAbove >= 260 || availableAbove >= availableBelow;
    const maxHeight = Math.max(
      180,
      Math.min(380, placeAbove ? availableAbove : availableBelow),
    );

    setModelDropdownStyle({
      left: `${left}px`,
      width: `${dropdownWidth}px`,
      maxHeight: `${maxHeight}px`,
      ...(placeAbove
        ? { bottom: `${window.innerHeight - rect.top + 12}px` }
        : { top: `${rect.bottom + 12}px` }),
    });
  };

  const restoreTextareaFocus = () => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus({ preventScroll: true });
    });
  };

  const updateDraft = (
    draftId: string,
    updater: (current: ComposerDraftAttachment) => ComposerDraftAttachment,
  ) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === draftId ? updater(draft) : draft)),
    );
  };

  const uploadDraft = async (draftId: string, source: ComposerDraftSource) => {
    try {
      if (source.type === 'remoteUrl') {
        const attachment = await chatUploadService.uploadRemoteUrl({
          url: source.url,
          fileName: source.fileName,
          kind: source.kind,
          path: 'chat',
          provider: 'AWS',
        });

        updateDraft(draftId, (draft) => ({
          ...draft,
          status: 'ready',
          error: undefined,
          kind: attachment.kind,
          name: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          previewUrl: attachment.previewUrl || attachment.url || draft.previewUrl,
          attachment,
        }));
        return;
      }

      const attachment = await chatUploadService.uploadFile({
        data: source.blob,
        fileName: source.fileName,
        kind: source.kind,
        contentType: source.contentType,
        path: 'chat',
        provider: 'AWS',
      });
      const enrichedAttachment: StudioConversationAttachment = {
        ...attachment,
        width: source.width ?? attachment.width,
        height: source.height ?? attachment.height,
        durationMs: source.durationMs ?? attachment.durationMs,
      };

      updateDraft(draftId, (draft) => {
        if (draft.previewUrl && draft.previewUrl !== enrichedAttachment.previewUrl) {
          releasePreviewUrl(draft.previewUrl);
        }

        return {
          ...draft,
          status: 'ready',
          error: undefined,
          kind: enrichedAttachment.kind,
          name: enrichedAttachment.name,
          mimeType: enrichedAttachment.mimeType,
          sizeBytes: enrichedAttachment.sizeBytes,
          previewUrl:
            enrichedAttachment.previewUrl || enrichedAttachment.url || draft.previewUrl,
          attachment: enrichedAttachment,
        };
      });
    } catch (error) {
      updateDraft(draftId, (draft) => ({
        ...draft,
        status: 'error',
        error:
          error instanceof Error && error.message
            ? error.message
            : t('chat.input.uploadFailedGeneric'),
      }));
    }
  };

  const enqueueSource = async (source: ComposerDraftSource) => {
    const draftId = createDraftId('draft');
    const draftKind =
      source.type === 'blob'
        ? source.kind || inferAttachmentKind(source.contentType, source.fileName)
        : source.kind || 'file';
    const previewUrl =
      source.type === 'blob' ? draftPreviewUrl(draftKind, source.blob) : undefined;

    setDrafts((current) => [
      ...current,
      {
        id: draftId,
        status: 'uploading',
        kind: draftKind,
        name: source.type === 'blob' ? source.fileName : source.fileName || source.url,
        mimeType: source.type === 'blob' ? source.contentType : undefined,
        sizeBytes: source.type === 'blob' ? source.blob.size : undefined,
        previewUrl,
        source,
      },
    ]);
    setComposerError(null);

    await uploadDraft(draftId, source);
  };

  const enqueueFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    await Promise.all(
      files.map(async (file) => {
        const source = await buildBlobSource(file, file.name);
        await enqueueSource(source);
      }),
    );
  };

  const enqueueDesktopPaths = async (paths: string[]) => {
    if (paths.length === 0) {
      return;
    }

    await Promise.all(
      paths.map(async (path) => {
        const [bytes, pathInfo] = await Promise.all([
          platform.readBinaryFile(path),
          platform.getPathInfo(path),
        ]);
        const fileName = pathInfo.name || path.split(/[\\/]/).at(-1) || 'attachment.bin';
        const contentType = mimeTypeFromFileName(fileName);
        const blob = new Blob([new Uint8Array(bytes)], {
          type: contentType,
        });
        const source = await buildBlobSource(blob, fileName);
        await enqueueSource(source);
      }),
    );
  };

  const removeDraft = (draftId: string) => {
    setDrafts((current) => {
      const draft = current.find((entry) => entry.id === draftId);
      if (draft?.previewUrl) {
        releasePreviewUrl(draft.previewUrl);
      }

      return current.filter((entry) => entry.id !== draftId);
    });
    setComposerError(null);
  };

  const retryDraft = async (draftId: string) => {
    const draft = draftsRef.current.find((entry) => entry.id === draftId);
    if (!draft) {
      return;
    }

    updateDraft(draftId, (current) => ({
      ...current,
      status: 'uploading',
      error: undefined,
    }));
    setComposerError(null);
    await uploadDraft(draftId, draft.source);
  };

  const clearDrafts = () => {
    setDrafts((current) => {
      current.forEach((draft) => {
        releasePreviewUrl(draft.previewUrl);
      });
      return [];
    });
  };

  const handleSend = async () => {
    if (hasUploadingDrafts) {
      setComposerError(t('chat.input.waitForUploads'));
      return;
    }

    if (isRecording) {
      setComposerError(t('chat.input.stopRecordingBeforeSend'));
      return;
    }

    if (isRecordingFinalizing) {
      setComposerError(t('chat.input.waitForRecording'));
      return;
    }

    if (!canSend || sendInvocationLockRef.current) {
      return;
    }

    sendInvocationLockRef.current = true;
    setIsSendingMessage(true);
    try {
      const handled = await onSend({
        text: message.trim(),
        attachments: readyAttachments.map((attachment) => ({ ...attachment })),
      });
      if (handled === false) {
        restoreTextareaFocus();
        return;
      }
      clearDrafts();
      setMessage('');
      setRemoteUrl('');
      setRemoteUrlFileName('');
      setShowUrlImport(false);
      setComposerError(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      restoreTextareaFocus();
    } catch (error) {
      setComposerError(
        error instanceof Error && error.message
          ? error.message
          : t('chat.input.uploadFailedGeneric'),
      );
    } finally {
      sendInvocationLockRef.current = false;
      if (!isUnmountingRef.current) {
        setIsSendingMessage(false);
      }
    }
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }

    await enqueueFiles(files);
    restoreTextareaFocus();
  };

  const openBrowserFilePicker = (mode: BrowserFilePickerMode) => {
    setBrowserFilePickerMode(mode);
    requestAnimationFrame(() => {
      fileInputRef.current?.click();
    });
  };

  const handlePickFiles = async (mode: BrowserFilePickerMode) => {
    setComposerError(null);

    if (isDesktopPlatform) {
      try {
        const selectedPaths = await platform.selectFile({
          multiple: true,
          title: mode === 'image' ? t('chat.input.uploadImage') : t('chat.input.attachFile'),
          filters:
            mode === 'image'
              ? [
                  {
                    name: 'Images',
                    extensions: IMAGE_EXTENSIONS,
                  },
                ]
              : undefined,
        });

        if (selectedPaths.length > 0) {
          await enqueueDesktopPaths(selectedPaths);
        }

        restoreTextareaFocus();
        return;
      } catch (error) {
        setComposerError(
          error instanceof Error && error.message
            ? error.message
            : t('chat.input.uploadFailedGeneric'),
        );
        restoreTextareaFocus();
        return;
      }
    }

    openBrowserFilePicker(mode);
  };

  const handleImportRemoteUrl = async () => {
    const trimmedUrl = remoteUrl.trim();
    const trimmedFileName = remoteUrlFileName.trim();

    if (
      !canImportChatComposerRemoteUrl({
        isImportingRemoteUrl,
        remoteUrl: trimmedUrl,
      })
    ) {
      return;
    }

    if (!isValidRemoteUrl(trimmedUrl)) {
      setComposerError(t('chat.input.invalidUrl'));
      return;
    }

    setIsImportingRemoteUrl(true);
    setComposerError(null);

    try {
      await enqueueSource({
        type: 'remoteUrl',
        url: trimmedUrl,
        fileName: trimmedFileName || undefined,
      });
      setRemoteUrl('');
      setRemoteUrlFileName('');
      setShowUrlImport(false);
      restoreTextareaFocus();
    } finally {
      if (!isUnmountingRef.current) {
        setIsImportingRemoteUrl(false);
      }
    }
  };

  const handleUrlImportKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      !shouldConfirmChatComposerFieldOnEnter({
        key: event.key,
        isComposing: event.nativeEvent.isComposing,
        keyCode:
          typeof event.nativeEvent.keyCode === 'number' ? event.nativeEvent.keyCode : null,
      })
    ) {
      return;
    }

    event.preventDefault();
    void handleImportRemoteUrl();
  };

  const handleCaptureScreenshot = async () => {
    if (!supportsNativeScreenshot) {
      setComposerError(t('chat.input.nativeScreenshotUnavailable'));
      return;
    }

    try {
      const screenshot = await platform.captureScreenshot();
      if (!screenshot) {
        setComposerError(t('chat.input.nativeScreenshotUnavailable'));
        return;
      }

      const blob = new Blob([new Uint8Array(screenshot.bytes)], {
        type: screenshot.mimeType || 'image/png',
      });
      const source = await buildBlobSource(
        blob,
        screenshot.fileName || sanitizeRecorderFileName('screenshot', 'png'),
        'screenshot',
      );
      await enqueueSource({
        ...source,
        width: screenshot.width ?? source.width,
        height: screenshot.height ?? source.height,
        kind: 'screenshot',
      });
      restoreTextareaFocus();
    } catch (error) {
      setComposerError(
        error instanceof Error && error.message
          ? error.message
          : t('chat.input.nativeScreenshotUnavailable'),
      );
    }
  };

  const startRecording = async (kind: 'audio' | 'screen-recording') => {
    if (kind === 'audio' && !supportsVoiceRecording) {
      setComposerError(t('chat.input.recordingPermissionDenied'));
      return;
    }

    if (kind === 'screen-recording' && !supportsScreenRecording) {
      setComposerError(t('chat.input.screenRecordingDenied'));
      return;
    }

    try {
      const audioMimeType = pickSupportedMimeType([
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ]);
      const videoMimeType = pickSupportedMimeType([
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ]);

      let stream: MediaStream;
      if (kind === 'audio') {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
      } else {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
        } catch (error) {
          if (error instanceof Error && error.name !== 'NotAllowedError') {
            stream = await navigator.mediaDevices.getDisplayMedia({
              video: true,
            });
          } else {
            throw error;
          }
        }
      }

      const mimeType = kind === 'audio' ? audioMimeType : videoMimeType;
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      let finalized = false;
      let discardRequested = false;

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      });

      recorder.addEventListener('error', () => {
        stopMediaStream(stream);
        if (isUnmountingRef.current) {
          return;
        }
        setActiveRecorder(null);
        setRecorderElapsedMs(0);
        setIsRecordingFinalizing(false);
        setComposerError(t('chat.input.recordingFailed'));
      });

      recorder.addEventListener('stop', () => {
        if (finalized) {
          return;
        }

        finalized = true;
        stopMediaStream(stream);

        const actualMimeType =
          recorder.mimeType ||
          mimeType ||
          (kind === 'audio' ? 'audio/webm' : 'video/webm');
        const blob = new Blob(chunks, {
          type: actualMimeType,
        });

        const shouldPersistRecording = shouldPersistChatComposerRecording({
          blobSize: blob.size,
          discardRequested,
          isUnmounting: isUnmountingRef.current,
        });

        if (!isUnmountingRef.current) {
          setActiveRecorder(null);
          setRecorderElapsedMs(0);
        }

        if (!shouldPersistRecording) {
          if (!isUnmountingRef.current) {
            setIsRecordingFinalizing(false);
            restoreTextareaFocus();
          }
          return;
        }

        setIsRecordingFinalizing(true);

        const extension = extensionFromMimeType(
          actualMimeType,
          kind === 'audio' ? 'webm' : 'webm',
        );
        const fileName = sanitizeRecorderFileName(
          kind === 'audio' ? 'voice' : 'screen-recording',
          extension,
        );

        void buildBlobSource(
          blob,
          fileName,
          kind === 'audio' ? 'audio' : 'screen-recording',
        )
          .then((source) => {
            if (isUnmountingRef.current) {
              return;
            }
            setIsRecordingFinalizing(false);
            return enqueueSource(source);
          })
          .then(() => {
            if (!isUnmountingRef.current) {
              restoreTextareaFocus();
            }
          })
          .catch((error) => {
            if (!isUnmountingRef.current) {
              setIsRecordingFinalizing(false);
              setComposerError(
                error instanceof Error && error.message
                  ? error.message
                  : t('chat.input.recordingFailed'),
              );
            }
          });
      });

      const videoTrack = kind === 'screen-recording' ? stream.getVideoTracks()[0] : undefined;
      const handleVideoTrackEnded = () => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      };

      if (videoTrack) {
        videoTrack.addEventListener('ended', handleVideoTrackEnded);
        recorder.addEventListener('stop', () => {
          videoTrack.removeEventListener('ended', handleVideoTrackEnded);
        }, { once: true });
      }

      recorder.start(250);
      setComposerError(null);
      setRecorderElapsedMs(0);
      setIsRecordingFinalizing(false);
      setActiveRecorder({
        kind,
        startedAt: Date.now(),
        stop: (options) => {
          discardRequested = options?.discard === true;
          if (recorder.state !== 'inactive') {
            recorder.stop();
            return;
          }

          if (!finalized) {
            finalized = true;
            stopMediaStream(stream);
          }
        },
      });
    } catch (error) {
      const errorName = error instanceof Error ? error.name : '';
      const errorKey = resolveRecorderStartErrorKey(kind, errorName);
      if (errorKey) {
        setComposerError(t(errorKey));
      }
      setIsRecordingFinalizing(false);
    }
  };

  const handleToggleVoiceRecording = async () => {
    if (activeRecorder?.kind === 'audio') {
      activeRecorder.stop();
      return;
    }

    if (activeRecorder) {
      setComposerError(t('chat.input.stopRecordingBeforeSend'));
      return;
    }

    if (isRecordingFinalizing) {
      setComposerError(t('chat.input.waitForRecording'));
      return;
    }

    await startRecording('audio');
  };

  const handleToggleScreenRecording = async () => {
    if (activeRecorder?.kind === 'screen-recording') {
      activeRecorder.stop();
      return;
    }

    if (activeRecorder) {
      setComposerError(t('chat.input.stopRecordingBeforeSend'));
      return;
    }

    if (isRecordingFinalizing) {
      setComposerError(t('chat.input.waitForRecording'));
      return;
    }

    await startRecording('screen-recording');
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      !shouldSendChatComposerMessageOnEnter({
        key: event.key,
        shiftKey: event.shiftKey,
        isLoading: Boolean(isLoading),
        isComposing: event.nativeEvent.isComposing,
        keyCode:
          typeof event.nativeEvent.keyCode === 'number' ? event.nativeEvent.keyCode : null,
      })
    ) {
      return;
    }

    event.preventDefault();
    void handleSend();
  };

  const handleTextareaPaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = extractTransferFiles(event.clipboardData);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    await enqueueFiles(files);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    const hasFiles =
      Array.from(event.dataTransfer.types).includes('Files') ||
      Array.from(event.dataTransfer.types).includes('text/uri-list');
    if (!hasFiles) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (isDragging) {
      event.preventDefault();
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);

    const files = extractTransferFiles(event.dataTransfer);
    if (files.length > 0) {
      await enqueueFiles(files);
      restoreTextareaFocus();
      return;
    }

    const droppedUrl = extractDroppedUrl(event.dataTransfer);
    if (droppedUrl) {
      setShowUrlImport(true);
      setRemoteUrl(droppedUrl);
      setComposerError(null);
    }
  };

  useEffect(() => {
    setSupportsNativeScreenshot(platform.supportsNativeScreenshot());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || supportsNativeScreenshot || !isDesktopPlatform) {
      return;
    }

    return startNativeScreenshotSupportProbe({
      platformKind: 'desktop',
      readSupport: () => platform.supportsNativeScreenshot(),
      onSupportDetected: () => {
        setSupportsNativeScreenshot(true);
      },
      schedule: (callback, delayMs) => window.setTimeout(callback, delayMs),
      clearSchedule: (handle) => {
        window.clearTimeout(handle as number);
      },
    });
  }, [isDesktopPlatform, supportsNativeScreenshot]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${scrollHeight}px`;
    textarea.style.overflowY = scrollHeight > 320 ? 'auto' : 'hidden';
  }, [message]);

  useEffect(() => {
    if (!showModelDropdown) {
      setModelDropdownStyle(null);
      return;
    }

    updateModelDropdownPosition();

    let repositionFrame: number | null = null;
    const handleReposition = () => {
      if (repositionFrame !== null) {
        return;
      }

      repositionFrame = window.requestAnimationFrame(() => {
        repositionFrame = null;
        updateModelDropdownPosition();
      });
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModelDropdown(false);
        restoreTextareaFocus();
      }
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('keydown', handleEscape);
      if (repositionFrame !== null) {
        window.cancelAnimationFrame(repositionFrame);
      }
    };
  }, [showModelDropdown, activeChannel?.id]);

  useEffect(() => {
    if (!showModelDropdown) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      if (showModelChannelRail) {
        activeChannelOptionRef.current?.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        });
      }

      activeModelOptionRef.current?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [showModelChannelRail, showModelDropdown, activeChannel?.id, activeModel?.id]);

  useEffect(() => {
    if (!showUrlImport) {
      return;
    }

    requestAnimationFrame(() => {
      urlInputRef.current?.focus();
    });
  }, [showUrlImport]);

  useEffect(() => {
    if (!activeRecorder) {
      setRecorderElapsedMs(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setRecorderElapsedMs(Date.now() - activeRecorder.startedAt);
    }, 200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeRecorder]);

  useEffect(() => {
    return () => {
      isUnmountingRef.current = true;
      activeRecorderRef.current?.stop({
        discard: true,
      });
      draftsRef.current.forEach((draft) => {
        releasePreviewUrl(draft.previewUrl);
      });
    };
  }, []);

  const renderDraftPreview = (draft: ComposerDraftAttachment) => {
    const previewUrl = draft.previewUrl || draft.attachment?.previewUrl || draft.attachment?.url;

    if (previewUrl && (draft.kind === 'image' || draft.kind === 'screenshot')) {
      return (
        <img
          src={previewUrl}
          alt={draft.name}
          className="h-28 w-full rounded-2xl object-cover"
        />
      );
    }

    if (previewUrl && draft.kind === 'audio') {
      return <audio controls preload="metadata" className="w-full" src={previewUrl} />;
    }

    if (previewUrl && (draft.kind === 'video' || draft.kind === 'screen-recording')) {
      return (
        <video
          controls
          preload="metadata"
          className="h-28 w-full rounded-2xl bg-zinc-950 object-cover"
          src={previewUrl}
        />
      );
    }

    const Icon = attachmentKindIcon(draft.kind);
    return (
      <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60">
        <div className="flex flex-col items-center gap-2 text-zinc-500 dark:text-zinc-400">
          <Icon className="h-6 w-6" />
          <span className="text-xs font-medium">
            {t(attachmentKindLabelKey(draft.kind))}
          </span>
        </div>
      </div>
    );
  };

  const statusState = resolveChatComposerStatusState({
    composerError,
    activeRecorderKind: activeRecorder?.kind ?? null,
    isRecordingFinalizing,
    hasUploadingDrafts,
  });
  const statusLabel =
    statusState === 'error'
      ? composerError
      : statusState === 'recording-audio' || statusState === 'recording-screen'
        ? `${t(
            statusState === 'recording-audio'
              ? 'chat.input.recordingVoice'
              : 'chat.input.recordingScreen',
          )} / ${formatRecorderDuration(recorderElapsedMs)}`
        : statusState === 'finalizing'
          ? t('chat.input.preparingRecording')
          : statusState === 'uploading'
            ? t('chat.input.uploading')
            : null;

  return (
    <div className="relative w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={browserFilePickerMode === 'image' ? 'image/*' : undefined}
        className="hidden"
        onChange={(event) => {
          void handleFileInputChange(event);
        }}
      />

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(event) => {
          void handleDrop(event);
        }}
        className={cn(
          CHAT_SURFACE_INPUT_CLASS,
          'relative flex w-full flex-col overflow-visible rounded-[18px] px-2 py-1.5 shadow-[0_-10px_24px_rgba(15,23,42,0.06)] backdrop-blur-xl transition-all duration-300 dark:shadow-[0_-14px_34px_rgba(0,0,0,0.24)] sm:rounded-[20px] sm:px-2.5 sm:py-2',
          isDragging
            ? 'overflow-hidden border-primary-300/70 bg-zinc-50/96 shadow-[0_22px_60px_rgba(59,130,246,0.14)] ring-2 ring-primary-500/16 dark:border-primary-500/30 dark:bg-zinc-900/84 dark:ring-primary-400/20 dark:shadow-[0_22px_60px_rgba(15,23,42,0.38)]'
            : showElevatedSurface
              ? 'bg-zinc-50/94 shadow-[0_-14px_32px_rgba(15,23,42,0.08)] dark:bg-zinc-900/76 dark:shadow-[0_-16px_36px_rgba(0,0,0,0.28)]'
              : null,
        )}
      >
        <AnimatePresence>
          {isDragging ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-primary-500/8 backdrop-blur-sm"
            >
              <div className="rounded-3xl border border-primary-500/30 bg-zinc-50/95 px-6 py-5 text-center shadow-lg dark:bg-zinc-900/95">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-300">
                  <Paperclip className="h-6 w-6" />
                </div>
                <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('chat.input.dropFiles')}
                </div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {t('chat.input.dropFilesHint')}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex flex-col gap-2.5 px-1 py-1.5 sm:px-2 sm:py-2">
          {drafts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {drafts.map((draft) => {
                const DraftIcon = attachmentKindIcon(draft.kind);
                const detailParts = [
                  t(attachmentKindLabelKey(draft.kind)),
                  formatDraftSize(draft.sizeBytes),
                ].filter(Boolean);
                const statusToneClassName =
                  draft.status === 'ready'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : draft.status === 'error'
                      ? 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                      : 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';

                return (
                  <div
                    key={draft.id}
                    className={cn(
                      CHAT_SURFACE_PANEL_CLASS,
                      'overflow-hidden rounded-[18px] p-3 shadow-sm',
                    )}
                  >
                    {renderDraftPreview(draft)}
                    <div className="mt-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-zinc-900/6 text-zinc-700 dark:bg-zinc-100/10 dark:text-zinc-200">
                            <DraftIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {draft.name}
                            </div>
                            {detailParts.length > 0 ? (
                              <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                {detailParts.join(' / ')}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
                              statusToneClassName,
                            )}
                          >
                            {draft.status === 'uploading' ? (
                              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : draft.status === 'ready' ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5" />
                            )}
                            {draft.status === 'uploading'
                              ? t('chat.input.uploading')
                              : draft.status === 'ready'
                                ? t('chat.input.ready')
                                : t('chat.input.failed')}
                          </span>
                          {draft.error ? (
                            <span className="truncate text-xs text-rose-600 dark:text-rose-300">
                              {draft.error}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {draft.status === 'error' ? (
                          <button
                            type="button"
                            onClick={() => {
                              void retryDraft(draft.id);
                            }}
                            className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/10"
                          >
                            <LoaderCircle className="h-3.5 w-3.5" />
                            {t('chat.input.retryUpload')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeDraft(draft.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                          title={t('chat.input.removeAttachment')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <AnimatePresence initial={false}>
            {showUrlImport ? (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={cn(
                  CHAT_SURFACE_PANEL_CLASS,
                  'rounded-[18px] p-4',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t('chat.input.importUrl')}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {t('chat.input.importUrlHint')}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isImportingRemoteUrl}
                    onClick={() => {
                      if (isImportingRemoteUrl) {
                        return;
                      }
                      setShowUrlImport(false);
                      setComposerError(null);
                      restoreTextareaFocus();
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-200/80 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                    title={t('common.close')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  <Input
                    ref={urlInputRef}
                    type="url"
                    value={remoteUrl}
                    disabled={isImportingRemoteUrl}
                    onChange={(event) => setRemoteUrl(event.target.value)}
                    onKeyDown={handleUrlImportKeyDown}
                    placeholder={t('chat.input.urlPlaceholder')}
                    className={cn(CHAT_SURFACE_INPUT_CLASS, 'h-11 rounded-2xl px-4')}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Input
                      type="text"
                      value={remoteUrlFileName}
                      disabled={isImportingRemoteUrl}
                      onChange={(event) => setRemoteUrlFileName(event.target.value)}
                      onKeyDown={handleUrlImportKeyDown}
                      placeholder={t('chat.input.urlFileNamePlaceholder')}
                      className={cn(
                        CHAT_SURFACE_INPUT_CLASS,
                        'h-11 flex-1 rounded-2xl px-4',
                      )}
                    />
                    <button
                      type="button"
                      disabled={isImportingRemoteUrl}
                      onClick={() => {
                        void handleImportRemoteUrl();
                      }}
                      className={cn(
                        'inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-medium transition-transform',
                        isImportingRemoteUrl
                          ? 'bg-zinc-300 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          : 'bg-zinc-900 text-white hover:scale-[1.01] dark:bg-zinc-100 dark:text-zinc-900',
                      )}
                    >
                      {isImportingRemoteUrl ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        t('chat.input.importAction')
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              if (composerError) {
                setComposerError(null);
              }
            }}
            onKeyDown={handleTextareaKeyDown}
            onPaste={(event) => {
              void handleTextareaPaste(event);
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={t('chat.input.placeholder')}
            className="min-h-[48px] max-h-[220px] w-full resize-none rounded-none border-none bg-transparent px-0 py-0.5 text-[14px] leading-6 text-zinc-900 shadow-none placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent dark:text-zinc-50 dark:placeholder:text-zinc-500"
            rows={1}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                onClick={() => {
                  void handlePickFiles('all');
                }}
                className={actionButtonClassName}
                title={t('chat.input.attachFile')}
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  void handlePickFiles('image');
                }}
                className={actionButtonClassName}
                title={t('chat.input.uploadImage')}
              >
                <ImageIcon className="h-4 w-4" />
              </button>

              {supportsNativeScreenshot ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleCaptureScreenshot();
                  }}
                  className={actionButtonClassName}
                  title={t('chat.input.captureScreenshot')}
                >
                  <Camera className="h-4 w-4" />
                </button>
              ) : null}

              {supportsScreenRecording ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleToggleScreenRecording();
                  }}
                  className={cn(
                    actionButtonClassName,
                    activeRecorder?.kind === 'screen-recording' &&
                      'bg-rose-500/10 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
                  )}
                  title={
                    activeRecorder?.kind === 'screen-recording'
                      ? t('chat.input.stopRecording')
                      : t('chat.input.startScreenRecording')
                  }
                >
                  {activeRecorder?.kind === 'screen-recording' ? (
                    <StopCircle className="h-4 w-4" />
                  ) : (
                    <MonitorUp className="h-4 w-4" />
                  )}
                </button>
              ) : null}

              <div className="relative min-w-0">
                <button
                  ref={modelTriggerRef}
                  type="button"
                  onClick={() => setShowModelDropdown((current) => !current)}
                  className={modelTriggerClassName}
                  title={modelTriggerLabel}
                  aria-label={modelTriggerLabel}
                  aria-expanded={showModelDropdown}
                  aria-haspopup="dialog"
                  aria-controls={showModelDropdown ? modelDropdownId : undefined}
                >
                  <BrainCircuit className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-300" />
                  <span className="min-w-0 flex-1 truncate max-w-[8.5rem] sm:max-w-[12rem] lg:max-w-[16rem] text-left text-xs font-medium">
                    {modelTriggerLabel}
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform dark:text-zinc-400',
                      showModelDropdown && 'rotate-180',
                    )}
                  />
                </button>
              </div>
            </div>

            <div
              className={cn(
                'flex items-center gap-2.5 sm:justify-end',
                statusLabel ? 'justify-between' : 'justify-end',
              )}
            >
              {statusLabel ? (
                <div
                  className={cn(
                    'min-w-0 text-xs font-medium',
                    composerError
                      ? 'text-rose-600 dark:text-rose-300'
                      : activeRecorder
                        ? 'text-rose-600 dark:text-rose-300'
                        : 'text-zinc-500 dark:text-zinc-400',
                  )}
                >
                  <span className="line-clamp-2">{statusLabel}</span>
                </div>
              ) : null}

              {supportsVoiceRecording ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleToggleVoiceRecording();
                  }}
                  className={cn(
                    sendSideActionButtonClassName,
                    activeRecorder?.kind === 'audio' &&
                      'border-rose-200 bg-rose-500/10 text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
                  )}
                  title={
                    activeRecorder?.kind === 'audio'
                      ? t('chat.input.stopRecording')
                      : t('chat.input.voiceInput')
                  }
                >
                  {activeRecorder?.kind === 'audio' ? (
                    <StopCircle className="h-[18px] w-[18px]" />
                  ) : (
                    <Mic className="h-[18px] w-[18px]" />
                  )}
                </button>
              ) : null}

              <AnimatePresence mode="wait">
                {isLoading && canStop ? (
                  <motion.button
                    key="stop"
                    type="button"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    onClick={onStop}
                    className="group flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm transition-all duration-300 hover:scale-105 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900"
                    title={t('chat.input.stopGenerating')}
                  >
                    <StopCircle className="h-[18px] w-[18px] transition-colors group-hover:text-red-400" />
                  </motion.button>
                ) : isLoading ? (
                  <motion.button
                    key="loading"
                    type="button"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    disabled
                    aria-disabled
                    title={t('common.loading')}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    <LoaderCircle className="h-[18px] w-[18px] animate-spin" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="send"
                    type="button"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    onClick={() => {
                      void handleSend();
                    }}
                    disabled={!canSend}
                    title={t('chat.input.sendMessage')}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300',
                      canSend
                        ? 'bg-zinc-900 text-white shadow-sm hover:scale-105 active:scale-95 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
                    )}
                  >
                    <Send className="h-[18px] w-[18px]" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {showModelDropdown && modelDropdownStyle && typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              <div
                className="fixed inset-0 z-[70]"
                onClick={() => {
                  setShowModelDropdown(false);
                  restoreTextareaFocus();
                }}
              />
              <motion.div
                id={modelDropdownId}
                role="dialog"
                aria-label={t('chat.page.selectModel')}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.15 }}
                style={modelDropdownStyle}
                className="fixed z-[80] flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_24px_70px_rgba(0,0,0,0.42)] sm:flex-row"
              >
                {showModelChannelRail ? (
                  <div className="overflow-y-auto border-b border-zinc-100 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900/70 sm:w-[220px] sm:border-b-0 sm:border-r">
                    <div className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      {t('chat.page.channels')}
                    </div>
                    <div className="mt-1 space-y-1">
                      {channels.map((channel) => (
                        <button
                          key={channel.id}
                          ref={activeChannel?.id === channel.id ? activeChannelOptionRef : null}
                          type="button"
                          onClick={() => onChannelChange(channel.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                            activeChannel?.id === channel.id
                              ? 'border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800'
                              : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800/60',
                          )}
                        >
                          <span className="text-lg">{channel.icon}</span>
                          <span
                            className={cn(
                              'truncate text-sm font-medium',
                              activeChannel?.id === channel.id
                                ? 'text-zinc-900 dark:text-zinc-100'
                                : 'text-zinc-600 dark:text-zinc-400',
                            )}
                          >
                            {channel.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="min-w-0 flex-1 overflow-y-auto bg-white p-2 dark:bg-zinc-900">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      {t('chat.page.models')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModelDropdown(false);
                        onOpenModelConfig?.();
                      }}
                      className="flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400"
                    >
                      <Settings2 className="h-3 w-3" />
                      {t('chat.page.config')}
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {activeChannel?.models.map((model) => (
                      <button
                        key={model.id}
                        ref={activeModel?.id === model.id ? activeModelOptionRef : null}
                        type="button"
                        onClick={() => {
                          if (!activeChannel) {
                            return;
                          }

                          onModelChange(activeChannel.id, model.id);
                          setShowModelDropdown(false);
                          restoreTextareaFocus();
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors',
                          activeModel?.id === model.id
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800',
                        )}
                      >
                        <span className="truncate text-sm font-medium">{model.name}</span>
                        {activeModel?.id === model.id ? (
                          <Check className="h-4 w-4 shrink-0" />
                        ) : null}
                      </button>
                    ))}
                    {!activeChannel?.models || activeChannel.models.length === 0 ? (
                      <div className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        {t('chat.page.noModels')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
