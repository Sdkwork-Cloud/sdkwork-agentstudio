import * as React from 'react';

function withDefaultClassName(className?: string) {
  return className || 'h-7 w-7';
}

function IMessageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="4" y="6" width="20" height="14" rx="7" fill="#22C55E" />
      <path d="M11.5 20h3.4l-2.6 3.1c-.5.6-1.5.3-1.5-.5V20Z" fill="#22C55E" />
      <path d="M9.4 11.5h9.2M9.4 14.8h6.4" stroke="#F0FDF4" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function IrcIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="5" y="6" width="18" height="16" rx="4" fill="#0891B2" />
      <path d="M11.1 9.2 9.6 18.8M18.4 9.2l-1.5 9.6M8.6 12.5h11.8M7.8 16.1h11.8" stroke="#ECFEFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MatrixIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <rect x="5" y="5" width="18" height="18" rx="5" fill="#7C3AED" />
      <path d="M9 10.3h10M9 14h10M9 17.7h10" stroke="#F5F3FF" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10.5" cy="10.3" r="2" fill="#A78BFA" />
      <circle cx="17.5" cy="17.7" r="2" fill="#C4B5FD" />
    </svg>
  );
}

function MattermostIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="14" cy="14" r="10.5" fill="#1E3A8A" />
      <path d="M18.9 8.5c2.4 2.2 2.8 5.9.8 8.7-2.3 3.2-6.8 3.9-10 1.6-2.8-2-3.7-5.7-2.3-8.7" stroke="#DBEAFE" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.2 8.1c2.5-.8 5.3.4 6.5 2.8" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SignalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={withDefaultClassName(className)} aria-hidden="true">
      <circle cx="14" cy="14" r="10" fill="#2563EB" />
      <path d="M9 13.4c0-2.8 2.2-5 5-5s5 2.2 5 5c0 2.6-2 4.8-4.5 5v2.1l-2.3-2.2A5 5 0 0 1 9 13.4Z" fill="#EFF6FF" />
      <path d="M6.5 10.4A8.4 8.4 0 0 1 10.4 6.5M17.6 6.5a8.4 8.4 0 0 1 3.9 3.9M21.5 17.6a8.4 8.4 0 0 1-3.9 3.9M10.4 21.5a8.4 8.4 0 0 1-3.9-3.9" stroke="#BFDBFE" strokeWidth="1.5" strokeLinecap="round" />
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

export function getChannelCatalogIcon(channelId: string) {
  switch (channelId) {
    case 'imessage':
      return <IMessageIcon />;
    case 'irc':
      return <IrcIcon />;
    case 'matrix':
      return <MatrixIcon />;
    case 'mattermost':
      return <MattermostIcon />;
    case 'signal':
      return <SignalIcon />;
    case 'telegram':
      return <TelegramIcon />;
    case 'slack':
      return <SlackIcon />;
    default:
      return null;
  }
}
