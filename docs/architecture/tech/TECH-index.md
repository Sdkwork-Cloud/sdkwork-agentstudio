> Migrated from `docs/contributing/index.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Contributing

## Commit Style

Use Conventional Commits:

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`

Keep each commit focused on one package or one architectural concern when possible.

## Pull Request Expectations

Every pull request should include:

- a concise summary
- affected packages
- verification commands you ran
- UI screenshots when the change affects visible behavior

## Package Rules

### Import Package Roots Only

Use:

```ts
import { Chat } from '@sdkwork/agentstudio-pc-chat';
```

Do not use:

```ts
import { Chat } from '@sdkwork/agentstudio-pc-chat/src/pages/chat/Chat';
```

### Keep Shell And Entry Layers Clean

- `@sdkwork/agentstudio-pc-web` should remain an entry shell
- `@sdkwork/agentstudio-pc-desktop` should remain a desktop entry shell
- `@sdkwork/agentstudio-pc-shell` should compose routes and global UX, not accumulate feature-local services

### Respect Feature Ownership

Feature-local pages, components, and services belong in feature packages. Move code into `core` only when it is truly shared across multiple features.

## Verification Before Review

At minimum, run:

```bash
pnpm lint
pnpm build
pnpm docs:build
```

If your change touches desktop behavior, also run:

```bash
pnpm check:desktop
```

If your change touches native server behavior, Docker or Kubernetes deployment bundles, or release metadata, also run:

```bash
pnpm check:multi-mode
pnpm check:server
```

If your change touches GitHub workflows, release asset packaging scripts, or release automation contracts, also run:

```bash
pnpm check:automation
```

## Documentation Changes

- update `README.md` and `README.zh-CN.md` for repository entry changes
- update `docs/` for public project documentation
- keep design and implementation plans in `docs/plans/`

