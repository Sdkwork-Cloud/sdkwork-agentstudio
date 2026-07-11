import type { InstanceWorkbenchFile } from '../types/index.ts';

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  kind: 'directory' | 'file';
  file?: InstanceWorkbenchFile;
  children?: FileTreeNode[];
}

interface MutableTreeNode extends FileTreeNode {
  childrenMap?: Map<string, MutableTreeNode>;
}

function createDirectoryNode(name: string, path: string): MutableTreeNode {
  return {
    id: `dir:${path}`,
    name,
    path,
    kind: 'directory',
    children: [],
    childrenMap: new Map(),
  };
}

function createFileNode(file: InstanceWorkbenchFile): MutableTreeNode {
  return {
    id: file.id,
    name: file.name,
    path: file.path,
    kind: 'file',
    file,
  };
}

function sortTree(nodes: MutableTreeNode[]): FileTreeNode[] {
  return nodes
    .sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }

      return a.name.localeCompare(b.name);
    })
    .map((node) => ({
      id: node.id,
      name: node.name,
      path: node.path,
      kind: node.kind,
      file: node.file,
      children: node.children ? sortTree(node.children as MutableTreeNode[]) : undefined,
    }));
}

export function buildFileTree(files: InstanceWorkbenchFile[]): FileTreeNode[] {
  const rootNodes = new Map<string, MutableTreeNode>();

  files.forEach((file) => {
    const segments = file.path.split('/').filter(Boolean);
    let currentMap = rootNodes;
    let currentPath = '';
    let parentNode: MutableTreeNode | null = null;

    segments.forEach((segment, index) => {
      currentPath = `${currentPath}/${segment}`;
      const isFile = index === segments.length - 1;

      if (!currentMap.has(currentPath)) {
        const nextNode = isFile ? createFileNode(file) : createDirectoryNode(segment, currentPath);

        currentMap.set(currentPath, nextNode);
        if (parentNode?.children) {
          (parentNode.children as MutableTreeNode[]).push(nextNode);
        }
      }

      const currentNode = currentMap.get(currentPath)!;
      if (!isFile) {
        parentNode = currentNode;
        currentMap = currentNode.childrenMap!;
      }
    });
  });

  return sortTree([...rootNodes.values()]);
}

export function getAncestorPaths(path: string) {
  const segments = path.split('/').filter(Boolean);
  return segments.slice(0, -1).map((_, index) => `/${segments.slice(0, index + 1).join('/')}`);
}

export function reconcileExpandedFileTreePaths(input: {
  current: Record<string, boolean>;
  selectedFilePath?: string | null;
}) {
  const next = { ...input.current };
  const selectedAncestors = input.selectedFilePath ? getAncestorPaths(input.selectedFilePath) : [];

  selectedAncestors.forEach((path) => {
    next[path] = true;
  });

  return next;
}
