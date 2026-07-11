export interface ChannelOfficialLink {
  href: string;
  label: string;
}

export type ChannelCatalogRegion = 'domestic' | 'global' | 'media' | 'all';
type ChannelCatalogPlacementRegion = Exclude<ChannelCatalogRegion, 'all'>;

export interface ChannelCatalogRegionGroups<T> {
  domestic: T[];
  global: T[];
  media: T[];
  all: T[];
}

interface ChannelCatalogMeta {
  order: number;
  monogram: string;
  tone: string;
  regions: ChannelCatalogPlacementRegion[];
  officialLink?: ChannelOfficialLink;
  primaryAction?: 'officialSite' | 'downloadApp';
}

const defaultChannelTone =
  'border-zinc-200/80 bg-gradient-to-br from-white to-zinc-50 text-zinc-700 dark:border-zinc-700/80 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-100';

const channelCatalogMetaMap: Record<string, ChannelCatalogMeta> = {
  qqbot: {
    order: 5,
    monogram: 'QQ',
    tone:
      'border-blue-200/80 bg-gradient-to-br from-blue-50 to-cyan-100 text-blue-700 dark:border-blue-500/20 dark:from-blue-500/15 dark:to-cyan-500/15 dark:text-blue-200',
    regions: ['domestic'],
    officialLink: {
      href: 'https://docs.openclaw.ai/channels/qqbot',
      label: 'OpenClaw QQ Bot Channel Docs',
    },
  },
  feishu: {
    order: 6,
    monogram: 'FS',
    tone: defaultChannelTone,
    regions: ['domestic'],
    officialLink: {
      href: 'https://docs.openclaw.ai/channels/feishu',
      label: 'OpenClaw Feishu Channel Docs',
    },
  },
  'openclaw-weixin': {
    order: 7,
    monogram: 'WX',
    tone: defaultChannelTone,
    regions: ['domestic'],
    officialLink: {
      href: 'https://docs.openclaw.ai/channels/wechat',
      label: 'OpenClaw WeChat Plugin Docs',
    },
  },
  wecom: {
    order: 8,
    monogram: 'WC',
    tone: defaultChannelTone,
    regions: ['domestic'],
    officialLink: {
      href: 'https://github.com/WecomTeam/wecom-openclaw-plugin',
      label: 'Official WeCom OpenClaw Plugin',
    },
  },
  'dingtalk-connector': {
    order: 9,
    monogram: 'DT',
    tone: defaultChannelTone,
    regions: ['domestic'],
    officialLink: {
      href: 'https://github.com/DingTalk-Real-AI/dingtalk-openclaw-connector',
      label: 'Official DingTalk OpenClaw Plugin',
    },
  },
  dingtalk: {
    order: 10,
    monogram: 'DT',
    tone: defaultChannelTone,
    regions: ['domestic'],
    officialLink: {
      href: 'https://soimy.github.io/openclaw-channel-dingtalk/',
      label: 'OpenClaw DingTalk Channel Plugin Docs',
    },
  },
  imessage: {
    order: 20,
    monogram: 'IM',
    tone:
      'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 dark:border-emerald-500/20 dark:from-emerald-500/15 dark:to-teal-500/15 dark:text-emerald-200',
    regions: ['global', 'media'],
    officialLink: {
      href: 'https://docs.openclaw.ai/channels/imessage',
      label: 'OpenClaw iMessage Channel Docs',
    },
  },
  irc: {
    order: 30,
    monogram: 'IRC',
    tone:
      'border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-blue-100 text-cyan-700 dark:border-cyan-500/20 dark:from-cyan-500/15 dark:to-blue-500/15 dark:text-cyan-200',
    regions: ['global'],
    officialLink: {
      href: 'https://docs.openclaw.ai/channels/irc',
      label: 'OpenClaw IRC Channel Docs',
    },
  },
  matrix: {
    order: 40,
    monogram: 'MX',
    tone:
      'border-violet-200/80 bg-gradient-to-br from-violet-50 to-indigo-100 text-violet-700 dark:border-violet-500/20 dark:from-violet-500/15 dark:to-indigo-500/15 dark:text-violet-200',
    regions: ['global'],
    officialLink: {
      href: 'https://docs.openclaw.ai/channels/matrix',
      label: 'OpenClaw Matrix Channel Docs',
    },
  },
  mattermost: {
    order: 50,
    monogram: 'MM',
    tone:
      'border-slate-200/80 bg-gradient-to-br from-slate-50 to-cyan-100 text-slate-700 dark:border-slate-500/20 dark:from-slate-500/15 dark:to-cyan-500/15 dark:text-slate-200',
    regions: ['global'],
    officialLink: {
      href: 'https://docs.openclaw.ai/channels/mattermost',
      label: 'OpenClaw Mattermost Channel Docs',
    },
  },
  signal: {
    order: 60,
    monogram: 'SG',
    tone:
      'border-blue-200/80 bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 dark:border-blue-500/20 dark:from-blue-500/15 dark:to-indigo-500/15 dark:text-blue-200',
    regions: ['global'],
    officialLink: {
      href: 'https://docs.openclaw.ai/channels/signal',
      label: 'OpenClaw Signal Channel Docs',
    },
  },
  slack: {
    order: 70,
    monogram: 'SL',
    tone:
      'border-rose-200/80 bg-gradient-to-br from-rose-50 to-orange-100 text-rose-700 dark:border-rose-500/20 dark:from-rose-500/15 dark:to-orange-500/15 dark:text-rose-200',
    regions: ['global'],
    officialLink: {
      href: 'https://api.slack.com/apps',
      label: 'Slack API Apps',
    },
  },
  telegram: {
    order: 80,
    monogram: 'TG',
    tone:
      'border-sky-200/80 bg-gradient-to-br from-sky-50 to-blue-100 text-sky-700 dark:border-sky-500/20 dark:from-sky-500/15 dark:to-blue-500/15 dark:text-sky-200',
    regions: ['global'],
    officialLink: {
      href: 'https://core.telegram.org/bots',
      label: 'Telegram Bot Platform',
    },
  },
};

