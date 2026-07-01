# SdkWork Claw Studio Kubernetes Deployment Templates

Use the extracted bundle root as the working directory.

Base deployment:

```bash
helm upgrade --install sdkwork-clawstudio ./chart \
  -f values.release.yaml \
  --set auth.manageUsername=claw-admin \
  --set auth.managePassword='replace-with-a-strong-secret'
```

NVIDIA CUDA overlay:

```bash
helm upgrade --install sdkwork-clawstudio ./chart -f chart/values-nvidia-cuda.yaml -f values.release.yaml
```

AMD ROCm overlay:

```bash
helm upgrade --install sdkwork-clawstudio ./chart -f chart/values-amd-rocm.yaml -f values.release.yaml
```

The chart already carries its default `chart/values.yaml`. The generated `values.release.yaml`
adds the packaged target architecture, accelerator profile, and the immutable image tag for the
selected release bundle.

Release bundles pin `image.tag` to an architecture-qualified release tag such as
`release-2026-04-04-01-linux-x64`, and the GitHub release workflow also stamps `image.digest`
from the published OCI image so Helm deployments can pull immutably. Override `image.repository`
when you mirror the image to another registry, and keep `image.digest` aligned with the mirrored
artifact.

Production-style installs must provide a Secret-backed control-plane credential set. The bundled
chart can generate that Secret from `auth.manageUsername` and `auth.managePassword`, or you can
point `auth.existingSecret` at a pre-provisioned secret in the target namespace.

The chart also mounts a PersistentVolumeClaim at `/var/lib/claw-server` by default so the
SQLite host-state database survives Pod restarts. Override `persistence.size`,
`persistence.storageClass`, or `persistence.enabled` to match your cluster storage policy.
