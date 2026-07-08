import assert from 'node:assert/strict';
import type { InstanceWorkbenchFile } from '../types/index.ts';
import {
  buildFileTree,
  reconcileExpandedFileTreePaths,
} from './instanceFileExplorerTree.ts';

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function createFile(id: string, path: string): InstanceWorkbenchFile {
  return {
    id,
    name: path.split('/').filter(Boolean).at(-1) || 'file.txt',
    path,
    category: 'artifact',
    language: 'plaintext',
    size: '1 KB',
    updatedAt: '2026-05-06T00:00:00.000Z',
    status: 'synced',
    description: 'Test file',
    content: '',
    isReadonly: false,
  };
}

runTest('buildFileTree keeps root directories collapsed until expansion state opens them', () => {
  const tree = buildFileTree([
    createFile('a', '/workspace/main/src/App.tsx'),
    createFile('b', '/workspace/main/docs/README.md'),
  ]);

  assert.deepEqual(tree.map((node) => ({
    kind: node.kind,
    path: node.path,
  })), [
    {
      kind: 'directory',
      path: '/workspace',
    },
  ]);
});

runTest('reconcileExpandedFileTreePaths opens only the selected file ancestors', () => {
  const expanded = reconcileExpandedFileTreePaths({
    current: {
      '/workspace/main/docs': false,
    },
    selectedFilePath: '/workspace/main/src/App.tsx',
  });

  assert.deepEqual(expanded, {
    '/workspace/main/docs': false,
    '/workspace': true,
    '/workspace/main': true,
    '/workspace/main/src': true,
  });
});
