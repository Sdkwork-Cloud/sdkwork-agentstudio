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
  sdkworkchat: {
    order: 0,
    monogram: 'SC',
    tone:
      'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-700 dark:border-emerald-500/20 dark:from-emerald-500/15 dark:to-teal-500/15 dark:text-emerald-200',
    regions: ['domestic', 'global', 'media'],
    officialLink: {
      href: 'https://clawstudio.sdkwork.com/platforms/android',
      label: 'Sdkwork Chat App Download',
    },
    primaryAction: 'downloadApp',
  },
  wechat: {
    order: 1,
    monogram: 'WX',
    tone:
      'border-green-200/80 bg-gradient-to-br from-green-50 to-emerald-100 text-green-700 dark:border-green-500/20 dark:from-green-500/15 dark:to-emerald-500/15 dark:text-green-200',
    regions: ['domestic'],
    officialLink: {
      href: 'https://weixin.qq.com/',
      label: 'WeChat Official Site',
    },
  },
  wehcat: {
    order: 2,
    monogram: 'WC',
    tone:
      'border-green-200/80 bg-gradient-to-br from-green-50 to-lime-100 text-green-700 dark:border-green-500/20 dark:from-green-500/15 dark:to-lime-500/15 dark:text-green-200',
    regions: ['media'],
    officialLink: {
      href: 'https://mp.weixin.qq.com/',
      label: 'WeChat Official Account Platform',
    },
  },
  feishu: {
    order: 10,
    monogram: 'FS',
    tone:
      'border-sky-200/80 bg-gradient-to-br from-sky-50 to-cyan-100 text-sky-700 dark:border-sky-500/20 dark:from-sky-500/15 dark:to-cyan-500/15 dark:text-sky-200',
    regions: ['domestic'],
    officialLink: {
      href: 'https://open.feishu.cn/app?lang=zh-CN',
      label: 'Feishu Open Platform',
    },
  },
  qq: {
    order: 3,
    monogram: 'QQ',
    tone:
      'border-cyan-200/80 bg-gradient-to-br from-cyan-50 to-blue-100 text-cyan-700 dark:border-cyan-500/20 dark:from-cyan-500/15 dark:to-blue-500/15 dark:text-cyan-200',
    regions: ['domestic'],
    officialLink: {
      href: 'https://q.qq.com/qqbot/#/home',
      label: 'QQ Bot Platform',
    },
  },
  dingtalk: {
    order: 4,
    monogram: 'DT',
    tone:
      'border-blue-200/80 bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-700 dark:border-blue-500/20 dark:from-blue-500/15 dark:to-indigo-500/15 dark:text-blue-200',
    regions: ['domestic'],
    officialLink: {
      href: 'https://open-dev.dingtalk.com/',
      label: 'DingTalk Developer Console',
    },
  },
  wecom: {
    order: 5,
    monogram: 'WC',
    tone:
      'border-violet-200/80 bg-gradient-to-br from-violet-50 to-indigo-100 text-violet-700 dark:border-violet-500/20 dark:from-violet-500/15 dark:to-indigo-500/15 dark:text-violet-200',
    regions: ['domestic'],
    officialLink: {
      href: 'https://work.weixin.qq.com/wework_admin/loginpage_wx?redirect_uri=https%3A%2F%2Fwork.weixin.qq.com%2Fwework_admin%2Fframe',
      label: 'WeCom Admin Console',
    },
  },
  telegram: {
    order: 20,
    monogram: 'TG',
    tone:
      'border-sky-200/80 bg-gradient-to-br from-sky-50 to-blue-100 text-sky-700 dark:border-sky-500/20 dark:from-sky-500/15 dark:to-blue-500/15 dark:text-sky-200',
    regions: ['global'],
    officialLink: {
      href: 'https://core.telegram.org/bots',
      label: 'Telegram Bot Platform',
    },
  },
  discord: {
    order: 21,
    monogram: 'DS',
    tone:
      'border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-700 dark:border-indigo-500/20 dark:from-indigo-500/15 dark:to-violet-500/15 dark:text-indigo-200',
    regions: ['global'],
    officialLink: {
      href: 'https://discord.com/developers/applications',
      label: 'Discord Developer Portal',
    },
  },
  slack: {
    order: 22,
    monogram: 'SL',
    tone:
      'border-rose-200/80 bg-gradient-to-br from-rose-50 to-orange-100 text-rose-700 dark:border-rose-500/20 dark:from-rose-500/15 dark:to-orange-500/15 dark:text-rose-200',
    regions: ['global'],
    officialLink: {
      href: 'https://api.slack.com/apps',
      label: 'Slack API Apps',
    },
  },
  googlechat: {
    order: 23,
    monogram: 'GC',
    tone:
      'border-amber-200/80 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-700 dark:border-amber-500/20 dark:from-amber-500/15 dark:to-yellow-500/15 dark:text-amber-200',
    regions: ['global'],
    officialLink: {
      href: 'https://developers.google.com/workspace/chat',
      label: 'Google Chat Developer Docs',
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
