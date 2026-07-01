export const CLAW_SERVER_DEFAULT_HOST = '127.0.0.1';
export const CLAW_SERVER_DEFAULT_PORT = 18797;
export const CLAW_SERVER_DEFAULT_CONFIG_FILE_NAME = 'claw-server.config.json';
export const CLAW_SERVER_SERVICE_MANAGERS = {
  linux: 'systemd',
  macos: 'launchd',
  windows: 'windowsService',
} as const;
export const CLAW_SERVER_SERVICE_LIFECYCLE_ACTIONS = [
  'install',
  'start',
  'stop',
  'restart',
  'status',
] as const;
