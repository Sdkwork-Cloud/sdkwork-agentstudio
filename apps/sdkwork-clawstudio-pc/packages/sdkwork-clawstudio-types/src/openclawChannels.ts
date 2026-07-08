export type OpenClawBundledChannelId =
  | 'qqbot'
  | 'feishu'
  | 'imessage'
  | 'irc'
  | 'matrix'
  | 'mattermost'
  | 'signal'
  | 'slack'
  | 'telegram';

export interface OpenClawBundledChannelMetadata {
  id: OpenClawBundledChannelId;
  label: string;
  detailLabel: string;
  description: string;
  docsPath: string;
  order: number;
}

export interface OpenClawChannelFieldDefinition {
  key: string;
  label: string;
  placeholder: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  sensitive?: boolean;
  inputMode?: 'text' | 'url' | 'numeric';
  storageFormat?: 'scalar' | 'stringArray' | 'jsonObject' | 'jsonValue';
}

export interface OpenClawChannelDefinition {
  id: OpenClawBundledChannelId;
  name: string;
  description: string;
  setupSteps: string[];
  configurationMode?: 'required' | 'none';
  fields: OpenClawChannelFieldDefinition[];
}

export const OPENCLAW_BUNDLED_CHANNEL_IDS: readonly OpenClawBundledChannelId[] = [
  'qqbot',
  'feishu',
  'imessage',
  'irc',
  'matrix',
  'mattermost',
  'signal',
  'slack',
  'telegram',
];

export const OPENCLAW_BUNDLED_CHANNELS: readonly OpenClawBundledChannelMetadata[] = [
  {
    id: 'qqbot',
    label: 'QQ Bot',
    detailLabel: 'QQ Bot Official API',
    description: 'Connect OpenClaw to QQ direct messages and groups through the official QQ Bot API.',
    docsPath: '/channels/qqbot',
    order: 5,
  },
  {
    id: 'feishu',
    label: 'Feishu',
    detailLabel: 'Feishu Bot',
    description: 'Connect OpenClaw to Feishu and Lark conversations through the bundled Feishu bot plugin.',
    docsPath: '/channels/feishu',
    order: 6,
  },
  {
    id: 'imessage',
    label: 'iMessage',
    detailLabel: 'iMessage',
    description: 'Bridge OpenClaw into iMessage or SMS conversations through the bundled iMessage plugin.',
    docsPath: '/channels/imessage',
    order: 10,
  },
  {
    id: 'irc',
    label: 'IRC',
    detailLabel: 'IRC',
    description: 'Bridge OpenClaw into classic IRC networks with server, nick, and channel routing controls.',
    docsPath: '/channels/irc',
    order: 20,
  },
  {
    id: 'matrix',
    label: 'Matrix',
    detailLabel: 'Matrix',
    description: 'Connect OpenClaw to Matrix rooms and direct messages through the bundled Matrix plugin.',
    docsPath: '/channels/matrix',
    order: 30,
  },
  {
    id: 'mattermost',
    label: 'Mattermost',
    detailLabel: 'Mattermost',
    description: 'Connect OpenClaw to a Mattermost workspace with bot authentication and access policy controls.',
    docsPath: '/channels/mattermost',
    order: 40,
  },
  {
    id: 'signal',
    label: 'Signal',
    detailLabel: 'Signal REST',
    description: 'Connect OpenClaw to Signal through a linked signal-cli or REST daemon session.',
    docsPath: '/channels/signal',
    order: 50,
  },
  {
    id: 'slack',
    label: 'Slack',
    detailLabel: 'Slack Bot',
    description: 'Connect OpenClaw to Slack workspaces through Socket Mode bot and app tokens.',
    docsPath: '/channels/slack',
    order: 60,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    detailLabel: 'Telegram Bot',
    description: 'Connect OpenClaw to Telegram direct messages and groups through the Bot API.',
    docsPath: '/channels/telegram',
    order: 70,
  },
];

export const OPENCLAW_CHANNEL_CONFIG_META_KEYS = ['defaults', 'modelByChannel'] as const;

