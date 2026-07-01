import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Folder,
  GitBranch,
  Loader2,
  Server,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  Checkbox,
  Input,
  Label,
  OverlaySurface,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sdkwork/claw-ui';

export interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  repoName: string;
  type: 'github' | 'huggingface';
  instances?: { id: string; name: string; status: string; ip: string; iconType: string }[];
}

export function InstallModal({
  isOpen,
  onClose,
  title,
  repoName,
  type,
  instances = [],
}: InstallModalProps) {
  const { t } = useTranslation();
  const revisionOptions = ['main', 'v1.0.0', 'dev'];
  const [step, setStep] = useState<'config' | 'installing' | 'success' | 'error'>('config');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const [targetEnvironment, setTargetEnvironment] = useState('local');
  const [installPath, setInstallPath] = useState('');
  const [selectedRevision, setSelectedRevision] = useState(revisionOptions[0]);

  const sourceLabel = useMemo(
    () =>
      type === 'github'
        ? t('installModal.sources.github')
        : t('installModal.sources.huggingFace'),
    [t, type],
  );

  useEffect(() => {
    if (isOpen) {
      setStep('config');
      setProgress(0);
      setLogs([]);
      setTargetEnvironment('local');
      setInstallPath(
        `~/openclaw/${type === 'github' ? 'repos' : 'models'}/${repoName.split('/').pop()}`,
      );
      setSelectedRevision(revisionOptions[0]);
      if (instances.length > 0) {
        setSelectedInstanceIds([instances[0].id]);
      }
    }
  }, [instances, isOpen]);

  const handleInstall = () => {
    setStep('installing');
    setLogs([
      t('installModal.logs.startingInstallation', { repoName }),
      t('installModal.logs.connectingTo', { source: sourceLabel }),
    ]);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.random() * 15;

      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);
        setLogs((currentLogs) => [
          ...currentLogs,
          t('installModal.logs.installationCompleted'),
        ]);
        setTimeout(() => setStep('success'), 500);
      } else {
        setLogs((currentLogs) => {
          const nextLogs = [...currentLogs];

          if (currentProgress > 20 && nextLogs.length < 3) {
            nextLogs.push(t('installModal.logs.downloadingMetadata'));
          }
          if (currentProgress > 50 && nextLogs.length < 4) {
            nextLogs.push(t('installModal.logs.fetchingFiles'));
          }
          if (currentProgress > 80 && nextLogs.length < 5) {
            nextLogs.push(t('installModal.logs.configuringEnvironment'));
          }

          return nextLogs;
        });
      }

      setProgress(currentProgress);
    }, 500);
  };

  return (
    <OverlaySurface
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop={step !== 'installing'}
      className="max-w-lg"
      backdropClassName="bg-zinc-900/42"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{repoName}</p>
        </div>
        {step !== 'installing' && (
          <button
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="overflow-y-auto p-6">
        {step === 'config' && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Server className="h-4 w-4 text-zinc-400" />
                {t('installModal.fields.targetInstances')}
              </Label>
              {instances.length > 0 ? (
                <div className="custom-scrollbar max-h-48 space-y-2 overflow-y-auto pr-1">
                  {instances.map((instance) => {
                    const isSelected = selectedInstanceIds.includes(instance.id);
                    return (
                      <div
                        key={instance.id}
                        onClick={() => {
                          setSelectedInstanceIds((current) =>
                            current.includes(instance.id)
                              ? current.filter((id) => id !== instance.id)
                              : [...current, instance.id],
                          );
                        }}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500 dark:bg-primary-500/10'
                            : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <div>
                          <h4
                            className={`text-sm font-bold ${
                              isSelected
                                ? 'text-primary-900 dark:text-primary-100'
                                : 'text-zinc-900 dark:text-zinc-100'
                            }`}
                          >
                            {instance.name}
                          </h4>
                          <p
                            className={`text-xs ${
                              isSelected
                                ? 'text-primary-600 dark:text-primary-400'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {t(
                              instance.status === 'online'
                                ? 'installModal.status.online'
                                : 'installModal.status.offline',
                            )}{' '}
                            - {instance.ip}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Select value={targetEnvironment} onValueChange={setTargetEnvironment}>
                  <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">
                      {t('installModal.fields.localEnvironmentDefault')}
                    </SelectItem>
                    <SelectItem value="docker">
                      {t('installModal.fields.dockerContainerDefault')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <Folder className="h-4 w-4 text-zinc-400" />
                {t('installModal.fields.installPath')}
              </Label>
              <Input
                type="text"
                value={installPath}
                onChange={(event) => setInstallPath(event.target.value)}
                className="bg-zinc-50 font-mono dark:bg-zinc-950"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                <GitBranch className="h-4 w-4 text-zinc-400" />
                {t(
                  type === 'github'
                    ? 'installModal.fields.branchOrTag'
                    : 'installModal.fields.revision',
                )}
              </Label>
              <Select value={selectedRevision} onValueChange={setSelectedRevision}>
                <SelectTrigger className="bg-zinc-50 dark:bg-zinc-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {revisionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 'installing' && (
          <div className="flex flex-col items-center justify-center space-y-6 py-8 text-center">
            <div className="relative">
              <svg className="h-24 w-24 -rotate-90 transform">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-zinc-100 dark:text-zinc-800"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * progress) / 100}
                  className="text-primary-500 transition-all duration-300 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            <div className="w-full max-w-sm space-y-2">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {t('installModal.progress.installingRepo', { repoName })}
              </div>
              <div className="h-32 space-y-1 overflow-y-auto rounded-xl bg-zinc-950 p-3 text-left font-mono text-[10px] text-zinc-400">
                {logs.map((log, index) => (
                  <div key={index} className="animate-fade-in">{`> ${log}`}</div>
                ))}
                <div className="flex items-center gap-2 text-primary-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('installModal.progress.processing')}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {t('installModal.success.title')}
            </h3>
            <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
              {t('installModal.success.description', { repoName })}
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
            <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {t('installModal.error.title')}
            </h3>
            <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
              {t('installModal.error.description', { repoName })}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-zinc-100 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/70">
        {step === 'config' && (
          <>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleInstall}
              disabled={instances.length > 0 && selectedInstanceIds.length === 0}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:bg-primary-300"
            >
              <Download className="h-4 w-4" />
              {t('installModal.actions.startInstall')}
            </button>
          </>
        )}
        {(step === 'success' || step === 'error') && (
          <button
            onClick={onClose}
            className="rounded-xl bg-zinc-900 px-6 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t('installModal.actions.close')}
          </button>
        )}
      </div>
    </OverlaySurface>
  );
}
