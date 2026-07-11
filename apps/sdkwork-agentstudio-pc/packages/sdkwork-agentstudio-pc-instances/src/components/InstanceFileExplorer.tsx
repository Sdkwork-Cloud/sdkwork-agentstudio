import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode2, Folder, FolderOpen } from 'lucide-react';
import type { InstanceWorkbenchFile } from '../types';
import {
  buildFileTree,
  reconcileExpandedFileTreePaths,
  type FileTreeNode,
} from './instanceFileExplorerTree.ts';

interface InstanceFileExplorerProps {
  files: InstanceWorkbenchFile[];
  selectedFileId: string | null;
  onSelectFile: (fileId: string) => void;
}

export function InstanceFileExplorer({
  files,
  selectedFileId,
  onSelectFile,
}: InstanceFileExplorerProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedFileId) || null,
    [files, selectedFileId],
  );
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedPaths((current) => {
      const next = reconcileExpandedFileTreePaths({
        current,
        selectedFilePath: selectedFile?.path,
      });
      return next;
    });
  }, [selectedFile, tree]);

  const toggleDirectory = (path: string) => {
    setExpandedPaths((current) => ({
      ...current,
      [path]: !current[path],
    }));
  };

  const renderNodes = (nodes: FileTreeNode[], depth = 0) =>
    nodes.map((node) => {
      if (node.kind === 'directory') {
        const isExpanded = expandedPaths[node.path] ?? false;

        return (
          <div key={node.id}>
            <button
              type="button"
              data-slot="instance-files-tree-node"
              data-node-kind="directory"
              onClick={() => toggleDirectory(node.path)}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-950/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.06]"
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-amber-500" />
              )}
              <span className="truncate">{node.name}</span>
            </button>

            {isExpanded ? <div>{renderNodes(node.children || [], depth + 1)}</div> : null}
          </div>
        );
      }

      const isActive = node.file?.id === selectedFileId;

      return (
        <button
          key={node.id}
          type="button"
          data-slot="instance-files-tree-node"
          data-node-kind="file"
          onClick={() => onSelectFile(node.id)}
          className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors ${
            isActive
              ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
              : 'text-zinc-700 hover:bg-zinc-950/[0.05] dark:text-zinc-200 dark:hover:bg-white/[0.06]'
          }`}
          style={{ paddingLeft: `${depth * 14 + 34}px` }}
        >
          <FileCode2 className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{node.name}</div>
            <div
              className={`truncate text-[11px] ${
                isActive ? 'text-white/70 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {node.file?.status}
            </div>
          </div>
        </button>
      );
    });

  return (
    <div data-slot="instance-files-tree" className="space-y-1">
      {renderNodes(tree)}
    </div>
  );
}
