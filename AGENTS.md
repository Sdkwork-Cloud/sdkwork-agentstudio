# Repository Guidelines

<!-- SDKWORK-AGENTS-GENERATED: v1 -->

## SDKWORK Soul

Read `../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards

Canonical SDKWORK specs path from this root:

- `../sdkwork-specs/README.md`
- `../sdkwork-specs/SOUL.md`
- `../sdkwork-specs/AGENTS_SPEC.md`
- `../sdkwork-specs/CODE_STYLE_SPEC.md`
- `../sdkwork-specs/NAMING_SPEC.md`

Do not copy root standard text into this repository. If these relative paths do not resolve, stop and report the broken workspace layout.

## Application Identity

Read `sdkwork.app.config.json` before changing application behavior, runtime config, SDK wiring, release metadata, or app-owned capabilities.

## Local Dictionary Structure

- `AGENTS.md`: local agent entrypoint and relative SDKWORK spec index.
- `CLAUDE.md`: Claude Code compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `GEMINI.md`: Gemini CLI compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `CODEX.md`: Codex compatibility shim that points to `AGENTS.md` and must not duplicate rules.
- `sdkwork.app.config.json`: application identity and owned capability metadata.
- `.sdkwork/`: reserved local dictionary folder; create only for local skills, plugins, manifests, or AI workspace metadata.
- `specs/`: local application/component contracts and narrowing rules.
- `sdks/`: not present here; use only for SDK authority or generation surfaces.
- `package.json`, `pnpm-workspace.yaml`: language/build manifests.
- Local directories to inspect first when relevant: `.github/`, `architect/`, `config/`, `deploy/`, `docs/`, `packages/`, `prompt/`, `scripts/`, `skills/`, `specs/`, `types/`.

## Spec Resolution Order

1. Read this `AGENTS.md` and any nearer component-level `AGENTS.md`.
2. Read `sdkwork.app.config.json` when present.
3. Read local `specs/README.md` and `specs/component.spec.json` when present.
4. Read local `.sdkwork/README.md`, `.sdkwork/skills/`, and `.sdkwork/plugins/` when relevant.
5. Read `../sdkwork-specs/README.md` and the task-specific root specs.
6. Inspect implementation files only after the relevant dictionary entries are clear.

## Required Specs By Task Type

- Agent/workflow changes: `../sdkwork-specs/SOUL.md`, `../sdkwork-specs/AGENTS_SPEC.md`, `../sdkwork-specs/SDKWORK_WORKSPACE_SPEC.md`.
- Any code change: `../sdkwork-specs/CODE_STYLE_SPEC.md`, `../sdkwork-specs/NAMING_SPEC.md`, plus only the touched language/framework spec.
- Rust code: `../sdkwork-specs/RUST_CODE_SPEC.md` and `../sdkwork-specs/RUST_RPC_SPEC.md` when RPC is touched.
- Java/Spring code: `../sdkwork-specs/JAVA_CODE_SPEC.md` and `../sdkwork-specs/WEB_BACKEND_SPEC.md` when HTTP backend behavior is touched.
- TypeScript/Node code: `../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md`.
- Frontend/UI code: `../sdkwork-specs/FRONTEND_CODE_SPEC.md`, `../sdkwork-specs/FRONTEND_SPEC.md`, `../sdkwork-specs/UI_ARCHITECTURE_SPEC.md`, and exactly one detailed UI architecture spec.
- API, SDK, database, runtime, security, and deployment changes must follow the task matrix in `../sdkwork-specs/README.md`.

Language-specific specs are on-demand; do not load Rust, Java, TypeScript, and frontend specs for unrelated tasks.

## Code Style Rules

Read `../sdkwork-specs/CODE_STYLE_SPEC.md` and `../sdkwork-specs/NAMING_SPEC.md` before code changes.

Load language specs only when touched: Rust uses `RUST_CODE_SPEC.md`, Java/Spring uses `JAVA_CODE_SPEC.md`, TypeScript/Node uses `TYPESCRIPT_CODE_SPEC.md`, and frontend/UI uses `FRONTEND_CODE_SPEC.md`.

For TypeScript or frontend code, prefer strict types, explicit package exports, colocated tests, and existing package/module boundaries.

## Build, Test, and Verification

Run commands from this directory unless a command explicitly targets another path.

- `pnpm install`: install dependencies for this workspace or package.
- `pnpm run dev`: start the local development server or app shell.
- `pnpm run build`: build production artifacts or package outputs.
- `pnpm run lint`: run lint and static checks.
- `pnpm run check:arch`: run repository verification or architecture checks.
- `pnpm run preview`: serve built artifacts locally.
- `pnpm run build:desktop`: build production artifacts or package outputs.
- `pnpm run build:desktop-host`: build production artifacts or package outputs.
- `pnpm run build:dev`: build production artifacts or package outputs.
- `pnpm run build:prod`: build production artifacts or package outputs.
- `pnpm run build:server`: build production artifacts or package outputs.
- `pnpm run build:test`: build production artifacts or package outputs.
- `pnpm run build:web`: build production artifacts or package outputs.
- `pnpm run check:automation`: run repository verification or architecture checks.
- `pnpm run check:ci-flow`: run repository verification or architecture checks.
- `pnpm run check:desktop`: run repository verification or architecture checks.
- `pnpm run check:desktop-kernel`: run repository verification or architecture checks.
- `pnpm run check:desktop-openclaw-runtime`: run repository verification or architecture checks.

Run the narrowest relevant check first, then broader verification when API contracts, SDK generation, persistence, security, or cross-package boundaries change.

## Agent Execution Rules

Use the convention dictionary instead of broad context loading. Do not hand-edit generated SDK output unless the task is explicitly about generated artifacts and the source contract is verified. Do not replace generated SDK integration with raw HTTP. Keep changes scoped to the owning module, package, crate, or app root. Record the exact verification commands and important outputs before reporting completion.

## Human Review Rules

Request human review before breaking SDKWORK standards, changing public naming, altering security/auth behavior, changing database migrations or production deployment config, deleting data/files, or changing generated SDK ownership. Surface unresolved spec paths, app identity conflicts, component ownership conflicts, and API authority ambiguity instead of guessing.

## Existing Local Guidance

The repository-specific guidance below was preserved from the previous `AGENTS.md`. If it conflicts with the SDKWORK sections above or with `../sdkwork-specs/`, the SDKWORK standards win.

### Project Structure & Module Organization
This repo is a `pnpm` workspace rooted at `packages/sdkwork-claw-*`. `packages/sdkwork-claw-web` is the browser host (`vite.config.ts`, `src/App.tsx`, `src/main.tsx`) and `packages/sdkwork-claw-desktop` is the Tauri desktop host. Both hosts should stay limited to routing, layout, providers, platform bootstrap, and runtime entry code. Shared layers live in `sdkwork-claw-types` for entities and shared types, `sdkwork-claw-infrastructure` for HTTP/config/platform adapters, `sdkwork-claw-core` for shared services, hooks, and stores, `sdkwork-claw-i18n` for locale bootstrap, and `sdkwork-claw-ui` for reusable UI. Feature packages such as `sdkwork-claw-chat`, `sdkwork-claw-market`, and `sdkwork-claw-settings` should keep `src/components`, `src/pages`, and `src/services` as their minimum boundaries when they own those concerns. Cross-package APIs must be consumed from the package root only. Do not import from package-internal subpaths after the package name. Respect dependency flow: `web/desktop -> shell -> feature -> (core + infrastructure + types + ui)`.

### Build, Test, and Development Commands
- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: start the Vite browser host at `http://localhost:3001`.
- `pnpm lint`: run the web TypeScript check plus `scripts/check-arch-boundaries.mjs`.
- `pnpm build`: create the production bundle for `@sdkwork/claw-web`.
- `pnpm preview`: serve the built app locally.
- `pnpm check:arch`: validate package layering and shell boundaries.
- `pnpm sync:features`: refresh feature package wiring.
- `pnpm tauri:dev` / `pnpm tauri:build`: run desktop development or production builds.

