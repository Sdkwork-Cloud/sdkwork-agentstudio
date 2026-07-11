import {
  resolveChatThinkingLevelDefaultOption,
  resolveChatThinkingLevelOptions,
} from '../services';
import type {
  ChatPageSessionControlOption,
  ChatPageTranslate,
} from './chatPageContracts';

export interface UseChatSessionControlOptionsStateInput {
  t: ChatPageTranslate;
  activeThinkingModelId: string | null;
}

export interface UseChatSessionControlOptionsStateResult {
  thinkingLevelDefaultLabel: string;
  thinkingLevelOptions: ChatPageSessionControlOption[];
  fastModeDefaultLabel: string;
  fastModeOptions: ChatPageSessionControlOption[];
  verboseLevelDefaultLabel: string;
  verboseLevelOptions: ChatPageSessionControlOption[];
  reasoningLevelDefaultLabel: string;
  reasoningLevelOptions: ChatPageSessionControlOption[];
}

export function useChatSessionControlOptionsState({
  t,
  activeThinkingModelId,
}: UseChatSessionControlOptionsStateInput): UseChatSessionControlOptionsStateResult {
  const thinkingLevelOptions = resolveChatThinkingLevelOptions(activeThinkingModelId).map((value) => ({
    value,
    label: t(`chat.page.thinkingLevels.${value}`),
  }));
  const resolvedThinkingLevelDefault = resolveChatThinkingLevelDefaultOption(activeThinkingModelId);
  const thinkingLevelDefaultLabel = resolvedThinkingLevelDefault
    ? t('chat.page.thinkingLevelDefaultResolved', {
        level: t(`chat.page.thinkingLevels.${resolvedThinkingLevelDefault}`),
      })
    : t('chat.page.thinkingLevelDefault');
  const sessionControlInheritLabel = t('chat.page.sessionControlInherit');
  const fastModeOptions = [
    {
      value: 'off',
      label: t('chat.page.fastModes.off'),
    },
    {
      value: 'on',
      label: t('chat.page.fastModes.on'),
    },
  ];
  const verboseLevelOptions = [
    {
      value: 'off',
      label: t('chat.page.verboseLevels.off'),
    },
    {
      value: 'on',
      label: t('chat.page.verboseLevels.on'),
    },
    {
      value: 'full',
      label: t('chat.page.verboseLevels.full'),
    },
  ];
  const reasoningLevelOptions = [
    {
      value: 'off',
      label: t('chat.page.reasoningLevels.off'),
    },
    {
      value: 'on',
      label: t('chat.page.reasoningLevels.on'),
    },
    {
      value: 'stream',
      label: t('chat.page.reasoningLevels.stream'),
    },
  ];

  return {
    thinkingLevelDefaultLabel,
    thinkingLevelOptions,
    fastModeDefaultLabel: sessionControlInheritLabel,
    fastModeOptions,
    verboseLevelDefaultLabel: sessionControlInheritLabel,
    verboseLevelOptions,
    reasoningLevelDefaultLabel: sessionControlInheritLabel,
    reasoningLevelOptions,
  };
}
