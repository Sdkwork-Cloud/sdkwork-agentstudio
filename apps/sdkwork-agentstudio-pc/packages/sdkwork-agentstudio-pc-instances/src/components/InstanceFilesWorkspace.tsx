import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { FolderTree, Loader2, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  buildWorkbenchFileContentStateKey,
  buildWorkbenchEditorModelPath,
  closeWorkbenchFileTab,
  createDefaultWorkbenchFileTabState,
  getInstanceVisibleWorkbenchFiles,
  getWorkbenchFileResolvedContent,
  instanceService,
  openWorkbenchFileTab,
  reconcileWorkbenchFileTabs,
  reconcileWorkbenchFileTextState,
  shouldLoadWorkbenchFileContent,
  shouldPersistWorkbenchFileDraftChange,
  type WorkbenchFileTabState,
} from '../services';
import type { InstanceWorkbenchAgent, InstanceWorkbenchFile } from '../types/index.ts';
import { InstanceFileExplorer } from './InstanceFileExplorer';
import { InstanceFilesTabsBar } from './InstanceFilesTabsBar';

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

interface InstanceFilesWorkspaceBaseProps {
  instanceId: string;
  files: InstanceWorkbenchFile[];
  runtimeKind?: string | null;
  transportKind?: string | null;
  isBuiltIn?: boolean;
  isLoading?: boolean;
  onReload?: () => Promise<void> | void;
}

interface InstanceScopedFilesWorkspaceProps extends InstanceFilesWorkspaceBaseProps {
  mode: 'instance';
  agents: InstanceWorkbenchAgent[];
  selectedAgentId: string | null;
  onSelectedAgentIdChange: (agentId: string) => void;
}

interface AgentScopedFilesWorkspaceProps extends InstanceFilesWorkspaceBaseProps {
  mode: 'agent';
  agent: InstanceWorkbenchAgent | null;
}

export type InstanceFilesWorkspaceProps =
  | InstanceScopedFilesWorkspaceProps
  | AgentScopedFilesWorkspaceProps;

function hasSameWorkbenchFileTabState(
  current: WorkbenchFileTabState | undefined,
  next: WorkbenchFileTabState,
) {
  if (!current) {
    return false;
  }

  return (
    current.activeFileId === next.activeFileId &&
    current.openFileIds.length === next.openFileIds.length &&
    current.openFileIds.every((fileId, index) => fileId === next.openFileIds[index])
  );
}

