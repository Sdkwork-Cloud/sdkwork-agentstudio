#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  ensureTauriRustToolchain,
  withRustToolchainPath,
} from './ensure-tauri-rust-toolchain.mjs';

const __filename = fileURLToPath(import.meta.url);
const CARGO_PATH_VALUE_FLAGS = new Set(['--manifest-path', '--target-dir']);

function normalizeCargoPathValue(value, cwd = process.cwd()) {
  const normalizedValue = String(value ?? '').trim();
  if (!normalizedValue || path.isAbsolute(normalizedValue)) {
    return value;
  }

  return path.resolve(cwd, normalizedValue);
}

export function normalizeCargoInvocationArgs(cargoArgs, {
  cwd = process.cwd(),
} = {}) {
  const normalizedArgs = [];
  const args = Array.isArray(cargoArgs) ? cargoArgs : [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--') {
      normalizedArgs.push(...args.slice(index));
      break;
    }

    if (CARGO_PATH_VALUE_FLAGS.has(arg)) {
      normalizedArgs.push(arg);
      if (index + 1 < args.length) {
        normalizedArgs.push(normalizeCargoPathValue(args[index + 1], cwd));
        index += 1;
      }
      continue;
    }

    const equalsFlag = [...CARGO_PATH_VALUE_FLAGS].find((flag) => arg.startsWith(`${flag}=`));
    if (equalsFlag) {
      normalizedArgs.push(`${equalsFlag}=${normalizeCargoPathValue(arg.slice(equalsFlag.length + 1), cwd)}`);
      continue;
    }

    normalizedArgs.push(arg);
  }

  return normalizedArgs;
}

function main() {
  const cwd = process.cwd();
  const cargoArgs = normalizeCargoInvocationArgs(process.argv.slice(2), { cwd });

  if (cargoArgs.length === 0) {
    console.error('Usage: node scripts/run-cargo.mjs <cargo-args...>');
    process.exit(1);
  }

  ensureTauriRustToolchain();

  const env = withRustToolchainPath(process.env);
  const result = spawnSync('cargo', cargoArgs, {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

if (path.resolve(process.argv[1] ?? '') === __filename) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
