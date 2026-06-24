> Migrated from `docs/guide/application-modes.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Application Modes

## Overview

Claw Studio is no longer documented as a single desktop-only product shell. The current workspace supports multiple host and deployment shapes that share the same product surface but differ in transport, packaging, and operational model.

## Mode Matrix

| Mode | Primary Host | Operator Access | Best For | Main Entry |
| --- | --- | --- | --- | --- |
| Web workspace | Vite dev server | Browser | day-to-day frontend development | `pnpm dev` |
| Desktop runtime | Tauri + Rust host | Native desktop window | local GUI-first installs and managed local runtimes | `pnpm tauri:dev` |
| Native server | Axum + Rust host | Browser over same-origin server | standalone server installs with browser-based management | `pnpm server:dev` |
| Container | Rust server inside Docker bundle | Browser via exposed container port | Docker and Compose-based deployment | packaged container bundle |
| Kubernetes | Rust server behind chart values | Browser through ingress or service exposure | clustered deployment and platform operations | packaged Kubernetes bundle |
| Web/docs archive | Static assets only | Static file host | publishing docs and browser assets without the Rust control plane | packaged web archive |

## Web Workspace

The web workspace is the fastest inner-loop path for UI and package work. It runs the shared shell in a browser-first development host.

Use this when:

- iterating on React, styles, and package boundaries
- validating architecture and parity checks
- building docs or browser-facing UI without native packaging

## Desktop Runtime

Desktop mode packages the same product shell into a Tauri application. It stays thin at the entry layer and delegates feature behavior to shared packages.

Current desktop characteristics:

- canonical `studio`, `manage`, `internal`, and `openapi` browser-facing flows run through the embedded Rust host in `desktopCombined` mode
- Tauri commands remain for native-only capabilities that are not part of the canonical `/claw/*` host surface
- `/claw/manage/v1/service*` stays server-only and is intentionally not published in desktop combined mode
- local runtime integration is handled by the Rust host and desktop packaging logic
- desktop remains part of the unified release system rather than a separate product line

Choose desktop mode when you need:

- a local GUI-first installation
- native window behavior
- local managed OpenClaw-compatible runtime integration

## Native Server

Server mode packages a Rust Axum host that serves both the browser app and the published native `/claw/*` route families.

Current server characteristics:

- browser UI is served from the same origin as the native control plane
- OpenAPI discovery is published under `/claw/openapi/*`
- runtime and management APIs are published under `/claw/internal/v1/*` and `/claw/manage/v1/*`
- optional HTTP basic auth can protect the browser shell and control-plane surfaces

Choose server mode when you need:

- remote browser access
- a deployable server binary for Windows, Linux, or macOS
- one packaged bundle that includes the web app and native API host

## Container And Kubernetes

Container and Kubernetes are deployment shapes built around the same Rust server binary, not separate application implementations.

Important model details:

- the Rust server binary remains CPU-neutral
- GPU differentiation is handled at the deployment layer through accelerator profiles such as `cpu`, `nvidia-cuda`, and `amd-rocm`
- Docker and Helm bundles carry deployment overlays, metadata, and packaging helpers around the same application runtime

## Browser Transport Differences

There are two important runtime patterns today:

- Desktop combined mode uses embedded loopback HTTP for canonical `/claw/*` browser-hosted flows and keeps Tauri commands for native-only capabilities.
- Server, container, and Kubernetes modes use same-origin HTTP through the published `/claw/*` host routes.

This distinction matters because the product surface stays aligned even though the transport differs by host mode.

## API Access By Mode

| Mode | Control-Plane Transport | Recommended API Consumer Pattern |
| --- | --- | --- |
| Web workspace | preview bridge or mock bridge | develop UI against package contracts, not direct `/claw/*` URLs |
| Desktop runtime | embedded loopback HTTP for canonical `/claw/*` flows plus desktop bridge for native-only capabilities | use the shared platform bridge or runtime `browserBaseUrl`; do not assume server-only service lifecycle routes exist |
| Native server | same-origin HTTP | call `/claw/*` directly from browser tooling, operators, or future SDKs |
| Container | same-origin HTTP behind mapped ports | call `/claw/*` through the published host and port |
| Kubernetes | same-origin HTTP behind service or ingress | call `/claw/*` through the cluster service or ingress domain |

This is the key rule for integrators: canonical `/claw/*` contracts are shared across embedded desktop and standalone server-backed modes, but server lifecycle endpoints remain server-only.

## Choosing The Right Mode

- Choose `web` for package development and rapid browser iteration.
- Choose `desktop` for local operator workflows with a native app shell.
- Choose `server` for standalone installs that should be managed from a browser.
- Choose `container` for Docker and Compose environments.
- Choose `kubernetes` for cluster-based rollout and ingress-managed deployment.
- Choose `web/docs` when you only need the static browser and documentation artifacts.

## Recommended Decision Path

Use this quick decision rule:

1. If you need a native app window, choose `desktop`.
2. If you need browser-based management on one machine or one VM, choose `server`.
3. If you already operate Docker hosts, choose `container`.
4. If you already operate a cluster and ingress, choose `kubernetes`.
5. If you only need UI development or documentation publishing, choose `web` or `web/docs`.