export const OPENCLAW_CHANNEL_CONTEXT_VISIBILITY_FIELD: OpenClawChannelFieldDefinition = {
  key: 'contextVisibility',
  label: 'Context Visibility',
  placeholder: 'allowlist_quote',
  helpText:
    'Optional per-channel context visibility policy, for example quote, none, or allowlist_quote.',
};

const OPENCLAW_CHANNEL_ALLOW_FROM_FIELD: OpenClawChannelFieldDefinition = {
  key: 'allowFrom',
  label: 'Allow From',
  placeholder: 'user@example.com\n+15555550123\n*',
  helpText:
    'Optional direct-message allowlist. Enter one sender per line or a JSON array. Use "*" only for intentionally open trusted channels.',
  multiline: true,
  storageFormat: 'stringArray',
};

const OPENCLAW_CHANNEL_GROUPS_FIELD: OpenClawChannelFieldDefinition = {
  key: 'groups',
  label: 'Groups',
  placeholder: `{
  "*": {
    "requireMention": true
  }
}`,
  helpText:
    'Optional JSON object of group or room routing rules. Use "*" to define defaults for all groups.',
  multiline: true,
  storageFormat: 'jsonObject',
};

const OPENCLAW_CHANNEL_FIELD_DEFINITIONS_BY_ID: Record<
  OpenClawBundledChannelId,
  readonly OpenClawChannelFieldDefinition[]
