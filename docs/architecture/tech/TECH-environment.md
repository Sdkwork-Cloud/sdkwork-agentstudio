> Migrated from `docs/reference/environment.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Environment

## Source Of Truth

Start from the root `.env.example`. Package-level `.env.example` files add runtime-specific detail for web and desktop entry packages.

## Core Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_URL` | Runtime-dependent | Host URL used by hosted deployments |
| `VITE_API_BASE_URL` | Recommended | Shared backend API base URL |
| `VITE_APP_ID` | Desktop updates | Backend app id used by update checks |
| `VITE_RELEASE_CHANNEL` | Desktop updates | Release channel for update queries |
| `VITE_DISTRIBUTION_ID` | Desktop distribution | Distribution manifest selection |
| `VITE_PLATFORM` | Desktop runtime | Force or describe the current platform |
| `VITE_TIMEOUT` | Optional | Shared HTTP timeout |
| `VITE_ENABLE_STARTUP_UPDATE_CHECK` | Optional | Enable update checks during desktop startup |
| `CLAW_SERVER_CONFIG` | Optional | JSON config file used by the native `claw-server` CLI |
| `CLAW_SERVER_HOST` | Server runtime | Native server bind host, defaults to loopback-only `127.0.0.1` |
| `CLAW_SERVER_PORT` | Server runtime | Native server listen port |
| `CLAW_SERVER_DATA_DIR` | Server runtime | Server rollout and node-session data directory |
| `CLAW_SERVER_STATE_STORE_DRIVER` | Server runtime | Host runtime state-store driver, currently `json-file` or `sqlite` |
| `CLAW_SERVER_STATE_STORE_SQLITE_PATH` | Optional | Override the SQLite host state database path when `sqlite` is selected |
| `CLAW_SERVER_STATE_STORE_POSTGRES_URL` | Optional | PostgreSQL connection metadata for the host-platform `stateStore` projection; current server slices mark the projected postgres provider as `projectionMode = metadataOnly` and do not enable a PostgreSQL runtime driver |
| `CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA` | Optional | PostgreSQL schema metadata for the host-platform `stateStore` projection; current server slices mark the projected postgres profile as `projectionMode = metadataOnly` and do not enable a PostgreSQL runtime driver |
| `CLAW_SERVER_WEB_DIST` | Server runtime | Override the served browser bundle directory |
| `CLAW_SERVER_MANAGE_USERNAME` | Optional | Enable HTTP basic auth for browser shell and `/claw/manage/v1/*` |
| `CLAW_SERVER_MANAGE_PASSWORD` | Optional | Password paired with `CLAW_SERVER_MANAGE_USERNAME` |
| `CLAW_SERVER_INTERNAL_USERNAME` | Optional | Enable dedicated HTTP basic auth for `/claw/internal/v1/*` |
| `CLAW_SERVER_INTERNAL_PASSWORD` | Optional | Password paired with `CLAW_SERVER_INTERNAL_USERNAME` |
| `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND` | Optional | Explicitly allow a non-loopback bind without control-plane basic auth; defaults to `false` |
| `SDKWORK_SERVER_BUILD_WSL_DISTRO` | Optional | On Windows, choose the WSL distro used when `pnpm server:build -- --target <linux-triple>` bridges into Linux automatically |
| `SDKWORK_SERVER_BUILD_DISABLE_WSL` | Optional | On Windows, disable the automatic WSL bridge for Linux `pnpm server:build` targets and fall back to the native Cargo toolchain only |

## Practical Guidance

- never commit secrets
- update `.env.example` when adding a new variable
- document new variables in the relevant package and public docs
- keep desktop-specific values consistent with the distribution and update flow
- browser and desktop Vite env files must not inject root access tokens; privileged credentials stay in trusted hosts
- AI generation now depends on an active OpenClaw-compatible instance plus Provider Center configuration, not a browser-side Gemini key
- `claw-server` now resolves configuration with the precedence order `CLI overrides -> config file -> environment variables -> defaults`
- `claw-server service print-manifest` reuses the same resolution order and falls back to `<CLAW_SERVER_DATA_DIR>/claw-server.config.json` when no explicit config path is supplied
- `claw-server service install`, `start`, `stop`, `restart`, and `status` also reuse that same config path and require whatever privileges the current platform service manager expects
- `CLAW_SERVER_MANAGE_USERNAME` and `CLAW_SERVER_MANAGE_PASSWORD` protect the browser shell, `/claw/manage/v1/rollouts*`, and `/claw/manage/v1/service*`, so the same-origin operator UI can safely drive native service lifecycle actions over HTTP
- for server deployments, do not widen `CLAW_SERVER_HOST` beyond `127.0.0.1` unless ingress, auth, and network exposure are intentionally configured
- once `CLAW_SERVER_HOST` widens beyond loopback, the Rust host now refuses startup unless control-plane credentials are configured or `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=true` is set intentionally
- `CLAW_SERVER_STATE_STORE_DRIVER` currently supports `json-file` and `sqlite`; SQLite is now the default durable baseline, while JSON is kept as an explicit bootstrap or developer fallback
- selecting `CLAW_SERVER_STATE_STORE_DRIVER=postgres` is rejected intentionally because PostgreSQL is still surfaced as a metadata-only projection rather than an activatable runtime driver
- `CLAW_SERVER_CONFIG` is the preferred way to stamp a packaged server install with stable host, state-store, and auth settings without expanding the environment footprint
- `CLAW_SERVER_STATE_STORE_POSTGRES_URL` and `CLAW_SERVER_STATE_STORE_POSTGRES_SCHEMA` currently feed only the host-platform `stateStore` projection so operators can see planned PostgreSQL readiness without enabling a PostgreSQL runtime driver; the returned provider and profile records expose `projectionMode = metadataOnly` to make that posture explicit
- `CLAW_SERVER_DATA_DIR` currently seeds either `rollouts.json` plus `node-sessions.json` or one `host-state.sqlite3` database through the host-core storage SPI; planned PostgreSQL and cache providers should attach behind the same boundary instead of bypassing it
- on Windows, `pnpm server:build -- --target x86_64-unknown-linux-gnu` prefers an installed WSL distro for Linux release builds; use `SDKWORK_SERVER_BUILD_WSL_DISTRO` to pin the distro or `SDKWORK_SERVER_BUILD_DISABLE_WSL=1` to force native Cargo handling

## Related Files

- `./.env.example`
- `./packages/sdkwork-claw-web/.env.example`
- `./packages/sdkwork-claw-desktop/.env.example`

