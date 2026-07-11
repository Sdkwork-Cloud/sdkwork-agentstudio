interface ChatComposerStatusStateInput {
  composerError: string | null;
  activeRecorderKind: 'audio' | 'screen-recording' | null;
  isRecordingFinalizing: boolean;
  hasUploadingDrafts: boolean;
}

export type ChatComposerStatusState =
  | 'idle'
  | 'error'
  | 'recording-audio'
  | 'recording-screen'
  | 'finalizing'
  | 'uploading';

export function resolveChatComposerStatusState(
  input: ChatComposerStatusStateInput,
): ChatComposerStatusState {
  if (input.composerError) {
    return 'error';
  }

  if (input.activeRecorderKind === 'audio') {
    return 'recording-audio';
  }

  if (input.activeRecorderKind === 'screen-recording') {
    return 'recording-screen';
  }

  if (input.isRecordingFinalizing) {
    return 'finalizing';
  }

  if (input.hasUploadingDrafts) {
    return 'uploading';
  }

  return 'idle';
}
