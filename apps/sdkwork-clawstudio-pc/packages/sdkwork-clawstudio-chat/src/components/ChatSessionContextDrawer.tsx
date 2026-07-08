import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Package, Search, Settings2, Sparkles, UserCircle, X } from 'lucide-react';
import {
  cn,
  Input,
  OverlaySurface,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/clawstudio-ui';
import {
  CHAT_SURFACE_CONTROL_CLASS,
  CHAT_SURFACE_DASHED_PANEL_CLASS,
  CHAT_SURFACE_ELEVATED_PANEL_CLASS,
  CHAT_SURFACE_INPUT_CLASS,
  CHAT_SURFACE_INSET_PANEL_CLASS,
  CHAT_SURFACE_PANEL_CLASS,
} from './chatChromeSurface';

export type ChatSessionContextStatusTone =
  | 'ready'
  | 'responding'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'unavailable';

export interface ChatSessionContextDrawerOption {
  id: string | null;
  name: string;
  description?: string | null;
  avatarLabel?: string | null;
}

export interface ChatSessionContextDrawerSelectOption {
  value: string;
  label: string;
}

type ChatSessionContextDrawerControlSection = {
  id: string;
  title: string;
  description: string;
  placeholder: string;
  currentValue: string | null;
  defaultLabel: string;
  options: ChatSessionContextDrawerSelectOption[];
  onSelect: (value: string | null) => void;
};

export interface ChatSessionContextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  statusLabel: string;
  statusTone: ChatSessionContextStatusTone;
  detailItems?: string[];
  currentChannelName?: string | null;
  currentModelName?: string | null;
  routeLabel?: string | null;
  errorMessage?: string | null;
  onOpenSettings?: () => void;
  currentThinkingLevel?: string | null;
  thinkingLevelDefaultLabel?: string | null;
  thinkingLevelOptions?: ChatSessionContextDrawerSelectOption[];
  onSelectThinkingLevel?: (thinkingLevel: string | null) => void;
  currentFastMode?: string | null;
  fastModeDefaultLabel?: string | null;
  fastModeOptions?: ChatSessionContextDrawerSelectOption[];
  onSelectFastMode?: (fastMode: string | null) => void;
  currentVerboseLevel?: string | null;
  verboseLevelDefaultLabel?: string | null;
  verboseLevelOptions?: ChatSessionContextDrawerSelectOption[];
  onSelectVerboseLevel?: (verboseLevel: string | null) => void;
  currentReasoningLevel?: string | null;
  reasoningLevelDefaultLabel?: string | null;
  reasoningLevelOptions?: ChatSessionContextDrawerSelectOption[];
  onSelectReasoningLevel?: (reasoningLevel: string | null) => void;
  agentOptions: ChatSessionContextDrawerOption[];
  selectedAgentId: string | null | undefined;
  isAgentLoading?: boolean;
  showAgentSection?: boolean;
  onSelectAgent: (agentId: string | null | undefined) => void;
  skillOptions: ChatSessionContextDrawerOption[];
  selectedSkillId: string | null;
  isSkillLoading?: boolean;
  showSkillSection?: boolean;
  onSelectSkill: (skillId: string | null) => void;
}

const CHAT_SESSION_CONTROL_DEFAULT_VALUE_PREFIX = '__session_control_default__';

function resolveStatusClasses(statusTone: ChatSessionContextStatusTone) {
  switch (statusTone) {
    case 'responding':
      return {
        badge: 'border-primary-500/20 bg-primary-500/10 text-primary-700 dark:text-primary-300',
        dot: 'bg-primary-500 dark:bg-primary-300',
      };
    case 'connected':
      return {
        badge: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        dot: 'bg-emerald-500 dark:bg-emerald-300',
      };
    case 'reconnecting':
      return {
        badge: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500 dark:bg-amber-300',
      };
    case 'disconnected':
      return {
        badge: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300',
        dot: 'bg-rose-500 dark:bg-rose-300',
      };
    case 'unavailable':
      return {
        badge: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        dot: 'bg-amber-500 dark:bg-amber-300',
      };
    default:
      return {
        badge:
          'border-zinc-200/80 bg-zinc-50/92 text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-900/82 dark:text-zinc-300',
        dot: 'bg-zinc-400 dark:bg-zinc-500',
      };
  }
}

function getOptionInitials(option: ChatSessionContextDrawerOption) {
  if (option.avatarLabel?.trim()) {
    return option.avatarLabel.trim().slice(0, 2).toUpperCase();
  }

  return option.name.trim().slice(0, 2).toUpperCase();
}