function getStatusRank(item: { status?: string; enabled?: boolean }) {
  if (item.status === 'connected' && item.enabled) {
    return 0;
  }
  if (item.status === 'connected') {
    return 1;
  }
  if (item.status === 'disconnected') {
    return 2;
  }
  return 3;
}

function getOrder(channelId: string) {
  return channelCatalogMetaMap[channelId]?.order ?? 100;
}

function fallbackMonogram(name?: string) {
  const normalized = (name || '')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return normalized || 'CH';
}

export function getChannelOfficialLink(channelId: string): ChannelOfficialLink | null {
  return channelCatalogMetaMap[channelId]?.officialLink || null;
}

export function getChannelCatalogRegion(channelId: string): ChannelCatalogRegion {
  return getChannelCatalogRegions(channelId)[0] || 'global';
}

export function getChannelCatalogRegions(channelId: string): ChannelCatalogPlacementRegion[] {
  return channelCatalogMetaMap[channelId]?.regions || ['global'];
}

export function isChannelDownloadAppAction(channelId: string) {
  return channelCatalogMetaMap[channelId]?.primaryAction === 'downloadApp';
}

export function getChannelCatalogMonogram(channelId: string, name?: string) {
  return channelCatalogMetaMap[channelId]?.monogram || fallbackMonogram(name);
}

export function getChannelCatalogTone(channelId: string) {
  return channelCatalogMetaMap[channelId]?.tone || defaultChannelTone;
}

export function sortChannelCatalogItems<
  T extends { id: string; name?: string; status?: string; enabled?: boolean },
>(items: T[]) {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const orderDifference = getOrder(left.item.id) - getOrder(right.item.id);
      if (orderDifference !== 0) {
        return orderDifference;
      }

      if (getOrder(left.item.id) >= 100 && getOrder(right.item.id) >= 100) {
        const statusDifference = getStatusRank(left.item) - getStatusRank(right.item);
        if (statusDifference !== 0) {
          return statusDifference;
        }
      }

      const nameDifference = (left.item.name || '').localeCompare(right.item.name || '');
      if (nameDifference !== 0) {
        return nameDifference;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.item);
}

export function partitionChannelCatalogItemsByRegion<
  T extends { id: string; name?: string; status?: string; enabled?: boolean },
>(items: T[]): ChannelCatalogRegionGroups<T> {
  return sortChannelCatalogItems(items).reduce<ChannelCatalogRegionGroups<T>>(
    (groups, item) => {
      const regions = getChannelCatalogRegions(item.id);
      for (const region of regions) {
        groups[region].push(item);
      }
      groups.all.push(item);
      return groups;
    },
    {
      domestic: [],
      global: [],
      media: [],
      all: [],
    },
  );
}

export function resolveDefaultChannelCatalogRegion<T>(
  groups: ChannelCatalogRegionGroups<T>,
): ChannelCatalogRegion {
  if (groups.domestic.length > 0) {
    return 'domestic';
  }

  if (groups.global.length > 0) {
    return 'global';
  }

  if (groups.media.length > 0) {
    return 'media';
  }

  return 'all';
}
