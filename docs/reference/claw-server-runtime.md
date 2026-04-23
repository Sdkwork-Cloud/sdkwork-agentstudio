# Claw Server Runtime Reference

This document captures the current built-in host runtime that ships from `packages/sdkwork-claw-server` and the shared router contract reused by the desktop embedded host.

## Purpose

The current runtime slice does these things:

1. Boots a native Axum web server.
2. Treats the built-in host port as the single external HTTP entry point.
3. Mounts platform-native APIs under `/claw/*`.
4. Mounts root-native local AI compatibility routes on the same host port when `local-ai-proxy` is active.
5. Mounts governed OpenClaw gateway proxy routes under `/claw/gateway/openclaw/*` when the managed gateway HTTP surface is active.
6. Serves the browser application bundle from the same host.
7. Persists rollout and node-session state through the host-core storage layer.
8. Publishes live OpenAPI 3.1 discovery and per-surface documents from the mounted route set.
9. Writes runtime OpenAPI snapshot files under `<runtime_data_dir>/openapi/` at startup.
10. Prints one machine-readable startup catalog that lists the active document URLs and gateway endpoints.
11. Exposes service lifecycle commands and matching HTTP manage routes in `server` mode.

## Native CLI

The Rust entry exposes a real command surface:

```bash
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- run
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- print-config
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service print-manifest --platform linux
cargo run --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml -- service status
```

Current command notes:

- the CLI contract is `claw-server run`, `claw-server print-config`, `claw-server service print-manifest --platform <linux|macos|windows>`, and `claw-server service <install|start|stop|restart|status>`
- current packaged release bundles expose that same command surface through the shipped native binary under `bin/claw-server` on Linux or macOS and `bin/claw-server.exe` on Windows; this native binary is the canonical packaged launcher, it auto-resolves bundled defaults for `CLAW_SERVER_WEB_DIST` and `CLAW_SERVER_DATA_DIR` when the expected bundle layout is present, and `start-claw-server.sh` plus `start-claw-server.cmd` remain optional convenience wrappers around the same binary
- `run` is the default command
- `print-config` resolves the effective runtime configuration after CLI overrides, config file values, environment variables, and built-in defaults
- `service print-manifest` prints portable service metadata and the platform-specific unit content for `systemd`, `launchd`, or `windowsService`
- `service install`, `service start`, `service stop`, `service restart`, and `service status` reuse the exact same runtime-config resolution path

## Service Manifest And Lifecycle

Current manifest projection:

- Linux projects `systemd` semantics with `/etc/systemd/system/claw-server.service`
- macOS projects `launchd` semantics with `/Library/LaunchDaemons/ai.sdkwork.claw.server.plist`
- Windows projects `windowsService` semantics with `<CLAW_SERVER_DATA_DIR>/service/windows-service.json`
- if `CLAW_SERVER_CONFIG` and `--config` are both omitted, the canonical config path falls back to `<CLAW_SERVER_DATA_DIR>/claw-server.config.json`

Current lifecycle notes:

- Linux uses `systemctl`
- macOS uses `launchctl`
- Windows uses `sc.exe`
- `GET /claw/manage/v1/service` plus `POST /claw/manage/v1/service:install|start|stop|restart` reuse the same service control plane as the CLI

## Environment Variables

The current server shell reads:

```bash
CLAW_SERVER_CONFIG=
CLAW_SERVER_HOST=127.0.0.1
CLAW_SERVER_PORT=18797
CLAW_SERVER_DATA_DIR=.claw-server
CLAW_SERVER_STATE_STORE_DRIVER=sqlite
CLAW_SERVER_STATE_STORE_SQLITE_PATH=
CLAW_SERVER_STATE_STORE_POSTGRES_URL=
CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA=
CLAW_SERVER_WEB_DIST=../sdkwork-claw-web/dist
CLAW_SERVER_MANAGE_USERNAME=
CLAW_SERVER_MANAGE_PASSWORD=
CLAW_SERVER_INTERNAL_USERNAME=
CLAW_SERVER_INTERNAL_PASSWORD=
CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false
```

Current behavior notes:

