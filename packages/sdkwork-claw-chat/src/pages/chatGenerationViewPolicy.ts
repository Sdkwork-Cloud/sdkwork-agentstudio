import type { ChatRunStateBinding } from '../services';

export function resolveChatGenerationViewState(params: {
  effectiveActiveSessionId: string | null;
  pendingSendSessionId: string | null;
  activeRunBinding: ChatRunStateBinding | null | undefined;
  runningRunBinding: ChatRunStateBinding | null | undefined;
}) {
  const activeRunSessionId =
    params.activeRunBinding?.sessionId ?? params.effectiveActiveSessionId ?? null;
  const activeRunIsGenerating = Boolean(params.activeRunBinding?.isActive && activeRunSessionId);
  const runningRunIsGenerating = Boolean(
    params.runningRunBinding?.isActive && params.runningRunBinding?.sessionId,
  );
  const stopRunBinding =
    (params.pendingSendSessionId
      ? {
          sessionId: params.pendingSendSessionId,
          runId: null,
          isActive: false,
        }
      : null) ||
    (activeRunIsGenerating
      ? {
          sessionId: activeRunSessionId,
          runId: params.activeRunBinding?.runId ?? null,
          isActive: true,
        }
      : null) ||
    (runningRunIsGenerating
      ? {
          sessionId: params.runningRunBinding?.sessionId ?? null,
          runId: params.runningRunBinding?.runId ?? null,
          isActive: true,
        }
      : null);
  const isActiveSessionGenerating =
    activeRunIsGenerating ||
    Boolean(
      params.effectiveActiveSessionId &&
      params.pendingSendSessionId === params.effectiveActiveSessionId,
    );

  return {
    isComposerLocked: Boolean(
      params.pendingSendSessionId || runningRunIsGenerating || activeRunIsGenerating,
    ),
    isActiveSessionGenerating,
    stopRunBinding,
  };
}