### Coding Style & Naming Conventions
Use TypeScript and React function components with hooks. Follow the existing style: 2-space indentation, semicolons, and grouped imports. Components and pages use `PascalCase.tsx`; services and utilities use `camelCase.ts`; Zustand hooks use `useXStore.ts`. Internal workspace packages must stay scoped as `@sdkwork/claw-xxx` in kebab-case with directories named `sdkwork-claw-xxx`. Do not place business `services`, `stores`, or `hooks` inside `packages/sdkwork-claw-web/src` or `packages/sdkwork-claw-desktop/src`.

### Previous SDKWORK Standards Notes
Before changing domains, APIs, SDK contracts, database schemas, reusable modules, frontend UI/service logic, app manifests, IAM/auth/permission behavior, deployment/runtime configuration, external integrations, events, observability, performance, privacy, or generated-client integration, read the canonical standards in `../sdkwork-specs/README.md` and then the relevant spec files under `../sdkwork-specs/`. Local conventions may extend these standards but must not contradict them.

### Testing Guidelines
There is no repo-wide `pnpm test` script or coverage gate yet. Keep logic-heavy tests next to source as `*.test.ts` or `*.test.tsx`, for example `packages/sdkwork-claw-core/src/services/updateService.test.ts`. Before opening a PR, run `pnpm lint` and `pnpm build` from the workspace root. If you add new behavior, include a focused test or a clear manual verification note.

### Commit & Pull Request Guidelines
Recent history follows Conventional Commits such as `feat:` and `docs:`. Keep each commit scoped to one package or one architectural concern. PRs should include a short summary, affected packages, verification commands, linked issues, and screenshots for UI changes.

### Security & Configuration Tips
Never commit secrets. Start from `.env.example`; `GEMINI_API_KEY` is required for AI endpoints, and `SDKWORK_ACCESS_TOKEN` is optional for protected API bootstrap before login. Document every new environment variable in the relevant package docs or example env file.
