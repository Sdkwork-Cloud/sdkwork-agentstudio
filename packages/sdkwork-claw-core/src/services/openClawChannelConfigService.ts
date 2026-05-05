import { parseJson5 } from '@sdkwork/local-api-proxy';
import {
  mutateOpenClawConfigDocument,
  type JsonArray,
  type JsonObject,
  type JsonValue,
} from './openClawConfigDocumentService.ts';

export interface OpenClawChannelFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  sensitive?: boolean;
  inputMode?: 'text' | 'url' | 'numeric';
  storageFormat?: 'scalar' | 'stringArray' | 'jsonObject';
}

export interface OpenClawChannelDefinition {
  id: string;
  name: string;
  description: string;
  setupSteps: string[];
  configurationMode?: 'required' | 'none';
  fields: OpenClawChannelFieldDefinition[];
}

export interface OpenClawChannelSnapshot {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  enabled: boolean;
  configurationMode: 'required' | 'none';
  fieldCount: number;
  configuredFieldCount: number;
  setupSteps: string[];
  values: Record<string, string>;
  fields: OpenClawChannelFieldDefinition[];
}

export interface SaveOpenClawChannelConfigurationDocumentInput {
  channelId: string;
  values: Record<string, string>;
  enabled?: boolean;
}

const OPENCLAW_CHANNEL_CONTEXT_VISIBILITY_FIELD: OpenClawChannelFieldDefinition = {
  key: 'contextVisibility',
  label: 'Context Visibility',
  placeholder: 'allowlist_quote',
  helpText:
    'Optional per-channel context visibility policy, for example quote, none, or allowlist_quote.',
};

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readObject(value: unknown) {
  return isJsonObject(value) ? value : null;
}

function ensureObject(parent: JsonObject, key: string): JsonObject {
  const current = parent[key];
  if (!isJsonObject(current)) {
    parent[key] = {};
  }

  return parent[key] as JsonObject;
}

