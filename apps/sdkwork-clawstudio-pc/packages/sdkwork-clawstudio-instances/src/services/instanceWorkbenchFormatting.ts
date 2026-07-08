const knownWorkbenchLabels: Record<string, string> = {
  openclaw: 'OpenClaw',
  hermes: 'Hermes',
  zeroclaw: 'ZeroClaw',
  ironclaw: 'IronClaw',
  appManaged: 'App Managed',
  externalProcess: 'External Process',
  remoteService: 'Remote Service',
  configurationRequired: 'Configuration Required',
  openaiChatCompletions: 'OpenAI Chat Completions',
  openaiResponses: 'OpenAI Responses',
  localManaged: 'Local Managed',
  localExternal: 'Local External',
  customHttp: 'Custom HTTP',
  customWs: 'Custom WebSocket',
  managedFile: 'OpenClaw config file',
  managedDirectory: 'Config Directory',
  storageBinding: 'Storage Binding',
  remoteEndpoint: 'Remote Endpoint',
  metadataOnly: 'Metadata Only',
  available: 'Available',
  configured: 'Configured',
  missing: 'Missing',
  planned: 'Planned',
  writable: 'Writable',
  readonly: 'Read Only',
  authoritative: 'Authoritative',
  derived: 'Derived',
  runtime: 'Runtime',
  config: 'Config',
  storage: 'Storage',
  integration: 'Integration',
  endpoint: 'Endpoint',
  dashboard: 'Dashboard',
  configFile: 'OpenClaw config file',
  logFile: 'Log File',
  workspaceDirectory: 'Workspace Directory',
  runtimeDirectory: 'Runtime Directory',
  connectivity: 'Connectivity',
};

export function formatWorkbenchLabel(value: string) {
  if (knownWorkbenchLabels[value]) {
    return knownWorkbenchLabels[value];
  }

  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
