import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileCode2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { InstanceWorkbenchFile } from '../types/index.ts';
import { buildWorkbenchFileTabPresentation } from '../services';

interface InstanceFilesTabsBarProps {
  files: InstanceWorkbenchFile[];
  activeFileId: string | null;
  hasPendingFileChangesFor: (file: InstanceWorkbenchFile) => boolean;
  onSelectFile: (fileId: string) => void;
  onCloseFile: (fileId: string) => void;
}

interface TabsScrollState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

function getTabsScrollState(container: HTMLDivElement | null): TabsScrollState {
  if (!container) {
    return {
      canScrollLeft: false,
      canScrollRight: false,
    };
  }

  const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  const scrollLeft = Math.max(0, container.scrollLeft);

  return {
    canScrollLeft: scrollLeft > 2,
    canScrollRight: scrollLeft < maxScrollLeft - 2,
  };
}

export function InstanceFilesTabsBar({
  files,
  activeFileId,
  hasPendingFileChangesFor,
  onSelectFile,
  onCloseFile,
}: InstanceFilesTabsBarProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [scrollState, setScrollState] = useState<TabsScrollState>({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const tabPresentations = useMemo(
    () => files.map((file) => ({ file, presentation: buildWorkbenchFileTabPresentation(file) })),
    [files],
  );

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const syncScrollState = () => {
      setScrollState(getTabsScrollState(container));
    };

    syncScrollState();
    container.addEventListener('scroll', syncScrollState, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncScrollState) : null;
    resizeObserver?.observe(container);
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', syncScrollState);
    }

    return () => {
      container.removeEventListener('scroll', syncScrollState);
      resizeObserver?.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', syncScrollState);
      }
    };
  }, [files.length]);

  useEffect(() => {
    if (!activeFileId) {
      return;
    }

    const activeButton = tabButtonRefs.current[activeFileId];
    if (!activeButton) {
      return;
    }

    activeButton.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
    setScrollState(getTabsScrollState(scrollContainerRef.current));
  }, [activeFileId, files]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const delta = direction === 'left' ? -180 : 180;
    container.scrollBy({
      left: delta,
      behavior: 'smooth',
    });
    window.setTimeout(() => {
      setScrollState(getTabsScrollState(container));
    }, 220);
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div
      data-slot="instance-files-tabs-bar"
      className="flex h-9 items-stretch border-b border-zinc-200/80 bg-zinc-100/85 dark:border-zinc-800 dark:bg-zinc-950/90"
    >
      <button
        type="button"
        onClick={() => scrollTabs('left')}
        disabled={!scrollState.canScrollLeft}
        className="flex h-9 w-9 shrink-0 items-center justify-center border-r border-zinc-200/80 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-700 disabled:cursor-default disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
        aria-label={t('instances.detail.instanceWorkbench.files.tabs.scrollLeft')}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        ref={scrollContainerRef}
        className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(event) => {
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
          }

          event.currentTarget.scrollLeft += event.deltaY;
        }}
      >
        <div className="flex min-w-max">
          {tabPresentations.map(({ file, presentation }) => {
            const isActive = file.id === activeFileId;
            const isDirty = hasPendingFileChangesFor(file);

            return (
              <div
                key={file.id}
                data-slot="instance-files-tab"
                className={`group flex h-9 min-w-[8.5rem] max-w-[13rem] items-stretch border-r border-zinc-200/80 ${
                  isActive
                    ? 'bg-white dark:bg-zinc-900'
                    : 'bg-transparent dark:bg-transparent'
                } dark:border-zinc-800`}
                title={presentation.tooltip}
              >
                <button
                  ref={(element) => {
                    tabButtonRefs.current[file.id] = element;
                  }}
                  type="button"
                  onClick={() => onSelectFile(file.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 text-left"
                >
                  <FileCode2
                    className={`h-4 w-4 shrink-0 ${
                      isActive
                        ? 'text-zinc-600 dark:text-zinc-300'
                        : 'text-zinc-500 dark:text-zinc-500'
                    }`}
                  />
                  <span
                    className={`truncate text-[13px] leading-none ${
                      isActive
                        ? 'text-zinc-950 dark:text-zinc-50'
                        : 'text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    {presentation.title}
                  </span>
                </button>

                <div className="flex shrink-0 items-center pr-1.5">
                  {isDirty && !isActive ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onCloseFile(file.id)}
                      className={`rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                      aria-label={t('instances.detail.instanceWorkbench.files.tabs.close', {
                        title: presentation.title,
                      })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => scrollTabs('right')}
        disabled={!scrollState.canScrollRight}
        className="flex h-9 w-9 shrink-0 items-center justify-center border-l border-zinc-200/80 text-zinc-500 transition-colors hover:bg-white hover:text-zinc-700 disabled:cursor-default disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
        aria-label={t('instances.detail.instanceWorkbench.files.tabs.scrollRight')}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
