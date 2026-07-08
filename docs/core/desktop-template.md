# Desktop Template API

## Purpose

`@sdkwork/clawstudio-desktop` now exposes a template-grade desktop bridge so future Tauri applications can copy a stable API surface instead of growing one-off `invoke()` calls.

## Standard Surface

The desktop bridge is built around four reusable parts:

- `catalog.ts`: the single source of truth for desktop command names and event names
- `runtime.ts`: the runtime detector, normalized `DesktopBridgeError`, and typed `invokeDesktopCommand` / `listenDesktopEvent` wrappers
- `tauriBridge.ts`: the compatibility layer plus grouped `desktopTemplateApi`
- `configureDesktopPlatformBridge()`: host bootstrap that wires the standard bridge into the shared infrastructure registry

## Grouped API

`desktopTemplateApi` is grouped by responsibility:

- `catalog`: command and event registries
- `meta`: runtime and window helpers
- `app`: app metadata, config, system info, device identity
- `kernel`: kernel and storage runtime snapshots
- `storage`: profile-aware key-value storage operations
- `filesystem`: managed file system operations
- `jobs`: job submission, process execution, and subscriptions
- `shell`: window controls and external shell actions
- `installer`: install-script execution
- `runtime`: aggregated runtime snapshot

## Rules

- Do not introduce new raw Tauri command strings outside `catalog.ts`.
- Do not call raw `invoke()` or `listen()` directly from feature or shell layers.
- Extend `desktopTemplateApi` by domain, not by ad-hoc flat helpers.
- Preserve web fallbacks where a browser-safe fallback exists.
- Throw `DesktopBridgeError` for desktop bridge failures so callers get a consistent error model.

## Extension Checklist

When adding a new native capability:

1. Add the command or event to `catalog.ts`.
2. Add the native Rust command and register it in `src-tauri/src/app/bootstrap.rs`.
3. Add a typed wrapper in `tauriBridge.ts`.
4. Expose the capability through the appropriate `desktopTemplateApi` domain.
5. Update `scripts/check-desktop-platform-foundation.mjs` if the standard surface changes.
6. Re-run `pnpm check:desktop`.
