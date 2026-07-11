import { Loader2, RefreshCw } from 'lucide-react';
import { AppHeader } from '@sdkwork/agentstudio-pc-shell';
import type { StartupLanguage, StartupProgressModel } from './startupPresentation';
import { getStartupCopy } from './startupPresentation';

interface DesktopStartupScreenProps {
  appName: string;
  language: StartupLanguage;
  progress: StartupProgressModel;
  status: 'booting' | 'launching' | 'error';
  errorMessage: string | null;
  isVisible: boolean;
  onRetry: () => void;
}

function BrandIcon({ isActive }: { isActive: boolean }) {
  return (
    <div
      className="flex h-14 w-14 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 shadow-[0_18px_44px_rgba(0,0,0,0.28)]"
    >
      <Loader2
        aria-hidden="true"
        className={`h-7 w-7 ${isActive ? 'motion-safe:animate-spin' : ''}`}
      />
    </div>
  );
}

function getStartupWindowControlLabels(language: StartupLanguage) {
  return (
    language === 'zh'
      ? {
          minimize: '\u6700\u5c0f\u5316\u7a97\u53e3',
          maximize: '\u6700\u5927\u5316\u7a97\u53e3',
          restore: '\u6062\u590d\u7a97\u53e3',
          close: '\u9690\u85cf\u5230\u6258\u76d8',
        }
      : {
          minimize: 'Minimize window',
          maximize: 'Maximize window',
          restore: 'Restore window',
          close: 'Hide to tray',
        }
  );
}

export function DesktopStartupScreen({
  appName,
  language,
  progress,
  status,
  errorMessage,
  isVisible,
  onRetry,
}: DesktopStartupScreenProps) {
  const copy = getStartupCopy(language, appName);
  const statusText = status === 'error' ? copy.errorTitle : progress.statusLabel;
  const isBooting = status !== 'error' && progress.phase !== 'ready';

  return (
    <div
      data-tauri-drag-region
      className={`absolute inset-0 z-50 transition-opacity duration-200 ease-out ${
        isVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-zinc-950" />

      <div className="relative flex h-full min-h-0 flex-col">
        <AppHeader
          mode="window-controls"
          windowControlLabels={getStartupWindowControlLabels(language)}
        />

        <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
          <div className="w-full max-w-[27rem] rounded-lg border border-zinc-800 bg-zinc-950 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.36)]">
            <div className="flex items-center gap-4">
              <BrandIcon isActive={isBooting} />
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold text-zinc-50">
                  {appName}
                </h1>
                <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded bg-sky-400 ${
                      isBooting ? 'motion-safe:animate-pulse' : ''
                    }`}
                  />
                  <span>{statusText}</span>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="h-2 rounded bg-zinc-800">
                <div
                  className="h-full rounded bg-sky-400 transition-[width] duration-200 ease-out"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>

            {status === 'error' ? (
              <div className="mt-6 rounded-lg border border-red-500/30 bg-red-950/50 p-4">
                <p className="text-sm leading-6 text-red-50">{errorMessage}</p>
                <button
                  type="button"
                  data-tauri-drag-region="false"
                  onClick={onRetry}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  {copy.retryLabel}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