function readScalar(value: JsonValue | undefined) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function parseChannelStringArrayValue(
  field: OpenClawChannelFieldDefinition,
  value: string,
): JsonArray {
  const normalized = value.trim();
  if (!normalized) {
    return [];
  }

  if (normalized.startsWith('[')) {
    const parsed = parseJson5<JsonValue>(normalized);
    if (!Array.isArray(parsed)) {
      throw new Error(`${field.label} must be a JSON array.`);
    }

    return parsed
      .map((entry) => (entry == null ? '' : String(entry).trim()))
      .filter(Boolean);
  }

  return normalized
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseChannelJsonObjectValue(
  field: OpenClawChannelFieldDefinition,
  value: string,
): JsonObject {
  const parsed = parseJson5<JsonValue>(value);
  if (!isJsonObject(parsed)) {
    throw new Error(`${field.label} must be a JSON object.`);
  }

  return parsed;
}

function setOptionalChannelField(
  target: JsonObject,
  field: OpenClawChannelFieldDefinition,
  value: string | undefined,
) {
  const normalized = value?.trim() || '';
  if (!normalized) {
    delete target[field.key];
    return;
  }

  if (field.storageFormat === 'stringArray') {
    target[field.key] = parseChannelStringArrayValue(field, normalized);
    return;
  }

  if (field.storageFormat === 'jsonObject') {
    target[field.key] = parseChannelJsonObjectValue(field, normalized);
    return;
  }

  target[field.key] = normalized;
}

const OPENCLAW_CHANNEL_DEFINITIONS: OpenClawChannelDefinition[] = [
  {
    id: 'sdkworkchat',
    name: 'SDKWORK Official Account',
    description:
      'Use the built-in SDKWORK official account delivery path so OpenClaw can hand off conversations without extra credential setup.',
    setupSteps: [
      'Open the integrated SDKWORK official account experience or install the SDKWORK client if this machine has not signed in yet.',
      'Sign in with your SDKWORK account so the default media channel is ready immediately.',
      'Keep this channel enabled when the current runtime should hand off into the SDKWORK official account.',
    ],
    configurationMode: 'none',
    fields: [],
  },
  {
    id: 'wechat',
    name: 'WeChat',
    description:
      'Connect WeChat conversational messaging so OpenClaw can serve China-facing direct chat surfaces.',
    setupSteps: [
      'Prepare the WeChat integration entry approved for your runtime deployment.',
      'Keep this channel enabled when OpenClaw should expose direct WeChat conversations.',
      'Use the WeChat Official Account channel separately for public account and broadcast workflows.',
    ],
    configurationMode: 'none',
    fields: [],
  },
  {
    id: 'wehcat',
    name: 'WeChat Official Account',
    description:
      'Connect a WeChat official account workflow so OpenClaw can serve China-facing media channels.',
    setupSteps: [
      'Create or manage a WeChat official account in the WeChat official account platform.',
      'Paste the App ID, App Secret, token, and optional AES key here.',
      'Configure the callback URL on the WeChat side and enable the official account channel.',
    ],
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        placeholder: 'wx1234567890abcdef',
        required: true,
      },
      {
        key: 'appSecret',
        label: 'App Secret',
        placeholder: 'WeChat app secret',
        required: true,
        sensitive: true,
      },
      {
        key: 'token',
        label: 'Token',
        placeholder: 'Verification token',
        required: true,
      },
      {
        key: 'encodingAesKey',
        label: 'Encoding AES Key',
        placeholder: 'Optional AES key',
        sensitive: true,
      },
    ],
  },
  {
    id: 'qq',
    name: 'QQ',
    description: 'Connect a QQ bot so OpenClaw can route commands, alerts, and approvals into QQ groups.',
    setupSteps: [
      'Create or manage the target QQ bot in the QQ bot platform.',
      'Paste the bot key and target group ID here.',
      'Enable the channel after a dry-run delivery succeeds.',
    ],
    fields: [
      {
        key: 'botKey',
        label: 'Bot Key',
        placeholder: 'QQ bot key',
        required: true,
        sensitive: true,
      },
      {
        key: 'groupId',
        label: 'Group ID',
        placeholder: '123456789',
        required: true,
        helpText: 'The target QQ group that receives OpenClaw updates.',
      },
    ],
  },
  {
    id: 'dingtalk',
    name: 'DingTalk',
    description: 'Connect a DingTalk custom robot so OpenClaw can broadcast updates into DingTalk workspaces.',
    setupSteps: [
      'Create a custom robot in the target DingTalk group.',
      'Copy the access token and signing secret into this form.',
      'Enable the channel after the first connectivity check succeeds.',
    ],
    fields: [
      {
        key: 'accessToken',
        label: 'Access Token',
        placeholder: 'DingTalk access token',
        required: true,
        sensitive: true,
      },
      {
        key: 'secret',
        label: 'Secret',
        placeholder: 'Robot signing secret',
        required: true,
        sensitive: true,
      },
    ],
  },
  {
    id: 'wecom',
    name: 'WeCom',
    description: 'Connect a WeCom application so OpenClaw can serve enterprise WeCom conversations.',
    setupSteps: [
      'Create a WeCom application with bot or customer-contact permissions.',
      'Paste the corp ID, agent ID, and secret here.',
      'Save the configuration and verify that message delivery succeeds.',
    ],
    fields: [
      {
        key: 'corpId',
        label: 'Corp ID',
        placeholder: 'ww1234567890abcdef',
        required: true,
      },
      {
        key: 'agentId',
        label: 'Agent ID',
        placeholder: '1000002',
        required: true,
      },
      {
        key: 'secret',
        label: 'Secret',
        placeholder: 'WeCom app secret',
        required: true,
        sensitive: true,
      },
    ],
  },
  {
    id: 'feishu',
    name: 'Feishu',
    description: 'Connect a Feishu bot so OpenClaw can receive and reply to team messages.',
    setupSteps: [
      'Create a Feishu app in the open platform.',
      'Copy the App ID and App Secret into this form.',
      'Add the event callback URL from your OpenClaw deployment if needed.',
    ],
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        placeholder: 'cli_xxxxxxxxxxxxx',
        required: true,
      },
      {
        key: 'appSecret',
        label: 'App Secret',
        placeholder: 'App secret',
        required: true,
        sensitive: true,
      },
      {
        key: 'encryptKey',
        label: 'Encrypt Key',
        placeholder: 'Optional encrypt key',
        sensitive: true,
      },
      {
        key: 'verificationToken',
        label: 'Verification Token',
        placeholder: 'Optional verification token',
        sensitive: true,
      },
    ],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Use a Telegram bot token to bring OpenClaw into direct messages or group chats.',
    setupSteps: [
      'Create a bot with BotFather and copy the bot token.',
      'Optionally set a webhook URL if Telegram should push events to your host.',
      'Enable the channel after the required credentials are filled.',
    ],
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        placeholder: '123456:AA...',
        required: true,
        sensitive: true,
      },
      {
        key: 'tokenFile',
        label: 'Token File',
        placeholder: 'Optional token file path',
      },
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://example.com/openclaw/telegram',
        inputMode: 'url',
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        placeholder: 'Optional webhook secret',
        sensitive: true,
      },
      {
        key: 'webhookPath',
        label: 'Webhook Path',
        placeholder: '/telegram/webhook',
      },
      {
        key: 'webhookHost',
        label: 'Webhook Host',
        placeholder: '0.0.0.0',
      },
      {
        key: 'webhookPort',
        label: 'Webhook Port',
        placeholder: '8443',
        inputMode: 'numeric',
      },
      {
        key: 'errorPolicy',
        label: 'Error Policy',
        placeholder: 'retry',
        helpText: 'Optional Telegram delivery error policy, for example retry or disable.',
      },
      {
        key: 'errorCooldownMs',
        label: 'Error Cooldown (ms)',
        placeholder: '300000',
        inputMode: 'numeric',
      },
    ],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description:
      'Manage optional WhatsApp access rules for direct-message allowlists and group delivery behavior.',
    setupSteps: [
      'Authenticate the OpenClaw WhatsApp channel with the official CLI or runtime login flow.',
      'Optionally restrict allowed direct-message senders or define per-group behavior here.',
      'Keep the channel enabled so runtime login state can be reused without extra config wiring.',
    ],
    configurationMode: 'none',
    fields: [
      {
        key: 'allowFrom',
        label: 'Allow From',
        placeholder: '+15555550123\n+15555550124',
        helpText:
          'Optional allowlist of direct-message senders. Enter one phone number per line or a JSON array.',
        multiline: true,
        storageFormat: 'stringArray',
      },
      {
        key: 'groups',
        label: 'Groups',
        placeholder: `{
  "*": {
    "requireMention": true
  }
}`,
        helpText:
          'Optional JSON object of WhatsApp group rules. Use "*" to define defaults for all groups.',
        multiline: true,
        storageFormat: 'jsonObject',
      },
    ],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Attach OpenClaw to a Discord bot for server and DM conversations.',
    setupSteps: [
      'Create a Discord application and bot in the developer portal.',
      'Paste the bot token here and invite the bot to your server.',
      'Turn the channel on once the token has been validated.',
    ],
    fields: [
      {
        key: 'token',
        label: 'Bot Token',
        placeholder: 'Discord bot token',
        required: true,
        sensitive: true,
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Configure bot and app tokens so OpenClaw can work inside Slack workspaces.',
    setupSteps: [
      'Create or open your Slack app and install it to the target workspace.',
      'Paste the bot token and app token below.',
      'Add a signing secret if your workspace uses slash commands or events.',
    ],
    fields: [
      {
        key: 'botToken',
        label: 'Bot Token',
        placeholder: 'xoxb-...',
        required: true,
        sensitive: true,
      },
      {
        key: 'appToken',
        label: 'App Token',
        placeholder: 'xapp-...',
        required: true,
        sensitive: true,
      },
      {
        key: 'signingSecret',
        label: 'Signing Secret',
        placeholder: 'Optional signing secret',
        sensitive: true,
      },
    ],
  },
  {
    id: 'googlechat',
    name: 'Google Chat',
    description: 'Provide Google Chat service account or ref details for enterprise workspace delivery.',
    setupSteps: [
      'Create a Google Chat app and service account.',
      'Provide either the inline service account JSON or a service account reference.',
      'Fill audience or webhook information if your deployment requires it.',
    ],
    fields: [
      {
        key: 'serviceAccount',
        label: 'Service Account JSON',
        placeholder: '{ "type": "service_account", ... }',
        multiline: true,
      },
      {
        key: 'serviceAccountRef',
        label: 'Service Account Ref',
        placeholder: 'secret://googlechat/service-account',
      },
      {
        key: 'audienceType',
        label: 'Audience Type',
        placeholder: 'SPACE or DM',
      },
      {
        key: 'audience',
        label: 'Audience',
        placeholder: 'spaces/AAAA12345',
      },
      {
        key: 'webhookPath',
        label: 'Webhook Path',
        placeholder: '/googlechat/webhook',
      },
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        placeholder: 'https://example.com/openclaw/googlechat',
        inputMode: 'url',
      },
    ],
  },
];