- configuration precedence is `CLI overrides -> config file -> environment variables -> built-in defaults`
- `CLAW_SERVER_HOST` defaults to `127.0.0.1`
- `CLAW_SERVER_PORT` defaults to `18797`
- `CLAW_SERVER_DATA_DIR` is the server runtime data root
- `CLAW_SERVER_STATE_STORE_DRIVER` currently supports `json-file` and `sqlite`
- when `sqlite` is active and no explicit path is provided, the runtime uses `<CLAW_SERVER_DATA_DIR>/host-state.sqlite3`
- `CLAW_SERVER_MANAGE_*` protects the browser shell and `/claw/manage/v1/*`
- `CLAW_SERVER_INTERNAL_*` protects `/claw/internal/v1/*` and falls back to the manage credentials when omitted
- public bind requires control-plane credentials unless `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=true` is set explicitly

## Startup Behavior

The server entrypoint is `packages/sdkwork-claw-server/src-host/src/main.rs`.

At startup the server:

1. parses the CLI command
2. resolves the effective runtime configuration
3. binds the requested host and port
4. allocates a fallback active port when the requested port is busy and dynamic fallback is allowed
5. builds `ServerState`
6. derives the live API-surface catalog from the active state
7. writes runtime OpenAPI snapshot files under `<runtime_data_dir>/openapi/`
8. builds one startup catalog JSON payload from the same live catalog
9. mounts the Axum router
10. prints the listening address
11. prints the startup catalog JSON

Important behavior:

- runtime OpenAPI snapshot publication is startup-critical; failure to write the snapshot files fails startup
- the startup catalog JSON uses `kind = "sdkworkClawOpenApiCatalog"`
- the same snapshot and startup-catalog behavior is reused by the desktop embedded host with its own runtime data directory

## Unified Host Route Publication

The built-in host router mounts these route families before static asset fallback:

- `/claw/health/*`
- `/claw/api/v1/*`
- `/claw/openapi/*`
- `/claw/internal/v1/*`
- `/claw/manage/v1/*`
- `/claw/gateway/openclaw/*`
- `/health`
- `/v1/*`
- `/v1beta/*`

Route ownership rules:

- `/claw/*` remains reserved for platform-native APIs
- `/health`, `/v1/*`, and `/v1beta/*` are root-native compatibility paths owned by `local-ai-proxy`
- `/claw/gateway/openclaw/*` is the governed OpenClaw gateway proxy namespace
- there is no `/claw/gateway/local-ai/*`
- API routes are mounted before browser asset fallback so root-native compatibility routes cannot be swallowed by the SPA shell

## Route Families

### Native Platform

Current native route families:

- `/claw/health/*`
- `/claw/api/v1/*`
- `/claw/openapi/*`
- `/claw/internal/v1/*`
- `/claw/manage/v1/*`

Representative endpoints:

- `GET /claw/health/live`
- `GET /claw/health/ready`
- `GET /claw/api/v1/discovery`
- `GET /claw/internal/v1/host-platform`
- `GET /claw/manage/v1/rollouts`
- `POST /claw/manage/v1/service:start`
- `GET /claw/manage/v1/openclaw/runtime`
- `GET /claw/manage/v1/openclaw/gateway`
- `POST /claw/manage/v1/openclaw/gateway/invoke`

### Local AI Compatibility

When `local-ai-proxy` is active, the host also publishes:

- `GET /health`
- `GET /v1/health`
- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/embeddings`
- `POST /v1/messages`
- `GET /v1beta/models`
- `POST /v1beta/models/{modelAction}`
- `POST /v1/models/{modelAction}`

These routes are provider-compatible by design, so callers only need to change `baseURL` and `apiKey`.

### Governed OpenClaw Gateway Proxy

When the managed OpenClaw gateway HTTP surface is active, the host also publishes:

- `POST /claw/gateway/openclaw/tools/invoke`

The governed prefix is stripped before the upstream request is proxied, but the published host contract stays under `/claw/gateway/openclaw/*`.

## OpenAPI Publication

The built-in host publishes one discovery endpoint and up to three live OpenAPI 3.1 documents.

### Discovery

- `GET /claw/openapi/discovery`

Discovery fields:

- `family`
- `hostMode`
- `generatedAt`
- `documents[]`

Each `documents[]` item currently includes:

- `id`
- `title`
- `version`
- `format`
- `url`
- `apiFamilies`
- `proxyTarget`
- `runtimeCapability`
- `generatedAt`

### Documents

Always present:

- `GET /claw/openapi/v1.json`

Conditionally present:

- `GET /claw/openapi/local-ai-compat-v1.json`
- `GET /claw/openapi/openclaw-gateway-v1.json`

Current document ownership:

- `claw-native-v1` owns platform-native `/claw/*` APIs
- `local-ai-compat-v1` owns root-native compatibility paths
- `openclaw-gateway-v1` owns `/claw/gateway/openclaw/*`

Rules:

- all documents use `openapi: 3.1.0`
- no published path appears in more than one live document
- optional documents are advertised only when the matching runtime surface is active

## Runtime OpenAPI Snapshot Files

At startup the runtime writes the live schema set to:

- `<runtime_data_dir>/openapi/discovery.json`
- `<runtime_data_dir>/openapi/claw-native-v1.json`

Conditionally:

- `<runtime_data_dir>/openapi/local-ai-compat-v1.json`
- `<runtime_data_dir>/openapi/openclaw-gateway-v1.json`

File writes are atomic so readers do not observe partially-written JSON.

## Startup Catalog Output

After the host binds successfully, startup prints one machine-readable JSON catalog that includes:

- `kind`
- `hostMode`
- `hostBaseUrl`
- `openapiDiscoveryUrl`
- `documents[]`
- `gatewayEndpoints[]`

`gatewayEndpoints[]` is built from the same live catalog and includes:

- `/claw/openapi/discovery`
- active OpenAPI document URLs
- root-native local AI compatibility endpoints when active
- governed OpenClaw proxy endpoints when active

Example shape:

```json
{
  "kind": "sdkworkClawOpenApiCatalog",
  "hostMode": "server",
  "hostBaseUrl": "http://127.0.0.1:18797",
  "openapiDiscoveryUrl": "http://127.0.0.1:18797/claw/openapi/discovery",
  "documents": [
    {
      "id": "claw-native-v1",
      "url": "/claw/openapi/v1.json",
      "absoluteUrl": "http://127.0.0.1:18797/claw/openapi/v1.json",
      "proxyTarget": "native-host",
      "runtimeCapability": "always",
      "generatedAt": 1743600000000
    }
  ],
  "gatewayEndpoints": [
    "http://127.0.0.1:18797/claw/openapi/discovery",
    "http://127.0.0.1:18797/claw/openapi/v1.json"
  ]
}
```

## Browser App Serving

Static serving is implemented in `packages/sdkwork-claw-server/src-host/src/http/static_assets.rs`.

Current behavior:

- browser shell routes and static assets share the manage basic-auth challenge when manage credentials are configured
- real files under the web `dist` directory are returned before SPA fallback
- unmatched browser routes fall back to `index.html`
- the returned HTML is injected with host metadata such as `sdkwork-claw-host-mode`, `sdkwork-claw-manage-base-path`, and `sdkwork-claw-internal-base-path`

## Desktop Embedded Host Reuse

The desktop runtime reuses the same Rust router through `packages/sdkwork-claw-desktop/src-tauri/src/framework/embedded_host_server.rs`.

Desktop-specific notes:

- mode is `desktopCombined`
- the embedded host base URL is published through `browserBaseUrl`
- runtime OpenAPI snapshots are written under the embedded host runtime data directory, currently `<machine_state_dir>/desktop-host/openapi/`
- the desktop embedded host also prints the same machine-readable startup catalog JSON
- `/claw/manage/v1/service*` remains disabled in desktop mode

## Verification Commands

Focused verification for this runtime slice:

```bash
cargo test --manifest-path packages/sdkwork-claw-server/src-host/Cargo.toml
cargo test --manifest-path packages/sdkwork-claw-desktop/src-tauri/Cargo.toml embedded_host_bootstrap
```

Workspace checks still commonly use:

```bash
pnpm lint
pnpm check:server
```

## Current Boundaries

Implemented now:

- one unified built-in host port
- native `/claw/*` platform APIs
- root-native local AI compatibility publication on the same host port
- governed `/claw/gateway/openclaw/*` proxy publication
- live multi-document OpenAPI discovery
- runtime schema snapshot output under `<runtime_data_dir>/openapi/`
- machine-readable startup catalog output

Not implemented yet:

- wider product-domain public APIs beyond the routes already published in `/claw/api/v1/*`
- additional governed OpenClaw proxy routes beyond the current shipped surface
- plugin-managed HTTP surfaces
