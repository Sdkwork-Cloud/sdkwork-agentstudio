# apis/ — Authored OpenAPI Contract Sources

This directory holds the **authored** OpenAPI 3.1.2 contract sources for the
SdkWork Agent Studio server, organized per `API_SPEC.md` §2 (Contract Source
Layout).

## Purpose

- Single source of truth for the public, control-plane, internal, and
  vendor-compatibility HTTP surfaces owned by the built-in host.
- Consumed by SDK generators, contract tests, and reviewers as the canonical
  description of each surface's operations, schemas, and wire protocol.
- Complements — but does **not** replace — the runtime OpenAPI document served
  by the server at `/claw/openapi/v1.json` (and its sibling discovery URLs).

## Relationship to the runtime OpenAPI document

The Rust server (`sdkwork-agentstudio-pc-server`) ships a runtime generator at
`apps/sdkwork-agentstudio-pc/packages/sdkwork-agentstudio-pc-server/src-host/src/http/routes/openapi.rs`
that emits a dynamic `openapi: 3.1.2` document from live `ServerState`. The
runtime document reflects host-version metadata, capability gating (for example
the manage service API is conditionally removed), and proxy availability for
vendor-compatibility routes.

The authored YAML in this directory is the **stable contract** that:

- Declares the intended operation set, parameters, request bodies, response
  envelopes, and schema shapes independent of runtime state.
- Must stay in sync with the runtime generator: when a route, schema, or
  envelope changes in `openapi.rs`, the matching `openapi.yaml` here must be
  updated in the same change.
- Is the authority for SDK generation (`--standard-profile sdkwork-v3`) and
  contract verification gates such as
  `check-api-operation-patterns.mjs` and `check-api-response-envelope.mjs`.

When the runtime document and this authored contract disagree on a wire shape,
**this authored contract wins** for SDK and consumer purposes; the runtime
generator must then be reconciled.

## Surface layout

| Surface | Path | Auth mode | Wire protocol |
| --- | --- | --- | --- |
| `app-api/studio` | `/claw/api/v1/...` | `anonymous` | `sdkwork-v3` (default) |
| `backend-api/manage` | `/claw/manage/v1/...` | `dual-token` | `sdkwork-v3` (default) |
| `internal-api/host-coordination` | `/claw/internal/v1/...` | `dual-token` | `sdkwork-v3` (default) |
| `open-api/openclaw-gateway` | `/claw/gateway/openclaw/...` | route-defined | `external` |
| `open-api/local-ai-compat` | `/v1/*`, `/v1beta/*`, `/anthropic/v1/*`, `/health` | route-defined | `external` |

## Wire protocol tagging (API_SPEC.md §4.5)

- **SDKWork-owned surfaces** (`app-api`, `backend-api`, `internal-api`) omit
  `x-sdkwork-wire-protocol` (equivalent to `sdkwork-v3`). Their success
  responses use the `SdkWorkApiResponse` envelope and errors use
  `application/problem+json` with `SdkWorkProblemDetail`.
- **Vendor-compatibility surfaces** (`open-api/openclaw-gateway`,
  `open-api/local-ai-compat`) declare `x-sdkwork-wire-protocol: external` and a
  stable `x-sdkwork-external-protocol-id` on **every** operation. They proxy
  upstream provider wire (OpenAI, Anthropic, Google, OpenClaw) and therefore use
  opaque `object` request/response schemas without the SDKWork envelope.

## Shared schemas

`apis/schemas/sdkwork-common.yaml` defines the shared `SdkWorkApiResponse` and
`SdkWorkProblemDetail` schemas. Each SDKWork-owned surface references them via:

```yaml
$ref: ../../schemas/sdkwork-common.yaml#/components/schemas/SdkWorkApiResponse
```

Surface-specific schemas live in each surface's own `components.schemas`.

## Auth modes (API_SPEC.md §3)

- `anonymous` — public bootstrap API surface (`app-api/studio`).
- `dual-token` — control-plane surfaces that accept either the manage or the
  internal token (`backend-api/manage`, `internal-api/host-coordination`).

## Verification

Before completing API contract or SDK generation work, run from the workspace
root:

```bash
node <sdkwork-specs>/tools/check-api-operation-patterns.mjs --workspace <workspace-root>
node <sdkwork-specs>/tools/check-api-response-envelope.mjs --workspace <workspace-root>
```
