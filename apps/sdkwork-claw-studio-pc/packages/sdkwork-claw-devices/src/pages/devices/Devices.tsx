import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Copy,
  KeyRound,
  RefreshCcw,
  Server,
  ShieldCheck,
  ShieldX,
  Smartphone,
  Trash2,
  Wifi,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  deviceService,
  type DeviceWorkspaceSnapshot,
  type PairedDeviceRecord,
  type RotateDeviceTokenResult,
} from '../../services';
import { Input } from '@sdkwork/claw-ui';

type AsyncStatus = 'idle' | 'loading' | 'error';

function formatDateTime(value?: number) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function renderScopes(scopes: string[]) {
  if (!scopes.length) {
    return '—';
  }

  return scopes.join(', ');
}

export function Devices() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useState<DeviceWorkspaceSnapshot | null>(null);
  const [status, setStatus] = useState<AsyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [lastRotatedToken, setLastRotatedToken] = useState<RotateDeviceTokenResult | null>(null);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);

  const pendingRequests = workspace?.pending || [];
  const pairedDevices = workspace?.paired || [];
  const selectedDevice =
    pairedDevices.find((device) => device.id === selectedDeviceId) || pairedDevices[0] || null;
  const tokenList = selectedDevice?.tokenList || [];
  const pairingGuide = [
    t('devices.page.pairingGuide.steps.open'),
    t('devices.page.pairingGuide.steps.connect'),
    t('devices.page.pairingGuide.steps.approve'),
  ];

  async function loadWorkspaceSnapshot() {
    setStatus('loading');
    setError(null);

    try {
      const nextWorkspace = await deviceService.getWorkspaceSnapshot();
      setWorkspace(nextWorkspace);
      setSelectedDeviceId((current) => {
        if (current && nextWorkspace.paired.some((device) => device.id === current)) {
          return current;
        }

        return nextWorkspace.paired[0]?.id || null;
      });
      setStatus('idle');
    } catch (nextError) {
      setStatus('error');
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    }
  }

  useEffect(() => {
    void loadWorkspaceSnapshot();
  }, []);

  async function runAction(actionKey: string, callback: () => Promise<void>) {
    setActiveActionKey(actionKey);
    setError(null);

    try {
      await callback();
      await loadWorkspaceSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setActiveActionKey(null);
    }
  }

  async function approvePairing(requestId: string) {
    await runAction(`approve:${requestId}`, () => deviceService.approvePairing(requestId));
  }

  async function rejectPairing(requestId: string) {
    if (!window.confirm(t('devices.page.confirmRejectPairing'))) {
      return;
    }

    await runAction(`reject:${requestId}`, () => deviceService.rejectPairing(requestId));
  }

  async function removeDevice(deviceId: string) {
    if (!window.confirm(t('devices.page.confirmRemoveDevice'))) {
      return;
    }

    await runAction(`remove:${deviceId}`, async () => {
      await deviceService.removeDevice(deviceId);
      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId(null);
      }
      if (lastRotatedToken?.deviceId === deviceId) {
        setLastRotatedToken(null);
      }
    });
  }

  async function rotateToken(device: PairedDeviceRecord, role: string, scopes: string[]) {
    setActiveActionKey(`rotate:${device.id}:${role}`);
    setError(null);

    try {
      const result = await deviceService.rotateToken({
        deviceId: device.id,
        role,
        scopes,
      });
      setLastRotatedToken(result);
      await loadWorkspaceSnapshot();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setActiveActionKey(null);
    }
  }

  async function revokeToken(deviceId: string, role: string) {
    if (!window.confirm(t('devices.page.confirmRevokeToken', { role }))) {
      return;
    }

    await runAction(`revoke:${deviceId}:${role}`, async () => {
      await deviceService.revokeToken({ deviceId, role });
      if (lastRotatedToken?.deviceId === deviceId && lastRotatedToken.role === role) {
        setLastRotatedToken(null);
      }
    });
  }

  async function copyToken(token: string) {
    if (!navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(token);
  }

  return (
    <div className="mx-auto h-full max-w-7xl overflow-y-auto p-6 md:p-10">
      <div className="mb-8 rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Wifi className="h-3.5 w-3.5" />
              {t('devices.page.banner.eyebrow')}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t('devices.page.title')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                {t('devices.page.subtitle')}
              </p>
            </div>
            {workspace?.instance ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('devices.page.instanceCard.instance')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {workspace.instance.name}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('devices.page.instanceCard.runtime')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {workspace.instance.typeLabel || workspace.instance.runtimeKind}
                  </div>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t('devices.page.instanceCard.version')}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {workspace.instance.version || t('devices.page.values.notAvailable')}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void loadWorkspaceSnapshot()}
            disabled={status === 'loading' || Boolean(activeActionKey)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
          >
            <RefreshCcw className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
            {t('devices.page.actions.refresh')}
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {lastRotatedToken ? (
        <div className="mb-6 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                {t('devices.page.tokenReveal.title')}
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300">
                {t('devices.page.tokenReveal.description', {
                  device: lastRotatedToken.deviceId,
                  role: lastRotatedToken.role,
                })}
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3 lg:max-w-2xl">
              <Input
                readOnly
                value={lastRotatedToken.token}
                className="h-11 flex-1 rounded-2xl border-emerald-300 bg-white px-4 text-sm text-zinc-900 dark:border-emerald-500/30 dark:bg-zinc-950 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => void copyToken(lastRotatedToken.token)}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-500/10"
              >
                <Copy className="h-4 w-4" />
                {t('devices.page.actions.copyToken')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1.2fr_1fr]">
        <section className="space-y-4 rounded-[1.75rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {t('devices.page.pendingRequests.title')}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('devices.page.pendingRequests.description')}
              </p>
            </div>
            <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {pendingRequests.length}
            </div>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              {t('devices.page.pendingRequests.empty')}
            </div>
          ) : (
            pendingRequests.map((request) => (
              <div
                key={request.requestId}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-sm dark:bg-zinc-950 dark:text-zinc-200">
                        <Smartphone className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {request.name}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {request.deviceId}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <div>
                        {t('devices.page.pendingRequests.fields.roles')}: {renderScopes(request.roles)}
                      </div>
                      <div>
                        {t('devices.page.pendingRequests.fields.scopes')}: {renderScopes(request.scopes)}
                      </div>
                      <div>
                        {t('devices.page.pendingRequests.fields.ip')}: {request.remoteIp || '—'}
                      </div>
                      <div>
                        {t('devices.page.pendingRequests.fields.requestedAt')}: {formatDateTime(request.requestedAtMs)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void approvePairing(request.requestId)}
                    disabled={Boolean(activeActionKey)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-400"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {t('devices.page.actions.approve')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void rejectPairing(request.requestId)}
                    disabled={Boolean(activeActionKey)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <ShieldX className="h-4 w-4" />
                    {t('devices.page.actions.reject')}
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="space-y-4 rounded-[1.75rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {t('devices.page.pairedDevices.title')}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('devices.page.pairedDevices.description')}
              </p>
            </div>
            <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {pairedDevices.length}
            </div>
          </div>

          {pairedDevices.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              {t('devices.page.pairedDevices.empty')}
            </div>
          ) : (
            <div className="space-y-3">
              {pairedDevices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => setSelectedDeviceId(device.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    selectedDevice?.id === device.id
                      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                      : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-zinc-700 shadow-sm dark:bg-zinc-950 dark:text-zinc-200">
                          <Server className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {device.name}
                          </div>
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            {device.id}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <div>
                          {t('devices.page.pairedDevices.fields.roles')}: {renderScopes(device.roles)}
                        </div>
                        <div>
                          {t('devices.page.pairedDevices.fields.scopes')}: {renderScopes(device.scopes)}
                        </div>
                        <div>
                          {t('devices.page.pairedDevices.fields.ip')}: {device.remoteIp || '—'}
                        </div>
                        <div>
                          {t('devices.page.pairedDevices.fields.approvedAt')}: {formatDateTime(device.approvedAtMs)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void removeDevice(device.id);
                      }}
                      disabled={Boolean(activeActionKey)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-300 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      aria-label={t('devices.page.actions.removeDevice')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t('devices.page.pairingGuide.title')}
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t('devices.page.pairingGuide.description')}
            </p>
            <div className="mt-4 space-y-3">
              {pairingGuide.map((step, index) => (
                <div
                  key={step}
                  className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
                    {index + 1}
                  </div>
                  <div className="text-sm text-zinc-600 dark:text-zinc-300">{step}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {t('devices.page.tokenList.title')}
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {selectedDevice
                    ? t('devices.page.tokenList.description', { device: selectedDevice.name })
                    : t('devices.page.tokenList.noSelection')}
                </p>
              </div>
            </div>

            {!selectedDevice ? (
              <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {t('devices.page.tokenList.selectDevice')}
              </div>
            ) : tokenList.length === 0 ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  {t('devices.page.tokenList.empty')}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void rotateToken(
                      selectedDevice,
                      selectedDevice.roles[0] || 'operator',
                      selectedDevice.scopes,
                    )
                  }
                  disabled={Boolean(activeActionKey)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                >
                  <KeyRound className="h-4 w-4" />
                  {t('devices.page.actions.rotateToken')}
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {tokenList.map((token) => (
                  <div
                    key={`${selectedDevice.id}:${token.role}`}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {token.role}
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <div>
                            {t('devices.page.tokenList.fields.scopes')}: {renderScopes(token.scopes)}
                          </div>
                          <div>
                            {t('devices.page.tokenList.fields.rotatedAt')}: {formatDateTime(token.rotatedAtMs)}
                          </div>
                          <div>
                            {t('devices.page.tokenList.fields.lastUsedAt')}: {formatDateTime(token.lastUsedAtMs)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => void rotateToken(selectedDevice, token.role, token.scopes)}
                          disabled={Boolean(activeActionKey)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
                        >
                          <RefreshCcw className="h-4 w-4" />
                          {t('devices.page.actions.rotateToken')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void revokeToken(selectedDevice.id, token.role)}
                          disabled={Boolean(activeActionKey)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('devices.page.actions.revokeToken')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
