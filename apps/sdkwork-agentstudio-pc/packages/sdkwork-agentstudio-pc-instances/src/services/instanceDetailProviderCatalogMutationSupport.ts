import type { CreateOpenClawProviderCatalogMutationRunnerArgs } from './openClawProviderCatalogMutationSupport.ts';

type ProviderCatalogMutationExecutors = Pick<
  CreateOpenClawProviderCatalogMutationRunnerArgs,
  | 'executeProviderConfigUpdate'
  | 'executeProviderCreate'
  | 'executeProviderModelUpdate'
  | 'executeProviderModelCreate'
  | 'executeProviderModelDelete'
  | 'executeProviderDelete'
>;

export interface InstanceDetailProviderCatalogMutationService {
  updateInstanceLlmProviderConfig: ProviderCatalogMutationExecutors['executeProviderConfigUpdate'];
  createInstanceLlmProvider: ProviderCatalogMutationExecutors['executeProviderCreate'];
  updateInstanceLlmProviderModel: ProviderCatalogMutationExecutors['executeProviderModelUpdate'];
  createInstanceLlmProviderModel: ProviderCatalogMutationExecutors['executeProviderModelCreate'];
  deleteInstanceLlmProviderModel: ProviderCatalogMutationExecutors['executeProviderModelDelete'];
  deleteInstanceLlmProvider: ProviderCatalogMutationExecutors['executeProviderDelete'];
}

export function createInstanceDetailProviderCatalogMutationExecutors(args: {
  instanceService: InstanceDetailProviderCatalogMutationService;
}): ProviderCatalogMutationExecutors {
  return {
    executeProviderConfigUpdate: (instanceId, providerId, providerUpdate) =>
      args.instanceService.updateInstanceLlmProviderConfig(instanceId, providerId, providerUpdate),
    executeProviderCreate: (instanceId, providerInput, selection) =>
      args.instanceService.createInstanceLlmProvider(instanceId, providerInput, selection),
    executeProviderModelUpdate: (instanceId, providerId, originalId, model) =>
      args.instanceService.updateInstanceLlmProviderModel(
        instanceId,
        providerId,
        originalId,
        model,
      ),
    executeProviderModelCreate: (instanceId, providerId, model) =>
      args.instanceService.createInstanceLlmProviderModel(instanceId, providerId, model),
    executeProviderModelDelete: (instanceId, providerId, modelId) =>
      args.instanceService.deleteInstanceLlmProviderModel(instanceId, providerId, modelId),
    executeProviderDelete: (instanceId, providerId) =>
      args.instanceService.deleteInstanceLlmProvider(instanceId, providerId),
  };
}