export function ChatSessionContextDrawer({
  isOpen,
  onClose,
  title,
  statusLabel,
  statusTone,
  detailItems = [],
  currentChannelName,
  currentModelName,
  routeLabel,
  errorMessage,
  onOpenSettings,
  currentThinkingLevel = null,
  thinkingLevelDefaultLabel = null,
  thinkingLevelOptions = [],
  onSelectThinkingLevel,
  currentFastMode = null,
  fastModeDefaultLabel = null,
  fastModeOptions = [],
  onSelectFastMode,
  currentVerboseLevel = null,
  verboseLevelDefaultLabel = null,
  verboseLevelOptions = [],
  onSelectVerboseLevel,
  currentReasoningLevel = null,
  reasoningLevelDefaultLabel = null,
  reasoningLevelOptions = [],
  onSelectReasoningLevel,
  agentOptions,
  selectedAgentId,
  isAgentLoading = false,
  showAgentSection = true,
  onSelectAgent,
  skillOptions,
  selectedSkillId,
  isSkillLoading = false,
  showSkillSection = true,
  onSelectSkill,
}: ChatSessionContextDrawerProps) {
  const { t } = useTranslation();
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [skillSearchQuery, setSkillSearchQuery] = useState('');
  const previousAgentOptionsKeyRef = useRef<string | null>(null);
  const previousSkillOptionsKeyRef = useRef<string | null>(null);
  const statusClasses = resolveStatusClasses(statusTone);

  const filteredAgentOptions = useMemo(() => {
    const normalizedQuery = agentSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return agentOptions;
    }

    return agentOptions.filter((option) => {
      const haystack = [option.name, option.description ?? ''].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [agentOptions, agentSearchQuery]);

  const filteredSkillOptions = useMemo(() => {
    const normalizedQuery = skillSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return skillOptions;
    }

    return skillOptions.filter((option) => {
      const haystack = [option.name, option.description ?? ''].join(' ').toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [skillOptions, skillSearchQuery]);
  const agentOptionsKey = useMemo(
    () =>
      agentOptions
        .map((option) => `${option.id ?? '__default__'}:${option.name}:${option.description ?? ''}`)
        .join('|'),
    [agentOptions],
  );
  const skillOptionsKey = useMemo(
    () =>
      skillOptions
        .map((option) => `${option.id ?? '__default__'}:${option.name}:${option.description ?? ''}`)
        .join('|'),
    [skillOptions],
  );
  const hasAgentSearchQuery = agentSearchQuery.trim().length > 0;
  const hasSkillSearchQuery = skillSearchQuery.trim().length > 0;

  useEffect(() => {
    if (isOpen && showAgentSection) {
      return;
    }
    setAgentSearchQuery('');
  }, [isOpen, showAgentSection]);

  useEffect(() => {
    if (isOpen && showSkillSection) {
      return;
    }
    setSkillSearchQuery('');
  }, [isOpen, showSkillSection]);

  useEffect(() => {
    if (!showAgentSection) {
      previousAgentOptionsKeyRef.current = agentOptionsKey;
      return;
    }

    const previousAgentOptionsKey = previousAgentOptionsKeyRef.current;
    previousAgentOptionsKeyRef.current = agentOptionsKey;

    if (
      !isOpen ||
      !hasAgentSearchQuery ||
      isAgentLoading ||
      !previousAgentOptionsKey ||
      previousAgentOptionsKey === agentOptionsKey ||
      filteredAgentOptions.length > 0
    ) {
      return;
    }

    setAgentSearchQuery('');
  }, [agentOptionsKey, filteredAgentOptions.length, hasAgentSearchQuery, isAgentLoading, isOpen, showAgentSection]);

  useEffect(() => {
    if (!showSkillSection) {
      previousSkillOptionsKeyRef.current = skillOptionsKey;
      return;
    }

    const previousSkillOptionsKey = previousSkillOptionsKeyRef.current;
    previousSkillOptionsKeyRef.current = skillOptionsKey;

    if (
      !isOpen ||
      !hasSkillSearchQuery ||
      isSkillLoading ||
      !previousSkillOptionsKey ||
      previousSkillOptionsKey === skillOptionsKey ||
      filteredSkillOptions.length > 0
    ) {
      return;
    }

    setSkillSearchQuery('');
  }, [hasSkillSearchQuery, isOpen, isSkillLoading, showSkillSection, skillOptionsKey, filteredSkillOptions.length]);

  const sessionControlSections = [
    onSelectThinkingLevel && thinkingLevelOptions.length > 0
      ? {
          id: 'thinking-level',
          title: t('chat.page.thinkingLevel'),
          description: t('chat.page.thinkingLevelDescription'),
          placeholder: t('chat.page.thinkingLevelPlaceholder'),
          currentValue: currentThinkingLevel,
          defaultLabel: thinkingLevelDefaultLabel || t('chat.page.thinkingLevelDefault'),
          options: thinkingLevelOptions,
          onSelect: onSelectThinkingLevel,
        }
      : null,
    onSelectFastMode && fastModeOptions.length > 0
      ? {
          id: 'fast-mode',
          title: t('chat.page.fastMode'),
          description: t('chat.page.fastModeDescription'),
          placeholder: t('chat.page.fastModePlaceholder'),
          currentValue: currentFastMode,
          defaultLabel: fastModeDefaultLabel || t('chat.page.sessionControlInherit'),
          options: fastModeOptions,
          onSelect: onSelectFastMode,
        }
      : null,
    onSelectVerboseLevel && verboseLevelOptions.length > 0
      ? {
          id: 'verbose-level',
          title: t('chat.page.verboseLevel'),
          description: t('chat.page.verboseLevelDescription'),
          placeholder: t('chat.page.verboseLevelPlaceholder'),
          currentValue: currentVerboseLevel,
          defaultLabel: verboseLevelDefaultLabel || t('chat.page.sessionControlInherit'),
          options: verboseLevelOptions,
          onSelect: onSelectVerboseLevel,
        }
      : null,
    onSelectReasoningLevel && reasoningLevelOptions.length > 0
      ? {
          id: 'reasoning-level',
          title: t('chat.page.reasoningLevel'),
          description: t('chat.page.reasoningLevelDescription'),
          placeholder: t('chat.page.reasoningLevelPlaceholder'),
          currentValue: currentReasoningLevel,
          defaultLabel: reasoningLevelDefaultLabel || t('chat.page.sessionControlInherit'),
          options: reasoningLevelOptions,
          onSelect: onSelectReasoningLevel,
        }
      : null,
  ].filter(
    (section): section is ChatSessionContextDrawerControlSection => section !== null,
  );

  return (
    <OverlaySurface
      isOpen={isOpen}
      onClose={onClose}
      variant="drawer"
      className="max-w-[460px]"
    >
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200/80 bg-zinc-50/85 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/75 sm:px-6">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {t('chat.page.sessionContext')}
          </div>
          <h2 className="mt-2 truncate text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {t('chat.page.sessionContextDescription')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {errorMessage}
          </div>
        ) : null}

        <section className={cn(CHAT_SURFACE_ELEVATED_PANEL_CLASS, 'p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-600 dark:bg-primary-400/10 dark:text-primary-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="mt-4 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {t('chat.page.sessionOverview')}
              </div>
            </div>
            <div
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
                statusClasses.badge,
              )}
            >
              <span className={cn('h-2 w-2 rounded-full', statusClasses.dot)} />
              <span>{statusLabel}</span>
            </div>
          </div>

          {detailItems.length > 0 ? (
            <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
              {detailItems.map((item, index) => (
                <React.Fragment key={`${item}:${index}`}>
                  {index > 0 ? (
                    <span className="text-zinc-300 dark:text-zinc-600">/</span>
                  ) : null}
                  <span className="truncate">{item}</span>
                </React.Fragment>
              ))}
            </div>
          ) : null}

          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className={cn(CHAT_SURFACE_INSET_PANEL_CLASS, 'px-4 py-3')}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                {t('chat.page.currentModel')}
              </dt>
              <dd className="mt-2 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {currentModelName || t('chat.page.noneSelected')}
              </dd>
            </div>
            <div className={cn(CHAT_SURFACE_INSET_PANEL_CLASS, 'px-4 py-3')}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                {t('chat.page.currentChannel')}
              </dt>
              <dd className="mt-2 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {currentChannelName || t('chat.page.noneSelected')}
              </dd>
            </div>
            <div className={cn(CHAT_SURFACE_INSET_PANEL_CLASS, 'px-4 py-3 sm:col-span-2')}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                {t('chat.page.routeMode')}
              </dt>
              <dd className="mt-2 break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {routeLabel || t('chat.page.noneSelected')}
              </dd>
            </div>
          </dl>

          {onOpenSettings ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className={cn(
                CHAT_SURFACE_CONTROL_CLASS,
                'mt-4 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors hover:border-primary-400 hover:text-primary-600 dark:hover:border-primary-500 dark:hover:text-primary-300',
              )}
            >
              <Settings2 className="h-4 w-4" />
              <span>{t('chat.page.configureModels')}</span>
            </button>
          ) : null}
        </section>

        {sessionControlSections.map((section) => {
          const defaultValue = `${CHAT_SESSION_CONTROL_DEFAULT_VALUE_PREFIX}:${section.id}`;
          return (
            <section key={section.id} className="mt-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {section.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                  {section.description}
                </p>
              </div>
              <Select
                value={section.currentValue ?? defaultValue}
                onValueChange={(value) =>
                  section.onSelect(value === defaultValue ? null : value)
                }
              >
                <SelectTrigger className={cn(CHAT_SURFACE_INPUT_CLASS, 'h-11 rounded-2xl')}>
                  <SelectValue placeholder={section.placeholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={defaultValue}>
                    {section.defaultLabel}
                  </SelectItem>
                  {section.options.map((option) => (
                    <SelectItem key={`${section.id}:${option.value}`} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          );
        })}

        {showAgentSection ? (
          <section className="mt-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {t('chat.page.selectAgent')}
              </h3>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('chat.page.agentSelectionDescription')}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                type="text"
                value={agentSearchQuery}
                onChange={(event) => setAgentSearchQuery(event.target.value)}
                placeholder={t('chat.page.searchAgentsPlaceholder')}
                className={cn(
                  CHAT_SURFACE_INPUT_CLASS,
                  'h-11 rounded-2xl pl-10 focus-visible:ring-2 focus-visible:ring-primary-500',
                )}
              />
            </div>
            <div className="mt-3 space-y-2">
              {isAgentLoading ? (
                <div className={cn(CHAT_SURFACE_DASHED_PANEL_CLASS, 'px-4 py-5 text-sm')}>
                  {t('common.loading')}
                </div>
              ) : filteredAgentOptions.length > 0 ? (
                filteredAgentOptions.map((option) => {
                  const isSelected = option.id === selectedAgentId;
                  return (
                    <button
                      key={option.id ?? '__default_agent__'}
                      type="button"
                      onClick={() => onSelectAgent(option.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                        isSelected
                          ? 'border-primary-500/35 bg-primary-500/8 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-primary-300'
                          : cn(
                              CHAT_SURFACE_PANEL_CLASS,
                              'text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50/96 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/88',
                            ),
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold',
                          isSelected
                            ? 'bg-primary-500/15 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
                        )}
                      >
                        {option.id === null ? <UserCircle className="h-5 w-5" /> : getOptionInitials(option)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{option.name}</div>
                        {option.description ? (
                          <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {option.description}
                          </div>
                        ) : null}
                      </div>
                      {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  );
                })
              ) : (
                <div className={cn(CHAT_SURFACE_DASHED_PANEL_CLASS, 'px-4 py-5 text-sm')}>
                  <div>{t('chat.page.noMatchingAgents')}</div>
                  {hasAgentSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => setAgentSearchQuery('')}
                      className={cn(
                        CHAT_SURFACE_CONTROL_CLASS,
                        'mt-3 inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:text-zinc-50',
                      )}
                    >
                      {t('common.reset')}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {showSkillSection ? (
          <section className="mt-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {t('chat.page.selectSkill')}
              </h3>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('chat.page.skillSelectionDescription')}
              </p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                type="text"
                value={skillSearchQuery}
                onChange={(event) => setSkillSearchQuery(event.target.value)}
                placeholder={t('chat.page.searchSkillsPlaceholder')}
                className={cn(
                  CHAT_SURFACE_INPUT_CLASS,
                  'h-11 rounded-2xl pl-10 focus-visible:ring-2 focus-visible:ring-primary-500',
                )}
              />
            </div>
            <div className="mt-3 space-y-2">
              {isSkillLoading ? (
                <div className={cn(CHAT_SURFACE_DASHED_PANEL_CLASS, 'px-4 py-5 text-sm')}>
                  {t('common.loading')}
                </div>
              ) : filteredSkillOptions.length > 0 ? (
                filteredSkillOptions.map((option) => {
                  const isSelected = option.id === selectedSkillId;
                  return (
                    <button
                      key={option.id ?? '__default_skill__'}
                      type="button"
                      onClick={() => onSelectSkill(option.id)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                        isSelected
                          ? 'border-primary-500/35 bg-primary-500/8 text-primary-700 dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-primary-300'
                          : cn(
                              CHAT_SURFACE_PANEL_CLASS,
                              'text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50/96 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/88',
                            ),
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold',
                          isSelected
                            ? 'bg-primary-500/15 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
                        )}
                      >
                        {option.id === null ? <Package className="h-5 w-5" /> : getOptionInitials(option)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{option.name}</div>
                        {option.description ? (
                          <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {option.description}
                          </div>
                        ) : null}
                      </div>
                      {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  );
                })
              ) : (
                <div className={cn(CHAT_SURFACE_DASHED_PANEL_CLASS, 'px-4 py-5 text-sm')}>
                  <div>{t('chat.page.noMatchingSkills')}</div>
                  {hasSkillSearchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSkillSearchQuery('')}
                      className={cn(
                        CHAT_SURFACE_CONTROL_CLASS,
                        'mt-3 inline-flex items-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors hover:border-zinc-300 hover:text-zinc-900 dark:hover:border-zinc-600 dark:hover:text-zinc-50',
                      )}
                    >
                      {t('common.reset')}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </OverlaySurface>
  );
}
