import type { ChatModel } from '../types/index.ts';

export type ChatComposerModelStatus =
  | 'idle'
  | 'streaming-current-model'
  | 'streaming-next-model-selected';

export interface ChatComposerModelState {
  selectedModelName: string;
  inFlightModelName: string | null;
  nextModelName: string | null;
  status: ChatComposerModelStatus;
}

export interface ChatComposerSendAvailabilityInput {
  hasActiveModel: boolean;
  isLoading: boolean;
  hasUploadingDrafts: boolean;
  hasPendingSendRequest?: boolean;
  isImportingRemoteUrl?: boolean;
  isRecording: boolean;
  isRecordingFinalizing: boolean;
  hasReadyContent: boolean;
}

export interface ChatComposerRemoteImportAvailabilityInput {
  isImportingRemoteUrl: boolean;
  remoteUrl: string;
}

export interface NativeScreenshotSupportProbeOptions {
  platformKind: 'web' | 'desktop';
  readSupport: () => boolean;
  onSupportDetected: () => void;
  schedule: (callback: () => void, delayMs: number) => unknown;
  clearSchedule: (handle: unknown) => void;
  intervalMs?: number;
}

export type ChatComposerRecorderKind = 'audio' | 'screen-recording';

export interface ChatComposerRecorderPersistenceInput {
  blobSize: number;
  discardRequested: boolean;
  isUnmounting: boolean;
}

export interface ChatComposerEnterKeyInput {
  key: string;
  isComposing: boolean;
  keyCode: number | null;
  shiftKey?: boolean;
  isLoading?: boolean;
}

interface DeriveChatComposerModelStateParams {
  activeModel?: Pick<ChatModel, 'name'> | null;
  inFlightModelName?: string | null;
  isLoading: boolean;
}

const UNKNOWN_MODEL_NAME = 'Unknown Model';

export function canSendChatComposerPayload({
  hasActiveModel,
  isLoading,
  hasUploadingDrafts,
  hasPendingSendRequest = false,
  isImportingRemoteUrl = false,
  isRecording,
  isRecordingFinalizing,
  hasReadyContent,
}: ChatComposerSendAvailabilityInput) {
  return (
    hasActiveModel &&
    !isLoading &&
    !hasUploadingDrafts &&
    !hasPendingSendRequest &&
    !isImportingRemoteUrl &&
    !isRecording &&
    !isRecordingFinalizing &&
    hasReadyContent
  );
}

export function canImportChatComposerRemoteUrl({
  isImportingRemoteUrl,
  remoteUrl,
}: ChatComposerRemoteImportAvailabilityInput) {
  return !isImportingRemoteUrl && remoteUrl.trim().length > 0;
}

export function startNativeScreenshotSupportProbe({
  platformKind,
  readSupport,
  onSupportDetected,
  schedule,
  clearSchedule,
  intervalMs = 250,
}: NativeScreenshotSupportProbeOptions) {
  if (platformKind !== 'desktop') {
    return () => {};
  }

  if (readSupport()) {
    onSupportDetected();
    return () => {};
  }

  const nextDelayMs = Math.max(50, intervalMs);
  let active = true;
  let currentHandle: unknown = null;

  const poll = () => {
    if (!active) {
      return;
    }

    if (readSupport()) {
      currentHandle = null;
      onSupportDetected();
      return;
    }

    currentHandle = schedule(poll, nextDelayMs);
  };

  currentHandle = schedule(poll, nextDelayMs);

  return () => {
    active = false;
    if (currentHandle !== null) {
      clearSchedule(currentHandle);
      currentHandle = null;
    }
  };
}

export function resolveRecorderStartErrorKey(
  kind: ChatComposerRecorderKind,
  errorName: string,
) {
  if (kind === 'screen-recording' && errorName === 'AbortError') {
    return null;
  }

  if (kind === 'audio') {
    return errorName === 'NotAllowedError'
      ? 'chat.input.recordingPermissionDenied'
      : 'chat.input.recordingFailed';
  }

  return errorName === 'NotAllowedError'
    ? 'chat.input.screenRecordingDenied'
    : 'chat.input.recordingFailed';
}

export function shouldPersistChatComposerRecording({
  blobSize,
  discardRequested,
  isUnmounting,
}: ChatComposerRecorderPersistenceInput) {
  return blobSize > 0 && !discardRequested && !isUnmounting;
}

export function shouldSendChatComposerMessageOnEnter({
  key,
  isComposing,
  keyCode,
  shiftKey = false,
  isLoading = false,
}: ChatComposerEnterKeyInput) {
  return (
    key === 'Enter' &&
    !shiftKey &&
    !isLoading &&
    !isComposing &&
    keyCode !== 229
  );
}

export function shouldConfirmChatComposerFieldOnEnter({
  key,
  isComposing,
  keyCode,
}: Pick<ChatComposerEnterKeyInput, 'key' | 'isComposing' | 'keyCode'>) {
  return key === 'Enter' && !isComposing && keyCode !== 229;
}

export function deriveChatComposerModelState({
  activeModel,
  inFlightModelName = null,
  isLoading,
}: DeriveChatComposerModelStateParams): ChatComposerModelState {
  const selectedModelName = activeModel?.name || UNKNOWN_MODEL_NAME;

  if (!isLoading || !inFlightModelName) {
    return {
      selectedModelName,
      inFlightModelName: null,
      nextModelName: null,
      status: 'idle',
    };
  }

  if (inFlightModelName === selectedModelName) {
    return {
      selectedModelName,
      inFlightModelName,
      nextModelName: null,
      status: 'streaming-current-model',
    };
  }

  return {
    selectedModelName,
    inFlightModelName,
    nextModelName: selectedModelName,
    status: 'streaming-next-model-selected',
  };
}
