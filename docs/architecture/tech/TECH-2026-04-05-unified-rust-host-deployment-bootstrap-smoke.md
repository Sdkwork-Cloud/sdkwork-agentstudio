> Migrated from `docs/reports/2026-04-05-unified-rust-host-deployment-bootstrap-smoke.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Unified Rust Host Deployment Bootstrap Smoke

Date: 2026-04-05

Scope:
- packaged container image startup
- docker compose startup
- singleton-k8s readiness
- runtime-aware readiness and shared-host endpoint projection truth

## Summary

This report persists the deployment bootstrap smoke contract for the unified Rust host kernel
across container and singleton-kubernetes deployment modes.

The goal is to separate two kinds of evidence cleanly:

- automated repository checks that prove the deployment contract is wired correctly
- runtime-backed docker and kubernetes smoke commands that must be executed against a real bundle,
  image, and cluster before release sign-off

The live runtime flows below were not executed in this sandbox and remain pending manual execution
on a real deployment target. The command set is still recorded here so the release gate can verify
that packaged container image startup, docker compose startup, singleton-k8s readiness, and
shared-host projection truth all have one explicit smoke contract.

## Automated Verification

Commands executed on 2026-04-05:

- `node scripts/release-deployment-contract.test.mjs`
- `node scripts/package-release-assets.test.mjs`
- `pnpm.cmd check:server`

Result:

- all commands above passed after the deployment bootstrap smoke contract landed

## Runtime-Backed Smoke Contract

### Packaged container image startup

Run from the extracted container bundle root:

```bash
docker build -f deploy/docker/Dockerfile -t claw-studio-smoke:2026-04-05 .
docker run --rm -d --name claw-studio-smoke -p 18797:18797 -e CLAW_SERVER_MANAGE_USERNAME=claw-admin -e CLAW_SERVER_MANAGE_PASSWORD=replace-with-a-strong-secret claw-studio-smoke:2026-04-05
curl -u claw-admin:replace-with-a-strong-secret http://127.0.0.1:18797/claw/health/live
curl -u claw-admin:replace-with-a-strong-secret http://127.0.0.1:18797/claw/health/ready
curl -u claw-admin:replace-with-a-strong-secret http://127.0.0.1:18797/claw/manage/v1/host-endpoints
docker logs claw-studio-smoke --tail=200
docker stop claw-studio-smoke
```

Expected evidence:

- `/claw/health/live` returns `200`
- `/claw/health/ready` returns success only when the runtime is actually usable
- `/claw/manage/v1/host-endpoints` returns the truthful shared-host projection for the packaged host
- startup logs show one coherent Rust host bootstrap instead of a second hidden runtime path

Current status:

- not executed in this sandbox
- pending manual execution on a real container-capable target

### Docker compose startup

Run from the extracted container bundle root:

```bash
export CLAW_SERVER_MANAGE_USERNAME=claw-admin
export CLAW_SERVER_MANAGE_PASSWORD='replace-with-a-strong-secret'
docker compose -f deploy/docker/docker-compose.yml up -d
docker compose -f deploy/docker/docker-compose.yml ps
docker compose -f deploy/docker/docker-compose.yml logs --tail=200
curl -u claw-admin:replace-with-a-strong-secret http://127.0.0.1:18797/claw/health/ready
curl -u claw-admin:replace-with-a-strong-secret http://127.0.0.1:18797/claw/manage/v1/host-endpoints
docker compose -f deploy/docker/docker-compose.yml down -v
```

Expected evidence:

- compose startup reaches a ready state without any first-boot bundle rewrite
- `/claw/health/ready` reflects runtime truth rather than static route availability
- `/claw/manage/v1/host-endpoints` confirms the shared host surfaces projected by the running bundle
- compose logs and persisted volume behavior prove restart-safe bootstrap

Current status:

- not executed in this sandbox
- pending manual execution on a real docker host

### Singleton-k8s readiness

Run from the extracted kubernetes bundle root:

```bash
helm upgrade --install claw-studio ./chart -f values.release.yaml --set auth.manageUsername=claw-admin --set auth.managePassword='replace-with-a-strong-secret'
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=claw-studio --timeout=180s
kubectl get pods -l app.kubernetes.io/name=claw-studio
kubectl port-forward svc/claw-studio 18797:18797
curl -u claw-admin:replace-with-a-strong-secret http://127.0.0.1:18797/claw/health/ready
curl -u claw-admin:replace-with-a-strong-secret http://127.0.0.1:18797/claw/manage/v1/host-endpoints
helm upgrade --install claw-studio ./chart -f values.release.yaml --set replicaCount=2
helm uninstall claw-studio
```

Expected evidence:

- singleton-k8s readiness gates on `/claw/health/ready`
- the ready pod serves a truthful `/claw/manage/v1/host-endpoints` projection
- `replicaCount=2` is rejected until shared multi-replica coordination exists
- one ready pod is enough to prove the shared Rust host kernel boots consistently outside desktop mode

Current status:

- not executed in this sandbox
- pending manual execution on a real kubernetes cluster

## Evidence Recording Template

When the live runtime smoke is executed outside this sandbox, persist the following for each flow:

- date, operator, and target platform
- bundle or image identifier used
- exact command transcript
- `/claw/health/live` and `/claw/health/ready` HTTP results
- `/claw/manage/v1/host-endpoints` response snapshot or sanitized excerpt
- pass/fail result plus any deviations from the expected bootstrap contract

## Remaining Gap

The repository now enforces the presence of an explicit deployment smoke contract, but real
container and singleton-kubernetes runtime evidence still has to be attached before release
sign-off. That gap is intentional and visible instead of being hidden behind template-only checks.

