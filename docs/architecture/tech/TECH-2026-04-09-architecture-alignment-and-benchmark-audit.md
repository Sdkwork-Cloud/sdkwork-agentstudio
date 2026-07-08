> Migrated from `docs/review/2026-04-09-architecture-alignment-and-benchmark-audit.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-09 Architecture Alignment And Benchmark Audit

## Inputs

- Architecture baseline:
  - `docs/架构/README.md`
  - `docs/架构/14-综合评估矩阵与优先级清单.md`
  - `docs/架构/15-Instance Detail 功能一致性基线与验收矩阵.md`
  - `docs/架构/16-API体系与契约设计.md`
  - `docs/架构/17-能力到API调用矩阵.md`
- OpenClaw fact sources:
  - `webStudio.ts` / `webStudio.test.ts`
  - `InstanceDetail.tsx`
  - `openClawConfigSchemaSupport.test.ts`
  - `channelService.ts`
  - `marketService.ts`
  - `agentInstallService.ts`
  - `openClawManagementCapabilities.ts`
  - `openClawProviderWorkspacePresentation.ts`
  - `local_ai_proxy.rs`
  - `plugins/mod.rs`
- Fresh local evidence:
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
- Official benchmark references:
  - Cursor Background Agents: `https://docs.cursor.com/background-agents`
  - Cursor Bugbot: `https://docs.cursor.com/bugbot`
  - Cursor MCP: `https://docs.cursor.com/zh-Hant/context/mcp`
  - GitHub Copilot coding agent: `https://docs.github.com/en/copilot/responsible-use/copilot-cloud-agent`
  - GitHub MCP and cloud agent: `https://docs.github.com/en/copilot/concepts/agents/cloud-agent/mcp-and-cloud-agent`
  - GitHub MCP overview: `https://docs.github.com/copilot/concepts/context/mcp`
  - Windsurf Workflows: `https://docs.windsurf.com/windsurf/cascade/workflows`
  - Windsurf MCP: `https://docs.windsurf.com/windsurf/cascade/mcp`

## Current Findings

### P0 - Step 07 is still blocked by the page hotspot

- Evidence:
  - `docs/架构/14` and `docs/架构/15` require a sustainable, leading `Instance Detail` workbench instead of a drifting hotspot shell.
  - `docs/review/step-07-执行卡-2026-04-08.md` explicitly says Step 07 cannot close while `InstanceDetail.tsx` remains a hotspot.
  - Fresh current-worktree measurement is still `InstanceDetail.tsx: 1444`.
- Impact:
  - slower review/debug cycles
  - weaker section isolation
  - continued regression risk when one page owns too many read-side projections
- Immediate fix chosen in this loop:
  - extract `availableAgentModelOptions` into `buildOpenClawAgentModelOptions(...)`

### P1 - Instance Detail is still too heavy for the L5 performance target

- Evidence:
  - fresh `pnpm build` still emits `dist/assets/InstanceDetail-*.js` at `262.56 kB`
  - `docs/架构/14` and `docs/架构/17` both favor sustainable, testable workbench decomposition over monolithic growth
- Impact:
  - slower first-open cost on web host
  - higher regression surface for desktop/web parity
  - lazy-loading benefits are currently capped by a still-large top-level section shell
- Fix direction:
  - keep reducing page-owned projection/state glue
  - add section-level code-splitting and lazy panel hydration after the page shell is smaller

### P1 - The app has strong agent/task primitives, but no first-class background-agent lane

- Benchmark evidence:
  - Cursor documents asynchronous background agents with status, follow-ups, and takeover
  - GitHub documents an autonomous coding agent with ephemeral environments, tests, linters, and iterative PR feedback
- Current local status:
  - Claw Studio has instance tasks, agent skills, and workbench sections
  - it does not yet expose a unified background execution lane for long-running coding/review tasks
- Fix direction:
  - design a workbench-native background agent lane on top of current task/runtime surfaces
  - keep Local Proxy, package-root boundaries, and page authority rules intact

### P1 - Workflow assets are still docs-only, not product-native

- Benchmark evidence:
  - Windsurf Workflows are reusable markdown workflows surfaced directly in product
  - Cursor MCP supports prompts/resources/tools through the MCP surface
- Current local status:
  - Claw Studio already has prompt assets in `docs/prompts/`
  - those assets are not yet versioned, browsable, or runnable as first-class workflow objects inside the app
- Fix direction:
  - promote prompt/workflow assets into a managed workflow registry with versioning, permissions, and audit trail

### P1 - Review automation is still manual-loop heavy

- Benchmark evidence:
  - Cursor Bugbot provides automated PR review with fix suggestions
  - GitHub MCP and cloud-agent docs show tool-governed review/automation lanes
- Current local status:
  - Claw Studio relies on manual `docs/review/` loops plus contract tests
  - there is no product-native diff review lane that files findings, links evidence, and tracks remediation state
- Fix direction:
  - design a review workbench that writes findings into `docs/review/` and runtime tasks, not just chat output

## Chosen Remediation Order

1. Keep clearing `CP07-3` page hotspots so the current workbench becomes maintainable.
2. Add section-level lazy-loading once the page shell is small enough to split cleanly.
3. Design workflow-registry architecture using existing `docs/prompts/` assets as the seed corpus.
4. Design a background-agent lane that reuses current task/runtime truth sources instead of inventing a parallel state model.
5. Design review automation and MCP/tool governance surfaces after the execution lane is defined.

## This Loop's Concrete Delivery

- Code:
  - `buildOpenClawAgentModelOptions(...)`
  - `InstanceDetail.tsx` now consumes that helper
- Tests:
  - focused unit RED -> GREEN
  - contract RED -> GREEN
  - fresh Step 07 verification suite re-run
- Review/docs:
  - this audit note
  - the Step 07 extraction note
  - architecture progress and release evidence updates

## Next Plan

1. Close `release-2026-04-09-130` and keep the release tag gate strict in every loop.
2. Continue `Step 07 / CP07-3` with the next smallest page-side pure bundle.
3. Open a dedicated architecture design loop for workflow registry, background agents, and review automation.
4. Use official benchmark docs only when comparing product capabilities or governance patterns.

## Update After release-2026-04-09-131

- The section-router lazy split is now shipped for the two heaviest route-owned panels:
  - `files`
  - `config`
- Fresh build evidence supersedes the earlier `262.56 kB` `InstanceDetail` chunk baseline:
  - `InstanceDetail-CO9QGjPk.js`: `179.55 kB`
  - `InstanceConfigWorkbenchPanel-BoVtLBcy.js`: `63.33 kB`
  - `InstanceDetailFilesSection-BEBOjm48.js`: `2.38 kB`
- This closes the first section-level code-splitting move in the chosen remediation order, but it does not change the broader ranking:
  - `P0` remains the `InstanceDetail.tsx` hotspot at `1444` lines
  - `P1` workflow registry, background-agent lane, and review automation are still design gaps relative to Cursor / Copilot / Windsurf benchmark capability
- The next preferred remediation step remains page-side hotspot reduction before adding more lazy surface area.

