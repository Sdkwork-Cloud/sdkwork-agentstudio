# API Reference Overview

## Scope

This page is the entry point for the HTTP APIs currently published by the built-in Claw host.

The host now exposes one unified external base URL and splits ownership into three explicit route namespaces:

- native platform APIs under `/claw/*`
- root-native local AI compatibility routes at `/health`, `/v1/*`, and `/v1beta/*`
- governed OpenClaw gateway proxy routes under `/claw/gateway/openclaw/*`

Static assets, `/`, and `/sdkwork-agentstudio-pc-bootstrap.json` are still host surfaces, but they are not OpenAPI-managed APIs.

## Unified Host Route Taxonomy

| Surface | Base Path | Purpose |
| --- | --- | --- |
| Native platform | `/claw/*` | platform-owned health, public API, OpenAPI, internal, and manage routes |
| Local AI compatibility | `/health`, `/v1/*`, `/v1beta/*` | provider-compatible local proxy routes on the same host port |
| OpenClaw gateway proxy | `/claw/gateway/openclaw/*` | governed proxy routes for the managed OpenClaw gateway |

Rules:

- `/claw/*` stays reserved for platform-native APIs.
- `local-ai-proxy` keeps exact root-native compatibility paths. There is no `/claw/gateway/local-ai/*` alias.
- OpenClaw proxy routes stay governed under `/claw/gateway/openclaw/*` and do not claim `/v1/*`.
- Every OpenAPI document is generated from the live mounted route set, so optional route families only appear when their runtime surface is active.

## How To Resolve The Base URL

The same host contract is used in more than one shell, but the unified HTTP API only exists when a Rust host is present.

| Mode | Unified Host Access | Base URL |
| --- | --- | --- |
| Web workspace | preview-only bridge or mock bridge | not a published built-in host |
| Desktop runtime | embedded loopback host | resolve from runtime `browserBaseUrl`, typically `http://127.0.0.1:<dynamic-port>` |
| Native server | same-origin host | `http://<host>:<port>` |
| Container | same-origin host through the exposed container port | `http://<host>:<port>` or ingress URL |
| Kubernetes | same-origin host through service or ingress | `https://<domain>` or service URL |

For packaged server bundles, the default local address remains `http://127.0.0.1:18797` unless `CLAW_SERVER_HOST` or `CLAW_SERVER_PORT` is overridden.

## Discovery And OpenAPI Documents

The built-in host publishes one discovery surface for public native metadata and one discovery surface for live OpenAPI documents.

| Endpoint | Purpose |
| --- | --- |
| `GET /claw/api/v1/discovery` | public native discovery for browser bootstrap and future SDK consumers |
| `GET /claw/openapi/discovery` | live OpenAPI document discovery |
| `GET /claw/openapi/v1.json` | native platform OpenAPI 3.1 document |
| `GET /claw/openapi/local-ai-compat-v1.json` | local AI compatibility OpenAPI 3.1 document, only when the local AI proxy is active |
| `GET /claw/openapi/openclaw-gateway-v1.json` | OpenClaw gateway proxy OpenAPI 3.1 document, only when the managed gateway HTTP surface is active |

`GET /claw/openapi/discovery` returns:

- `family`
- `hostMode`
- `generatedAt`
- `documents[]`

Each `documents[]` entry currently exposes:

- `id`
- `title`
- `version`
- `format`
- `url`
- `apiFamilies`
- `proxyTarget`
- `runtimeCapability`
- `generatedAt`

## Current Endpoint Matrix

### Native Platform

#### Health

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/health/live` | liveness probe |
| `GET` | `/claw/health/ready` | readiness probe |

#### Public API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/api/v1/discovery` | native public discovery and bootstrap metadata |
| `GET` | `/claw/api/v1/studio/instances` | list canonical studio instances |
| `POST` | `/claw/api/v1/studio/instances` | create one studio instance |
| `GET` | `/claw/api/v1/studio/instances/{id}` | read one studio instance |
| `PUT` | `/claw/api/v1/studio/instances/{id}` | update one studio instance |
| `DELETE` | `/claw/api/v1/studio/instances/{id}` | delete one studio instance |
| `POST` | `/claw/api/v1/studio/instances/{id}:start` | start one studio instance |
| `POST` | `/claw/api/v1/studio/instances/{id}:stop` | stop one studio instance |
| `POST` | `/claw/api/v1/studio/instances/{id}:restart` | restart one studio instance |
| `GET` | `/claw/api/v1/studio/instances/{id}/detail` | read rich instance detail |
| `GET` | `/claw/api/v1/studio/instances/{id}/config` | read instance config |
| `PUT` | `/claw/api/v1/studio/instances/{id}/config` | update instance config |
| `GET` | `/claw/api/v1/studio/instances/{id}/logs` | read instance log projection |
| `GET` | `/claw/api/v1/studio/instances/{id}/conversations` | list instance conversations |
| `PUT` | `/claw/api/v1/studio/conversations/{conversationId}` | upsert one conversation |
| `DELETE` | `/claw/api/v1/studio/conversations/{conversationId}` | delete one conversation |

