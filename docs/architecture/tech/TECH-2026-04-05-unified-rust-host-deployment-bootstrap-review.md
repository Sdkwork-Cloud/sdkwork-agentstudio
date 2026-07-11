> Migrated from `docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-review.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Unified Rust Host Deployment And Bootstrap Review

Date: 2026-04-05

Scope:
- docker bundle deployment path
- kubernetes chart/runtime alignment
- desktop embedded host bootstrap transport
- browser-session bootstrap and auth edges

## Summary

The shared Rust host kernel is reused across deployment modes, but the deployment and bootstrap edges are still not product-grade. The current templates, bootstrap transport, and verification strategy leave too much of the real runtime path either implicit, bundle-specific, or only statically validated.

## Findings

### 1. High: docker deployment in the source tree is bundle-relative and not self-validating

Evidence:
- `deploy/docker/README.md`
- `deploy/docker/docker-compose.yml`
- `deploy/docker/Dockerfile`
- `scripts/release/package-release-assets.mjs`
- `scripts/package-release-assets.test.mjs`

What is happening:

- `deploy/docker/docker-compose.yml` uses:
  - `context: ..`
  - `dockerfile: deploy/Dockerfile`
- the source repository does not contain `deploy/Dockerfile`
- the source repository does not contain `deploy/docker/app/start-agentstudio-server.sh`
- release packaging later materializes a bundle where those paths become valid

Why it matters:

- source-tree inspection alone suggests the docker deployment is broken
- bundle packaging hides the real runtime entrypoint and Docker build layout from normal code review
- deployment validation is shifted away from the actual source templates into packaging transforms

Current status:

- this is not a release-bundle blocker by itself because the package-release tests verify the transformed bundle layout
- it is still a developer-experience and reviewability gap because the source deployment templates are not directly runnable

Required direction:

- either make the source-tree deployment templates runnable as-is
- or clearly separate:
  - source templates
  - packaged bundle templates
- and add tooling that renders the package-relative docker deployment layout locally for inspection

### 2. High: docker and kubernetes verification is still mostly static, not runtime-backed

Evidence:
- `scripts/release-deployment-contract.test.mjs`
- `deploy/docker/README.md`
- `deploy/kubernetes/templates/deployment.yaml`

What is happening:

- docker and kubernetes contract tests mainly regex-match templates and docs
- there is no local runtime smoke proving:
  - the container image boots successfully
  - the HTTP server binds correctly
  - readiness semantics match actual runtime state
  - no fake built-in OpenClaw runtime is projected

Why it matters:

- shared-kernel deployment confidence is being inferred from template shape instead of runtime behavior
- template correctness can still coexist with broken startup, broken readiness, or broken runtime authority

Required direction:

- add runnable smoke for:
  - packaged container bundle
  - docker compose startup
  - singleton-k8s startup
  - hosted OpenClaw readiness and instance projection truth

### 3. High: kubernetes chart still advertises readiness without runtime truth

Evidence:
- `deploy/kubernetes/templates/deployment.yaml`
- `deploy/kubernetes/templates/configmap.yaml`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/health.rs`

What is happening:

- chart readiness still points to `/claw/health/live`
- `health.rs` still returns `200 OK` for `/ready`
- chart config only pushes host/port/data-dir/deployment-family/accelerator-profile
- no runtime-level readiness contract is enforced at the chart edge

Why it matters:

- kubernetes can report pods ready before the shared host is actually usable
- this undermines the whole point of a shared kernel if operational health remains template-driven instead of runtime-driven

Required direction:

- move readiness to `/claw/health/ready`
- make `/ready` reflect actual runtime dependency health
- add startup probes and singleton-mode guardrails while the runtime store remains single-writer

### 4. Medium: docker image still lacks an image-native health contract

Evidence:
- `deploy/docker/Dockerfile`

What is happening:

- the image exposes port `18797`
- it has no `HEALTHCHECK`

Why it matters:

- container-native health tooling cannot observe runtime availability without external orchestration knowledge
- the image itself does not encode the shared host health contract

Required direction:

- add a container-native health probe once `/ready` is truthful
- keep the container image and helm chart aligned on the same readiness semantics

### 5. High: desktop embedded host bootstrap still scrapes the browser session token from HTML

Evidence:
- `packages/sdkwork-agentstudio-pc-desktop/src-tauri/src/framework/desktop_host_bootstrap.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/static_assets.rs`

What is happening:

- desktop bootstrap fetches root HTML
- it extracts `sdkwork-agentstudio-pc-browser-session-token` from a `<meta>` tag
- server static asset injection writes dynamic metadata straight into HTML

Why it matters:

- bootstrap depends on HTML structure for a control-plane transport concern
- session bootstrap is coupled to document rendering instead of a structured bootstrap descriptor
- this is fragile and difficult to evolve safely

Required direction:

- move browser-session/bootstrap discovery to a structured command or endpoint
- leave HTML metadata informational only
- escape all dynamic HTML metadata while this path still exists

### 6. Medium: desktop root HTML authorization and browser-session trust model are not clearly separated

Evidence:
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/auth.rs`
- `packages/sdkwork-agentstudio-pc-server/src-host/src/http/static_assets.rs`

What is happening:

- `authorize_browser_request()` uses manage basic auth, not the browser session token
- in desktop combined mode, public studio/manage/internal surfaces may rely on the browser-session token
- the token is then delivered inside the root HTML

Why it matters:

- the bootstrap trust chain is harder to reason about than it needs to be
- browser shell delivery, browser session bootstrap, and control-plane authorization are not expressed as one explicit contract

Required direction:

- define one desktop hosted bootstrap contract:
  - how the shell is loaded
  - how session identity is acquired
  - which surfaces accept which credentials
- make tests assert that contract directly instead of inferring it from HTML scraping and per-surface auth helpers

## Bottom Line

The shared host kernel is present, but deployment and bootstrap still depend on too many implicit transforms and weak runtime proofs. The next hardening step is not another surface-level UI patch. It is to make docker/k8s launch paths, desktop bootstrap transport, and runtime health verification explicit, structured, and runnable.

