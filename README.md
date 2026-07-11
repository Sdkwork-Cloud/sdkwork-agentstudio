# SdkWork Agent Studio
repository-kind: application

[Chinese README](./README.zh-CN.md)

SdkWork Agent Studio is a package-first workspace for the modern Agent Studio application, shared browser shell, and Tauri desktop runtime. The current implementation is aligned to `upgrade/agent-studio-v5`, reorganized into maintainable feature packages with strict architecture boundaries and root-only cross-package imports.

This repository focuses on the SdkWork Agent Studio product. The primary workspace, scripts, and documentation here center on SdkWork Agent Studio.

## Highlights

- Shared product shell across web and desktop entry packages
- Vertical feature packages for chat, apps, market, settings, devices, account, extensions, community, and more
- Strict dependency layering enforced by repository checks
- Tauri desktop runtime with update, distribution, and platform foundation checks
- Multilingual documentation for users, contributors, and commercial buyers

## Architecture Snapshot

```text
web/desktop -> shell -> feature -> (commons + core + infrastructure + i18n + types + ui)
shell -> (core + i18n + ui + feature)
core -> (infrastructure + i18n + types)
infrastructure -> (i18n + types)
```

Key package roles:

- `@sdkwork/agentstudio-pc-web`: runnable web app and Vite host
- `@sdkwork/agentstudio-pc-desktop`: Tauri desktop entry and native bridge
- `@sdkwork/agentstudio-pc-shell`: routes, layouts, providers, sidebar, command palette
- `@sdkwork/agentstudio-pc-core`: shared stores and cross-feature orchestration
- `@sdkwork/agentstudio-pc-types`: pure types and shared models
- `@sdkwork/agentstudio-pc-infrastructure`: environment, HTTP, i18n, and platform adapters
- `@sdkwork/agentstudio-pc-*`: vertical feature packages such as `chat`, `market`, `settings`, `account`, and `extensions`

The repository rejects cross-package subpath imports. Use package roots such as `@sdkwork/agentstudio-pc-market`, not `@sdkwork/agentstudio-pc-market/src/...`.

## Quick Start

```bash
pnpm install
pnpm dev
```

The default web development server runs through Vite for `@sdkwork/agentstudio-pc-web` on `http://localhost:3001`.

For desktop development and packaging:

```bash
pnpm dev:desktop
pnpm build:desktop
```

For native server development and packaging:

```bash
pnpm dev:server
pnpm build:server
```

## Common Commands

```bash
pnpm dev           # start the web shell
pnpm build         # build the web package
pnpm check:multi-mode # validate desktop, server, OpenClaw runtime, and release packaging together
pnpm check:server  # validate the native Rust server runtime
pnpm check:automation # validate release and CI automation contracts
pnpm build:server  # build the native Rust server
pnpm lint          # TypeScript + architecture + parity checks
pnpm check:arch    # validate package boundaries and root imports
pnpm check:parity  # verify critical parity checks against the v5 baseline
pnpm check:desktop # validate desktop platform wiring
pnpm docs:dev      # run the VitePress docs site
pnpm docs:build    # build the VitePress docs site
```

Package-scoped execution stays available through pnpm's filters, for example:

```bash
pnpm --filter @sdkwork/agentstudio-pc-web build
```

## Release Artifacts

Agent Studio release tags now publish multiple artifact families from the same workflow:

- desktop bundles for Windows, Linux, and macOS
- native server archives for Windows, Linux, and macOS
- container deployment bundles for Linux `x64` and `arm64`
- kubernetes deployment bundles for Linux `x64` and `arm64`
- web/docs archive

Deployment-oriented bundles also expose CPU, NVIDIA CUDA, and AMD ROCm-oriented profiles where the difference belongs to runtime orchestration rather than the server binary itself.

## Environment

Start from [`.env.example`](./.env.example). The most important variables are:

- an active OpenClaw-compatible instance plus Provider Center configuration for AI generation features
- `VITE_API_BASE_URL`: backend API base URL used by typed clients and desktop update checks
- `SDKWORK_ACCESS_TOKEN`: optional private bootstrap access token for protected API calls before login
- `VITE_APP_ID`, `VITE_RELEASE_CHANNEL`, `VITE_DISTRIBUTION_ID`, `VITE_PLATFORM`, `VITE_TIMEOUT`: desktop runtime and update configuration

Desktop-specific examples are also available in [`packages/sdkwork-agentstudio-pc-desktop/.env.example`](./packages/sdkwork-agentstudio-pc-desktop/.env.example).

## License

Agent Studio uses a dual-license model:

- Open source: [`AGPL-3.0-only`](./LICENSE)
- Commercial: [`LICENSE-COMMERCIAL.md`](./LICENSE-COMMERCIAL.md)

AGPL itself does not automatically ban commercial use. The repository policy is:

- if your use case can comply with AGPL obligations, you may use the project under AGPL
- if you need closed-source use, OEM, white-label redistribution, customer delivery, or other commercial rights beyond AGPL, you must obtain a separate commercial license from SdkWork

The full Chinese commercial policy, pricing matrix, and FAQ are maintained in [`README.zh-CN.md`](./README.zh-CN.md).

## Commercial Use

Commercial licensing is strongly recommended for:

- closed-source commercial products
- SaaS deployments that do not want to carry AGPL compliance obligations
- internal commercial systems with procurement or support requirements
- OEM, white-label, redistribution, and customer delivery projects
- enterprise teams that need invoices, SLA, or dedicated support

If you are unsure whether your scenario can remain under AGPL, contact the repository maintainer before production use.

## Commercial Plans

Public reference pricing is published as RMB annual pricing:

- `Individual Commercial License`: `RMB 2,999 / year`
- `Team Commercial License`: `RMB 12,800 / year`
- `Enterprise Commercial License`: `RMB 49,800 / year`
- `OEM / White-Label / Redistribution License`: `RMB 159,000 / year and up`
- `Private Custom Delivery And Source Support`: `RMB 299,000 / year and up`

These are reference prices only. Final scope, taxes, and delivery terms are defined in the executed commercial quote, order, or contract.

## Purchase Process

1. Identify your deployment model: AGPL-compliant use, closed-source product, SaaS, private delivery, OEM, or white-label.
2. Prepare team size, production environment count, support requirements, and redistribution scope.
3. Choose the closest public package tier as the quoting baseline.
4. Contact [sales@sdkwork.com](mailto:sales@sdkwork.com) or use the community channels below for the first commercial conversation.
5. Final commercial rights are granted only after quote confirmation and a signed order or contract.

Primary sales inbox: [sales@sdkwork.com](mailto:sales@sdkwork.com)

Recommended use of this inbox:

- commercial licensing and pricing
- OEM, white-label, and redistribution requests
- enterprise procurement and invoice requirements
- custom delivery and dedicated support discussions

Sales response target: within `2 business days`

Suggested email subject:

- `Agent Studio Commercial License Inquiry`

Suggested first email contents:

- company or individual name
- package tier you are evaluating
- deployment model: SaaS, closed-source product, internal system, OEM, or white-label
- expected developer seat count
- expected production environment count
- whether invoice, SLA, or redistribution rights are required

## Contact Sales

- Primary inbox: [sales@sdkwork.com](mailto:sales@sdkwork.com)
- Primary use cases: licensing, procurement, OEM, white-label, redistribution, and custom delivery
- Response target: within `2 business days`

For faster triage, include the following in your first message:

- legal entity name
- target package tier
- deployment model
- whether you need invoice, contract review, or dedicated support
- expected launch timeline

## Renewals And Upgrades

- individual, team, and enterprise licenses can be renewed through the sales inbox
- package upgrades should be handled before production expansion, team expansion, or redistribution
- OEM, white-label, redistribution, and custom-delivery renewals are quoted case by case
- final renewal scope and pricing are confirmed in the active quote, order, or contract

## Community

The repository does not yet contain the real community QR codes for Feishu, WeChat, QQ, or Sdkwork Chat. The following images are placeholders so the README layout is stable now and the real assets can be swapped in later without changing the documentation structure.

| Channel | QR |
| --- | --- |
| Feishu | <img src="./docs/public/community/feishu-qr-placeholder.svg" alt="Feishu community QR placeholder" width="180" /> |
| WeChat | <img src="./docs/public/community/wechat-qr-placeholder.svg" alt="WeChat community QR placeholder" width="180" /> |
| QQ | <img src="./docs/public/community/qq-qr-placeholder.svg" alt="QQ community QR placeholder" width="180" /> |
| Sdkwork Chat | <img src="./docs/public/community/sdkwork-chat-qr-placeholder.svg" alt="Sdkwork Chat community QR placeholder" width="180" /> |

Replace the files under `docs/public/community/` with the real QR assets when they become available.

Sales contact: [sales@sdkwork.com](mailto:sales@sdkwork.com)
Response target: within `2 business days`

## Documentation

- [Getting Started](./docs/guide/getting-started.md)
- [Development Guide](./docs/guide/development.md)
- [Architecture](./docs/core/architecture.md)
- [Package Layout](./docs/core/packages.md)
- [Desktop Runtime](./docs/core/desktop.md)
- [Release And Deployment](./docs/core/release-and-deployment.md)
- [Desktop Template API](./docs/core/desktop-template.md)
- [Commands Reference](./docs/reference/commands.md)
- [Contribution Guide](./docs/contributing/index.md)

The repository also ships an in-app documentation feature package at `@sdkwork/agentstudio-pc-docs`. The VitePress site in `docs/` is the public project documentation for GitHub and open-source contributors.

## Contributing

Use Conventional Commits such as `feat:`, `fix:`, `refactor:`, and `docs:`. Before opening a pull request, run:

```bash
pnpm lint
pnpm build
pnpm docs:build
```

If your change touches native server behavior, Docker packaging, Kubernetes bundles, or release metadata, also run:

```bash
pnpm check:multi-mode
pnpm check:server
```

If your change touches GitHub workflows, release asset packaging scripts, or release automation contracts, also run:

```bash
pnpm check:automation
```

Pull requests should include a concise summary, affected packages, verification commands, and screenshots for UI-facing changes.

## SDKWork Documentation Contract

Domain: system
Capability: component
Package type: app
Status: ACTIVE

### Public API

Public exports are declared in `specs/component.spec.json` under `contracts.publicExports`.

### Required SDK Surface

- None declared in `specs/component.spec.json`.

### Configuration

Configuration keys and runtime entrypoints are declared in `specs/component.spec.json`.

### SaaS/Private/Local Behavior

This module follows the canonical standards linked from `specs/component.spec.json`, including deployment and runtime configuration rules where applicable.

### Security

Do not add secrets, live tokens, manual auth headers, or app-local credential handling to this module.

### Extension Points

Extension points are limited to declared public exports, runtime entrypoints, SDK clients, events, and config keys.

### Verification

- `pnpm --filter @sdkwork/agentstudio-workspace build`

### Owner And Status

Owner and lifecycle status are tracked in `specs/component.spec.json`.

## Documentation Canon

- [docs/README.md](docs/README.md)
- [docs/product/prd/PRD.md](docs/product/prd/PRD.md)
- [docs/architecture/tech/TECH_ARCHITECTURE.md](docs/architecture/tech/TECH_ARCHITECTURE.md)
