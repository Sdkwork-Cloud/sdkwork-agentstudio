import {
  hostEndpointService,
  type HostEndpointSnapshot,
} from './hostEndpointService.ts';

export interface HostPortSettingsRow {
  endpointId: string;
  bindHost: string;
  requestedPort: number;
  activePort: number | null;
  portBindingLabel: string;
  statusLabel: string;
  exposureLabel: string;
  conflictSummary: string | null;
  baseUrl: string | null;
  websocketUrl: string | null;
}

export interface HostPortSettingsSummary {
  totalEndpoints: number;
  readyEndpoints: number;
  conflictedEndpoints: number;
  dynamicPortEndpoints: number;
  browserBaseUrl: string | null;
  rows: HostPortSettingsRow[];
}

export interface CreateHostPortSettingsServiceOptions {
  hostEndpointService?: Pick<typeof hostEndpointService, 'list'>;
}

function formatPortBindingLabel(endpoint: HostEndpointSnapshot) {
  if (endpoint.activePort === null) {
    return String(endpoint.requestedPort);
  }

  if (endpoint.activePort === endpoint.requestedPort) {
    return String(endpoint.requestedPort);
  }

  return `${endpoint.requestedPort} -> ${endpoint.activePort}`;
}

function formatStatusLabel(endpoint: HostEndpointSnapshot) {
  switch (endpoint.status) {
    case 'ready':
      return 'Requested Port Active';
    case 'fallback':
      return 'Fallback Active';
    default:
      return 'Pending';
  }
}

function mapHostPortSettingsRow(endpoint: HostEndpointSnapshot): HostPortSettingsRow {
  return {
    endpointId: endpoint.endpointId,
    bindHost: endpoint.bindHost,
    requestedPort: endpoint.requestedPort,
    activePort: endpoint.activePort,
    portBindingLabel: formatPortBindingLabel(endpoint),
    statusLabel: formatStatusLabel(endpoint),
    exposureLabel: endpoint.exposureLabel,
    conflictSummary: endpoint.hasConflict
      ? `Requested port unavailable: ${endpoint.conflictSummary ?? 'Unknown conflict'}`
      : null,
    baseUrl: endpoint.baseUrl ?? null,
    websocketUrl: endpoint.websocketUrl ?? null,
  };
}

export function createHostPortSettingsService(
  options: CreateHostPortSettingsServiceOptions = {},
) {
  const resolveHostEndpointService = options.hostEndpointService ?? hostEndpointService;

  return {
    async getSummary(): Promise<HostPortSettingsSummary> {
      const endpoints = await resolveHostEndpointService.list();
      const rows = endpoints.map(mapHostPortSettingsRow);

      return {
        totalEndpoints: rows.length,
        readyEndpoints: endpoints.filter((endpoint) => endpoint.activePort !== null).length,
        conflictedEndpoints: endpoints.filter((endpoint) => endpoint.hasConflict).length,
        dynamicPortEndpoints: endpoints.filter((endpoint) => endpoint.dynamicPort).length,
        browserBaseUrl:
          rows.find((row) => row.endpointId === 'claw-manage-http')?.baseUrl ?? null,
        rows,
      };
    },
  };
}

export const hostPortSettingsService = createHostPortSettingsService();
