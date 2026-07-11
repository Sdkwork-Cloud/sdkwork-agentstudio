export interface KernelDetailModuleRegistration<TModule> {
  kernelId: string;
  module: TModule;
}

export interface KernelDetailModuleRegistry<TModule> {
  resolve(kernelId: string | null | undefined): TModule | null;
  listKernelIds(): string[];
}

function normalizeKernelId(kernelId: string | null | undefined) {
  return String(kernelId ?? '').trim().toLowerCase();
}

export function createKernelDetailModuleRegistry<TModule>(
  registrations: readonly KernelDetailModuleRegistration<TModule>[],
): KernelDetailModuleRegistry<TModule> {
  const moduleByKernelId = new Map<string, TModule>();

  for (const registration of registrations) {
    const normalizedKernelId = normalizeKernelId(registration.kernelId);
    if (!normalizedKernelId) {
      throw new Error('Kernel detail module registration is missing kernelId.');
    }
    if (moduleByKernelId.has(normalizedKernelId)) {
      throw new Error(`Duplicate kernel detail module registration: ${normalizedKernelId}`);
    }
    moduleByKernelId.set(normalizedKernelId, registration.module);
  }

  const kernelIds = [...moduleByKernelId.keys()];

  return {
    resolve(kernelId) {
      const normalizedKernelId = normalizeKernelId(kernelId);
      return normalizedKernelId ? moduleByKernelId.get(normalizedKernelId) ?? null : null;
    },
    listKernelIds() {
      return [...kernelIds];
    },
  };
}
