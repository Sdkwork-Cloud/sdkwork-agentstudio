#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const DEFAULT_DESKTOP_DIST_DIR = path.join(
  rootDir,
  'packages',
  'sdkwork-agentstudio-pc-desktop',
  'dist',
);

export function collectHtmlAssetReferences(indexHtmlSource) {
  const stylesheetRefs = Array.from(
    indexHtmlSource.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/gi),
    (match) => match[1],
  );
  const scriptRefs = Array.from(
    indexHtmlSource.matchAll(/<script[^>]+src=["']([^"']+)["']/gi),
    (match) => match[1],
  );

  return {
    stylesheetRefs,
    scriptRefs,
    assetRefs: [...stylesheetRefs, ...scriptRefs],
  };
}

export function isRelativeBundledAssetPath(assetPath) {
  if (typeof assetPath !== 'string') {
    return false;
  }

  const normalizedAssetPath = assetPath.trim();
  if (normalizedAssetPath.length === 0) {
    return false;
  }

  return !(
    normalizedAssetPath.startsWith('/') ||
    normalizedAssetPath.startsWith('//') ||
    normalizedAssetPath.startsWith('http://') ||
    normalizedAssetPath.startsWith('https://') ||
    normalizedAssetPath.startsWith('data:')
  );
}

function resolveAssetFilePath(distDir, assetPath) {
  const normalizedAssetPath = assetPath.replace(/^[.][\\/]/, '');
  return path.join(distDir, normalizedAssetPath);
}

export function verifyDesktopBuildAssets({
  distDir = DEFAULT_DESKTOP_DIST_DIR,
} = {}) {
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (!existsSync(indexHtmlPath)) {
    throw new Error(`Missing desktop build index.html at ${indexHtmlPath}`);
  }

  const indexHtmlSource = readFileSync(indexHtmlPath, 'utf8');
  const { stylesheetRefs, scriptRefs, assetRefs } = collectHtmlAssetReferences(indexHtmlSource);

  if (stylesheetRefs.length === 0) {
    throw new Error(`Desktop build is missing a stylesheet reference in ${indexHtmlPath}`);
  }

  if (scriptRefs.length === 0) {
    throw new Error(`Desktop build is missing a script reference in ${indexHtmlPath}`);
  }

  for (const assetRef of assetRefs) {
    if (!isRelativeBundledAssetPath(assetRef)) {
      throw new Error(
        `Desktop build asset path must stay relative for packaged app loading, received "${assetRef}" in ${indexHtmlPath}`,
      );
    }

    const assetPath = resolveAssetFilePath(distDir, assetRef);
    if (!existsSync(assetPath)) {
      throw new Error(`Desktop build references missing asset ${assetRef} at ${assetPath}`);
    }
  }

  const stylesheetPath = resolveAssetFilePath(distDir, stylesheetRefs[0]);
  if (statSync(stylesheetPath).size <= 0) {
    throw new Error(`Desktop build stylesheet is empty: ${stylesheetPath}`);
  }

  return {
    distDir,
    indexHtmlPath,
    stylesheetRefs,
    scriptRefs,
  };
}

function main() {
  const result = verifyDesktopBuildAssets();
  console.log(
    `Verified desktop bundled assets at ${result.distDir} (${result.stylesheetRefs.length} stylesheet refs, ${result.scriptRefs.length} script refs).`,
  );
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
