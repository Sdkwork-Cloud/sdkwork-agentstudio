---
layout: home

hero:
  name: Claw Studio
  text: One product shell, multiple host modes, one documented control plane.
  tagline: Web, desktop, native server, container, and Kubernetes modes now share a clearer architecture, a published native `/claw/*` API surface, and a unified release system.
  image:
    src: /logo.svg
    alt: Claw Studio
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /reference/api-reference

features:
  - title: Multi-Mode Delivery
    details: Run Claw Studio as a web workspace, a Tauri desktop app, a standalone Rust server, a Docker deployment, or a Kubernetes release family.
  - title: Native Control Plane
    details: The server publishes documented `/claw/health/*`, `/claw/api/v1/*`, `/claw/openapi/*`, `/claw/internal/v1/*`, and `/claw/manage/v1/*` route families.
  - title: Package-First Architecture
    details: Shell, core, infrastructure, UI, and feature packages stay separated by enforced import and dependency boundaries.
  - title: Desktop + Server Alignment
    details: Desktop combined mode and the standalone server share the same logical control-plane contracts, even when transport differs.
  - title: Release Automation
    details: GitHub Actions packages desktop, server, container, Kubernetes, and web/docs artifacts from one unified release workflow.
  - title: Operations Ready
    details: Commands, environment variables, artifact layouts, and deployment instructions are documented for contributors and operators.
---

## What This Site Covers

This VitePress site is the public source of truth for how Claw Studio is organized, how it is packaged, and which native APIs are currently implemented.

It is designed for three audiences:

- contributors working inside the `pnpm` workspace
- operators deploying the standalone Rust server, Docker bundle, or Kubernetes chart
- integrators who need the published native `/claw/*` API and current runtime boundaries

## Recommended Reading Path

- Start from [Getting Started](/guide/getting-started)
- Choose a host shape in [Application Modes](/guide/application-modes)
- Follow installation guidance in [Install And Deploy](/guide/install-and-deploy)
- Understand package boundaries in [Architecture](/core/architecture)
- Inspect the current native surface in [API Overview](/reference/api-reference)
- Verify packaging and release behavior in [Release And Deployment](/core/release-and-deployment)

## Current API Publication

The native server currently publishes:

- `GET /claw/health/live`
- `GET /claw/health/ready`
- `GET /claw/api/v1/discovery`
- `GET /claw/openapi/discovery`
- `GET /claw/openapi/v1.json`
- `/claw/internal/v1/*`
- `/claw/manage/v1/*`

Use [API Overview](/reference/api-reference) for the route-family map and [Claw Server Runtime](/reference/clawstudio-server-runtime) for runtime behavior details.

> Historical plans under `docs/plans` and `docs/superpowers` remain intentionally excluded from public search indexing. Public documentation here should describe implemented behavior or explicitly marked future boundaries only.
