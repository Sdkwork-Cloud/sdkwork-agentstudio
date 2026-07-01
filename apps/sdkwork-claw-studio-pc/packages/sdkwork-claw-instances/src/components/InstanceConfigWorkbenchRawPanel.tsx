import React, { Suspense } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { InstanceConfigWorkbenchStatusChip } from './InstanceConfigWorkbenchStatusChip.tsx';

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

type Translate = (
  key: string,
  en: string,
  zh: string,
  options?: Record<string, unknown>,
) => string;

function configureRawConfigMonaco(monaco: {
  languages?: {
    json?: {
      jsonDefaults?: {
        setDiagnosticsOptions?: (options: { validate: boolean }) => void;
      };
    };
  };
}) {
  if (!monaco.languages?.json?.jsonDefaults?.setDiagnosticsOptions) {
    return;
  }

  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({ validate: false });
}

interface InstanceConfigWorkbenchRawPanelProps {
  tr: Translate;
  parseError: string | null;
  rawSensitiveCount: number;
  rawSensitiveVisible: boolean;
  rawSensitiveHidden: boolean;
  lineCount: number;
  characterCount: number;
  sectionCount: number;
  isWritable: boolean;
  editorTheme: string;
  rawDraft: string;
  onRawDraftChange: (value: string) => void;
  onToggleRawSensitiveVisible: () => void;
  onRevealRawSensitive: () => void;
}

export function InstanceConfigWorkbenchRawPanel(props: InstanceConfigWorkbenchRawPanelProps) {
  const sensitiveStateLabel = props.rawSensitiveHidden
    ? props.tr(
        'instances.detail.instanceWorkbench.config.workbench.raw.states.hidden',
        'hidden',
        'hidden',
      )
    : props.tr(
        'instances.detail.instanceWorkbench.config.workbench.raw.states.visible',
        'visible',
        'visible',
      );

  return (
    <div className="space-y-3">
      {props.parseError ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          {props.tr(
            'instances.detail.instanceWorkbench.config.raw.invalidDraft',
            'The current draft is not valid JSON5.',
            'The current draft is not valid JSON5.',
          )}{' '}
          {props.parseError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {props.rawSensitiveCount > 0 ? (
          <>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              {props.tr(
                'instances.detail.instanceWorkbench.config.workbench.raw.sensitiveValuesStatus',
                '{{count}} sensitive values {{state}}',
                '{{count}} sensitive values {{state}}',
                {
                  count: props.rawSensitiveCount,
                  state: sensitiveStateLabel,
                },
              )}
            </span>
            <button
              type="button"
              onClick={props.onToggleRawSensitiveVisible}
              className="rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
            >
              {props.rawSensitiveVisible
                ? props.tr(
                    'instances.detail.instanceWorkbench.config.workbench.section.hideSensitiveValues',
                    'Hide sensitive values',
                    'Hide sensitive values',
                  )
                : props.tr(
                    'instances.detail.instanceWorkbench.config.workbench.section.revealSensitiveValues',
                    'Reveal sensitive values',
                    'Reveal sensitive values',
                  )}
            </button>
          </>
        ) : null}
        <span className="rounded-full border border-zinc-200/70 bg-white/80 px-3 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/55 dark:text-zinc-300">
          {props.tr(
            'instances.detail.instanceWorkbench.config.workbench.raw.label',
            'Raw config (JSON/JSON5)',
            'Raw config (JSON/JSON5)',
          )}
        </span>
        <InstanceConfigWorkbenchStatusChip>
          {props.tr('instances.detail.instanceWorkbench.config.raw.lines', 'Lines: {{count}}', 'Lines: {{count}}', {
            count: props.lineCount,
          })}
        </InstanceConfigWorkbenchStatusChip>
        <InstanceConfigWorkbenchStatusChip>
          {props.tr(
            'instances.detail.instanceWorkbench.config.raw.characters',
            'Chars: {{count}}',
            'Chars: {{count}}',
            { count: props.characterCount },
          )}
        </InstanceConfigWorkbenchStatusChip>
        <InstanceConfigWorkbenchStatusChip>
          {props.tr(
            'instances.detail.instanceWorkbench.config.raw.sections',
            'Sections: {{count}}',
            'Sections: {{count}}',
            {
              count: props.sectionCount,
            },
          )}
        </InstanceConfigWorkbenchStatusChip>
      </div>

      <div className="overflow-hidden rounded-[1.6rem] border border-zinc-200/70 bg-white/85 dark:border-zinc-800 dark:bg-zinc-950/35">
        {props.rawSensitiveHidden ? (
          <div className="flex h-[min(70vh,720px)] items-center justify-center p-6">
            <div className="max-w-md space-y-3 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                <Shield className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {props.tr(
                    'instances.detail.instanceWorkbench.config.workbench.raw.hiddenTitle',
                    'Hidden until you reveal sensitive values.',
                    'Hidden until you reveal sensitive values.',
                  )}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">
                  {props.tr(
                    'instances.detail.instanceWorkbench.config.workbench.raw.hiddenDescription',
                    'Use reveal to inspect and edit the raw config.',
                    'Use reveal to inspect and edit the raw config.',
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={props.onRevealRawSensitive}
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                {props.tr(
                  'instances.detail.instanceWorkbench.config.workbench.section.revealSensitiveValues',
                  'Reveal sensitive values',
                  'Reveal sensitive values',
                )}
              </button>
            </div>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="flex h-[min(70vh,720px)] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {props.tr(
                  'instances.detail.instanceWorkbench.config.raw.loading',
                  'Loading config document...',
                  'Loading config document...',
                )}
              </div>
            }
          >
            <MonacoEditor
              height="min(70vh,720px)"
              beforeMount={configureRawConfigMonaco}
              defaultLanguage="json"
              language="json"
              theme={props.editorTheme}
              value={props.rawDraft}
              onChange={(value) => props.onRawDraftChange(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbersMinChars: 3,
                padding: { top: 12, bottom: 12 },
                readOnly: !props.isWritable,
                smoothScrolling: true,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
