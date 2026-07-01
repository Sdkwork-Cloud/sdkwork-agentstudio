import { ArrowUpRight, Check, Copy, Smartphone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import { platform } from '@sdkwork/claw-core';
import { OverlaySurface } from '@sdkwork/claw-ui';

export interface MobileAppDownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type MobileAppGuideChannelId = 'android' | 'ios' | 'harmony';
type MobileAppGuideChannelStatus = 'available' | 'preview';

interface MobileAppGuideChannel {
  id: MobileAppGuideChannelId;
  href: string;
  copyHref: string;
  status: MobileAppGuideChannelStatus;
}

const mobileChannelLinks: Record<MobileAppGuideChannelId, string> = {
  android: 'https://clawstudio.sdkwork.com/platforms/android',
  ios: 'https://clawstudio.sdkwork.com/platforms/ios',
  harmony: 'https://clawstudio.sdkwork.com/platforms/harmony',
};

function createGuideChannel(
  id: MobileAppGuideChannelId,
  status: MobileAppGuideChannelStatus = 'available',
): MobileAppGuideChannel {
  return {
    id,
    href: mobileChannelLinks[id],
    copyHref: mobileChannelLinks[id],
    status,
  };
}

function createMobileAppGuide() {
  return {
    recommendedChannelId: 'android' as const,
    channels: [
      createGuideChannel('android'),
      createGuideChannel('ios'),
      createGuideChannel('harmony'),
    ],
  };
}

function getStatusClasses(status: MobileAppGuideChannelStatus) {
  if (status === 'preview') {
    return 'border-amber-500/25 bg-amber-500/12 text-amber-200';
  }

  return 'border-emerald-500/25 bg-emerald-500/12 text-emerald-200';
}

function MobileAppDownloadChannelCard({
  channel,
  isRecommended = false,
}: {
  channel: MobileAppGuideChannel;
  isRecommended?: boolean;
}) {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);
  const channelKey = `install.mobileGuide.channels.${channel.id}`;

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timeout = window.setTimeout(() => setIsCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [isCopied]);

  const handleOpen = () => {
    void platform.openExternal(channel.href);
  };

  const handleCopy = async () => {
    await platform.copy(channel.copyHref);
    setIsCopied(true);
  };

  return (
    <div className="flex h-full flex-col rounded-[20px] border border-white/10 bg-zinc-950/78 p-5 text-zinc-100 shadow-[0_24px_60px_rgba(9,9,11,0.22)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-white">
          <Smartphone className="h-5 w-5" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isRecommended ? (
            <span className="rounded-full border border-sky-400/20 bg-sky-400/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100">
              {t('install.mobileGuide.badges.recommended')}
            </span>
          ) : null}
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStatusClasses(channel.status)}`}
          >
            {t(`install.mobileGuide.status.${channel.status}`)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">{t(`${channelKey}.title`)}</h3>
        <p className="text-sm leading-6 text-zinc-300">{t(`${channelKey}.description`)}</p>
        <p className="text-xs leading-5 text-zinc-400">{t(`${channelKey}.note`)}</p>
        <div className="rounded-2xl bg-white/[0.06] px-3 py-2 font-mono text-[11px] leading-5 text-sky-100/88">
          {channel.href}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleOpen}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-100"
        >
          <ArrowUpRight className="h-4 w-4" />
          {t('install.mobileGuide.actions.openGuide')}
        </button>
        <button
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          className="flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/[0.08]"
        >
          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {isCopied ? t('install.mobileGuide.actions.copied') : t('install.mobileGuide.actions.copyLink')}
        </button>
      </div>
    </div>
  );
}

function MobileAppDownloadQrCode({
  label,
  description,
  value,
}: {
  label: string;
  description: string;
  value: string;
}) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  useEffect(() => {
    let isDisposed = false;

    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((nextQrCodeDataUrl) => {
        if (!isDisposed) {
          setQrCodeDataUrl(nextQrCodeDataUrl);
        }
      })
      .catch(() => {
        if (!isDisposed) {
          setQrCodeDataUrl('');
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [value]);

  return (
    <div
      data-slot="mobile-app-download-qr-code"
      className="rounded-[20px] border border-sky-500/16 bg-white/90 p-5 text-zinc-950 shadow-[0_18px_40px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-zinc-900/92 dark:text-zinc-50"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-600 dark:text-sky-300">
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{description}</p>
        <div className="mt-4 flex justify-center rounded-[18px] bg-white p-4 shadow-inner">
        {qrCodeDataUrl ? (
          <img
            src={qrCodeDataUrl}
            alt={label}
            className="h-48 w-48 rounded-2xl object-contain"
          />
        ) : (
          <div className="h-48 w-48 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        )}
      </div>
      <div className="mt-4 break-all rounded-2xl bg-zinc-950 px-3 py-2 font-mono text-[11px] leading-5 text-emerald-300 dark:bg-black/40">
        {value}
      </div>
    </div>
  );
}

export function MobileAppDownloadDialog({
  isOpen,
  onClose,
}: MobileAppDownloadDialogProps) {
  const { t } = useTranslation();
  const guide = createMobileAppGuide();
  const featuredChannel =
    guide.channels.find((channel) => channel.id === guide.recommendedChannelId) ?? guide.channels[0];
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timeout = window.setTimeout(() => setIsCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [isCopied]);

  const handleCopyAll = async () => {
    await platform.copy(featuredChannel.href);
    setIsCopied(true);
  };

  return (
    <OverlaySurface
      isOpen={isOpen}
      onClose={onClose}
      closeOnBackdrop
      className="max-w-5xl"
      backdropClassName="bg-zinc-950/56"
    >
      <div className="border-b border-zinc-200 bg-white/92 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/92">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500/12 text-primary-600 dark:text-primary-300">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                {t('install.mobileGuide.dialog.eyebrow')}
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
                {t('install.mobileGuide.dialog.title')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {t('install.mobileGuide.dialog.description')}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label={t('install.mobileGuide.dialog.close')}
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.10),_transparent_34%),linear-gradient(180deg,_rgba(9,9,11,0.02),_rgba(9,9,11,0))] px-6 py-6 dark:bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_36%),linear-gradient(180deg,_rgba(24,24,27,0.76),_rgba(9,9,11,0.96))]">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_22rem]">
          <div className="rounded-[20px] border border-sky-500/14 bg-sky-500/[0.06] px-5 py-5 text-sm leading-6 text-zinc-700 dark:text-sky-50/90">
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700 dark:text-sky-200/80">
              {t('install.mobileGuide.dialog.primaryTitle')}
            </div>
            <p className="mt-3">{t('install.mobileGuide.dialog.hint')}</p>
          </div>

          <MobileAppDownloadQrCode
            label={t('install.mobileGuide.dialog.qrTitle')}
            description={t('install.mobileGuide.dialog.qrDescription', {
              channel: t(`install.mobileGuide.channels.${featuredChannel.id}.title`),
            })}
            value={featuredChannel.href}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {guide.channels.map((channel) => (
            <MobileAppDownloadChannelCard
              key={channel.id}
              channel={channel}
              isRecommended={channel.id === guide.recommendedChannelId}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-zinc-200 bg-white/92 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900/92 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => {
            void handleCopyAll();
          }}
          className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {isCopied ? <ArrowUpRight className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {isCopied ? t('install.mobileGuide.actions.copied') : t('install.mobileGuide.dialog.copyAll')}
        </button>
        <button
          type="button"
          onClick={() => {
            void platform.openExternal(featuredChannel.href);
          }}
          className="flex items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <ArrowUpRight className="h-4 w-4" />
          {t('install.mobileGuide.dialog.openDocs')}
        </button>
      </div>
    </OverlaySurface>
  );
}
