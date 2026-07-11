import {
  bootstrapServerBrowserPlatformBridge,
  getPlatformBridge,
} from '@sdkwork/agentstudio-pc-core';

export interface BootstrapShellRuntimeDependencies {
  getActivePlatform: () => string;
  bootstrapHostedBrowserBridge: () => Promise<boolean>;
  ensureI18n: () => Promise<void>;
}

async function ensureShellI18n() {
  const { ensureI18n } = await import('@sdkwork/agentstudio-pc-i18n');
  await ensureI18n();
}

function createBootstrapShellRuntimeDependencies(): BootstrapShellRuntimeDependencies {
  return {
    getActivePlatform: () => getPlatformBridge().platform.getPlatform(),
    bootstrapHostedBrowserBridge: () => bootstrapServerBrowserPlatformBridge(),
    ensureI18n: ensureShellI18n,
  };
}

export async function runBootstrapShellRuntime(
  dependencies: BootstrapShellRuntimeDependencies = createBootstrapShellRuntimeDependencies(),
) {
  if (dependencies.getActivePlatform() !== 'desktop') {
    await dependencies.bootstrapHostedBrowserBridge();
  }

  await dependencies.ensureI18n();
}

export async function bootstrapShellRuntime() {
  await runBootstrapShellRuntime();
}