function resolveOpenClawChannelDefinition(
  definition: OpenClawChannelDefinition,
): OpenClawChannelDefinition {
  const fields = definition.fields.map((field) => ({ ...field }));
  const shouldExposeContextVisibility = definition.id !== 'sdkworkchat';

  if (
    shouldExposeContextVisibility &&
    !fields.some((field) => field.key === OPENCLAW_CHANNEL_CONTEXT_VISIBILITY_FIELD.key)
  ) {
    fields.push({ ...OPENCLAW_CHANNEL_CONTEXT_VISIBILITY_FIELD });
  }

  return {
    ...definition,
    setupSteps: [...definition.setupSteps],
    fields,
  };
}

export function listOpenClawChannelDefinitions() {
  return OPENCLAW_CHANNEL_DEFINITIONS.map(resolveOpenClawChannelDefinition);
}

export function findOpenClawChannelDefinition(channelId: string) {
  return listOpenClawChannelDefinitions().find((definition) => definition.id === channelId) || null;
}

export function buildOpenClawChannelSnapshotsFromConfigRoot(
  root: JsonObject,
): OpenClawChannelSnapshot[] {
  const channelsRoot =
    root.channels && typeof root.channels === 'object' && !Array.isArray(root.channels)
      ? (root.channels as JsonObject)
      : {};

  return listOpenClawChannelDefinitions().map((definition) => {
    const channelConfig =
      channelsRoot[definition.id] &&
      typeof channelsRoot[definition.id] === 'object' &&
      !Array.isArray(channelsRoot[definition.id])
        ? (channelsRoot[definition.id] as JsonObject)
        : {};
    const configurationMode = definition.configurationMode || 'required';
    const values = Object.fromEntries(
      definition.fields.map((field) => [field.key, readScalar(channelConfig[field.key])]),
    );
    const configuredFieldCount = definition.fields.filter((field) => Boolean(values[field.key])).length;
    const enabled = Boolean(
      channelConfig.enabled ?? (configurationMode === 'none' ? true : configuredFieldCount > 0),
    );
    const status =
      configurationMode === 'none'
        ? enabled
          ? 'connected'
          : 'disconnected'
        : configuredFieldCount === 0
          ? 'not_configured'
          : enabled
            ? 'connected'
            : 'disconnected';

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      status,
      enabled,
      configurationMode,
      fieldCount: definition.fields.length,
      configuredFieldCount,
      setupSteps: [...definition.setupSteps],
      values,
      fields: definition.fields.map((field) => ({ ...field })),
    };
  });
}

export function saveOpenClawChannelConfigurationToConfigRoot(
  root: JsonObject,
  input: SaveOpenClawChannelConfigurationDocumentInput,
) {
  const channelsRoot = ensureObject(root, 'channels');
  const channelRoot = ensureObject(channelsRoot, input.channelId);
  const definition = findOpenClawChannelDefinition(input.channelId);

  if (!definition) {
    throw new Error(`Unsupported OpenClaw channel: ${input.channelId}`);
  }

  for (const field of definition.fields) {
    setOptionalChannelField(channelRoot, field, input.values[field.key]);
  }

  const configuredFieldCount = definition.fields.filter(
    (field) => Boolean(input.values[field.key]?.trim()),
  ).length;
  channelRoot.enabled =
    input.enabled ??
    ((definition.configurationMode || 'required') === 'none' ? true : configuredFieldCount > 0);
}

export function setOpenClawChannelEnabledInDocument(
  raw: string,
  input: {
    channelId: string;
    enabled: boolean;
  },
) {
  return mutateOpenClawConfigDocument(raw, (root) => {
    const channelsRoot = ensureObject(root, 'channels');
    const channelRoot = ensureObject(channelsRoot, input.channelId);
    channelRoot.enabled = input.enabled;
  });
}
