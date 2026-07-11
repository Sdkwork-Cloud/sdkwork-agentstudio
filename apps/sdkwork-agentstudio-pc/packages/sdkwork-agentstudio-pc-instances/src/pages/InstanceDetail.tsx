import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  createInstanceDetailSource,
  instanceService,
  projectInstanceBaseDetail,
  resolveRegistryKernelId,
  resolveSupportedInstanceDetailModule,
  type InstanceDetailAgentMarketModalRequest,
} from '../services';
import type { Instance } from '../types';
import type { InstanceBaseDetail } from '../services';
import { UnsupportedInstanceDetailPage } from './UnsupportedInstanceDetailPage';

export interface InstanceDetailPageEntryProps {
  onOpenAgentMarketModal: (
    request: InstanceDetailAgentMarketModalRequest,
  ) => void;
}

const INSTANCE_DETAIL_PLACEHOLDER: Instance = {
  id: '__instance-detail-placeholder__',
  name: 'Unknown Instance',
  type: 'Unknown Runtime',
  iconType: 'server',
  status: 'offline',
  version: '',
  uptime: '-',
  ip: '127.0.0.1',
  cpu: 0,
  memory: 0,
  totalMemory: 'Unknown',
};

function renderInstanceDetailLoadingState() {
  return (
    <div className="mx-auto flex h-64 max-w-6xl items-center justify-center p-4 md:p-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
    </div>
  );
}

export function InstanceDetail({
  onOpenAgentMarketModal,
}: InstanceDetailPageEntryProps) {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const handleBackToInstances = () => navigate('/instances');
  const kernelId = instance ? resolveRegistryKernelId(instance) : 'custom';
  const detailModule = instance ? resolveSupportedInstanceDetailModule(kernelId) : null;
  const detailChrome = detailModule?.chrome ?? 'sharedWorkbench';

  useEffect(() => {
    let isCancelled = false;

    if (!id) {
      setInstance(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void instanceService
      .getInstanceById(id)
      .then((nextInstance) => {
        if (isCancelled) {
          return;
        }
        setInstance(nextInstance || null);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }
        setInstance(null);
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [id]);

  const detailSource = useMemo(() => {
    const baseDetailPromiseByInstanceId = new Map<string, Promise<InstanceBaseDetail | null>>();
    const effectiveInstanceId = id ?? INSTANCE_DETAIL_PLACEHOLDER.id;
    const effectiveInstance = instance ?? INSTANCE_DETAIL_PLACEHOLDER;
    const loadBaseDetail = (instanceId: string) => {
      if (!id || !instance) {
        return Promise.resolve<InstanceBaseDetail | null>(null);
      }

      const cachedPromise = baseDetailPromiseByInstanceId.get(instanceId);
      if (cachedPromise) {
        return cachedPromise;
      }

      const nextPromise = instanceService.getInstanceDetail(instanceId).then((detail) => (
        detail ? projectInstanceBaseDetail(detail) : null
      ));
      baseDetailPromiseByInstanceId.set(instanceId, nextPromise);
      return nextPromise;
    };

    return createInstanceDetailSource({
      instanceId: effectiveInstanceId,
      kernelId,
      chrome: detailChrome,
      instance: effectiveInstance,
      loadBaseDetail: async (instanceId) => loadBaseDetail(instanceId),
      loadModulePayload: async (instanceId) => {
        if (!detailModule || !instance) {
          return null;
        }

        return detailModule.loadModulePayload(instanceId, {
          instance,
          loadBaseDetail: () => loadBaseDetail(instanceId),
        });
      },
    });
  }, [detailChrome, detailModule, id, instance, kernelId]);

  if (isLoading) {
    return renderInstanceDetailLoadingState();
  }

  if (!id || !instance) {
    return (
      <div className="mx-auto max-w-6xl p-4 text-center md:p-8">
        <h2 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('instances.detail.notFoundTitle')}
        </h2>
        <button
          onClick={handleBackToInstances}
          className="text-primary-600 hover:underline dark:text-primary-400"
        >
          {t('instances.detail.returnToInstances')}
        </button>
      </div>
    );
  }

  if (!detailModule) {
    return (
      <UnsupportedInstanceDetailPage
        instance={instance}
        kernelId={kernelId}
      />
    );
  }

  const DetailPage = detailModule.DetailPage;
  return (
    <Suspense fallback={renderInstanceDetailLoadingState()}>
      <DetailPage
        source={detailSource}
        onOpenAgentMarketModal={onOpenAgentMarketModal}
      />
    </Suspense>
  );
}
