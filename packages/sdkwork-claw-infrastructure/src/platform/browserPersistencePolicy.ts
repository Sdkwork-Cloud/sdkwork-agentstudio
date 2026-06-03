import type {
  StudioInstanceConfig,
  StudioInstanceRecord,
  StudioWorkbenchFileRecord,
  StudioWorkbenchLLMProviderConfigRecord,
  StudioWorkbenchLLMProviderRecord,
  StudioWorkbenchSnapshot,
} from '@sdkwork/claw-types';
import { isOpenClawBundledChannelId } from '@sdkwork/claw-types';

type BrowserPersistedWorkbenchChannelRecord =
  StudioWorkbenchSnapshot['channels'][number] & {
    values?: Record<string, string>;
  };

type BrowserPersistedWorkbenchSnapshot =
  Omit<StudioWorkbenchSnapshot, 'channels'> & {
    channels: BrowserPersistedWorkbenchChannelRecord[];
  };

export interface BrowserPersistedInstanceRegistryDocument {
  version: 1;
  instances: StudioInstanceRecord[];
}

export interface BrowserPersistedWorkbenchRegistryDocument {
  version: 1;
  workbenches: Record<string, BrowserPersistedWorkbenchSnapshot>;
}

const NON_PERSISTABLE_EXACT_FIELDS = new Set([
  'apikeysource',
  'authtoken',
  'workspacepath',
  'request',
  'headers',
  'auth',
  'tls',
  'serviceaccountjson',
  'clientsecret',
  'signingsecret',
  'aeskey',
  'password',
  'passphrase',
  'privatekey',
  'publickey',
  'cert',
  'certificate',
  'ca',
  'key',
]);

function normalizeFieldName(fieldName: string) {
  return fieldName.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isPersistableClientField(fieldName: string) {
  const normalized = normalizeFieldName(fieldName);
  if (!normalized) {
    return true;
  }

  if (NON_PERSISTABLE_EXACT_FIELDS.has(normalized)) {
    return false;
  }

  if (normalized.endsWith('token')) {
    return false;
  }

  if (normalized.endsWith('secret')) {
    return false;
  }

  if (normalized.includes('apikey')) {
    return false;
  }

  if (normalized.endsWith('password') || normalized.endsWith('passphrase')) {
    return false;
  }

  return true;
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, candidate]) => typeof candidate === 'string')
      .map(([key, candidate]) => [key, candidate as string]),
  );
}

function formatPersistedFileSize(content: string) {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  return `${kilobytes >= 10 ? kilobytes.toFixed(0) : kilobytes.toFixed(1)} KB`;
}

function sanitizePersistedJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizePersistedJsonValue(entry))
      .filter((entry) => entry !== undefined);
  }

  if (value && typeof value === 'object') {
    const nextEntries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => isPersistableClientField(key))
      .map(([key, child]) => [key, sanitizePersistedJsonValue(child)] as const)
      .filter(([, child]) => child !== undefined);

    return Object.fromEntries(nextEntries);
  }

  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
  ) {
    return value;
  }

  return undefined;
}

export function sanitizeBrowserInstanceConfig(
  config: StudioInstanceConfig,
): StudioInstanceConfig {
  return {
    port: config.port,
    sandbox: config.sandbox,
    autoUpdate: config.autoUpdate,
    logLevel: config.logLevel,
    corsOrigins: config.corsOrigins,
    baseUrl: config.baseUrl ?? undefined,
    websocketUrl: config.websocketUrl ?? undefined,
  };
}

export function sanitizeBrowserInstanceRecord(
  instance: StudioInstanceRecord,
): StudioInstanceRecord {
  return {
    ...instance,
    config: sanitizeBrowserInstanceConfig(instance.config),
  };
}

export function sanitizeBrowserWorkbenchChannelValues(
  values?: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(normalizeStringRecord(values))
      .filter(([key]) => isPersistableClientField(key)),
  );
}

