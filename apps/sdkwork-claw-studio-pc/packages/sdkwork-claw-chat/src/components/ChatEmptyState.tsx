import { Sparkles } from 'lucide-react';
import { cn } from '@sdkwork/claw-ui';
import {
  CHAT_SURFACE_ELEVATED_PANEL_CLASS,
  CHAT_SURFACE_INSET_PANEL_CLASS,
  CHAT_SURFACE_INTERACTIVE_PANEL_CLASS,
} from './chatChromeSurface';

export interface ChatEmptyStateHighlight {
  label: string;
  tone?: 'neutral' | 'primary';
}

export interface ChatEmptyStateProps {
  appName: string;
  title: string;
  description: string;
  suggestions: string[];
  highlights: ChatEmptyStateHighlight[];
  onSuggestionSelect: (suggestion: string) => void;
}

export function ChatEmptyState({
  appName,
  title,
  description,
  suggestions,
  highlights,
  onSuggestionSelect,
}: ChatEmptyStateProps) {
  return (
    <div className="grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:items-center xl:gap-6">
      <div
        className={cn(
          CHAT_SURFACE_ELEVATED_PANEL_CLASS,
          'flex flex-col items-center p-6 text-center sm:p-8 lg:items-start lg:p-10 lg:text-left',
        )}
      >
        <span className="mb-6 inline-flex items-center rounded-full border border-primary-500/15 bg-primary-500/8 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-primary-600 dark:border-primary-400/20 dark:bg-primary-400/10 dark:text-primary-300">
          <span className="max-w-full truncate">{appName.toUpperCase()}</span>
        </span>

        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-primary-500/10 shadow-inner sm:h-20 sm:w-20 sm:rounded-[2rem]">
          <Sparkles className="h-10 w-10 text-primary-500" />
        </div>

        <h2 className="max-w-[18ch] text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl xl:text-[2.15rem] dark:text-zinc-100">
          {title}
        </h2>

        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-500 sm:text-base lg:max-w-[34rem] dark:text-zinc-400">
          {description}
        </p>

        {highlights.length > 0 ? (
          <div className="mt-8 flex w-full flex-wrap justify-center gap-3 lg:justify-start">
            {highlights.map((highlight) => (
              <div
                key={`${highlight.tone || 'neutral'}:${highlight.label}`}
                className={
                  highlight.tone === 'primary'
                    ? 'inline-flex max-w-full items-center rounded-2xl border border-primary-500/15 bg-primary-500/8 px-4 py-2 text-sm text-primary-600 dark:border-primary-400/20 dark:bg-primary-400/10 dark:text-primary-300'
                    : cn(
                        CHAT_SURFACE_INSET_PANEL_CLASS,
                        'inline-flex max-w-full items-center px-4 py-2 text-sm text-zinc-600 dark:text-zinc-300',
                      )
                }
              >
                <span className="truncate">{highlight.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 items-stretch">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${index}:${suggestion}`}
              onClick={() => onSuggestionSelect(suggestion)}
              className={cn(
                CHAT_SURFACE_INTERACTIVE_PANEL_CLASS,
                'group relative flex min-h-[8.5rem] flex-col justify-between overflow-hidden p-5 text-left',
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 via-primary-500/0 to-primary-500/0 transition-colors duration-500 group-hover:from-primary-500/5 group-hover:via-primary-500/0 group-hover:to-transparent" />
              <span className="relative z-10 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="relative z-10 flex min-w-0 items-end justify-between gap-4">
                <p className="min-w-0 text-[15px] font-medium leading-6 text-zinc-700 transition-colors group-hover:text-primary-600 dark:text-zinc-300 dark:group-hover:text-primary-400">
                  {suggestion}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
