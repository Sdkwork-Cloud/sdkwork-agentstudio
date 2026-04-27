import {
  DEFAULT_BUNDLED_OPENCLAW_VERSION,
  OPENCLAW_GATEWAY_DEFAULT_BASE_URL,
  OPENCLAW_GATEWAY_DEFAULT_HOST,
  OPENCLAW_GATEWAY_DEFAULT_PORT,
  OPENCLAW_GATEWAY_DEFAULT_WEBSOCKET_URL,
  STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
  isBuiltInOpenClawInstanceId,
} from '@sdkwork/claw-types';
import type {
  StudioConversationMessage,
  StudioConversationRecord,
  StudioConversationSummary,
  StudioInstanceAuthMode,
  StudioInstanceArtifactRecord,
  StudioInstanceCapability,
  StudioInstanceCapabilitySnapshot,
  StudioInstanceCapabilityStatus,
  StudioInstanceConfig,
  StudioInstanceConnectivityEndpoint,
  StudioInstanceDataAccessEntry,
  StudioInstanceDataAccessSnapshot,
  StudioInstanceDetailRecord,
  StudioInstanceEndpointKind,
  StudioInstanceEndpointStatus,
  StudioInstanceExposure,
  StudioInstanceHealthCheck,
  StudioInstanceHealthSnapshot,
  StudioInstanceHealthStatus,
  StudioInstanceLifecycleOwner,
  StudioInstanceLifecycleSnapshot,
  StudioInstanceObservabilitySnapshot,
  StudioInstanceRecord,
  StudioInstanceStatus,
  StudioInstanceStorageSnapshot,
  StudioInstanceStorageStatus,
  StudioInstanceRuntimeNote,
  StudioStorageBinding,
  StudioWorkbenchFileRecord,
  StudioWorkbenchLLMProviderRecord,
  StudioWorkbenchSnapshot,
  StudioWorkbenchTaskRecord,
  StudioWorkbenchTaskExecutionRecord,
} from '@sdkwork/claw-types';
import type {
  StudioCreateInstanceInput,
  StudioInstanceTaskMutationPayload,
  StudioUpdateInstanceLlmProviderConfigInput,
  StudioPlatformAPI,
  StudioUpdateInstanceInput,
} from './contracts/studio.ts';
import {
  assertValidStudioCreateInstanceKernelPolicy,
} from './contracts/studioKernelPolicy.ts';
import {
  sanitizeBrowserInstanceRegistryDocument,
  sanitizeBrowserInstanceRecord,
  sanitizeBrowserWorkbenchRegistryDocument,
  sanitizeBrowserWorkbenchSnapshot,
} from './browserPersistencePolicy.ts';

const INSTANCE_STORAGE_KEY = 'claw-studio:studio:instances:v1';
const CONVERSATION_STORAGE_KEY = 'claw-studio:studio:conversations:v1';
const WORKBENCH_STORAGE_KEY = 'claw-studio:studio:workbench:v1';
const DEFAULT_INSTANCE_ID = STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID;
const DEFAULT_OPENCLAW_PROVIDER_ID = 'openai';
const DEFAULT_OPENCLAW_AGENT_FILE_ID = '/workspace/main/AGENTS.md';
const DEFAULT_OPENCLAW_MEMORY_FILE_ID = '/workspace/main/MEMORY.md';
const DEFAULT_OPENCLAW_CONFIG_FILE_ID = '/workspace/main/openclaw.json';

type BrowserOpenClawWorkbenchChannelRecord = StudioWorkbenchSnapshot['channels'][number] & {
  values?: Record<string, string>;
};

type BrowserOpenClawWorkbenchSnapshot = Omit<StudioWorkbenchSnapshot, 'channels'> & {
  channels: BrowserOpenClawWorkbenchChannelRecord[];
};

interface BrowserOpenClawChannelTemplate {
  id: string;
  name: string;
  description: string;
  configurationMode: 'required' | 'none';
  fieldCount: number;
  setupSteps: string[];
}

const BROWSER_OPENCLAW_CHANNEL_TEMPLATES: BrowserOpenClawChannelTemplate[] = [
  {
    id: 'sdkworkchat',
    name: 'Sdkwork Chat',
    description:
      'Deliver OpenClaw conversations directly into the first-party Sdkwork Chat experience.',
    configurationMode: 'none',
    fieldCount: 0,
    setupSteps: [
      'Download the Sdkwork Chat app or open the existing Sdkwork Chat workspace.',
      'Sign in with your SDKWork account to receive OpenClaw conversations immediately.',
      'Keep this channel enabled when the current runtime should hand off into Sdkwork Chat.',
    ],
  },
  {
    id: 'wehcat',
    name: 'Wehcat',
    description:
      'Connect a WeChat official account workflow so OpenClaw can serve China-facing channels.',
    configurationMode: 'required',
    fieldCount: 4,
    setupSteps: [
      'Create or manage a WeChat official account in the WeChat platform.',
      'Paste the App ID, App Secret, token, and optional AES key here.',
      'Configure the callback URL on the WeChat side and enable the channel.',
    ],
  },
  {
    id: 'qq',
    name: 'QQ',
    description:
      'Connect a QQ bot so OpenClaw can route commands, alerts, and approvals into QQ groups.',
    configurationMode: 'required',
    fieldCount: 2,
    setupSteps: [
      'Create or manage the target QQ bot in the QQ bot platform.',
      'Paste the bot key and target group ID here.',
      'Enable the channel after a dry-run delivery succeeds.',
    ],
  },
  {
    id: 'dingtalk',
    name: 'DingTalk',
    description:
      'Connect a DingTalk custom robot so OpenClaw can broadcast updates into DingTalk workspaces.',
    configurationMode: 'required',
    fieldCount: 2,
    setupSteps: [
      'Create a custom robot in the target DingTalk group.',
      'Copy the access token and signing secret into this form.',
      'Enable the channel after the first connectivity check succeeds.',
    ],
  },
  {
    id: 'wecom',
    name: 'WeCom',
    description:
      'Connect a WeCom application so OpenClaw can serve enterprise WeCom conversations.',
    configurationMode: 'required',
    fieldCount: 3,
    setupSteps: [
      'Create a WeCom application with bot or customer-contact permissions.',
      'Paste the corp ID, agent ID, and secret here.',
      'Save the configuration and verify that message delivery succeeds.',
    ],
  },
  {
    id: 'feishu',
    name: 'Feishu',
    description:
      'Connect a Feishu bot so OpenClaw can receive and reply to team messages.',
    configurationMode: 'required',
    fieldCount: 4,
    setupSteps: [
      'Create a Feishu app in the open platform.',
      'Copy the App ID and App Secret into this form.',
      'Add the event callback URL from your OpenClaw deployment if needed.',
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description:
      'Use a Telegram bot token to bring OpenClaw into direct messages or group chats.',
    configurationMode: 'required',
    fieldCount: 7,
    setupSteps: [
      'Create a bot with BotFather and copy the bot token.',
      'Optionally set a webhook URL if Telegram should push events to your host.',
      'Enable the channel after the required credentials are filled.',
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    description:
      'Attach OpenClaw to a Discord bot for server and DM conversations.',
    configurationMode: 'required',
    fieldCount: 1,
    setupSteps: [
      'Create a Discord application and bot in the developer portal.',
      'Paste the bot token here and invite the bot to your server.',
      'Turn the channel on once the token has been validated.',
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description:
      'Configure bot and app tokens so OpenClaw can work inside Slack workspaces.',
    configurationMode: 'required',
    fieldCount: 3,
    setupSteps: [
      'Create or open your Slack app and install it to the target workspace.',
      'Paste the bot token and app token below.',
      'Add a signing secret if your workspace uses slash commands or events.',
    ],
  },
  {
    id: 'googlechat',
    name: 'Google Chat',
    description:
      'Provide Google Chat service account or ref details for enterprise workspace delivery.',
    configurationMode: 'required',
    fieldCount: 6,
    setupSteps: [
      'Create a Google Chat app and service account.',
      'Provide either the inline service account JSON or a service account reference.',
      'Fill audience or webhook information if your deployment requires it.',
    ],
  },
];

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function mapSessionTarget(
  sessionTarget: string | undefined,
): Pick<StudioWorkbenchTaskRecord, 'sessionMode' | 'customSessionId'> {
  if (sessionTarget === 'main') {
    return { sessionMode: 'main' };
  }

  if (sessionTarget === 'current') {
    return { sessionMode: 'current' };
  }

  if (sessionTarget?.startsWith('session:')) {
    const customSessionId = sessionTarget.slice('session:'.length).trim();
    if (customSessionId) {
      return {
        sessionMode: 'custom',
        customSessionId,
      };
    }
  }

  return { sessionMode: 'isolated' };
}

function mapDelivery(
  delivery: Record<string, unknown>,
  sessionMode: StudioWorkbenchTaskRecord['sessionMode'],
): Pick<StudioWorkbenchTaskRecord, 'deliveryMode' | 'deliveryBestEffort' | 'deliveryChannel' | 'recipient'> {
  const deliveryMode = asString(delivery.mode);
  const recipient = asString(delivery.to);
  const deliveryBestEffort = asBoolean(delivery.bestEffort) ? true : undefined;

  if (deliveryMode === 'webhook') {
    return {
      deliveryMode: 'webhook',
      deliveryBestEffort,
      deliveryChannel: undefined,
      recipient,
    };
  }

  if (deliveryMode === 'none' || (!deliveryMode && sessionMode === 'main')) {
    return {
      deliveryMode: 'none',
      deliveryBestEffort: undefined,
      deliveryChannel: undefined,
      recipient: undefined,
    };
  }

  return {
    deliveryMode: 'publishSummary',
    deliveryBestEffort,
    deliveryChannel: asString(delivery.channel),
    recipient,
  };
}

function cloneTaskRawDefinition(payload: StudioInstanceTaskMutationPayload) {
  return JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
}

function toIsoString(value: number = Date.now()) {
  return new Date(value).toISOString();
}

function buildOpenClawTaskRecord(
  payload: StudioInstanceTaskMutationPayload,
  existing?: StudioWorkbenchTaskRecord,
): StudioWorkbenchTaskRecord {
  const root = asObject(payload);
  const schedule = asObject(root.schedule);
  const jobPayload = asObject(root.payload);
  const delivery = asObject(root.delivery);
  const scheduleKind = asString(schedule.kind) || 'cron';
  const payloadKind = asString(jobPayload.kind);
  const session = mapSessionTarget(asString(root.sessionTarget));
  const deliveryState = mapDelivery(delivery, session.sessionMode);

  if (scheduleKind === 'every') {
    const everyMs = asNumber(schedule.everyMs) || 30 * 60 * 1000;
    const intervalMinutes = Math.max(1, Math.round(everyMs / (60 * 1000)));
    return {
      id: existing?.id || `web-task-${Math.random().toString(36).slice(2, 10)}`,
      name: asString(root.name) || 'Untitled task',
      description: asString(root.description),
      prompt: asString(jobPayload.message) || asString(jobPayload.text) || '',
      schedule: `@every ${intervalMinutes}m`,
      scheduleMode: 'interval',
      scheduleConfig: {
        intervalValue: intervalMinutes,
        intervalUnit: 'minute',
      },
      cronExpression: undefined,
      actionType: payloadKind === 'systemEvent' ? 'message' : 'skill',
      status: asBoolean(root.enabled) === false ? 'paused' : 'active',
      ...session,
      wakeUpMode: asString(root.wakeMode) === 'next-heartbeat' ? 'nextCycle' : 'immediate',
      executionContent: payloadKind === 'systemEvent' ? 'sendPromptMessage' : 'runAssistantTask',
      timeoutSeconds: asNumber(jobPayload.timeoutSeconds),
      deleteAfterRun: asBoolean(root.deleteAfterRun),
      agentId: asString(root.agentId),
      model: asString(jobPayload.model),
      thinking: asString(jobPayload.thinking) as StudioWorkbenchTaskRecord['thinking'],
      lightContext: asBoolean(jobPayload.lightContext),
      ...deliveryState,
      lastRun: existing?.lastRun,
      nextRun: existing?.nextRun,
      latestExecution: existing?.latestExecution ? { ...existing.latestExecution } : null,
      rawDefinition: cloneTaskRawDefinition(payload),
    };
  }

  if (scheduleKind === 'at') {
    const at = asString(schedule.at) || '';
    const parsed = at ? new Date(at) : null;
    const year = parsed && !Number.isNaN(parsed.getTime()) ? parsed.getFullYear() : 2026;
    const month = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getMonth() + 1).padStart(2, '0') : '01';
    const day = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getDate()).padStart(2, '0') : '01';
    const hours = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getHours()).padStart(2, '0') : '09';
    const minutes = parsed && !Number.isNaN(parsed.getTime()) ? String(parsed.getMinutes()).padStart(2, '0') : '00';
    const scheduledDate = `${year}-${month}-${day}`;
    const scheduledTime = `${hours}:${minutes}`;

    return {
      id: existing?.id || `web-task-${Math.random().toString(36).slice(2, 10)}`,
      name: asString(root.name) || 'Untitled task',
      description: asString(root.description),
      prompt: asString(jobPayload.message) || asString(jobPayload.text) || '',
      schedule: `at ${scheduledDate} ${scheduledTime}`,
      scheduleMode: 'datetime',
      scheduleConfig: {
        scheduledDate,
        scheduledTime,
      },
      cronExpression: `${Number(minutes)} ${Number(hours)} ${Number(day)} ${Number(month)} *`,
      actionType: payloadKind === 'systemEvent' ? 'message' : 'skill',
      status: asBoolean(root.enabled) === false ? 'paused' : 'active',
      ...session,
      wakeUpMode: asString(root.wakeMode) === 'next-heartbeat' ? 'nextCycle' : 'immediate',
      executionContent: payloadKind === 'systemEvent' ? 'sendPromptMessage' : 'runAssistantTask',
      timeoutSeconds: asNumber(jobPayload.timeoutSeconds),
      deleteAfterRun: asBoolean(root.deleteAfterRun),
      agentId: asString(root.agentId),
      model: asString(jobPayload.model),
      thinking: asString(jobPayload.thinking) as StudioWorkbenchTaskRecord['thinking'],
      lightContext: asBoolean(jobPayload.lightContext),
      ...deliveryState,
      lastRun: existing?.lastRun,
      nextRun: existing?.nextRun,
      latestExecution: existing?.latestExecution ? { ...existing.latestExecution } : null,
      rawDefinition: cloneTaskRawDefinition(payload),
    };
  }

  return {
    id: existing?.id || `web-task-${Math.random().toString(36).slice(2, 10)}`,
    name: asString(root.name) || 'Untitled task',
    description: asString(root.description),
    prompt: asString(jobPayload.message) || asString(jobPayload.text) || '',
    schedule: asString(schedule.expr) || '* * * * *',
    scheduleMode: 'cron',
    scheduleConfig: {
      cronExpression: asString(schedule.expr) || '* * * * *',
      cronTimezone: asString(schedule.tz),
      staggerMs: asNumber(schedule.staggerMs),
    },
    cronExpression: asString(schedule.expr) || '* * * * *',
    actionType: payloadKind === 'systemEvent' ? 'message' : 'skill',
    status: asBoolean(root.enabled) === false ? 'paused' : 'active',
    ...session,
    wakeUpMode: asString(root.wakeMode) === 'next-heartbeat' ? 'nextCycle' : 'immediate',
    executionContent: payloadKind === 'systemEvent' ? 'sendPromptMessage' : 'runAssistantTask',
    timeoutSeconds: asNumber(jobPayload.timeoutSeconds),
    deleteAfterRun: asBoolean(root.deleteAfterRun),
    agentId: asString(root.agentId),
    model: asString(jobPayload.model),
    thinking: asString(jobPayload.thinking) as StudioWorkbenchTaskRecord['thinking'],
    lightContext: asBoolean(jobPayload.lightContext),
    ...deliveryState,
    lastRun: existing?.lastRun,
    nextRun: existing?.nextRun,
    latestExecution: existing?.latestExecution ? { ...existing.latestExecution } : null,
    rawDefinition: cloneTaskRawDefinition(payload),
  };
}

