# Claw Studio Container Deployment Templates

This directory is the source tree template location. In the source repository, review and diff:

- `deploy/docker/docker-compose.yml`
- `deploy/docker/docker-compose.nvidia-cuda.yml`
- `deploy/docker/docker-compose.amd-rocm.yml`
- `deploy/docker/Dockerfile`
- `deploy/docker/profiles/*`

Those source tree paths are packaging inputs, not the final runnable release layout. Render the
packaged bundle layout locally with `pnpm release:package:container`, then switch to the extracted
bundle root for real deployment commands.

Inside the extracted bundle root, the same templates are materialized as:

- `deploy/docker/docker-compose.yml`
- `deploy/docker/docker-compose.nvidia-cuda.yml`
- `deploy/docker/docker-compose.amd-rocm.yml`
- `deploy/docker/Dockerfile`
- `deploy/docker/profiles/*`

The packaged `deploy/docker/docker-compose*.yml` files resolve env overlays relative to `deploy/docker/` and use
the extracted bundle root as the Docker build context for `app/`.

Local packaging prerequisite:

- `pnpm release:package:container` refreshes a matching Linux server binary through an incremental build when you use the root local wrapper. On Windows, that build can automatically bridge through WSL when a Linux distro is installed. On other non-Linux hosts, you still need the corresponding Rust target and cross-build toolchain if the target binary cannot be produced locally.

Base deployment from the extracted bundle root:

```bash
export CLAW_SERVER_MANAGE_USERNAME=claw-admin
export CLAW_SERVER_MANAGE_PASSWORD='replace-with-a-strong-secret'
docker compose -f deploy/docker/docker-compose.yml up -d
```

Canonical user-center server integration modes:

- `builtin-local`: private deployment with the Claw Studio server owning its local user-center data.
- `sdkwork-cloud-app-api`: shared cloud identity backed by `sdkwork-cloud-app-api`.
- `external-user-center`: third-party identity authority with the same token and handshake contract.

Container entrypoint variables:

- `CLAW_STUDIO_USER_CENTER_MODE`: one of `builtin-local`, `sdkwork-cloud-app-api`, or `external-user-center`.
- `CLAW_STUDIO_USER_CENTER_APP_API_BASE_URL`: required when `CLAW_STUDIO_USER_CENTER_MODE=sdkwork-cloud-app-api`.
- `CLAW_STUDIO_USER_CENTER_EXTERNAL_BASE_URL`: required when `CLAW_STUDIO_USER_CENTER_MODE=external-user-center`.
- `CLAW_STUDIO_USER_CENTER_SECRET_ID`: required for upstream shared-secret handshakes.
- `CLAW_STUDIO_USER_CENTER_SHARED_SECRET`: required for upstream shared-secret handshakes.

NVIDIA CUDA overlay:

```bash
docker compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.nvidia-cuda.yml up -d
```

AMD ROCm overlay from the extracted bundle root:

```bash
docker compose -f deploy/docker/docker-compose.yml -f deploy/docker/docker-compose.amd-rocm.yml up -d
```

The server binary is identical across CPU and GPU-oriented bundles. GPU variants package
deployment overlays and environment presets so operators can keep one release flow while
switching runtime topology.

The packaged Docker image starts `/opt/claw/app/bin/claw-server` directly. The optional
`app/start-claw-server.sh` wrapper remains in the bundle for operator convenience outside the
container entrypoint path, but container startup does not route through it.

The base deployment template intentionally requires `CLAW_SERVER_MANAGE_USERNAME` and
`CLAW_SERVER_MANAGE_PASSWORD` before Docker Compose will start the public control plane.
If you do not provide dedicated internal credentials, the Rust server falls back to the
manage credential pair for `/claw/internal/v1/*`.

The bundled env overlays keep `CLAW_SERVER_ALLOW_INSECURE_PUBLIC_BIND=false` and mount
`/var/lib/claw-server` for persistent state, so container restarts do not silently drop the
SQLite host-state database.
