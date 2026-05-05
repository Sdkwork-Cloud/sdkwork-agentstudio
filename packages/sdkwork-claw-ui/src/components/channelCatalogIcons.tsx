import * as React from 'react';

function withDefaultClassName(className?: string) {
  return className || 'h-7 w-7';
}

function SdkworkChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="4" y="5" width="20" height="15" rx="7" fill="#10B981" />
      <path d="M4 12.8c1.8-2.1 5-3.4 8.3-3.4 4.1 0 7.8 1.9 10 4.8V12c0-3.9-3.1-7-7-7h-7.2A4.1 4.1 0 0 0 4 9.1v3.7Z" fill="#0F766E" opacity=".22" />
      <path d="M12 20h3.4L12.8 23.2c-.5.6-1.5.3-1.5-.5V20Z" fill="#10B981" />
      <path d="M9.5 11.2h8.2M9.5 14.4h5.8" stroke="#ECFDF5" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="19.6" cy="9.1" r="2.1" fill="#FDE68A" />
    </svg>
  );
}

function WehcatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="#22C55E" />
      <circle cx="18.5" cy="16.5" r="5.5" fill="#16A34A" />
      <circle cx="9.3" cy="11" r="1.1" fill="#fff" />
      <circle cx="13.4" cy="11" r="1.1" fill="#fff" />
      <circle cx="16.7" cy="15.7" r="0.95" fill="#fff" />
      <circle cx="20.1" cy="15.7" r="0.95" fill="#fff" />
      <path d="M7 18.4 7.8 15.8" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" />
      <path d="M20.2 21.9 19.4 19.7" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WechatIcon({ className }: { className?: string }) {
  return <WehcatIcon className={className} />;
}

function FeishuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <path d="M7 18 13.7 5.5c.4-.8 1.6-.7 1.9.1L18.5 12l-5.7 1.5L7 18Z" fill="#00C2FF" />
      <path d="M12.8 13.5 21.3 11c.9-.3 1.7.6 1.3 1.4L18 22.2c-.3.7-1.2.9-1.8.4L9.2 17.5l3.6-4Z" fill="#0F6FFF" />
      <path d="M11.7 14.7 18.2 21c.5.5.2 1.4-.5 1.5L8 24c-.8.1-1.3-.7-1-1.4l2.5-6.2 2.2-1.7Z" fill="#14B8A6" />
    </svg>
  );
}

function QqIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="14" cy="9.2" r="4.1" fill="#111827" />
      <ellipse cx="14" cy="16.7" rx="5.3" ry="6.2" fill="#F8FAFC" />
      <ellipse cx="11.3" cy="21.1" rx="1.7" ry="2.4" fill="#F97316" />
      <ellipse cx="16.7" cy="21.1" rx="1.7" ry="2.4" fill="#F97316" />
      <path d="M10 15.7c1.3 1 2.6 1.4 4 1.4s2.7-.4 4-1.4" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12.4" cy="8.8" r="0.8" fill="#fff" />
      <circle cx="15.6" cy="8.8" r="0.8" fill="#fff" />
    </svg>
  );
}

function DingtalkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <path d="M5.8 14.6 21 5.2c1-.6 2 .5 1.5 1.4l-4.8 8.5 2.1 3.6c.5.8-.3 1.8-1.2 1.6l-4.7-1-4.6 3.4c-.8.6-1.9-.2-1.7-1.2l.8-4.2-2.9-1.2c-.8-.3-.9-1.4.3-1.5Z" fill="#1677FF" />
    </svg>
  );
}

function WecomIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <path d="M14 5.5c-3.7 0-6.8 2.5-7.7 5.9 1.7-1.4 3.9-2.2 6.2-2.2 3.8 0 7.1 2.1 8.8 5.3A7.9 7.9 0 0 0 14 5.5Z" fill="#3B82F6" />
      <path d="M21.8 14.7c0 4.2-3.8 7.6-8.5 7.6-1.4 0-2.7-.3-3.9-.8L5.8 23l1.1-3.2a7.2 7.2 0 0 1-2.1-5.1c0-4.2 3.8-7.6 8.5-7.6s8.5 3.4 8.5 7.6Z" fill="#10B981" />
      <circle cx="10.2" cy="14.3" r="1" fill="#fff" />
      <circle cx="13.6" cy="14.3" r="1" fill="#fff" />
      <circle cx="17" cy="14.3" r="1" fill="#fff" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="14" cy="14" r="11" fill="#229ED9" />
      <path d="M20.7 8.8 8.2 13.6c-.8.3-.8 1.4 0 1.6l3.1 1 1.2 3.8c.2.8 1.3 1 1.8.3l1.8-2.4 3.4 2.5c.6.5 1.5.1 1.7-.7L22 9.9c.2-.8-.5-1.4-1.3-1.1Z" fill="#fff" />
      <path d="m11.2 16.2 7.4-5.5-5.6 6.2" stroke="#229ED9" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="4.5" y="6.5" width="19" height="15" rx="7.5" fill="#5865F2" />
      <path d="M10 19c1.5 1 2.8 1.4 4 1.4 1.2 0 2.5-.4 4-1.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11.4" cy="13.8" r="1.4" fill="#fff" />
      <circle cx="16.6" cy="13.8" r="1.4" fill="#fff" />
      <path d="M9 10.3 11 9M17 9l2 1.3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="5" y="10.8" width="5.1" height="12.2" rx="2.55" fill="#36C5F0" />
      <rect x="8.7" y="5" width="12.1" height="5.1" rx="2.55" fill="#2EB67D" />
      <rect x="17.9" y="8.7" width="5.1" height="12.2" rx="2.55" fill="#ECB22E" />
      <rect x="7.2" y="17.9" width="12.1" height="5.1" rx="2.55" fill="#E01E5A" />
    </svg>
  );
}

function GoogleChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <path d="M6 8.5A3.5 3.5 0 0 1 9.5 5h8A3.5 3.5 0 0 1 21 8.5v5A3.5 3.5 0 0 1 17.5 17H12l-3.6 3c-.6.4-1.4 0-1.4-.8V17A3.5 3.5 0 0 1 6 13.5v-5Z" fill="#4285F4" />
      <path d="M11 17h6.8A3.2 3.2 0 0 1 21 20.2v1.3c0 .8-.9 1.3-1.5.8L17.2 20H11a3 3 0 0 1-3-3v-.8l3-2.4V17Z" fill="#34A853" />
      <path d="M10.2 10.7h7.6" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10.2 13.6h5.2" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8.4" cy="13.5" r="2.2" fill="#FBBC05" />
      <circle cx="18.6" cy="8.6" r="2.2" fill="#EA4335" />
    </svg>
  );
}

export function getChannelCatalogIcon(channelId: string) {
  switch (channelId) {
    case 'sdkworkchat':
      return <SdkworkChatIcon />;
    case 'wechat':
      return <WechatIcon />;
    case 'wehcat':
      return <WehcatIcon />;
    case 'feishu':
      return <FeishuIcon />;
    case 'qq':
      return <QqIcon />;
    case 'dingtalk':
      return <DingtalkIcon />;
    case 'wecom':
      return <WecomIcon />;
    case 'telegram':
      return <TelegramIcon />;
    case 'discord':
      return <DiscordIcon />;
    case 'slack':
      return <SlackIcon />;
    case 'googlechat':
      return <GoogleChatIcon />;
    default:
      return null;
  }
}