#### OpenAPI

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/openapi/discovery` | discover live OpenAPI documents |
| `GET` | `/claw/openapi/v1.json` | download the native platform OpenAPI 3.1 document |
| `GET` | `/claw/openapi/local-ai-compat-v1.json` | download the local AI compatibility document when active |
| `GET` | `/claw/openapi/openclaw-gateway-v1.json` | download the OpenClaw gateway proxy document when active |

#### Internal

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/internal/v1/host-platform` | read host platform status, capabilities, and state-store projection |
| `GET` | `/claw/internal/v1/node-sessions` | list merged live and projected node sessions |
| `POST` | `/claw/internal/v1/node-sessions:hello` | register a node runtime and receive a lease proposal |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:admit` | admit a hello-created session |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:heartbeat` | refresh a live lease and receive posture hints |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:pull-desired-state` | fetch current desired state for one node runtime |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:ack-desired-state` | record apply or reject results for a desired-state revision |
| `POST` | `/claw/internal/v1/node-sessions/{sessionId}:close` | gracefully close a live session |

#### Manage

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/claw/manage/v1/rollouts` | list rollout records |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}` | read one rollout record |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/targets` | read the preview-derived target list |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/targets/{nodeId}` | read one preview-derived rollout target |
| `GET` | `/claw/manage/v1/rollouts/{rolloutId}/waves` | read preview-derived rollout wave summaries |
| `POST` | `/claw/manage/v1/rollouts/{rolloutId}:preview` | compute or refresh rollout preview |
| `POST` | `/claw/manage/v1/rollouts/{rolloutId}:start` | start a rollout after preview succeeds |
| `GET` | `/claw/manage/v1/host-endpoints` | list canonical host endpoint records |
| `GET` | `/claw/manage/v1/openclaw/runtime` | read managed OpenClaw runtime projection |
| `GET` | `/claw/manage/v1/openclaw/gateway` | read managed OpenClaw gateway projection |
| `POST` | `/claw/manage/v1/openclaw/gateway/invoke` | invoke the managed OpenClaw gateway through the control plane |
| `GET` | `/claw/manage/v1/service` | read native service status projection, `server` mode only |
| `POST` | `/claw/manage/v1/service:install` | install native service, `server` mode only |
| `POST` | `/claw/manage/v1/service:start` | start native service, `server` mode only |
| `POST` | `/claw/manage/v1/service:stop` | stop native service, `server` mode only |
| `POST` | `/claw/manage/v1/service:restart` | restart native service, `server` mode only |

Important mode note:

- `desktopCombined` publishes the same native `api`, `openapi`, `internal`, and non-service `manage` flows through its embedded loopback host.
- `/claw/manage/v1/service*` remains server-only.

### Local AI Compatibility

These routes are mounted on the same host port only when `local-ai-proxy` is active.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | root health probe for compatibility clients |
| `GET` | `/v1/health` | OpenAI-style health probe |
| `GET` | `/v1/models` | list compatible models |
| `POST` | `/v1/chat/completions` | OpenAI-compatible chat completions |
| `POST` | `/v1/responses` | OpenAI-compatible responses |
| `POST` | `/v1/embeddings` | OpenAI-compatible embeddings |
| `POST` | `/v1/messages` | Anthropic-compatible messages |
| `GET` | `/v1beta/models` | Gemini-compatible model discovery |
| `POST` | `/v1beta/models/{modelAction}` | Gemini-compatible model action |
| `POST` | `/v1/models/{modelAction}` | Gemini-compatible model action under `/v1/models/*` |

Compatibility notes:

- callers only need to change `baseURL` and `apiKey`
- there is no extra host prefix in front of these routes
- the host preserves method, body, query string, content type, and forwarded request headers needed by the upstream surface

### Governed OpenClaw Gateway Proxy