> = {
  qqbot: [
    {
      key: 'appId',
      label: 'App ID',
      placeholder: 'QQ Bot App ID',
      helpText: 'Required QQ Bot application ID from the QQ Bot developer console.',
      required: true,
    },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      placeholder: 'QQ Bot client secret',
      helpText: 'Required QQ Bot client secret. Prefer an environment or secret reference for release deployments.',
      required: true,
      sensitive: true,
    },
    {
      key: 'clientSecretFile',
      label: 'Client Secret File',
      placeholder: 'secret://qqbot/client-secret',
      helpText: 'Optional file or secret reference used instead of an inline client secret.',
      sensitive: true,
    },
    {
      key: 'allowFrom',
      label: 'Allow From',
      placeholder: '123456789\n987654321',
      helpText:
        'Optional direct-message allowlist of QQ user IDs. Enter one sender per line or a JSON array.',
      multiline: true,
      storageFormat: 'stringArray',
    },
    {
      key: 'groupAllowFrom',
      label: 'Group Allow From',
      placeholder: '987654321\n123456789',
      helpText:
        'Optional QQ group allowlist used when groupPolicy is allowlist. Enter one group ID per line or a JSON array.',
      multiline: true,
      storageFormat: 'stringArray',
    },
    {
      key: 'dmPolicy',
      label: 'DM Policy',
      placeholder: 'open',
      helpText: 'Optional direct-message policy: open, allowlist, or disabled.',
    },
    {
      key: 'groupPolicy',
      label: 'Group Policy',
      placeholder: 'open',
      helpText: 'Optional group policy: open, allowlist, or disabled.',
    },
    {
      key: 'systemPrompt',
      label: 'System Prompt',
      placeholder: 'Optional QQ Bot specific system prompt',
      multiline: true,
    },
    {
      key: 'markdownSupport',
      label: 'Markdown Support',
      placeholder: 'true',
      helpText: 'Optional boolean flag controlling QQ Markdown output support.',
    },
    {
      key: 'streaming',
      label: 'Streaming',
      placeholder: `{
  "mode": "partial"
}`,
      helpText: 'Optional QQ Bot streaming configuration. Use true, false, or a JSON object supported by the plugin.',
      multiline: true,
      storageFormat: 'jsonValue',
    },
    {
      key: 'groups',
      label: 'Groups',
      placeholder: `{
  "987654321": {
    "requireMention": true
  }
}`,
      helpText:
        'Optional JSON object of QQ group routing rules. Use group IDs or "*" to define defaults.',
      multiline: true,
      storageFormat: 'jsonObject',
    },
    {
      key: 'stt',
      label: 'Speech To Text',
      placeholder: `{
  "provider": "default"
}`,
      helpText: 'Optional QQ Bot speech-to-text configuration. Use true, false, or a plugin-supported JSON object.',
      multiline: true,
      storageFormat: 'jsonValue',
    },
    {
      key: 'tts',
      label: 'Text To Speech',
      placeholder: `{
  "provider": "default"
}`,
      helpText: 'Optional QQ Bot text-to-speech configuration. Use true, false, or a plugin-supported JSON object.',
      multiline: true,
      storageFormat: 'jsonValue',
    },
    {
      key: 'audioFormatPolicy',
      label: 'Audio Format Policy',
      placeholder: `{
  "sttDirectFormats": ["amr"],
  "uploadDirectFormats": ["amr"],
  "transcodeEnabled": true
}`,
      helpText:
        'Optional QQ Bot audio format policy for direct STT/upload formats and plugin transcoding.',
      multiline: true,
      storageFormat: 'jsonObject',
    },
    {
      key: 'accounts',
      label: 'Accounts',
      placeholder: `{
  "main": {
    "appId": "123456"
  }
}`,
      helpText: 'Optional multi-account QQ Bot configuration keyed by account ID.',
      multiline: true,
      storageFormat: 'jsonObject',
    },
    {
      key: 'defaultAccount',
      label: 'Default Account',
      placeholder: 'main',
    },
  ],
  feishu: [
    {
      key: 'appId',
      label: 'App ID',
      placeholder: 'cli_a1234567890abcdef',
      helpText: 'Required Feishu or Lark application ID from the developer console.',
      required: true,
    },
    {
      key: 'appSecret',
      label: 'App Secret',
      placeholder: 'Feishu app secret',
      helpText: 'Required Feishu or Lark app secret. Prefer an environment or secret reference for release deployments.',
      required: true,
      sensitive: true,
    },
    {
      key: 'appSecretFile',
      label: 'App Secret File',
      placeholder: 'secret://feishu/app-secret',
      helpText: 'Optional file or secret reference used instead of an inline app secret.',
      sensitive: true,
    },
    {
      key: 'verificationToken',
      label: 'Verification Token',
      placeholder: 'Optional event subscription verification token',
      sensitive: true,
    },
    {
      key: 'encryptKey',
      label: 'Encrypt Key',
      placeholder: 'Optional event encryption key',
      sensitive: true,
    },
    {
      key: 'allowFrom',
      label: 'Allow From',
      placeholder: 'ou_xxxxxxxxxxxxxxxx\non_xxxxxxxxxxxxxxxx',
      helpText:
        'Optional direct-message allowlist of Feishu or Lark sender IDs. Enter one sender per line or a JSON array.',
      multiline: true,
      storageFormat: 'stringArray',
    },
    {
      key: 'groupAllowFrom',
      label: 'Group Allow From',
      placeholder: 'oc_xxxxxxxxxxxxxxxx\noc_yyyyyyyyyyyyyyyy',
      helpText:
        'Optional Feishu or Lark group allowlist used when groupPolicy is allowlist. Enter one chat ID per line or a JSON array.',
      multiline: true,
      storageFormat: 'stringArray',
    },
    {
      key: 'dmPolicy',
      label: 'DM Policy',
      placeholder: 'open',
      helpText: 'Optional direct-message policy: open, allowlist, or disabled.',
    },
    {
      key: 'groupPolicy',
      label: 'Group Policy',
      placeholder: 'open',
      helpText: 'Optional group policy: open, allowlist, or disabled.',
    },
    {
      key: 'systemPrompt',
      label: 'System Prompt',
      placeholder: 'Optional Feishu specific system prompt',
      multiline: true,
    },
    {
      key: 'streaming',
      label: 'Streaming',
      placeholder: `{
  "mode": "partial"
}`,
      helpText: 'Optional Feishu streaming configuration. Use true, false, or a JSON object supported by the plugin.',
      multiline: true,
      storageFormat: 'jsonValue',
    },
    {
      key: 'groups',
      label: 'Groups',
      placeholder: `{
  "oc_xxxxxxxxxxxxxxxx": {
    "requireMention": true
  }
}`,
      helpText:
        'Optional JSON object of Feishu or Lark group routing rules. Use chat IDs or "*" to define defaults.',
      multiline: true,
      storageFormat: 'jsonObject',
    },
    {
      key: 'accounts',
      label: 'Accounts',
      placeholder: `{
  "main": {
    "appId": "cli_a1234567890abcdef"
  }
}`,
      helpText: 'Optional multi-account Feishu or Lark configuration keyed by account ID.',
      multiline: true,
      storageFormat: 'jsonObject',
    },
    {
      key: 'defaultAccount',
      label: 'Default Account',
      placeholder: 'main',
    },
  ],
  imessage: [
    {
      key: 'dbPath',
      label: 'Database Path',
      placeholder: '~/Library/Messages/chat.db',
      helpText: 'Optional iMessage database path when the runtime cannot use the platform default.',
    },
    {
      key: 'remoteHost',
      label: 'Remote Host',
      placeholder: 'mac-mini.local',
      helpText: 'Optional remote iMessage bridge host for non-local runtime access.',
    },
    {
      key: 'service',
      label: 'Service',
      placeholder: 'auto',
      helpText: 'Optional service selector: imessage, sms, or auto.',
    },
    {
      key: 'region',
      label: 'SMS Region',
      placeholder: 'US',
      helpText: 'Optional SMS region used by the iMessage plugin.',
    },
    OPENCLAW_CHANNEL_ALLOW_FROM_FIELD,
    OPENCLAW_CHANNEL_GROUPS_FIELD,
  ],
  irc: [
    {
      key: 'host',
      label: 'Host',
      placeholder: 'irc.libera.chat',
      required: true,
    },
    {
      key: 'port',
      label: 'Port',
      placeholder: '6697',
      inputMode: 'numeric',
    },
    {
      key: 'nick',
      label: 'Nick',
      placeholder: 'openclaw-bot',
      required: true,
    },
    {
      key: 'username',
      label: 'Username',
      placeholder: 'openclaw',
    },
    {
      key: 'password',
      label: 'Password',
      placeholder: 'IRC server password',
      sensitive: true,
    },
    {
      key: 'passwordFile',
      label: 'Password File',
      placeholder: 'secret://irc/password',
      sensitive: true,
    },
    {
      key: 'channels',
      label: 'Channels',
      placeholder: '#openclaw\n#ops',
      multiline: true,
      storageFormat: 'stringArray',
    },
    OPENCLAW_CHANNEL_ALLOW_FROM_FIELD,
    OPENCLAW_CHANNEL_GROUPS_FIELD,
  ],
  matrix: [
    {
      key: 'homeserver',
      label: 'Homeserver',
      placeholder: 'https://matrix.org',
      required: true,
      inputMode: 'url',
    },
    {
      key: 'userId',
      label: 'User ID',
      placeholder: '@openclaw:matrix.org',
      required: true,
    },
    {
      key: 'accessToken',
      label: 'Access Token',
      placeholder: 'Matrix access token',
      required: true,
      sensitive: true,
    },
    {
      key: 'password',
      label: 'Password',
      placeholder: 'Matrix password',
      sensitive: true,
    },
    {
      key: 'deviceId',
      label: 'Device ID',
      placeholder: 'OPENCLAW',
    },
    {
      key: 'deviceName',
      label: 'Device Name',
      placeholder: 'OpenClaw',
    },
    OPENCLAW_CHANNEL_ALLOW_FROM_FIELD,
    OPENCLAW_CHANNEL_GROUPS_FIELD,
  ],
  mattermost: [
    {
      key: 'url',
      label: 'Server URL',
      placeholder: 'https://mattermost.example.com',
      required: true,
      inputMode: 'url',
    },
    {
      key: 'botToken',
      label: 'Bot Token',
      placeholder: 'Mattermost bot token',
      required: true,
      sensitive: true,
    },
    OPENCLAW_CHANNEL_ALLOW_FROM_FIELD,
    OPENCLAW_CHANNEL_GROUPS_FIELD,
  ],
  signal: [
    {
      key: 'account',
      label: 'Account',
      placeholder: '+15555550123',
      required: true,
      helpText: 'Signal account identifier used to bind this channel to a linked device session.',
    },
    {
      key: 'accountUuid',
      label: 'Account UUID',
      placeholder: 'Optional Signal account UUID',
    },
    {
      key: 'httpUrl',
      label: 'HTTP URL',
      placeholder: 'http://127.0.0.1:8080',
      inputMode: 'url',
    },
    {
      key: 'httpHost',
      label: 'HTTP Host',
      placeholder: '127.0.0.1',
    },
    {
      key: 'httpPort',
      label: 'HTTP Port',
      placeholder: '8080',
      inputMode: 'numeric',
    },
    OPENCLAW_CHANNEL_ALLOW_FROM_FIELD,
    OPENCLAW_CHANNEL_GROUPS_FIELD,
  ],
  slack: [
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
    {
      key: 'webhookPath',
      label: 'Webhook Path',
      placeholder: '/slack/events',
    },
    OPENCLAW_CHANNEL_ALLOW_FROM_FIELD,
    OPENCLAW_CHANNEL_GROUPS_FIELD,
  ],
  telegram: [
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
      key: 'apiRoot',
      label: 'API Root',
      placeholder: 'https://api.telegram.org',
      inputMode: 'url',
    },
    {
      key: 'allowFrom',
      label: 'Allow From',
      placeholder: '123456789\n987654321',
      helpText:
        'Optional allowlist of Telegram sender IDs or usernames. Enter one sender per line or a JSON array.',
      multiline: true,
      storageFormat: 'stringArray',
    },
    {
      key: 'groups',
      label: 'Groups',
      placeholder: `{
  "-1001234567890": {
    "requireMention": true
  }
}`,
      helpText:
        'Optional JSON object of Telegram group rules. Use chat IDs or "*" to define defaults.',
      multiline: true,
      storageFormat: 'jsonObject',
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
};