interface StudioInstanceRegistryDocument {
  version: 1;
  instances: StudioInstanceRecord[];
}

interface StudioConversationRegistryDocument {
  version: 1;
  conversations: StudioConversationRecord[];
}

interface StudioWorkbenchRegistryDocument {
  version: 1;
  workbenches: Record<string, BrowserOpenClawWorkbenchSnapshot>;
}

function now() {
  return Date.now();
}

function getStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function createDefaultStorageBinding(): StudioStorageBinding {
  return {
    profileId: 'default-local',
    provider: 'localFile',
    namespace: 'claw-studio',
    database: null,
    connectionHint: null,
    endpoint: null,
  };
}

function createDefaultInstanceConfig(
  input?: Partial<StudioInstanceConfig>,
): StudioInstanceConfig {
  return {
    port: input?.port ?? String(OPENCLAW_GATEWAY_DEFAULT_PORT),
    sandbox: input?.sandbox ?? true,
    autoUpdate: input?.autoUpdate ?? true,
    logLevel: input?.logLevel ?? 'info',
    corsOrigins: input?.corsOrigins ?? '*',
    baseUrl: input?.baseUrl ?? OPENCLAW_GATEWAY_DEFAULT_BASE_URL,
    websocketUrl: input?.websocketUrl ?? OPENCLAW_GATEWAY_DEFAULT_WEBSOCKET_URL,
  };
}

function createDefaultBuiltInInstance(): StudioInstanceRecord {
  const createdAt = now();

  return {
    id: DEFAULT_INSTANCE_ID,
    name: 'Local Built-In',
    description: 'Packaged local OpenClaw kernel managed by Claw Studio.',
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: 'online',
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
    typeLabel: 'Built-In OpenClaw',
    host: OPENCLAW_GATEWAY_DEFAULT_HOST,
    port: OPENCLAW_GATEWAY_DEFAULT_PORT,
    baseUrl: OPENCLAW_GATEWAY_DEFAULT_BASE_URL,
    websocketUrl: OPENCLAW_GATEWAY_DEFAULT_WEBSOCKET_URL,
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities: ['chat', 'health', 'files', 'memory', 'tasks', 'tools', 'models'],
    storage: createDefaultStorageBinding(),
    config: createDefaultInstanceConfig(),
    createdAt,
    updatedAt: createdAt,
    lastSeenAt: createdAt,
  };
}

function isManagedBuiltInOpenClawInstance(instance: StudioInstanceRecord) {
  return (
    instance.runtimeKind === 'openclaw' &&
    instance.isBuiltIn === true &&
    instance.deploymentMode === 'local-managed' &&
    instance.transportKind === 'openclawGatewayWs'
  );
}

function resolveRequestedInstanceId(
  instances: StudioInstanceRecord[],
  requestedId: string,
) {
  const normalizedRequestedId = requestedId.trim();
  if (!normalizedRequestedId) {
    return requestedId;
  }

  if (normalizedRequestedId === STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID) {
    return (
      instances.find(isManagedBuiltInOpenClawInstance)?.id ??
      STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID
    );
  }

  return normalizedRequestedId;
}

function findRequestedInstance(
  instances: StudioInstanceRecord[],
  requestedId: string,
) {
  const resolvedId = resolveRequestedInstanceId(instances, requestedId);
  return instances.find((instance) => instance.id === resolvedId) ?? null;
}

function normalizeBuiltInInstance(instance: StudioInstanceRecord): StudioInstanceRecord {
  const baseline = createDefaultBuiltInInstance();
  const resolvedName = instance.name?.trim() || baseline.name;
  const resolvedDescription = instance.description?.trim() || baseline.description;
  const resolvedTypeLabel = instance.typeLabel?.trim() || baseline.typeLabel;
  const resolvedPort = baseline.port ?? OPENCLAW_GATEWAY_DEFAULT_PORT;
  const resolvedBaseUrl = baseline.baseUrl ?? OPENCLAW_GATEWAY_DEFAULT_BASE_URL;
  const resolvedWebsocketUrl =
    baseline.websocketUrl ?? OPENCLAW_GATEWAY_DEFAULT_WEBSOCKET_URL;

  return {
    ...baseline,
    ...instance,
    id: STABLE_BUILT_IN_OPENCLAW_INSTANCE_ID,
    name: resolvedName,
    description: resolvedDescription,
    runtimeKind: 'openclaw',
    deploymentMode: 'local-managed',
    transportKind: 'openclawGatewayWs',
    status: instance.status || baseline.status,
    isBuiltIn: true,
    isDefault: true,
    iconType: 'server',
    version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
    typeLabel: resolvedTypeLabel,
    host: OPENCLAW_GATEWAY_DEFAULT_HOST,
    port: resolvedPort,
    baseUrl: resolvedBaseUrl,
    websocketUrl: resolvedWebsocketUrl,
    cpu: instance.cpu ?? baseline.cpu,
    memory: instance.memory ?? baseline.memory,
    totalMemory: instance.totalMemory ?? baseline.totalMemory,
    uptime: instance.uptime ?? baseline.uptime,
    capabilities:
      Array.isArray(instance.capabilities) && instance.capabilities.length > 0
        ? instance.capabilities
        : baseline.capabilities,
    storage: {
      ...baseline.storage,
      ...(instance.storage || {}),
      provider: instance.storage?.provider ?? baseline.storage.provider,
      namespace: instance.storage?.namespace ?? baseline.storage.namespace,
    },
    config: createDefaultInstanceConfig({
      ...(instance.config || {}),
      port: String(resolvedPort),
      baseUrl: resolvedBaseUrl,
      websocketUrl: resolvedWebsocketUrl,
    }),
    createdAt: instance.createdAt ?? baseline.createdAt,
    updatedAt: instance.updatedAt ?? baseline.updatedAt,
    lastSeenAt: instance.lastSeenAt ?? baseline.lastSeenAt,
  };
}