export function InstanceFilesWorkspace(props: InstanceFilesWorkspaceProps) {
  const { t } = useTranslation();
  const [fileTabsByScope, setFileTabsByScope] = useState<Record<string, WorkbenchFileTabState>>(
    {},
  );
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({});
  const [loadedFileContents, setLoadedFileContents] = useState<Record<string, string>>({});
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [isSavingFile, setIsSavingFile] = useState(false);

  const contextAgent =
    props.mode === 'instance'
      ? props.agents.find((agent) => agent.agent.id === props.selectedAgentId) ||
        props.agents[0] ||
        null
      : props.agent;
  const visibleFiles =
    props.mode === 'instance'
      ? getInstanceVisibleWorkbenchFiles(props.files, contextAgent)
      : props.files;
  const scopeKey =
    props.mode === 'instance'
      ? contextAgent?.agent.id || '__instance-files__'
      : contextAgent?.agent.id || '__agent-files__';
  const resolveFileContentStateKey = (file: InstanceWorkbenchFile) =>
    buildWorkbenchFileContentStateKey({
      instanceId: props.instanceId,
      scopeKey,
      file,
    });

  useEffect(() => {
    if (props.files.length === 0) {
      setFileTabsByScope({});
      setFileDrafts({});
      setLoadedFileContents({});
      setLoadingFileId(null);
      return;
    }

    setFileDrafts((current) =>
      reconcileWorkbenchFileTextState(props.files, current, resolveFileContentStateKey),
    );
    setLoadedFileContents((current) =>
      reconcileWorkbenchFileTextState(props.files, current, resolveFileContentStateKey),
    );
    setLoadingFileId((current) =>
      current && props.files.some((file) => resolveFileContentStateKey(file) === current)
        ? current
        : null,
    );
  }, [props.files, props.instanceId, scopeKey]);

  useEffect(() => {
    if (!scopeKey) {
      return;
    }

    setFileTabsByScope((current) => {
      const currentState = current[scopeKey];
      const nextState = currentState
        ? reconcileWorkbenchFileTabs(visibleFiles, currentState)
        : createDefaultWorkbenchFileTabState(visibleFiles);

      if (hasSameWorkbenchFileTabState(currentState, nextState)) {
        return current;
      }

      return {
        ...current,
        [scopeKey]: nextState,
      };
    });
  }, [scopeKey, visibleFiles]);

  const selectedFileTabState = fileTabsByScope[scopeKey] || {
    openFileIds: [],
    activeFileId: null,
  };
  const openFiles = useMemo(() => {
    const visibleFilesById = new Map(visibleFiles.map((file) => [file.id, file]));
    return selectedFileTabState.openFileIds
      .map((fileId) => visibleFilesById.get(fileId))
      .filter((file): file is InstanceWorkbenchFile => Boolean(file));
  }, [selectedFileTabState.openFileIds, visibleFiles]);
  const selectedFile = useMemo(
    () => visibleFiles.find((file) => file.id === selectedFileTabState.activeFileId) || null,
    [selectedFileTabState.activeFileId, visibleFiles],
  );

  const selectedFileShouldLoadContent = selectedFile
    ? shouldLoadWorkbenchFileContent({
        file: selectedFile,
        loadedFileContents,
        contentStateKey: resolveFileContentStateKey(selectedFile),
        runtimeKind: props.runtimeKind,
        transportKind: props.transportKind,
        isBuiltIn: props.isBuiltIn,
      })
    : false;
  const selectedFileSourceContent = selectedFile
    ? getWorkbenchFileResolvedContent({
        file: selectedFile,
        loadedFileContents,
        contentStateKey: resolveFileContentStateKey(selectedFile),
        runtimeKind: props.runtimeKind,
        transportKind: props.transportKind,
        isBuiltIn: props.isBuiltIn,
      })
    : '';
  const hasSelectedFileDraft = selectedFile
    ? Object.prototype.hasOwnProperty.call(fileDrafts, resolveFileContentStateKey(selectedFile))
    : false;
  const selectedFileDraft = selectedFile
    ? hasSelectedFileDraft
      ? fileDrafts[resolveFileContentStateKey(selectedFile)] || ''
      : selectedFileSourceContent
    : '';
  const hasPendingFileChangesFor = (file: InstanceWorkbenchFile) =>
    !file.isReadonly &&
    (fileDrafts[resolveFileContentStateKey(file)] ?? getFileSourceContent(file)) !==
      getFileSourceContent(file);
  const hasPendingFileChanges = Boolean(
    selectedFile && !selectedFile.isReadonly && selectedFileDraft !== selectedFileSourceContent,
  );
  const isSelectedFileLoading = Boolean(
    selectedFile && loadingFileId === resolveFileContentStateKey(selectedFile),
  );
  const editorTheme =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'vs-dark'
      : 'vs';

  useEffect(() => {
    if (!selectedFile || !selectedFileShouldLoadContent) {
      return;
    }

    let cancelled = false;
    const contentStateKey = resolveFileContentStateKey(selectedFile);
    setLoadingFileId(contentStateKey);

    void instanceService
      .getInstanceFileContent(props.instanceId, selectedFile.id)
      .then((content) => {
        if (cancelled) {
          return;
        }
        setLoadedFileContents((current) => ({
          ...current,
          [contentStateKey]: content,
        }));
      })
      .catch((error: any) => {
        if (!cancelled) {
          toast.error(
            error?.message || t('instances.detail.instanceWorkbench.files.fileSaveFailed'),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingFileId((current) => (current === contentStateKey ? null : current));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.instanceId, selectedFile, selectedFileShouldLoadContent, scopeKey, t]);

  const getFileSourceContent = (file: InstanceWorkbenchFile) =>
    getWorkbenchFileResolvedContent({
      file,
      loadedFileContents,
      contentStateKey: resolveFileContentStateKey(file),
      runtimeKind: props.runtimeKind,
      transportKind: props.transportKind,
      isBuiltIn: props.isBuiltIn,
    });

  const handleSelectFile = (fileId: string) => {
    setFileTabsByScope((current) => ({
      ...current,
      [scopeKey]: openWorkbenchFileTab(
        visibleFiles,
        current[scopeKey] || createDefaultWorkbenchFileTabState([]),
        fileId,
      ),
    }));
  };

  const handleCloseFileTab = (fileId: string) => {
    setFileTabsByScope((current) => ({
      ...current,
      [scopeKey]: closeWorkbenchFileTab(
        visibleFiles,
        current[scopeKey] || createDefaultWorkbenchFileTabState([]),
        fileId,
      ),
    }));
  };

  const handleFileDraftChange = (
    file: InstanceWorkbenchFile | null,
    value: string,
    event?: {
      isFlush?: boolean;
    },
  ) => {
    if (
      !shouldPersistWorkbenchFileDraftChange({
        file,
        isFlush: event?.isFlush,
      })
    ) {
      return;
    }

    if (!file) {
      return;
    }

    setFileDrafts((current) => ({
      ...current,
      [resolveFileContentStateKey(file)]: value,
    }));
  };

  const handleResetFileDraft = () => {
    if (!selectedFile) {
      return;
    }

    setFileDrafts((current) => ({
      ...current,
      [resolveFileContentStateKey(selectedFile)]: selectedFileSourceContent,
    }));
  };

  const handleSaveFile = async () => {
    if (!selectedFile || selectedFile.isReadonly) {
      return;
    }

    setIsSavingFile(true);
    try {
      await instanceService.updateInstanceFileContent(
        props.instanceId,
        selectedFile.id,
        selectedFileDraft,
      );
      setLoadedFileContents((current) => ({
        ...current,
        [resolveFileContentStateKey(selectedFile)]: selectedFileDraft,
      }));
      setFileDrafts((current) => ({
        ...current,
        [resolveFileContentStateKey(selectedFile)]: selectedFileDraft,
      }));
      toast.success(t('instances.detail.instanceWorkbench.files.fileSaved'));
      await props.onReload?.();
    } catch (error: any) {
      toast.error(error?.message || t('instances.detail.instanceWorkbench.files.fileSaveFailed'));
    } finally {
      setIsSavingFile(false);
    }
  };

  return (
    <div
      data-slot="instance-files-workspace"
      data-workspace-mode={props.mode}
      className="rounded-[1.75rem] border border-zinc-200/70 bg-white/75 dark:border-zinc-800 dark:bg-zinc-950/35"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            <FolderTree className="h-4 w-4" />
            {t('instances.detail.instanceWorkbench.files.runtimeArtifacts')}
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t('instances.detail.instanceWorkbench.files.runtimeArtifactsDescription')}
          </p>
        </div>
        {selectedFile ? (
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-zinc-950/[0.04] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
              {selectedFile.language}
            </span>
            <span className="rounded-full border border-zinc-200/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              {t(`instances.detail.instanceWorkbench.fileStatus.${selectedFile.status}`)}
            </span>
          </div>
        ) : null}
      </div>

      {props.files.length > 0 ? (
        <div
          className={`grid min-h-[42rem] ${
            props.mode === 'instance'
              ? 'xl:grid-cols-[15rem_20rem_minmax(0,1fr)]'
              : 'xl:grid-cols-[20rem_minmax(0,1fr)]'
          }`}
        >
          {props.mode === 'instance' ? (
            <aside
              data-slot="instance-files-agents"
              className="border-b border-zinc-200/70 bg-zinc-950/[0.015] p-3 dark:border-zinc-800 dark:bg-white/[0.015] xl:border-r xl:border-b-0"
            >
              <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.agents.panel.badge')}
                </div>
                <div className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                  {props.agents.length}
                </div>
              </div>
              <div className="space-y-2">
                {props.agents.map((agent) => {
                  const isActive = agent.agent.id === props.selectedAgentId;

                  return (
                    <button
                      key={agent.agent.id}
                      type="button"
                      onClick={() => props.onSelectedAgentIdChange(agent.agent.id)}
                      className={`w-full rounded-[1.2rem] border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? 'border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                          : 'border-zinc-200/70 bg-white/70 text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-100 dark:hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg ${
                            isActive
                              ? 'bg-white/12 text-white dark:bg-zinc-950/10 dark:text-zinc-950'
                              : 'bg-sky-500/10 text-sky-600 dark:text-sky-300'
                          }`}
                        >
                          {agent.agent.avatar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{agent.agent.name}</div>
                          <div
                            className={`mt-1 truncate font-mono text-[11px] ${
                              isActive
                                ? 'text-white/70 dark:text-zinc-700'
                                : 'text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            {agent.workspace || '--'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          ) : null}

          <aside
            data-slot="instance-files-explorer"
            className="border-b border-zinc-200/70 bg-zinc-950/[0.02] p-3 dark:border-zinc-800 dark:bg-white/[0.02] xl:border-r xl:border-b-0"
          >
            <div className="flex items-center justify-between gap-3 px-2 pb-3 pt-1">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {t('instances.detail.instanceWorkbench.files.explorer')}
                </div>
                {contextAgent ? (
                  <div className="mt-1 truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    {contextAgent.agent.name}
                  </div>
                ) : null}
              </div>
              <div className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-[11px] font-semibold text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400">
                {visibleFiles.length}
              </div>
            </div>
            {visibleFiles.length > 0 ? (
              <InstanceFileExplorer
                files={visibleFiles}
                selectedFileId={selectedFile?.id || null}
                onSelectFile={handleSelectFile}
              />
            ) : (
              <div className="flex min-h-[16rem] items-center justify-center px-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.empty.files')}
              </div>
            )}
          </aside>

          <div data-slot="instance-files-editor" className="flex min-h-[42rem] flex-col">
            <div className="border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="truncate text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                      {selectedFile?.name ||
                        contextAgent?.agent.name ||
                        t('instances.detail.instanceWorkbench.files.runtimeArtifacts')}
                    </h3>
                    {contextAgent ? (
                      <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                        {contextAgent.agent.name}
                      </span>
                    ) : null}
                    {selectedFile ? (
                      <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600 dark:bg-white/[0.06] dark:text-zinc-300">
                        {selectedFile.isReadonly
                          ? t('instances.detail.instanceWorkbench.files.previewMode')
                          : t('instances.detail.instanceWorkbench.files.editMode')}
                      </span>
                    ) : null}
                    {hasPendingFileChanges ? (
                      <span className="rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                        {t('instances.detail.instanceWorkbench.files.unsavedChanges')}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 truncate font-mono text-sm text-zinc-500 dark:text-zinc-400">
                    {selectedFile?.path ||
                      contextAgent?.workspace ||
                      t('instances.detail.instanceWorkbench.files.selectFile')}
                  </p>
                </div>
                {selectedFile?.isReadonly ? (
                  <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                    {t('instances.detail.instanceWorkbench.files.readonlyNotice')}
                  </div>
                ) : selectedFile ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleResetFileDraft}
                      disabled={!hasPendingFileChanges}
                      className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    >
                      <RotateCcw className="h-4 w-4" />
                      {t('instances.detail.instanceWorkbench.files.revertDraft')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFile}
                      disabled={!hasPendingFileChanges || isSavingFile}
                      className="flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                    >
                      {isSavingFile ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          {t('instances.detail.instanceWorkbench.files.savingFile')}
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          {t('instances.detail.instanceWorkbench.files.saveFile')}
                        </>
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
              {selectedFile ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                      {selectedFile.size}
                    </span>
                    <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                      {selectedFile.updatedAt}
                    </span>
                    <span className="rounded-full bg-zinc-950/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
                      {t(`instances.detail.instanceWorkbench.fileCategories.${selectedFile.category}`)}
                    </span>
                  </div>
                  {isSelectedFileLoading ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-zinc-200/70 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('common.loading')}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <InstanceFilesTabsBar
              files={openFiles}
              activeFileId={selectedFile?.id || null}
              hasPendingFileChangesFor={hasPendingFileChangesFor}
              onSelectFile={handleSelectFile}
              onCloseFile={handleCloseFileTab}
            />

            {selectedFile ? (
              <div className="min-h-[34rem] flex-1">
                <Suspense
                  fallback={
                    <div className="flex h-full min-h-[34rem] items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      {t('common.loading')}
                    </div>
                  }
                >
                  <MonacoEditor
                    height="100%"
                    language={selectedFile.language}
                    path={buildWorkbenchEditorModelPath(selectedFile)}
                    theme={editorTheme}
                    value={selectedFileDraft}
                    onChange={(value, event) =>
                      handleFileDraftChange(
                        selectedFile,
                        value ?? '',
                        event as { isFlush?: boolean } | undefined,
                      )
                    }
                    saveViewState
                    options={{
                      automaticLayout: true,
                      fontSize: 13,
                      lineHeight: 20,
                      minimap: { enabled: true },
                      padding: { top: 16, bottom: 16 },
                      readOnly: selectedFile.isReadonly,
                      roundedSelection: true,
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      wordWrap: 'on',
                    }}
                  />
                </Suspense>
              </div>
            ) : (
              <div className="flex h-full min-h-[34rem] items-center justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                {t('instances.detail.instanceWorkbench.files.selectFile')}
              </div>
            )}
          </div>
        </div>
      ) : props.isLoading ? (
        <div className="flex min-h-[20rem] items-center justify-center p-6 text-sm text-zinc-500 dark:text-zinc-400">
          <div className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200/70 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[20rem] items-center justify-center p-6 text-sm text-zinc-500 dark:text-zinc-400">
          {t('instances.detail.instanceWorkbench.empty.files')}
        </div>
      )}
    </div>
  );
}