export function sanitizeBrowserWorkbenchChannelRecord<T extends BrowserPersistedWorkbenchChannelRecord>(
  channel: T,
): T | null {
  if (!isOpenClawBundledChannelId(channel.id)) {
    return null;
  }

  return {
    ...channel,
    values: sanitizeBrowserWorkbenchChannelValues(channel.values),
  };
}

export function sanitizeBrowserWorkbenchProviderConfig(
  config: StudioWorkbenchLLMProviderConfigRecord,
): StudioWorkbenchLLMProviderConfigRecord {
  return {
    temperature: config.temperature,
    topP: config.topP,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    streaming: config.streaming,
  };
}

export function sanitizeBrowserWorkbenchProviderRecord(
  provider: StudioWorkbenchLLMProviderRecord,
): StudioWorkbenchLLMProviderRecord {
  return {
    ...provider,
    apiKeySource: '',
    capabilities: [...provider.capabilities],
    models: provider.models.map((model) => ({ ...model })),
    config: sanitizeBrowserWorkbenchProviderConfig(provider.config),
  };
}

export function sanitizeBrowserWorkbenchFileRecord(
  file: StudioWorkbenchFileRecord,
): StudioWorkbenchFileRecord {
  if (file.id !== '/workspace/main/openclaw.json') {
    return {
      ...file,
    };
  }

  try {
    const parsed = JSON.parse(file.content);
    const sanitizedRoot = sanitizePersistedJsonValue(parsed);
    const content = `${JSON.stringify(sanitizedRoot ?? {}, null, 2)}\n`;

    return {
      ...file,
      content,
      size: formatPersistedFileSize(content),
    };
  } catch {
    return {
      ...file,
    };
  }
}

export function sanitizeBrowserWorkbenchSnapshot(
  snapshot: BrowserPersistedWorkbenchSnapshot,
): BrowserPersistedWorkbenchSnapshot {
  return {
    ...snapshot,
    channels: snapshot.channels
      .map(sanitizeBrowserWorkbenchChannelRecord)
      .filter((channel): channel is BrowserPersistedWorkbenchChannelRecord => Boolean(channel)),
    cronTasks: {
      tasks: snapshot.cronTasks.tasks.map((task) => ({
        ...task,
        scheduleConfig: { ...task.scheduleConfig },
        latestExecution: task.latestExecution ? { ...task.latestExecution } : null,
        rawDefinition: task.rawDefinition
          ? JSON.parse(JSON.stringify(task.rawDefinition)) as Record<string, unknown>
          : undefined,
      })),
      taskExecutionsById: Object.fromEntries(
        Object.entries(snapshot.cronTasks.taskExecutionsById).map(([taskId, executions]) => [
          taskId,
          executions.map((execution) => ({ ...execution })),
        ]),
      ),
    },
    llmProviders: snapshot.llmProviders.map(sanitizeBrowserWorkbenchProviderRecord),
    agents: snapshot.agents.map((agent) => ({
      ...agent,
      agent: { ...agent.agent },
      focusAreas: [...agent.focusAreas],
    })),
    skills: snapshot.skills.map((skill) => ({ ...skill })),
    files: snapshot.files.map(sanitizeBrowserWorkbenchFileRecord),
    memory: snapshot.memory.map((entry) => ({ ...entry })),
    tools: snapshot.tools.map((tool) => ({ ...tool })),
  };
}

export function sanitizeBrowserInstanceRegistryDocument(
  document: BrowserPersistedInstanceRegistryDocument,
): BrowserPersistedInstanceRegistryDocument {
  return {
    version: 1,
    instances: document.instances.map(sanitizeBrowserInstanceRecord),
  };
}

export function sanitizeBrowserWorkbenchRegistryDocument(
  document: BrowserPersistedWorkbenchRegistryDocument,
): BrowserPersistedWorkbenchRegistryDocument {
  return {
    version: 1,
    workbenches: Object.fromEntries(
      Object.entries(document.workbenches).map(([instanceId, snapshot]) => [
        instanceId,
        sanitizeBrowserWorkbenchSnapshot(snapshot),
      ]),
    ),
  };
}
