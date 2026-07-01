import { LoaderCircle, QrCode, RefreshCw, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppAuthLoginQrCode } from '@sdkwork/claw-core';
import { Button } from '@sdkwork/claw-ui';
import { resolveAuthQrTypeHintKey, type QrPanelState } from './authConfig.ts';

interface QrLoginPanelProps {
  qrCode: AppAuthLoginQrCode | null;
  qrImageSrc: string;
  qrState: QrPanelState;
  qrErrorMessage?: string;
  onRefresh: () => void;
}

function resolveQrStatusCopy(
  t: (key: string) => string,
  state: QrPanelState,
) {
  if (state === 'loading') {
    return t('auth.qrStatus.loading');
  }
  if (state === 'scanned') {
    return t('auth.qrStatus.scanned');
  }
  if (state === 'confirmed') {
    return t('auth.qrStatus.confirmed');
  }
  if (state === 'expired') {
    return t('auth.qrStatus.expired');
  }
  if (state === 'error') {
    return t('auth.qrStatus.error');
  }
  return t('auth.qrStatus.pending');
}

function resolveQrStatusAccent(state: QrPanelState) {
  if (state === 'scanned') {
    return 'text-amber-300';
  }
  if (state === 'confirmed') {
    return 'text-emerald-300';
  }
  if (state === 'expired' || state === 'error') {
    return 'text-rose-300';
  }
  return 'text-zinc-300';
}

export function QrLoginPanel({
  qrCode,
  qrImageSrc,
  qrState,
  qrErrorMessage,
  onRefresh,
}: QrLoginPanelProps) {
  const { t } = useTranslation();
  const qrTypeHintKey = resolveAuthQrTypeHintKey(qrCode?.type);

  return (
    <div className="relative flex h-full flex-col justify-center overflow-hidden rounded-[28px] bg-zinc-950 p-8 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(255,255,255,0.05),_transparent_30%)]" />
      <div className="relative z-10 mx-auto flex w-full max-w-[360px] flex-col justify-center gap-8">
        <div>
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.08]">
            <QrCode className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            {qrCode?.title || t('auth.qrLogin')}
          </h2>
          <p className="mt-3 max-w-[260px] text-sm leading-7 text-zinc-300">
            {qrCode?.description || t('auth.qrDesc')}
          </p>
        </div>

        <div>
          <div className="rounded-[30px] bg-zinc-900/70 p-4 backdrop-blur-sm">
            <div className="mx-auto aspect-square w-full max-w-[280px]">
              <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-white">
                {qrImageSrc ? (
                  <img
                    src={qrImageSrc}
                    alt={t('auth.qrAlt')}
                    className={`h-full w-full object-contain p-3 transition-opacity ${
                      qrState === 'expired' || qrState === 'error' ? 'opacity-40' : 'opacity-100'
                    }`}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-zinc-100">
                    <LoaderCircle className="h-8 w-8 animate-spin text-zinc-400" />
                  </div>
                )}

                {qrState === 'expired' || qrState === 'error' ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/10">
                    <Button
                      type="button"
                      onClick={onRefresh}
                      className="h-auto rounded-xl px-4 py-2.5 text-sm font-bold"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {t('auth.qrRefresh')}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={`mt-5 text-sm font-medium ${resolveQrStatusAccent(qrState)}`}>
            {resolveQrStatusCopy(t, qrState)}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {qrState === 'error'
              ? qrErrorMessage
              : qrState === 'scanned'
                ? t('auth.qrScannedHint')
                : t('auth.openApp')}
          </p>
          <div className="mt-5 flex items-center gap-2 text-sm text-zinc-400">
            <Smartphone className="h-4 w-4" />
            <span>{t(qrTypeHintKey)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
