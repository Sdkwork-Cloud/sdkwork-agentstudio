type TranslateFunction = (key: string, options?: Record<string, unknown>) => string;

interface NavigableInstance {
  id: string;
}

export interface BuildInstanceDetailNavigationHandlersArgs {
  instance: NavigableInstance | null | undefined;
  navigate: (href: string) => void;
  openAgentMarketModal: () => void;
  setActiveInstanceId: (instanceId: string | null) => void;
}

export function createSharedStatusLabelGetter(t: TranslateFunction) {
  return (status: string) => t(`instances.shared.status.${status}`);
}

export function buildInstanceDetailNavigationHandlers(
  args: BuildInstanceDetailNavigationHandlersArgs,
) {
  return {
    onBackToInstances: () => {
      args.navigate('/instances');
    },
    onOpenProviderCenter: () => {
      args.navigate('/settings?tab=api');
    },
    onOpenAgentMarket: () => {
      args.openAgentMarketModal();
    },
    onSetActive: () => {
      if (!args.instance?.id) {
        return;
      }

      args.setActiveInstanceId(args.instance.id);
    },
  };
}