function isBuiltInOpenClawWorkbenchInstance(instance: StudioInstanceRecord) {
  return isManagedBuiltInOpenClawInstance(instance);
}

function formatWorkbenchFileSize(content: string) {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  return `${kilobytes >= 10 ? kilobytes.toFixed(0) : kilobytes.toFixed(1)} KB`;
}

function summarizeMemoryContent(content: string) {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('#'));

  return lines[0] || 'OpenClaw workspace memory for the browser-backed workbench.';
}

function createWorkbenchFile(params: {
  id: string;
  name: string;
  path: string;
  category: StudioWorkbenchFileRecord['category'];
  language: string;
  description: string;
  content: string;
}): StudioWorkbenchFileRecord {
  const updatedAt = toIsoString();
  return {
    id: params.id,
    name: params.name,
    path: params.path,
    category: params.category,
    language: params.language,
    size: formatWorkbenchFileSize(params.content),
    updatedAt,
    status: 'synced',
    description: params.description,
    content: params.content,
    isReadonly: false,
  };
}

function buildDefaultOpenClawConfigContent(instance: StudioInstanceRecord) {
  return JSON.stringify(
    {
      runtime: 'openclaw',
      version: DEFAULT_BUNDLED_OPENCLAW_VERSION,
      instanceId: instance.id,
      gateway: {
        baseUrl: instance.baseUrl ?? null,
        websocketUrl: instance.websocketUrl ?? null,
        port: instance.config.port,
      },
      workspace: {
        root: '/workspace/main',
      },
      channels: {
        sdkworkchat: {
          enabled: true,
        },
      },
      models: {
        defaultProvider: DEFAULT_OPENCLAW_PROVIDER_ID,
      },
    },
    null,
    2,
  );
}

function buildOpenClawConfigFile(instance: StudioInstanceRecord) {
  return createWorkbenchFile({
    id: DEFAULT_OPENCLAW_CONFIG_FILE_ID,
    name: 'openclaw.json',
    path: DEFAULT_OPENCLAW_CONFIG_FILE_ID,
    category: 'config',
    language: 'json',
    description: 'Browser-backed OpenClaw runtime configuration snapshot.',
    content: buildDefaultOpenClawConfigContent(instance),
  });
}

function buildOpenClawMemoryEntries(files: StudioWorkbenchFileRecord[]) {
  return files
    .filter((file) => file.category === 'memory' || file.name === 'MEMORY.md')
    .map((file) => ({
      id: `memory:${file.id}`,
      title: file.name,
      type: 'runbook' as const,
      summary: summarizeMemoryContent(file.content),
      source: 'system' as const,
      updatedAt: file.updatedAt,
      retention: 'pinned' as const,
      tokens: Math.max(1, Math.ceil(file.content.length / 4)),
    }));
}

function normalizeChannelValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, candidate]) => typeof candidate === 'string')
      .map(([key, candidate]) => [key, candidate as string]),
  );
}

function countConfiguredChannelValues(values: Record<string, string>) {
  return Object.values(values).filter((value) => value.trim().length > 0).length;
}

function resolveBrowserOpenClawChannelTemplate(
  channelId: string,
  current?: Partial<BrowserOpenClawWorkbenchChannelRecord> | null,
): BrowserOpenClawChannelTemplate {
  const matched = BROWSER_OPENCLAW_CHANNEL_TEMPLATES.find((template) => template.id === channelId);
  if (matched) {
    return matched;
  }

  return {
    id: channelId,
    name: current?.name || channelId,
    description: current?.description || 'Browser-backed OpenClaw channel.',
    configurationMode: current?.configurationMode || 'required',
    fieldCount:
      typeof current?.fieldCount === 'number' && Number.isFinite(current.fieldCount)
        ? current.fieldCount
        : 0,
    setupSteps: current?.setupSteps ? [...current.setupSteps] : [],
  };
}

function createBrowserOpenClawChannelRecord(input: {
  template: BrowserOpenClawChannelTemplate;
  values?: Record<string, string>;
  enabled?: boolean;
  configuredFieldCount?: number;
}): BrowserOpenClawWorkbenchChannelRecord {
  const values = normalizeChannelValues(input.values);
  const configuredFieldCount =
    typeof input.configuredFieldCount === 'number'
      ? input.configuredFieldCount
      : countConfiguredChannelValues(values);
  const enabled =
    typeof input.enabled === 'boolean'
      ? input.enabled
      : input.template.configurationMode === 'none'
        ? true
        : configuredFieldCount > 0;
  const status =
    input.template.configurationMode === 'none'
      ? enabled
        ? 'connected'
        : 'disconnected'
      : configuredFieldCount === 0
        ? 'not_configured'
        : enabled
          ? 'connected'
          : 'disconnected';

  return {
    id: input.template.id,
    name: input.template.name,
    description: input.template.description,
    status,
    enabled,
    configurationMode: input.template.configurationMode,
    fieldCount: input.template.fieldCount,
    configuredFieldCount,
    setupSteps: [...input.template.setupSteps],
    values,
  };
}