export function buildOpenClawChannelSetupSteps(metadata: OpenClawBundledChannelMetadata) {
  return [
    `Open the OpenClaw ${metadata.label} channel documentation before entering credentials.`,
    `Configure the ${metadata.detailLabel} plugin with the runtime-supported fields shown here.`,
    `Enable ${metadata.label} after credentials or runtime account state are ready.`,
  ];
}

function cloneOpenClawChannelFieldDefinition(
  field: OpenClawChannelFieldDefinition,
): OpenClawChannelFieldDefinition {
  return { ...field };
}

export function listOpenClawChannelFieldDefinitions(channelId: OpenClawBundledChannelId) {
  return OPENCLAW_CHANNEL_FIELD_DEFINITIONS_BY_ID[channelId].map(
    cloneOpenClawChannelFieldDefinition,
  );
}

function buildOpenClawChannelDefinitionFromMetadata(
  metadata: OpenClawBundledChannelMetadata,
): OpenClawChannelDefinition {
  const fields = listOpenClawChannelFieldDefinitions(metadata.id);

  if (!fields.some((field) => field.key === OPENCLAW_CHANNEL_CONTEXT_VISIBILITY_FIELD.key)) {
    fields.push(cloneOpenClawChannelFieldDefinition(OPENCLAW_CHANNEL_CONTEXT_VISIBILITY_FIELD));
  }

  return {
    id: metadata.id,
    name: metadata.label,
    description: metadata.description,
    setupSteps: buildOpenClawChannelSetupSteps(metadata),
    fields,
  };
}

export function listOpenClawChannelDefinitions() {
  return OPENCLAW_BUNDLED_CHANNELS.map(buildOpenClawChannelDefinitionFromMetadata);
}

export function findOpenClawChannelDefinition(channelId: string) {
  return isOpenClawBundledChannelId(channelId)
    ? listOpenClawChannelDefinitions().find((definition) => definition.id === channelId) || null
    : null;
}

export function isOpenClawBundledChannelId(channelId: string): channelId is OpenClawBundledChannelId {
  return (OPENCLAW_BUNDLED_CHANNEL_IDS as readonly string[]).includes(channelId);
}

export function getOpenClawBundledChannelMetadata(
  channelId: string,
): OpenClawBundledChannelMetadata | null {
  return OPENCLAW_BUNDLED_CHANNELS.find((channel) => channel.id === channelId) || null;
}