These routes are mounted on the same host port only when the managed OpenClaw gateway HTTP surface is active.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/claw/gateway/openclaw/tools/invoke` | invoke the governed OpenClaw gateway proxy route |

Governance notes:

- this surface is separate from the manage control-plane route `POST /claw/manage/v1/openclaw/gateway/invoke`
- the host strips the external governed prefix before proxying upstream
- root-native provider-compatible routes remain reserved for `local-ai-proxy`

## Authentication And Proxy Behavior

Authentication is optional for the native control-plane routes and based on HTTP basic auth.

| Surface | Default | Optional Credentials |
| --- | --- | --- |
| Browser shell | open | `CLAW_SERVER_MANAGE_USERNAME` and `CLAW_SERVER_MANAGE_PASSWORD` |
| `/claw/manage/v1/*` | open | `CLAW_SERVER_MANAGE_USERNAME` and `CLAW_SERVER_MANAGE_PASSWORD` |
| `/claw/internal/v1/*` | open | `CLAW_SERVER_INTERNAL_USERNAME` and `CLAW_SERVER_INTERNAL_PASSWORD` |

Important behavior:

- when internal credentials are omitted, the internal surface falls back to the manage credentials
- when manage credentials are configured, browser shell routes and static assets share the same basic-auth challenge as `/claw/manage/v1/*`
- local AI compatibility routes preserve provider-facing auth headers so upstream-compatible clients can keep their normal request shape
- governed OpenClaw gateway proxy routes use host-governed upstream credentials instead of forwarding a caller-provided bearer token to the managed gateway

## Quick Examples

Set a local base URL first:

```bash
export CLAW_BASE_URL=http://127.0.0.1:18797
```

Readiness probe:

```bash
curl -i "$CLAW_BASE_URL/claw/health/ready"
```

OpenAPI discovery:

```bash
curl "$CLAW_BASE_URL/claw/openapi/discovery"
```

Local AI model discovery on the same host port:

```bash
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  "$CLAW_BASE_URL/v1/models"
```

Governed OpenClaw gateway invocation on the same host port:

```bash
curl -H "Content-Type: application/json" \
  -X POST \
  -d '{"tool":"ping"}' \
  "$CLAW_BASE_URL/claw/gateway/openclaw/tools/invoke"
```

## Example Payloads

Public native discovery example:

```json
{
  "family": "api",
  "version": "v1",
  "basePath": "/claw/api/v1",
  "hostMode": "server",
  "hostVersion": "0.1.0",
  "openapiDocumentUrl": "/claw/openapi/v1.json",
  "healthLiveUrl": "/claw/health/live",
  "healthReadyUrl": "/claw/health/ready",
  "capabilityKeys": ["api.discovery.read"],
  "generatedAt": 1743600000000
}
```

OpenAPI discovery example:

```json
{
  "family": "openapi",
  "hostMode": "server",
  "generatedAt": 1743600000000,
  "documents": [
    {
      "id": "claw-native-v1",
      "title": "Claw Native Platform API",
      "version": "v1",
      "format": "openapi+json",
      "url": "/claw/openapi/v1.json",
      "apiFamilies": ["health", "api", "internal", "manage"],
      "proxyTarget": "native-host",
      "runtimeCapability": "always",
      "generatedAt": 1743600000000
    }
  ]
}
```

Error envelope example:

```json
{
  "error": {
    "code": "rollout_not_found",
    "category": "state",
    "message": "The requested rollout was not found.",
    "httpStatus": 404,
    "retryable": false,
    "resolution": "fix_request",
    "correlationId": "claw-1234567890"
  }
}
```

Treat the `x-claw-correlation-id` response header as the primary request trace id for logs, browser diagnostics, and operator support workflows.

## OpenAPI Ownership Boundary

The built-in host now publishes multiple live OpenAPI documents:

- `claw-native-v1` for `/claw/*` platform APIs
- `local-ai-compat-v1` for root-native compatibility paths
- `openclaw-gateway-v1` for `/claw/gateway/openclaw/*`

Boundary rules:

- no published path appears in more than one live document
- optional documents are advertised only when their runtime surface is active
- all published documents use `openapi: 3.1.0`
- generated schema files are runtime artifacts, not committed source files

For runtime schema snapshots and startup catalog output, see [Claw Server Runtime](/reference/agentstudio-server-runtime).

## Related Documents

- [Claw Server Runtime](/reference/agentstudio-server-runtime)
- [Claw Rollout API](/reference/claw-rollout-api)
- [Commands](/reference/commands)
- [Environment](/reference/environment)