function sortBrowserOpenClawChannels(
  channels: BrowserOpenClawWorkbenchChannelRecord[],
) {
  const order = new Map(
    BROWSER_OPENCLAW_CHANNEL_TEMPLATES.map((template, index) => [template.id, index] as const),
  );

  return [...channels].sort((left, right) => {
    const leftOrder = order.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

function sortWorkbenchFiles(files: StudioWorkbenchFileRecord[]) {
  return [...files].sort((left, right) => left.path.localeCompare(right.path));
}

function buildDefaultOpenClawWorkbenchChannels() {
  return BROWSER_OPENCLAW_CHANNEL_TEMPLATES.map((template) =>
    createBrowserOpenClawChannelRecord({ template }),
  );
}

function parseWorkbenchConfigRoot(content: string) {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function updateWorkbenchConfigFile(
  snapshot: StudioWorkbenchSnapshot,
  instance: StudioInstanceRecord,
  updater: (root: Record<string, unknown>) => void,
) {
  const currentConfigFile =
    snapshot.files.find((file) => file.id === DEFAULT_OPENCLAW_CONFIG_FILE_ID) ||
    buildOpenClawConfigFile(instance);
  const root = parseWorkbenchConfigRoot(currentConfigFile.content);
  updater(root);
  const content = `${JSON.stringify(root, null, 2)}\n`;
  const nextConfigFile: StudioWorkbenchFileRecord = {
    ...currentConfigFile,
    content,
    size: formatWorkbenchFileSize(content),
    updatedAt: toIsoString(),
    status: 'modified',
  };

  return sortWorkbenchFiles([
    ...snapshot.files.filter((file) => file.id !== DEFAULT_OPENCLAW_CONFIG_FILE_ID),
    nextConfigFile,
  ]);
}

function createDefaultWorkbenchSnapshot(
  instance: StudioInstanceRecord,
): BrowserOpenClawWorkbenchSnapshot {
  if (!isBuiltInOpenClawWorkbenchInstance(instance)) {
    return {
      channels: [],
      cronTasks: {
        tasks: [],
        taskExecutionsById: {},
      },
      llmProviders: [],
      agents: [],
      skills: [],
      files: [],
      memory: [],
      tools: [],
    };
  }

  const agentsFile = createWorkbenchFile({
    id: DEFAULT_OPENCLAW_AGENT_FILE_ID,
    name: 'AGENTS.md',
    path: DEFAULT_OPENCLAW_AGENT_FILE_ID,
    category: 'prompt',
    language: 'markdown',
    description: 'Primary agent instructions for the browser-backed OpenClaw workspace.',
    content: [
      '# Main Agent',
      '',
      `You are the primary managed agent for ${instance.name}.`,
      '- Prefer real runtime actions over placeholder responses.',
      '- Keep plans concise and execution-oriented.',
    ].join('\n'),
  });
  const memoryFile = createWorkbenchFile({
    id: DEFAULT_OPENCLAW_MEMORY_FILE_ID,
    name: 'MEMORY.md',
    path: DEFAULT_OPENCLAW_MEMORY_FILE_ID,
    category: 'memory',
    language: 'markdown',
    description: 'Pinned workspace memory for the OpenClaw browser workbench.',
    content: [
      '# Workspace Memory',
      '',
      `- Runtime: ${instance.name}`,
      `- Transport: ${instance.transportKind}`,
      `- Gateway: ${instance.baseUrl ?? 'unconfigured'}`,
    ].join('\n'),
  });
  const configFile = buildOpenClawConfigFile(instance);
  const files = sortWorkbenchFiles([agentsFile, memoryFile, configFile]);

  return {
    channels: buildDefaultOpenClawWorkbenchChannels(),
    cronTasks: {
      tasks: [],
      taskExecutionsById: {},
    },
    llmProviders: [
      {
        id: DEFAULT_OPENCLAW_PROVIDER_ID,
        name: 'OpenAI',
        provider: 'openai',
        endpoint: 'https://api.openai.com/v1',
        apiKeySource: '',
        status: 'configurationRequired',
        defaultModelId: 'gpt-5.4',
        reasoningModelId: 'o4-mini',
        embeddingModelId: 'text-embedding-3-large',
        description: 'Primary hosted provider profile for the managed browser workbench.',
        icon: 'O',
        lastCheckedAt: toIsoString(),
        capabilities: ['chat', 'reasoning', 'embedding'],
        models: [
          {
            id: 'gpt-5.4',
            name: 'GPT-5.4',
            role: 'primary',
            contextWindow: '128k',
          },
          {
            id: 'o4-mini',
            name: 'o4-mini',
            role: 'reasoning',
            contextWindow: '200k',
          },
          {
            id: 'text-embedding-3-large',
            name: 'text-embedding-3-large',
            role: 'embedding',
            contextWindow: '8k',
          },
        ],
        config: {
          temperature: 0.2,
          topP: 1,
          maxTokens: 4096,
          timeoutMs: 60000,
          streaming: true,
        },
      },
    ],
    agents: [
      {
        agent: {
          id: 'main',
          name: 'Main',
          description: 'Primary OpenClaw workspace agent.',
          avatar: 'M',
          systemPrompt: 'Coordinate OpenClaw workbench activity.',
          creator: 'Claw Studio Web',
        },
        focusAreas: ['planning', 'automation', 'operations'],
        automationFitScore: 82,
      },
    ],
    skills: [],
    files,
    memory: buildOpenClawMemoryEntries(files),
    tools: [
      {
        id: 'cron',
        name: 'Cron Scheduler',
        description: 'Create and run browser-backed OpenClaw scheduled tasks.',
        category: 'automation',
        status: 'ready',
        access: 'write',
        command: 'openclaw:cron',
      },
      {
        id: 'workspace-files',
        name: 'Workspace Files',
        description: 'Edit OpenClaw workspace files from the browser.',
        category: 'filesystem',
        status: 'ready',
        access: 'write',
        command: 'openclaw:files',
      },
    ],
  };
}

function cloneWorkbenchTaskExecution(
  execution: StudioWorkbenchTaskExecutionRecord,
): StudioWorkbenchTaskExecutionRecord {
  return {
    ...execution,
  };
}

function cloneWorkbenchTask(task: StudioWorkbenchTaskRecord): StudioWorkbenchTaskRecord {
  return {
    ...task,
    scheduleConfig: { ...task.scheduleConfig },
    latestExecution: task.latestExecution ? cloneWorkbenchTaskExecution(task.latestExecution) : null,
    rawDefinition: task.rawDefinition ? JSON.parse(JSON.stringify(task.rawDefinition)) as Record<string, unknown> : undefined,
  };
}

function cloneWorkbenchProvider(
  provider: StudioWorkbenchLLMProviderRecord,
): StudioWorkbenchLLMProviderRecord {
  return {
    ...provider,
    capabilities: [...provider.capabilities],
    models: provider.models.map((model) => ({ ...model })),
    config: { ...provider.config },
  };
}

function cloneWorkbenchSnapshot(
  snapshot: BrowserOpenClawWorkbenchSnapshot,
): BrowserOpenClawWorkbenchSnapshot {
  return {
    channels: snapshot.channels.map((channel) => ({
      ...channel,
      setupSteps: [...channel.setupSteps],
      values: channel.values ? { ...channel.values } : undefined,
    })),
    cronTasks: {
      tasks: snapshot.cronTasks.tasks.map(cloneWorkbenchTask),
      taskExecutionsById: Object.fromEntries(
        Object.entries(snapshot.cronTasks.taskExecutionsById).map(([taskId, executions]) => [
          taskId,
          executions.map(cloneWorkbenchTaskExecution),
        ]),
      ),
    },
    llmProviders: snapshot.llmProviders.map(cloneWorkbenchProvider),
    agents: snapshot.agents.map((agent) => ({
      ...agent,
      agent: { ...agent.agent },
      focusAreas: [...agent.focusAreas],
    })),
    skills: snapshot.skills.map((skill) => ({ ...skill })),
    files: snapshot.files.map((file) => ({ ...file })),
    memory: snapshot.memory.map((entry) => ({ ...entry })),
    tools: snapshot.tools.map((tool) => ({ ...tool })),
  };
}

function createWorkbenchFallback(instances: StudioInstanceRecord[]): StudioWorkbenchRegistryDocument {
  return {
    version: 1,
    workbenches: Object.fromEntries(
      instances
        .filter(isBuiltInOpenClawWorkbenchInstance)
        .map((instance) => [instance.id, createDefaultWorkbenchSnapshot(instance)]),
    ),
  };
}

function readWorkbenchRegistry(instances: StudioInstanceRecord[] = readInstances().instances): StudioWorkbenchRegistryDocument {
  const storage = getStorage();
  const fallback = sanitizeBrowserWorkbenchRegistryDocument(
    createWorkbenchFallback(instances),
  );

  if (!storage) {
    return fallback;
  }

  const raw = storage.getItem(WORKBENCH_STORAGE_KEY);
  if (!raw) {
    storage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudioWorkbenchRegistryDocument>;
    const sanitizedDocument = sanitizeBrowserWorkbenchRegistryDocument({
      version: 1,
      workbenches: {
        ...fallback.workbenches,
        ...(asObject(parsed.workbenches) as Record<string, BrowserOpenClawWorkbenchSnapshot>),
      },
    });
    const sanitizedRaw = JSON.stringify(sanitizedDocument);
    if (sanitizedRaw !== raw) {
      storage.setItem(WORKBENCH_STORAGE_KEY, sanitizedRaw);
    }
    return sanitizedDocument;
  } catch {
    storage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function writeWorkbenchRegistry(document: StudioWorkbenchRegistryDocument) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    WORKBENCH_STORAGE_KEY,
    JSON.stringify(sanitizeBrowserWorkbenchRegistryDocument(document)),
  );
}

function readBuiltInOpenClawWorkbench(instance: StudioInstanceRecord): StudioWorkbenchSnapshot | null {
  if (!isBuiltInOpenClawWorkbenchInstance(instance)) {
    return null;
  }

  const document = readWorkbenchRegistry();
  const existing = document.workbenches[instance.id];
  if (existing) {
    return cloneWorkbenchSnapshot(existing);
  }

  const created = createDefaultWorkbenchSnapshot(instance);
  document.workbenches[instance.id] = created;
  writeWorkbenchRegistry(document);
  return cloneWorkbenchSnapshot(sanitizeBrowserWorkbenchSnapshot(created));
}

function updateBuiltInOpenClawWorkbench(
  instanceId: string,
  updater: (snapshot: StudioWorkbenchSnapshot, instance: StudioInstanceRecord) => StudioWorkbenchSnapshot,
): StudioWorkbenchSnapshot | null {
  const instances = readInstances().instances;
  const instance = findRequestedInstance(instances, instanceId);
  if (!instance || !isBuiltInOpenClawWorkbenchInstance(instance)) {
    return null;
  }
  const resolvedInstanceId = instance.id;

  const document = readWorkbenchRegistry(instances);
  const current =
    document.workbenches[resolvedInstanceId] || createDefaultWorkbenchSnapshot(instance);
  const next = updater(cloneWorkbenchSnapshot(current), instance);
  next.memory = buildOpenClawMemoryEntries(next.files);
  const sanitizedNext = sanitizeBrowserWorkbenchSnapshot(next);
  document.workbenches[resolvedInstanceId] = sanitizedNext;
  writeWorkbenchRegistry(document);
  return cloneWorkbenchSnapshot(sanitizedNext);
}

function removeBuiltInOpenClawWorkbench(instanceId: string) {
  const document = readWorkbenchRegistry();
  if (!(instanceId in document.workbenches)) {
    return;
  }

  delete document.workbenches[instanceId];
  writeWorkbenchRegistry(document);
}

function synchronizeBuiltInOpenClawWorkbench(instance: StudioInstanceRecord) {
  if (!isBuiltInOpenClawWorkbenchInstance(instance)) {
    removeBuiltInOpenClawWorkbench(instance.id);
    return;
  }

  updateBuiltInOpenClawWorkbench(instance.id, (snapshot) => {
    const configFile = buildOpenClawConfigFile(instance);
    const nextFiles = snapshot.files.filter((file) => file.id !== DEFAULT_OPENCLAW_CONFIG_FILE_ID);
    nextFiles.push(configFile);
    nextFiles.sort((left, right) => left.path.localeCompare(right.path));
    return {
      ...snapshot,
      files: nextFiles,
    };
  });
}

function readInstances(): StudioInstanceRegistryDocument {
  const storage = getStorage();
  const fallback = sanitizeBrowserInstanceRegistryDocument({
    version: 1,
    instances: [createDefaultBuiltInInstance()],
  });

  if (!storage) {
    return fallback;
  }

  const raw = storage.getItem(INSTANCE_STORAGE_KEY);
  if (!raw) {
    storage.setItem(INSTANCE_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudioInstanceRegistryDocument>;
    const storedInstances = Array.isArray(parsed.instances) ? parsed.instances : [];
    const instances = storedInstances.map((instance) =>
      sanitizeBrowserInstanceRecord(
        isManagedBuiltInOpenClawInstance(instance) ? normalizeBuiltInInstance(instance) : instance,
      ),
    );
    if (!instances.some(isManagedBuiltInOpenClawInstance)) {
      instances.unshift(createDefaultBuiltInInstance());
    }

    const normalizedDocument = sanitizeBrowserInstanceRegistryDocument({
      version: 1,
      instances,
    } satisfies StudioInstanceRegistryDocument);
    const normalizedRaw = JSON.stringify(normalizedDocument);
    if (normalizedRaw !== raw) {
      storage.setItem(INSTANCE_STORAGE_KEY, normalizedRaw);
    }

    return normalizedDocument;
  } catch {
    storage.setItem(INSTANCE_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function writeInstances(document: StudioInstanceRegistryDocument) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(
    INSTANCE_STORAGE_KEY,
    JSON.stringify(sanitizeBrowserInstanceRegistryDocument(document)),
  );
}

function readConversations(): StudioConversationRegistryDocument {
  const storage = getStorage();
  const fallback: StudioConversationRegistryDocument = {
    version: 1,
    conversations: [],
  };

  if (!storage) {
    return fallback;
  }

  const raw = storage.getItem(CONVERSATION_STORAGE_KEY);
  if (!raw) {
    storage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StudioConversationRegistryDocument>;
    return {
      version: 1,
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
    };
  } catch {
    storage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
}

function writeConversations(document: StudioConversationRegistryDocument) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(CONVERSATION_STORAGE_KEY, JSON.stringify(document));
}

function createInstanceId() {
  return `instance-${Math.random().toString(36).slice(2, 10)}`;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function resolveHealthStatus(instance: StudioInstanceRecord): StudioInstanceHealthStatus {
  if (instance.status === 'offline') {
    return 'offline';
  }
  if (instance.status === 'error') {
    return 'degraded';
  }
  if (instance.status === 'starting' || instance.status === 'syncing') {
    return 'attention';
  }
  return 'healthy';
}

function buildHealthSnapshot(instance: StudioInstanceRecord): StudioInstanceHealthSnapshot {
  const runtimeStatus = resolveHealthStatus(instance);
  const score = clampScore(
    (runtimeStatus === 'healthy' ? 88 : runtimeStatus === 'attention' ? 62 : runtimeStatus === 'offline' ? 30 : 18) -
      instance.cpu * 0.25 -
      instance.memory * 0.22,
  );

  const checks: StudioInstanceHealthCheck[] = [
    {
      id: 'runtime-status',
      label: 'Runtime status',
      status: runtimeStatus,
      detail: `Instance is ${instance.status}.`,
    },
    {
      id: 'transport',
      label: 'Connectivity',
      status: instance.baseUrl || instance.websocketUrl ? 'healthy' : 'attention',
      detail: instance.baseUrl || instance.websocketUrl ? 'Endpoint metadata is configured.' : 'No endpoint metadata configured.',
    },
    {
      id: 'storage',
      label: 'Storage binding',
      status: resolveStorageStatus(instance.storage) === 'ready' ? 'healthy' : 'attention',
      detail: `Storage provider is ${instance.storage.provider}.`,
    },
  ];

  return {
    score,
    status:
      score >= 80 ? 'healthy' : score >= 55 ? 'attention' : runtimeStatus === 'offline' ? 'offline' : 'degraded',
    checks,
    evaluatedAt: now(),
  };
}

function resolveLifecycleOwner(instance: StudioInstanceRecord): StudioInstanceLifecycleOwner {
  if (isBuiltInOpenClawWorkbenchInstance(instance)) {
    return 'appManaged';
  }
  if (instance.deploymentMode === 'local-managed' || instance.deploymentMode === 'local-external') {
    return 'externalProcess';
  }
  return 'remoteService';
}

function buildLifecycleSnapshot(
  instance: StudioInstanceRecord,
  workbench: StudioWorkbenchSnapshot | null = null,
): StudioInstanceLifecycleSnapshot {
  const owner = resolveLifecycleOwner(instance);
  const workbenchManaged = isBuiltInOpenClawWorkbenchInstance(instance) && workbench != null;

  if (owner === 'appManaged') {
    return {
      owner,
      startStopSupported: false,
      configWritable: true,
      lifecycleControllable: false,
      workbenchManaged,
      endpointObserved: false,
      notes: [
        'Browser fallback projects an OpenClaw workbench snapshot, but lifecycle control stays unavailable until a native host exposes a real controller.',
      ],
    };
  }

  if (instance.deploymentMode === 'local-managed') {
    return {
      owner,
      startStopSupported: false,
      configWritable: false,
      lifecycleControllable: false,
      workbenchManaged: false,
      endpointObserved: false,
      notes: ['This local-managed runtime is not bound to the browser-backed managed workbench.'],
    };
  }

  return {
    owner,
    startStopSupported: false,
    configWritable: owner === 'externalProcess',
    lifecycleControllable: false,
    workbenchManaged: false,
    endpointObserved: false,
    notes:
      owner === 'externalProcess'
        ? ['Lifecycle is owned by an external local process.']
        : ['Lifecycle is owned by a remote deployment.'],
  };
}

function resolveStorageStatus(storage: StudioStorageBinding): StudioInstanceStorageStatus {
  switch (storage.provider) {
    case 'memory':
    case 'localFile':
      return 'ready';
    case 'sqlite':
      return storage.namespace ? 'ready' : 'configurationRequired';
    case 'postgres':
      return storage.connectionHint ? 'ready' : 'configurationRequired';
    case 'remoteApi':
      return storage.endpoint ? 'planned' : 'configurationRequired';
    default:
      return 'unavailable';
  }
}

function buildStorageSnapshot(instance: StudioInstanceRecord): StudioInstanceStorageSnapshot {
  const status = resolveStorageStatus(instance.storage);

  return {
    status,
    profileId: instance.storage.profileId ?? null,
    provider: instance.storage.provider,
    namespace: instance.storage.namespace,
    database: instance.storage.database ?? null,
    connectionHint: instance.storage.connectionHint ?? null,
    endpoint: instance.storage.endpoint ?? null,
    durable: instance.storage.provider !== 'memory',
    queryable: instance.storage.provider === 'sqlite' || instance.storage.provider === 'postgres' || instance.storage.provider === 'remoteApi',
    transactional: instance.storage.provider === 'sqlite' || instance.storage.provider === 'postgres',
    remote: instance.storage.provider === 'postgres' || instance.storage.provider === 'remoteApi',
  };
}

function inferExposure(instance: StudioInstanceRecord): StudioInstanceExposure {
  return instance.deploymentMode === 'remote' ? 'remote' : instance.host === '127.0.0.1' ? 'loopback' : 'private';
}

function inferAuthMode(instance: StudioInstanceRecord): StudioInstanceAuthMode {
  if (instance.config.authToken) {
    return 'token';
  }
  if (instance.deploymentMode === 'remote') {
    return 'external';
  }
  return 'unknown';
}

function buildEndpoint(
  instance: StudioInstanceRecord,
  id: string,
  label: string,
  kind: StudioInstanceEndpointKind,
  url: string | null | undefined,
  source: 'config' | 'derived' | 'runtime',
): StudioInstanceConnectivityEndpoint {
  return {
    id,
    label,
    kind,
    status: url ? 'ready' : 'configurationRequired',
    url: url ?? null,
    exposure: inferExposure(instance),
    auth: inferAuthMode(instance),
    source,
  };
}

function normalizeOpenClawConfiguredHttpEndpoint(
  value: string | null | undefined,
): string | null {
  const normalized = value?.trim().replace(/\/+$/, '');
  return normalized || null;
}

function resolveConfiguredOpenClawHttpEndpoints(instance: StudioInstanceRecord) {
  const baseUrl = normalizeOpenClawConfiguredHttpEndpoint(instance.baseUrl);
  if (!baseUrl) {
    return [];
  }

  const configuredEndpoints: Array<{
    id: 'openai-http-chat' | 'openai-http-responses';
    label: string;
    kind: 'openaiChatCompletions' | 'openaiResponses';
    suffixes: string[];
  }> = [
    {
      id: 'openai-http-chat',
      label: 'OpenAI Chat Completions',
      kind: 'openaiChatCompletions',
      suffixes: ['/v1/chat/completions', '/chat/completions'],
    },
    {
      id: 'openai-http-responses',
      label: 'OpenAI Responses',
      kind: 'openaiResponses',
      suffixes: ['/v1/responses', '/responses'],
    },
  ];

  return configuredEndpoints
    .filter((endpoint) => endpoint.suffixes.some((suffix) => baseUrl.endsWith(suffix)))
    .map((endpoint) =>
      buildEndpoint(instance, endpoint.id, endpoint.label, endpoint.kind, baseUrl, 'config'),
    );
}

interface WebStudioRuntimeDetailAdapter {
  defaultCapabilities?: StudioInstanceCapability[];
  buildConnectivityEndpoints?(instance: StudioInstanceRecord): StudioInstanceConnectivityEndpoint[];
  buildArtifacts?(instance: StudioInstanceRecord): StudioInstanceArtifactRecord[];
  buildOfficialRuntimeNotes?(instance: StudioInstanceRecord): StudioInstanceRuntimeNote[];
}

function resolveWebStudioRuntimeLabel(runtimeKind: string | undefined) {
  const normalized = String(runtimeKind ?? '').trim();
  if (!normalized) {
    return 'custom';
  }

  if (normalized === 'openclaw') {
    return 'OpenClaw';
  }

  if (normalized === 'zeroclaw') {
    return 'ZeroClaw';
  }

  if (normalized === 'ironclaw') {
    return 'IronClaw';
  }

  return normalized;
}

const WEB_STUDIO_RUNTIME_DETAIL_ADAPTERS: Record<string, WebStudioRuntimeDetailAdapter> = {
  openclaw: {
    defaultCapabilities: ['chat', 'health', 'files', 'memory', 'tasks', 'tools', 'models'],
    buildConnectivityEndpoints(instance) {
      return instance.baseUrl ? resolveConfiguredOpenClawHttpEndpoints(instance) : [];
    },
    buildOfficialRuntimeNotes() {
      return [
        {
          title: 'Gateway-first transport',
          content: 'OpenClaw centers its runtime around the Gateway WebSocket and can optionally expose OpenAI-compatible HTTP endpoints when enabled.',
          sourceUrl: 'https://docs.openclaw.ai/gateway/openai-http-api',
        },
      ];
    },
  },
  zeroclaw: {
    buildConnectivityEndpoints(instance) {
      return instance.baseUrl
        ? [buildEndpoint(instance, 'dashboard', 'Gateway Dashboard', 'dashboard', instance.baseUrl, 'derived')]
        : [];
    },
    buildArtifacts(instance) {
      return instance.baseUrl
        ? [
            {
              id: 'dashboard-endpoint',
              label: 'Dashboard',
              kind: 'dashboard',
              status: 'remote',
              location: instance.baseUrl,
              readonly: true,
              detail: 'ZeroClaw dashboard surface derived from the configured gateway URL.',
              source: 'derived',
            },
          ]
        : [];
    },
    buildOfficialRuntimeNotes() {
      return [
        {
          title: 'Gateway and dashboard',
          content: 'ZeroClaw ships as a single Rust binary and exposes a gateway/dashboard surface that can be run locally or remotely.',
          sourceUrl: 'https://github.com/zeroclaw-labs/zeroclaw',
        },
      ];
    },
  },
  ironclaw: {
    buildConnectivityEndpoints(instance) {
      return instance.baseUrl
        ? [buildEndpoint(instance, 'gateway-sse', 'Realtime Gateway', 'sse', instance.baseUrl, 'derived')]
        : [];
    },
    buildOfficialRuntimeNotes() {
      return [
        {
          title: 'Database-first runtime',
          content: 'IronClaw expects PostgreSQL plus pgvector and emphasizes persistent storage, routines, and realtime gateway streaming.',
          sourceUrl: 'https://github.com/nearai/ironclaw',
        },
      ];
    },
  },
};

function resolveWebStudioDefaultCapabilities(
  runtimeKind: string | undefined,
): StudioInstanceCapability[] {
  const normalizedRuntimeKind = String(runtimeKind ?? '').trim();
  const configuredCapabilities = normalizedRuntimeKind
    ? WEB_STUDIO_RUNTIME_DETAIL_ADAPTERS[normalizedRuntimeKind]?.defaultCapabilities
    : undefined;

  if (Array.isArray(configuredCapabilities) && configuredCapabilities.length > 0) {
    return [...configuredCapabilities];
  }

  return ['chat', 'health'];
}

function buildConnectivityEndpoints(instance: StudioInstanceRecord): StudioInstanceConnectivityEndpoint[] {
  const endpoints: StudioInstanceConnectivityEndpoint[] = [];

  if (instance.baseUrl) {
    endpoints.push(buildEndpoint(instance, 'gateway-http', 'HTTP endpoint', 'http', instance.baseUrl, 'config'));
  }
  if (instance.websocketUrl) {
    endpoints.push(buildEndpoint(instance, 'gateway-ws', 'Gateway WebSocket', 'websocket', instance.websocketUrl, 'config'));
  }
  endpoints.push(
    ...(WEB_STUDIO_RUNTIME_DETAIL_ADAPTERS[instance.runtimeKind]?.buildConnectivityEndpoints?.(instance) ?? []),
  );

  return endpoints;
}

function buildCapabilities(
  instance: StudioInstanceRecord,
  workbench: StudioWorkbenchSnapshot | null = null,
): StudioInstanceCapabilitySnapshot[] {
  const allCapabilities: StudioInstanceCapability[] = ['chat', 'health', 'files', 'memory', 'tasks', 'tools', 'models'];
  const supported = new Set(instance.capabilities);
  const storageStatus = resolveStorageStatus(instance.storage);
  const workbenchBacked = isBuiltInOpenClawWorkbenchInstance(instance) && workbench != null;

  return allCapabilities.map((capability) => {
    let status: StudioInstanceCapabilityStatus = supported.has(capability) ? 'ready' : 'unsupported';
    let detail = supported.has(capability)
      ? 'Advertised by the instance record.'
      : 'This runtime is not currently modeled as supporting this capability.';

    if (
      workbenchBacked &&
      (capability === 'files' || capability === 'memory' || capability === 'tasks' || capability === 'tools' || capability === 'models')
    ) {
      status = 'ready';
      detail = 'OpenClaw browser workbench persists this capability locally when native adapters are unavailable.';
    } else if (supported.has(capability) && (capability === 'memory' || capability === 'tasks') && storageStatus !== 'ready') {
      status = 'configurationRequired';
      detail = 'Capability depends on a configured durable storage binding.';
    } else if (supported.has(capability) && instance.deploymentMode !== 'local-managed' && (capability === 'files' || capability === 'tools')) {
      status = 'planned';
      detail = 'Runtime may support this, but Claw Studio has not integrated this external detail surface yet.';
    }

    return {
      id: capability,
      status,
      detail,
      source: capability === 'memory' || capability === 'tasks' ? 'storage' : 'runtime',
    };
  });
}

function buildObservabilitySnapshot(
  instance: StudioInstanceRecord,
  logs: string,
): StudioInstanceObservabilitySnapshot {
  const lines = logs
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean);

  return {
    status: lines.length > 0 ? 'ready' : 'limited',
    logAvailable: lines.length > 0,
    logFilePath: null,
    logPreview: lines.slice(-5),
    lastSeenAt: instance.lastSeenAt ?? null,
    metricsSource: 'derived',
  };
}

function createDataAccessEntry(
  entry: StudioInstanceDataAccessEntry,
): StudioInstanceDataAccessEntry {
  return entry;
}

function getStorageTarget(snapshot: StudioInstanceStorageSnapshot) {
  return snapshot.endpoint ?? snapshot.database ?? snapshot.namespace;
}

function buildDataAccessSnapshot(
  instance: StudioInstanceRecord,
  storage: StudioInstanceStorageSnapshot,
  observability: StudioInstanceObservabilitySnapshot,
  workbench: StudioWorkbenchSnapshot | null = null,
): StudioInstanceDataAccessSnapshot {
  const workbenchBacked = isBuiltInOpenClawWorkbenchInstance(instance) && workbench != null;
  const routes: StudioInstanceDataAccessEntry[] = [
    createDataAccessEntry({
      id: 'config',
      label: 'Configuration',
      scope: 'config',
      mode: instance.deploymentMode === 'local-managed' ? 'metadataOnly' : 'metadataOnly',
      status: 'ready',
      target: INSTANCE_STORAGE_KEY,
      readonly: false,
      authoritative: false,
      detail:
        'Web fallback projects instance configuration from Claw Studio metadata instead of direct runtime-owned files.',
      source: 'integration',
    }),
    createDataAccessEntry({
      id: 'logs',
      label: 'Logs',
      scope: 'logs',
      mode: 'metadataOnly',
      status: observability.logAvailable ? 'limited' : 'planned',
      target: null,
      readonly: true,
      authoritative: false,
      detail: observability.logAvailable
        ? 'Web fallback shows derived log preview lines only.'
        : 'No direct log transport is available in the web fallback.',
      source: 'derived',
    }),
  ];

  if (workbenchBacked) {
    routes.push(
      createDataAccessEntry({
        id: 'files',
        label: 'Workspace',
        scope: 'files',
        mode: 'metadataOnly',
        status: 'ready',
        target: WORKBENCH_STORAGE_KEY,
        readonly: false,
        authoritative: true,
        detail:
          'OpenClaw workspace files are persisted through the browser workbench state.',
        source: 'integration',
      }),
    );
  } else if (instance.config.workspacePath) {
    routes.push(
      createDataAccessEntry({
        id: 'files',
        label: 'Workspace',
        scope: 'files',
        mode: 'managedDirectory',
        status: 'limited',
        target: instance.config.workspacePath,
        readonly: false,
        authoritative: false,
        detail:
          'A workspace path is configured, but the web fallback does not directly mount runtime files.',
        source: 'config',
      }),
    );
  } else {
    routes.push(
      createDataAccessEntry({
        id: 'files',
        label: 'Workspace',
        scope: 'files',
        mode: 'metadataOnly',
        status: 'planned',
        target: null,
        readonly: false,
        authoritative: false,
        detail:
          'Runtime file access requires a desktop-backed adapter or explicit workspace metadata.',
        source: 'integration',
      }),
    );
  }

  const storageStatus =
    storage.status === 'ready'
      ? 'ready'
      : storage.status === 'configurationRequired'
        ? 'configurationRequired'
        : storage.status === 'planned'
          ? 'planned'
          : 'unavailable';

  routes.push(
    createDataAccessEntry({
      id: 'memory',
      label: 'Memory',
      scope: 'memory',
      mode: workbenchBacked ? 'metadataOnly' : 'storageBinding',
      status: workbenchBacked ? 'ready' : storageStatus,
      target: workbenchBacked ? WORKBENCH_STORAGE_KEY : getStorageTarget(storage),
      readonly: false,
      authoritative: workbenchBacked || storage.status === 'ready',
      detail: workbenchBacked
        ? 'OpenClaw memory entries are derived from browser-persisted workspace notes.'
        : 'Memory detail is described through the configured storage binding in the web fallback.',
      source: 'storage',
    }),
    createDataAccessEntry({
      id: 'tasks',
      label: 'Tasks',
      scope: 'tasks',
      mode: workbenchBacked ? 'metadataOnly' : instance.baseUrl ? 'remoteEndpoint' : 'metadataOnly',
      status: workbenchBacked ? 'ready' : instance.baseUrl ? 'planned' : 'configurationRequired',
      target: workbenchBacked ? WORKBENCH_STORAGE_KEY : instance.baseUrl ?? null,
      readonly: false,
      authoritative: workbenchBacked,
      detail: workbenchBacked
        ? 'OpenClaw task definitions and execution history are persisted through the browser workbench state.'
        : 'Task operations depend on runtime-specific adapters and are not directly mounted in the web fallback.',
      source: 'integration',
    }),
    createDataAccessEntry({
      id: 'tools',
      label: 'Tools',
      scope: 'tools',
      mode: workbenchBacked ? 'metadataOnly' : instance.baseUrl ? 'remoteEndpoint' : 'metadataOnly',
      status: workbenchBacked ? 'ready' : instance.baseUrl ? 'planned' : 'configurationRequired',
      target: workbenchBacked ? WORKBENCH_STORAGE_KEY : instance.baseUrl ?? null,
      readonly: true,
      authoritative: workbenchBacked,
      detail: workbenchBacked
        ? 'OpenClaw tool metadata is projected from the browser workbench state.'
        : 'Tool detail is currently limited to endpoint and metadata posture in the web fallback.',
      source: 'integration',
    }),
    createDataAccessEntry({
      id: 'models',
      label: 'Models',
      scope: 'models',
      mode: workbenchBacked ? 'metadataOnly' : instance.baseUrl ? 'remoteEndpoint' : 'metadataOnly',
      status: workbenchBacked ? 'ready' : instance.baseUrl ? 'planned' : 'configurationRequired',
      target: workbenchBacked ? WORKBENCH_STORAGE_KEY : instance.baseUrl ?? null,
      readonly: false,
      authoritative: workbenchBacked,
      detail: workbenchBacked
        ? 'OpenClaw provider and model selections are persisted through the browser workbench state.'
        : 'Provider and model surfaces require runtime-specific adapters beyond the web fallback.',
      source: 'integration',
    }),
  );

  return { routes };
}

function buildArtifacts(
  instance: StudioInstanceRecord,
  storage: StudioInstanceStorageSnapshot,
  observability: StudioInstanceObservabilitySnapshot,
): StudioInstanceArtifactRecord[] {
  const artifacts: StudioInstanceArtifactRecord[] = [];

  if (instance.baseUrl) {
    artifacts.push({
      id: 'gateway-endpoint',
      label: 'Gateway Endpoint',
      kind: 'endpoint',
      status: instance.deploymentMode === 'remote' ? 'remote' : 'configured',
      location: instance.baseUrl,
      readonly: true,
      detail: 'Primary runtime HTTP endpoint configured for this instance.',
      source: 'config',
    });
  }

  if (instance.config.workspacePath) {
    artifacts.push({
      id: 'workspace',
      label: 'Workspace Directory',
      kind: 'workspaceDirectory',
      status: 'configured',
      location: instance.config.workspacePath,
      readonly: false,
      detail: 'Workspace path configured for this instance.',
      source: 'config',
    });
  }

  if (observability.logFilePath) {
    artifacts.push({
      id: 'log-file',
      label: 'Log File',
      kind: 'logFile',
      status: 'configured',
      location: observability.logFilePath,
      readonly: true,
      detail: 'Configured log file path projected by the runtime detail snapshot.',
      source: 'derived',
    });
  }

  artifacts.push({
    id: 'storage-binding',
    label: 'Storage Binding',
    kind: 'storageBinding',
    status:
      storage.status === 'ready'
        ? 'configured'
        : storage.status === 'configurationRequired'
          ? 'missing'
          : storage.status === 'planned'
            ? 'planned'
            : 'missing',
    location: getStorageTarget(storage),
    readonly: false,
    detail: 'Storage profile, namespace, and database binding used by this instance.',
    source: 'storage',
  });

  artifacts.push(
    ...(WEB_STUDIO_RUNTIME_DETAIL_ADAPTERS[instance.runtimeKind]?.buildArtifacts?.(instance) ?? []),
  );

  return artifacts;
}

function buildOfficialRuntimeNotes(instance: StudioInstanceRecord): StudioInstanceRuntimeNote[] {
  const adapterNotes =
    WEB_STUDIO_RUNTIME_DETAIL_ADAPTERS[instance.runtimeKind]?.buildOfficialRuntimeNotes?.(instance);
  if (adapterNotes) {
    return adapterNotes;
  }

  const runtimeLabel = resolveWebStudioRuntimeLabel(instance.runtimeKind);

  return [
    {
      title: `${runtimeLabel} runtime`,
      content: `This instance uses the ${runtimeLabel} runtime binding. Connectivity and capability surfaces depend on the configured metadata.`,
    },
  ];
}

function buildInstanceDetailRecord(
  instance: StudioInstanceRecord,
  logs: string,
  workbench: StudioWorkbenchSnapshot | null = null,
): StudioInstanceDetailRecord {
  const storage = buildStorageSnapshot(instance);
  const observability = buildObservabilitySnapshot(instance, logs);

  return {
    instance,
    config: instance.config,
    logs,
    health: buildHealthSnapshot(instance),
    lifecycle: buildLifecycleSnapshot(instance, workbench),
    storage,
    connectivity: {
      primaryTransport: instance.transportKind,
      endpoints: buildConnectivityEndpoints(instance),
    },
    observability,
    dataAccess: buildDataAccessSnapshot(instance, storage, observability, workbench),
    artifacts: buildArtifacts(instance, storage, observability),
    capabilities: buildCapabilities(instance, workbench),
    officialRuntimeNotes: buildOfficialRuntimeNotes(instance),
    workbench,
  };
}

function summarizeConversation(
  conversation: StudioConversationRecord,
): StudioConversationSummary {
  const lastMessage = conversation.messages[conversation.messages.length - 1];

  return {
    id: conversation.id,
    title: conversation.title,
    primaryInstanceId: conversation.primaryInstanceId,
    participantInstanceIds: [...conversation.participantInstanceIds],
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastSeenAt:
      typeof conversation.lastSeenAt === 'number' &&
      Number.isFinite(conversation.lastSeenAt) &&
      conversation.lastSeenAt >= 0
        ? conversation.lastSeenAt
        : null,
    messageCount: conversation.messages.length,
    lastMessagePreview: lastMessage?.content?.slice(0, 120) || '',
  };
}

function normalizeConversationMessages(
  conversation: StudioConversationRecord,
): StudioConversationMessage[] {
  return (conversation.messages || []).map((message) => ({
    ...message,
    conversationId: conversation.id,
    updatedAt: message.updatedAt ?? message.createdAt,
    status: message.status ?? 'complete',
  }));
}

function withConversationDerivedFields(
  conversation: StudioConversationRecord,
): StudioConversationRecord {
  const messages = normalizeConversationMessages(conversation);
  const normalizedPrimaryInstanceId =
    conversation.primaryInstanceId.trim() || conversation.primaryInstanceId;
  const normalizedParticipantInstanceIds = Array.from(
    new Set(
      conversation.participantInstanceIds.map(
        (participantInstanceId) =>
          participantInstanceId.trim() || participantInstanceId,
      ),
    ),
  );
  const summary = summarizeConversation({
    ...conversation,
    primaryInstanceId: normalizedPrimaryInstanceId,
    participantInstanceIds: normalizedParticipantInstanceIds,
    messages,
  });

  return {
    ...conversation,
    ...summary,
    primaryInstanceId: normalizedPrimaryInstanceId,
    participantInstanceIds: normalizedParticipantInstanceIds,
    lastSeenAt: summary.lastSeenAt,
    messages,
  };
}

function buildInstanceRecord(input: StudioCreateInstanceInput): StudioInstanceRecord {
  assertValidStudioCreateInstanceKernelPolicy(input);
  const createdAt = now();
  const baseUrl = input.baseUrl ?? input.config?.baseUrl ?? null;
  const websocketUrl = input.websocketUrl ?? input.config?.websocketUrl ?? null;
  const port =
    input.port ??
    (input.config?.port ? Number.parseInt(input.config.port, 10) : null) ??
    null;
  const config = createDefaultInstanceConfig({
    ...input.config,
    baseUrl,
    websocketUrl,
    port: port != null ? String(port) : input.config?.port,
  });
  const capabilities = resolveWebStudioDefaultCapabilities(input.runtimeKind);

  return {
    id: createInstanceId(),
    name: input.name,
    description: input.description,
    runtimeKind: input.runtimeKind,
    deploymentMode: input.deploymentMode,
    transportKind: input.transportKind,
    status: 'offline',
    isBuiltIn: false,
    isDefault: false,
    iconType: input.iconType ?? 'server',
    version: input.version ?? 'custom',
    typeLabel: input.typeLabel ?? `${input.runtimeKind} (${input.deploymentMode})`,
    host: input.host ?? '127.0.0.1',
    port,
    baseUrl,
    websocketUrl,
    cpu: 0,
    memory: 0,
    totalMemory: 'Unknown',
    uptime: '-',
    capabilities,
    storage: {
      ...createDefaultStorageBinding(),
      ...(input.storage || {}),
      provider: input.storage?.provider ?? 'localFile',
      namespace: input.storage?.namespace ?? 'claw-studio',
    },
    config,
    createdAt,
    updatedAt: createdAt,
    lastSeenAt: null,
  };
}

function createTaskExecutionRecord(
  task: StudioWorkbenchTaskRecord,
  trigger: StudioWorkbenchTaskExecutionRecord['trigger'],
): StudioWorkbenchTaskExecutionRecord {
  const startedAt = toIsoString();

  return {
    id: `web-execution-${Math.random().toString(36).slice(2, 10)}`,
    taskId: task.id,
    status: 'success',
    trigger,
    startedAt,
    finishedAt: startedAt,
    summary: `Executed ${task.name} from the browser-backed OpenClaw workbench.`,
    details: task.prompt,
  };
}

export class WebStudioPlatform implements StudioPlatformAPI {
  async listInstances(): Promise<StudioInstanceRecord[]> {
    return readInstances().instances;
  }

  async getInstance(id: string): Promise<StudioInstanceRecord | null> {
    return findRequestedInstance(readInstances().instances, id);
  }

  async getInstanceDetail(id: string): Promise<StudioInstanceDetailRecord | null> {
    const instance = await this.getInstance(id);
    if (!instance) {
      return null;
    }

    const logs = await this.getInstanceLogs(id);
    const workbench = readBuiltInOpenClawWorkbench(instance);
    return buildInstanceDetailRecord(instance, logs, workbench);
  }

  async createInstance(input: StudioCreateInstanceInput): Promise<StudioInstanceRecord> {
    const document = readInstances();
    const instance = buildInstanceRecord(input);
    document.instances.push(instance);
    writeInstances(document);
    synchronizeBuiltInOpenClawWorkbench(instance);
    return instance;
  }

  async updateInstance(
    id: string,
    input: StudioUpdateInstanceInput,
  ): Promise<StudioInstanceRecord> {
    const document = readInstances();
    const current = findRequestedInstance(document.instances, id);
    if (!current) {
      throw new Error(`Instance "${id}" not found`);
    }
    const resolvedId = current.id;

    if (input.isDefault) {
      document.instances = document.instances.map((instance) => ({
        ...instance,
        isDefault: instance.id === resolvedId,
      }));
    }

    const nextPort =
      input.port ??
      (input.config?.port ? Number.parseInt(input.config.port, 10) : current.port) ??
      null;
    const updated: StudioInstanceRecord = {
      ...current,
      ...input,
      port: nextPort,
      storage: {
        ...current.storage,
        ...(input.storage || {}),
        provider: input.storage?.provider ?? current.storage.provider,
        namespace: input.storage?.namespace ?? current.storage.namespace,
      },
      config: createDefaultInstanceConfig({
        ...current.config,
        ...(input.config || {}),
        port: nextPort != null ? String(nextPort) : current.config.port,
      }),
      updatedAt: now(),
    };
    const next = isManagedBuiltInOpenClawInstance(current)
      ? normalizeBuiltInInstance(updated)
      : updated;

    document.instances = document.instances.map((instance) =>
      instance.id === resolvedId ? next : instance,
    );
    writeInstances(document);
    synchronizeBuiltInOpenClawWorkbench(next);
    return next;
  }

  async deleteInstance(id: string): Promise<boolean> {
    const document = readInstances();
    const target = findRequestedInstance(document.instances, id);
    if (!target) {
      return false;
    }
    const resolvedId = target.id;

    if (target.isBuiltIn) {
      throw new Error('The built-in instance cannot be deleted');
    }

    document.instances = document.instances.filter((instance) => instance.id !== resolvedId);
    if (!document.instances.some((instance) => instance.isDefault)) {
      document.instances = document.instances.map((instance, index) => ({
        ...instance,
        isDefault: index === 0,
      }));
    }
    writeInstances(document);

    const conversations = readConversations();
    conversations.conversations = conversations.conversations.filter(
      (conversation) =>
        conversation.primaryInstanceId !== resolvedId &&
        !conversation.participantInstanceIds.includes(resolvedId),
    );
    writeConversations(conversations);
    removeBuiltInOpenClawWorkbench(resolvedId);
    return true;
  }

  async startInstance(id: string): Promise<StudioInstanceRecord | null> {
    return this.setInstanceStatus(id, 'online');
  }

  async stopInstance(id: string): Promise<StudioInstanceRecord | null> {
    return this.setInstanceStatus(id, 'offline');
  }

  async restartInstance(id: string): Promise<StudioInstanceRecord | null> {
    const stopped = await this.stopInstance(id);
    if (!stopped) {
      return null;
    }

    return this.startInstance(id);
  }

  async setInstanceStatus(
    id: string,
    status: StudioInstanceStatus,
  ): Promise<StudioInstanceRecord | null> {
    const current = await this.getInstance(id);
    if (!current) {
      return null;
    }

    return this.updateInstance(id, { status });
  }

  async getInstanceConfig(id: string): Promise<StudioInstanceConfig | null> {
    return (await this.getInstance(id))?.config ?? null;
  }

  async updateInstanceConfig(
    id: string,
    config: StudioInstanceConfig,
  ): Promise<StudioInstanceConfig | null> {
    const updated = await this.updateInstance(id, {
      config,
      port: Number.parseInt(config.port, 10),
      baseUrl: config.baseUrl ?? null,
      websocketUrl: config.websocketUrl ?? null,
    });
    return updated.config;
  }

  async getInstanceLogs(id: string): Promise<string> {
    const instance = await this.getInstance(id);
    if (!instance) {
      return '';
    }

    return [
      `[${new Date(instance.updatedAt).toISOString()}] instance=${instance.id} status=${instance.status}`,
      `[${new Date().toISOString()}] transport=${instance.transportKind} baseUrl=${instance.baseUrl || '-'}`,
    ].join('\n');
  }

  async createInstanceTask(
    instanceId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void> {
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot) => ({
      ...snapshot,
      cronTasks: {
        ...snapshot.cronTasks,
        tasks: [...snapshot.cronTasks.tasks, buildOpenClawTaskRecord(payload)],
      },
    }));
    if (!updated) {
      throw new Error(`Instance "${instanceId}" does not support browser-backed task persistence.`);
    }
  }

  async updateInstanceTask(
    instanceId: string,
    taskId: string,
    payload: StudioInstanceTaskMutationPayload,
  ): Promise<void> {
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot) => {
      const current = snapshot.cronTasks.tasks.find((task) => task.id === taskId);
      if (!current) {
        throw new Error(`Task "${taskId}" not found`);
      }

      return {
        ...snapshot,
        cronTasks: {
          ...snapshot.cronTasks,
          tasks: snapshot.cronTasks.tasks.map((task) =>
            task.id === taskId ? buildOpenClawTaskRecord(payload, current) : task,
          ),
        },
      };
    });
    if (!updated) {
      throw new Error(`Task "${taskId}" not found`);
    }
  }

  async updateInstanceFileContent(
    instanceId: string,
    fileId: string,
    content: string,
  ): Promise<boolean> {
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot) => {
      const current = snapshot.files.find((file) => file.id === fileId);
      if (!current) {
        return snapshot;
      }

      return {
        ...snapshot,
        files: snapshot.files.map((file) =>
          file.id === fileId
            ? {
                ...file,
                content,
                size: formatWorkbenchFileSize(content),
                updatedAt: toIsoString(),
                status: 'modified',
              }
            : file,
        ),
      };
    });

    return Boolean(updated?.files.some((file) => file.id === fileId && file.content === content));
  }

  async updateInstanceLlmProviderConfig(
    instanceId: string,
    providerId: string,
    update: StudioUpdateInstanceLlmProviderConfigInput,
  ): Promise<boolean> {
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot) => {
      const current = snapshot.llmProviders.find((provider) => provider.id === providerId);
      if (!current) {
        return snapshot;
      }

      return {
        ...snapshot,
        llmProviders: snapshot.llmProviders.map((provider) =>
          provider.id === providerId
            ? {
                ...provider,
                endpoint: update.endpoint,
                apiKeySource: update.apiKeySource,
                defaultModelId: update.defaultModelId,
                reasoningModelId: update.reasoningModelId,
                embeddingModelId: update.embeddingModelId,
                status: update.apiKeySource.trim() ? 'ready' : 'configurationRequired',
                lastCheckedAt: toIsoString(),
                models: provider.models.map((model) => {
                  if (model.role === 'primary') {
                    return {
                      ...model,
                      id: update.defaultModelId,
                      name: update.defaultModelId,
                    };
                  }
                  if (model.role === 'reasoning' && update.reasoningModelId) {
                    return {
                      ...model,
                      id: update.reasoningModelId,
                      name: update.reasoningModelId,
                    };
                  }
                  if (model.role === 'embedding' && update.embeddingModelId) {
                    return {
                      ...model,
                      id: update.embeddingModelId,
                      name: update.embeddingModelId,
                    };
                  }
                  return model;
                }),
                config: { ...update.config },
              }
            : provider,
        ),
      };
    });

    return Boolean(
      updated?.llmProviders.some(
        (provider) =>
          provider.id === providerId &&
          provider.defaultModelId === update.defaultModelId &&
          provider.endpoint === update.endpoint,
      ),
    );
  }

  async setInstanceChannelEnabled(
    instanceId: string,
    channelId: string,
    enabled: boolean,
  ): Promise<boolean> {
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot, instance) => {
      const current = snapshot.channels.find((channel) => channel.id === channelId) as
        | BrowserOpenClawWorkbenchChannelRecord
        | undefined;
      const template = resolveBrowserOpenClawChannelTemplate(channelId, current);
      const nextChannel = createBrowserOpenClawChannelRecord({
        template,
        values: current?.values,
        enabled,
        configuredFieldCount: current?.configuredFieldCount,
      });

      return {
        ...snapshot,
        channels: sortBrowserOpenClawChannels(
          [
            ...snapshot.channels.filter((channel) => channel.id !== channelId),
            nextChannel,
          ] as BrowserOpenClawWorkbenchChannelRecord[],
        ),
        files: updateWorkbenchConfigFile(snapshot, instance, (root) => {
          const channelsRoot = asObject(root.channels);
          const currentChannelRoot = asObject(channelsRoot[channelId]);
          if (template.configurationMode === 'none' || nextChannel.configuredFieldCount > 0) {
            root.channels = {
              ...channelsRoot,
              [channelId]: {
                ...currentChannelRoot,
                ...normalizeChannelValues(current?.values),
                enabled: nextChannel.enabled,
              },
            };
            return;
          }

          const { [channelId]: _deletedChannel, ...restChannels } = channelsRoot;
          root.channels = restChannels;
        }),
      };
    });

    return Boolean(
      updated?.channels.some(
        (channel) => channel.id === channelId && channel.enabled === enabled,
      ),
    );
  }

  async saveInstanceChannelConfig(
    instanceId: string,
    channelId: string,
    values: Record<string, string>,
  ): Promise<boolean> {
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot, instance) => {
      const current = snapshot.channels.find((channel) => channel.id === channelId) as
        | BrowserOpenClawWorkbenchChannelRecord
        | undefined;
      const template = resolveBrowserOpenClawChannelTemplate(channelId, current);
      const nextValues = {
        ...normalizeChannelValues(current?.values),
        ...normalizeChannelValues(values),
      };
      const nextChannel = createBrowserOpenClawChannelRecord({
        template,
        values: nextValues,
        enabled: true,
      });

      return {
        ...snapshot,
        channels: sortBrowserOpenClawChannels(
          [
            ...snapshot.channels.filter((channel) => channel.id !== channelId),
            nextChannel,
          ] as BrowserOpenClawWorkbenchChannelRecord[],
        ),
        files: updateWorkbenchConfigFile(snapshot, instance, (root) => {
          const channelsRoot = asObject(root.channels);
          root.channels = {
            ...channelsRoot,
            [channelId]: {
              ...asObject(channelsRoot[channelId]),
              ...nextValues,
              enabled: true,
            },
          };
        }),
      };
    });

    return Boolean(
      updated?.channels.some(
        (channel) =>
          channel.id === channelId &&
          channel.enabled &&
          channel.status === 'connected',
      ),
    );
  }

  async deleteInstanceChannelConfig(
    instanceId: string,
    channelId: string,
  ): Promise<boolean> {
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot, instance) => {
      const current = snapshot.channels.find((channel) => channel.id === channelId) as
        | BrowserOpenClawWorkbenchChannelRecord
        | undefined;
      const template = resolveBrowserOpenClawChannelTemplate(channelId, current);
      const nextChannel = createBrowserOpenClawChannelRecord({
        template,
        values: {},
        enabled: template.configurationMode === 'none',
      });

      return {
        ...snapshot,
        channels: sortBrowserOpenClawChannels(
          [
            ...snapshot.channels.filter((channel) => channel.id !== channelId),
            nextChannel,
          ] as BrowserOpenClawWorkbenchChannelRecord[],
        ),
        files: updateWorkbenchConfigFile(snapshot, instance, (root) => {
          const channelsRoot = asObject(root.channels);
          const { [channelId]: _deletedChannel, ...restChannels } = channelsRoot;
          root.channels =
            template.configurationMode === 'none'
              ? {
                  ...restChannels,
                  [channelId]: {
                    enabled: true,
                  },
                }
              : restChannels;
        }),
      };
    });

    return Boolean(
      updated?.channels.some(
        (channel) =>
          channel.id === channelId &&
          channel.configuredFieldCount === 0 &&
          (channel.configurationMode === 'none'
            ? channel.enabled
            : channel.status === 'not_configured'),
      ),
    );
  }

  async cloneInstanceTask(
    instanceId: string,
    taskId: string,
    name?: string,
  ): Promise<void> {
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot) => {
      const source = snapshot.cronTasks.tasks.find((task) => task.id === taskId);
      if (!source) {
        throw new Error(`Task "${taskId}" not found`);
      }

      const clonedTask: StudioWorkbenchTaskRecord = {
        ...cloneWorkbenchTask(source),
        id: `web-task-${Math.random().toString(36).slice(2, 10)}`,
        name: name?.trim() || `${source.name} (copy)`,
        latestExecution: null,
        lastRun: undefined,
        nextRun: undefined,
      };
      const taskExecutionsById = { ...snapshot.cronTasks.taskExecutionsById };
      delete taskExecutionsById[clonedTask.id];

      return {
        ...snapshot,
        cronTasks: {
          tasks: [clonedTask, ...snapshot.cronTasks.tasks],
          taskExecutionsById,
        },
      };
    });
    if (!updated) {
      throw new Error(`Task "${taskId}" not found`);
    }
  }

  async runInstanceTaskNow(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord> {
    let execution: StudioWorkbenchTaskExecutionRecord | null = null;
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot) => {
      const task = snapshot.cronTasks.tasks.find((entry) => entry.id === taskId);
      if (!task) {
        throw new Error(`Task "${taskId}" not found`);
      }

      execution = createTaskExecutionRecord(task, 'manual');
      const taskExecutionsById = {
        ...snapshot.cronTasks.taskExecutionsById,
        [taskId]: [execution, ...(snapshot.cronTasks.taskExecutionsById[taskId] || [])],
      };

      return {
        ...snapshot,
        cronTasks: {
          tasks: snapshot.cronTasks.tasks.map((entry) =>
            entry.id === taskId
              ? {
                  ...entry,
                  latestExecution: cloneWorkbenchTaskExecution(execution!),
                  lastRun: execution!.startedAt,
                }
              : entry,
          ),
          taskExecutionsById,
        },
      };
    });
    if (!updated || !execution) {
      throw new Error(`Task "${taskId}" not found`);
    }
    return execution;
  }

  async listInstanceTaskExecutions(
    instanceId: string,
    taskId: string,
  ): Promise<StudioWorkbenchTaskExecutionRecord[]> {
    const instance = await this.getInstance(instanceId);
    if (!instance) {
      return [];
    }

    const workbench = readBuiltInOpenClawWorkbench(instance);
    return (workbench?.cronTasks.taskExecutionsById[taskId] || []).map(cloneWorkbenchTaskExecution);
  }

  async updateInstanceTaskStatus(
    instanceId: string,
    taskId: string,
    status: 'active' | 'paused',
  ): Promise<void> {
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot) => {
      const current = snapshot.cronTasks.tasks.find((task) => task.id === taskId);
      if (!current) {
        throw new Error(`Task "${taskId}" not found`);
      }

      return {
        ...snapshot,
        cronTasks: {
          ...snapshot.cronTasks,
          tasks: snapshot.cronTasks.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status,
                }
              : task,
          ),
        },
      };
    });
    if (!updated) {
      throw new Error(`Task "${taskId}" not found`);
    }
  }

  async deleteInstanceTask(instanceId: string, taskId: string): Promise<boolean> {
    let deleted = false;
    const updated = updateBuiltInOpenClawWorkbench(instanceId, (snapshot) => {
      if (!snapshot.cronTasks.tasks.some((task) => task.id === taskId)) {
        return snapshot;
      }

      deleted = true;
      const taskExecutionsById = { ...snapshot.cronTasks.taskExecutionsById };
      delete taskExecutionsById[taskId];
      return {
        ...snapshot,
        cronTasks: {
          tasks: snapshot.cronTasks.tasks.filter((task) => task.id !== taskId),
          taskExecutionsById,
        },
      };
    });

    return Boolean(updated && deleted);
  }

  async listConversations(instanceId: string): Promise<StudioConversationRecord[]> {
    const normalizedInstanceId =
      instanceId.trim() || instanceId;
    return readConversations()
      .conversations
      .map(withConversationDerivedFields)
      .filter(
        (conversation) =>
          conversation.primaryInstanceId === normalizedInstanceId,
      )
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  async putConversation(
    record: StudioConversationRecord,
  ): Promise<StudioConversationRecord> {
    const document = readConversations();
    const normalized = withConversationDerivedFields(record);
    const existingIndex = document.conversations.findIndex(
      (conversation) => conversation.id === normalized.id,
    );

    if (existingIndex >= 0) {
      document.conversations[existingIndex] = normalized;
    } else {
      document.conversations.unshift(normalized);
    }

    writeConversations(document);
    return normalized;
  }

  async deleteConversation(id: string): Promise<boolean> {
    const document = readConversations();
    const next = document.conversations.filter((conversation) => conversation.id !== id);
    const existed = next.length !== document.conversations.length;
    if (!existed) {
      return false;
    }

    document.conversations = next;
    writeConversations(document);
    return true;
  }
}
