# Repository Guidelines

## Project Structure & Module Organization
This repo is a `pnpm` workspace rooted at `packages/sdkwork-claw-*`. `packages/sdkwork-claw-web` is the browser host (`vite.config.ts`, `src/App.tsx`, `src/main.tsx`) and `packages/sdkwork-claw-desktop` is the Tauri desktop host. Both hosts should stay limited to routing, layout, providers, platform bootstrap, and runtime entry code. Shared layers live in `sdkwork-claw-types` for entities and shared types, `sdkwork-claw-infrastructure` for HTTP/config/platform adapters, `sdkwork-claw-core` for shared services, hooks, and stores, `sdkwork-claw-i18n` for locale bootstrap, and `sdkwork-claw-ui` for reusable UI. Feature packages such as `sdkwork-claw-chat`, `sdkwork-claw-market`, and `sdkwork-claw-settings` should keep `src/components`, `src/pages`, and `src/services` as their minimum boundaries when they own those concerns. Cross-package APIs must be consumed from the package root only. Do not import from package-internal subpaths after the package name. Respect dependency flow: `web/desktop -> shell -> feature -> (core + infrastructure + types + ui)`.

## Build, Test, and Development Commands
- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: start the Vite browser host at `http://localhost:3001`.
- `pnpm lint`: run the web TypeScript check plus `scripts/check-arch-boundaries.mjs`.
- `pnpm build`: create the production bundle for `@sdkwork/claw-web`.
- `pnpm preview`: serve the built app locally.
- `pnpm check:arch`: validate package layering and shell boundaries.
- `pnpm sync:features`: refresh feature package wiring.
- `pnpm tauri:dev` / `pnpm tauri:build`: run desktop development or production builds.

## Coding Style & Naming Conventions
Use TypeScript and React function components with hooks. Follow the existing style: 2-space indentation, semicolons, and grouped imports. Components and pages use `PascalCase.tsx`; services and utilities use `camelCase.ts`; Zustand hooks use `useXStore.ts`. Internal workspace packages must stay scoped as `@sdkwork/claw-xxx` in kebab-case with directories named `sdkwork-claw-xxx`. Do not place business `services`, `stores`, or `hooks` inside `packages/sdkwork-claw-web/src` or `packages/sdkwork-claw-desktop/src`.

## SDKWork Standards
Before changing domains, APIs, SDK contracts, database schemas, reusable modules, frontend UI/service logic, app manifests, IAM/auth/permission behavior, deployment/runtime configuration, external integrations, events, observability, performance, privacy, or generated-client integration, read the canonical standards in `../../specs/README.md` and then the relevant spec files under `../../specs/`. Local conventions may extend these standards but must not contradict them.

## Testing Guidelines
There is no repo-wide `pnpm test` script or coverage gate yet. Keep logic-heavy tests next to source as `*.test.ts` or `*.test.tsx`, for example `packages/sdkwork-claw-core/src/services/updateService.test.ts`. Before opening a PR, run `pnpm lint` and `pnpm build` from the workspace root. If you add new behavior, include a focused test or a clear manual verification note.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits such as `feat:` and `docs:`. Keep each commit scoped to one package or one architectural concern. PRs should include a short summary, affected packages, verification commands, linked issues, and screenshots for UI changes.

## Security & Configuration Tips
Never commit secrets. Start from `.env.example`; `GEMINI_API_KEY` is required for AI endpoints, and `VITE_ACCESS_TOKEN` is optional for update checks. Document every new environment variable in the relevant package docs or example env file.
