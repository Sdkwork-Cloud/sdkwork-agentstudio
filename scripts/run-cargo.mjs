#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  buildCargoFailureMessage,
  normalizeCargoInvocationArgs,
} from './cargo-command-standards.mjs';
import {
  ensureNativeRustToolchain,
  withRustToolchainPath,
} from './ensure-native-rust-toolchain.mjs';

const __filename = fileURLToPath(import.meta.url);

export {
  buildCargoFailureMessage,
  normalizeCargoInvocationArgs,
};

function main() {
  const cwd = process.cwd();
  const cargoArgs = normalizeCargoInvocationArgs(process.argv.slice(2), { cwd });

  if (cargoArgs.length === 0) {
    console.error('Usage: node scripts/run-cargo.mjs <cargo-args...>');
    process.exit(1);
  }

  ensureNativeRustToolchain();

  const env = withRustToolchainPath(process.env);
  const result = spawnSync('cargo', cargoArgs, {
    cwd,
    env,
    stdio: ['inherit', 'inherit', 'pipe'],
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if ((result.status ?? 1) !== 0 || result.signal) {
    console.error(buildCargoFailureMessage({
      status: result.status,
      signal: result.signal,
      stderr: result.stderr,
    }));
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
