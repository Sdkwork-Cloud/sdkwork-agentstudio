import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const tsExtensionLoaderUrl = pathToFileURL(
  path.join(__dirname, 'ts-extension-loader.mjs'),
).href;

function createLoaderRegisterImport(loaderUrl) {
  const source = [
    'import { register } from "node:module";',
    'import { pathToFileURL } from "node:url";',
    `register(${JSON.stringify(loaderUrl)}, pathToFileURL("./"));`,
  ].join(' ');

  return `data:text/javascript,${encodeURIComponent(source)}`;
}

function createTypeScriptEntryEvalSource(scriptPath) {
  const scriptUrl = pathToFileURL(path.resolve(workspaceRoot, scriptPath)).href;
  return `await import(${JSON.stringify(scriptUrl)});`;
}

function createNodeTypeScriptArgs(scriptPath) {
  return [
    '--disable-warning=ExperimentalWarning',
    '--experimental-transform-types',
    '--import',
    createLoaderRegisterImport(tsExtensionLoaderUrl),
    '--input-type=module',
    '--eval',
    createTypeScriptEntryEvalSource(scriptPath),
  ];
}

export function runNodeTypeScriptChecks(scriptPaths) {
  for (const scriptPath of scriptPaths) {
    const result = spawnSync(process.execPath, createNodeTypeScriptArgs(scriptPath), {
      cwd: workspaceRoot,
      stdio: 'inherit',
      windowsHide: true,
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}
