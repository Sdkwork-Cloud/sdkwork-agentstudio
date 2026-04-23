import type { ChannelCatalogRegion } from './channelCatalogMeta';

type RegionTranslator = (key: string) => string;

export function buildChannelCatalogRegionLabels(t: RegionTranslator) {
  return {
    domestic: t('channels.page.catalog.tabs.domestic'),
    global: t('channels.page.catalog.tabs.global'),
    media: t('channels.page.catalog.tabs.media'),
    all: t('channels.page.catalog.tabs.all'),
  } satisfies Record<ChannelCatalogRegion, string>;
}

export function buildChannelCatalogRegionDescriptions(t: RegionTranslator) {
  return {
    domestic: t('channels.page.catalog.descriptions.domestic'),
    global: t('channels.page.catalog.descriptions.global'),
    media: t('channels.page.catalog.descriptions.media'),
    all: t('channels.page.catalog.descriptions.all'),
  } satisfies Partial<Record<ChannelCatalogRegion, string>>;
}

export function getChannelCatalogRegionEmptyText(
  t: RegionTranslator,
  activeRegion: ChannelCatalogRegion,
) {
  switch (activeRegion) {
    case 'domestic':
      return t('channels.page.catalog.empty.domestic');
    case 'global':
      return t('channels.page.catalog.empty.global');
    case 'media':
      return t('channels.page.catalog.empty.media');
    case 'all':
    default:
      return t('channels.page.catalog.empty.all');
  }
}
