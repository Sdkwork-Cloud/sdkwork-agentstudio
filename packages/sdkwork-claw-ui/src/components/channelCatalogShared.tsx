import * as React from 'react';
import { cn } from '../lib/utils';
import { getChannelCatalogIcon } from './channelCatalogIcons';
import { getChannelCatalogMonogram, getChannelCatalogTone } from './channelCatalogMeta';

interface ChannelIdentityBadgeProps {
  channelId: string;
  channelName: string;
  icon?: React.ReactNode;
  className?: string;
  monogramClassName?: string;
}

export function ChannelIdentityBadge({
  channelId,
  channelName,
  icon,
  className,
  monogramClassName,
}: ChannelIdentityBadgeProps) {
  const builtInIcon = getChannelCatalogIcon(channelId);

  return (
    <div className={cn(className, getChannelCatalogTone(channelId))}>
      {builtInIcon ? (
        builtInIcon
      ) : icon ? (
        icon
      ) : (
        <span className={monogramClassName}>
          {getChannelCatalogMonogram(channelId, channelName)}
        </span>
      )}
    </div>
  );
}

interface ChannelEmptyStateSurfaceProps {
  title: string;
  dataSlot: string;
  className?: string;
}

export function ChannelEmptyStateSurface({
  title,
  dataSlot,
  className,
}: ChannelEmptyStateSurfaceProps) {
  return (
    <div data-slot={dataSlot} className={className}>
      {title}
    </div>
  );
}
