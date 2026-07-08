use super::{
    observability, request_context, request_translation,
    response_io::{
        build_buffered_upstream_response, build_json_outcome, parse_json_response,
        ProxyRouteOutcome,
    },
    response_translation, streaming,
    types::{LocalAiProxyAppState, LocalAiProxyTokenUsage, ProxyHttpResult},
    LocalAiProxyRouteSnapshot, ANTHROPIC_VERSION_HEADER, DEFAULT_ANTHROPIC_VERSION,
    LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL, OLLAMA_UPSTREAM_PROTOCOL, X_API_KEY_HEADER,
    X_GOOG_API_KEY_HEADER,
};
use axum::{
    body::Bytes,
    extract::{OriginalUri, State},
    http::{header::CONTENT_TYPE, HeaderMap, HeaderValue, StatusCode},
    response::Response,
    Json,
};
pub(super) use sdkwork_local_api_proxy_native::response::extract_token_usage;
use sdkwork_local_api_proxy_native::streaming::openai_stream_endpoint_for_suffix as resolve_shared_openai_stream_endpoint;
use sdkwork_local_api_proxy_native::support::proxy_error;
use sdkwork_local_api_proxy_native::translation::resolve_request_model_id as resolve_shared_request_model_id;
use sdkwork_local_api_proxy_native::upstream::{
    build_gemini_upstream_request_url, build_ollama_upstream_request_url,
    build_openai_compatible_upstream_request, infer_gemini_default_api_version,
};
use serde_json::{json, Value};
use std::time::Instant;

pub(super) async fn models_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
) -> ProxyHttpResult<Json<Value>> {
    let snapshot = request_context::current_snapshot(&state)?;
    request_context::require_client_auth(&headers, &snapshot.auth_token)?;
    let route = request_context::require_route_for_protocol(
        &snapshot,
        LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
    )?;

    Ok(Json(json!({
        "object": "list",
        "data": route.models.iter().map(|model| json!({
            "id": model.id,
            "object": "model",
            "created": 0,
            "owned_by": route.provider_id,
        })).collect::<Vec<_>>(),
    })))
}

pub(super) async fn chat_completions_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    openai_compatible_passthrough_handler(state, headers, original_uri, body, "chat/completions")
        .await
}

pub(super) async fn openai_responses_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    openai_compatible_passthrough_handler(state, headers, original_uri, body, "responses").await
}

pub(super) async fn openai_embeddings_handler(
    State(state): State<LocalAiProxyAppState>,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    openai_compatible_passthrough_handler(state, headers, original_uri, body, "embeddings").await
}

async fn openai_compatible_passthrough_handler(
    state: LocalAiProxyAppState,
    headers: HeaderMap,
    original_uri: OriginalUri,
    body: Bytes,
    endpoint_suffix: &str,
) -> ProxyHttpResult<Response> {
    let snapshot = request_context::current_snapshot(&state)?;
    request_context::require_client_auth(&headers, &snapshot.auth_token)?;
    let route = request_context::require_route_for_protocol(
        &snapshot,
        LOCAL_AI_PROXY_DEFAULT_CLIENT_PROTOCOL,
    )?;

    match route.upstream_protocol.as_str() {
        "anthropic" => {
            return anthropic_openai_compatible_handler(state, route, endpoint_suffix, body).await
        }
        "gemini" => {
            return gemini_openai_compatible_handler(state, route, endpoint_suffix, body).await
        }
        OLLAMA_UPSTREAM_PROTOCOL => {
            return ollama_openai_compatible_handler(state, route, endpoint_suffix, body).await
        }
        _ => {}
    }

    let payload = request_context::parse_json_body(&body)?;
    let streaming = streaming::is_openai_stream_request(&payload);
    let started_at = Instant::now();
    let audit_context =
        observability::build_request_audit_context(route, &format!("/v1/{endpoint_suffix}"), &body);
    let result = async {
        let response = build_openai_compatible_upstream_request(
            &state.client,
            route,
            endpoint_suffix,
            original_uri.0.query(),
            body,
        )?
        .send()
        .await
        .map_err(|error| {
            proxy_error(
                StatusCode::BAD_GATEWAY,
                &format!("Local AI proxy upstream request failed: {error}"),
            )
        })?;

        if streaming && response.status().is_success() {
            let status = response.status();
            let observability_repo = state.observability_repo.clone();
            let request_audit_context = audit_context.clone();
            let request_started_at = started_at;
            return Ok(ProxyRouteOutcome {
                response: streaming::build_passthrough_response(
                    response,
                    started_at,
                    move |ttft_ms, response_text| {
                        observability::record_completed_stream_request_log(
                            &observability_repo,
                            request_audit_context,
                            status,
                            request_started_at,
                            LocalAiProxyTokenUsage::default(),
                            ttft_ms,
                            response_text,
                        );
                    },
                )
                .await?,
                status,
                usage: LocalAiProxyTokenUsage::default(),
                error: None,
                response_preview: None,
                response_body: None,
            });
        }

        build_buffered_upstream_response(response).await
    }
    .await;

    observability::record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    observability::record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

async fn ollama_openai_compatible_handler(
    state: LocalAiProxyAppState,
    route: &LocalAiProxyRouteSnapshot,
    endpoint_suffix: &str,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    let stream_endpoint = resolve_shared_openai_stream_endpoint(endpoint_suffix).ok();
    let started_at = Instant::now();
    let audit_context =
        observability::build_request_audit_context(route, &format!("/v1/{endpoint_suffix}"), &body);
    let result = match endpoint_suffix {
        "chat/completions" => {
            let payload = request_context::parse_json_body(&body)?;
            let streaming = streaming::is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body =
                request_translation::build_ollama_request_from_openai_chat(route, &payload)?;
            let response = state
                .client
                .post(build_ollama_upstream_request_url(route, "/api/chat"))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at;
                Ok(ProxyRouteOutcome {
                    response: streaming::build_translated_openai_jsonl_response(
                        status,
                        response,
                        streaming::OpenAiTranslatedStreamState::new(
                            stream_endpoint
                                .unwrap_or(streaming::OpenAiStreamEndpoint::ChatCompletions),
                            requested_model_id,
                            "chatcmpl-local-proxy",
                        ),
                        streaming::handle_ollama_openai_stream_frame,
                        started_at,
                        move |usage, ttft_ms, response_text| {
                            observability::record_proxy_route_usage_adjustment(
                                &observability,
                                &route_id,
                                &usage,
                            );
                            observability::record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    response_translation::build_openai_chat_completion_from_ollama(
                        route.default_model_id.as_str(),
                        &upstream_body,
                    ),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "responses" => {
            let payload = request_context::parse_json_body(&body)?;
            let streaming = streaming::is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body =
                request_translation::build_ollama_request_from_openai_response(route, &payload)?;
            let response = state
                .client
                .post(build_ollama_upstream_request_url(route, "/api/chat"))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at;
                Ok(ProxyRouteOutcome {
                    response: streaming::build_translated_openai_jsonl_response(
                        status,
                        response,
                        streaming::OpenAiTranslatedStreamState::new(
                            stream_endpoint.unwrap_or(streaming::OpenAiStreamEndpoint::Responses),
                            requested_model_id,
                            "resp-local-proxy",
                        ),
                        streaming::handle_ollama_openai_stream_frame,
                        started_at,
                        move |usage, ttft_ms, response_text| {
                            observability::record_proxy_route_usage_adjustment(
                                &observability,
                                &route_id,
                                &usage,
                            );
                            observability::record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    response_translation::build_openai_response_from_ollama(
                        route.default_model_id.as_str(),
                        &upstream_body,
                    ),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "embeddings" => {
            let payload = request_context::parse_json_body(&body)?;
            let request_body =
                request_translation::build_ollama_request_from_openai_embeddings(route, &payload)?;
            let response = state
                .client
                .post(build_ollama_upstream_request_url(route, "/api/embed"))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    response_translation::build_openai_embeddings_from_ollama(&upstream_body),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        _ => Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            &format!("Unsupported OpenAI-compatible endpoint: {endpoint_suffix}"),
        )),
    };

    observability::record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    observability::record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

async fn anthropic_openai_compatible_handler(
    state: LocalAiProxyAppState,
    route: &LocalAiProxyRouteSnapshot,
    endpoint_suffix: &str,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    let stream_endpoint = resolve_shared_openai_stream_endpoint(endpoint_suffix).ok();
    let started_at = Instant::now();
    let audit_context =
        observability::build_request_audit_context(route, &format!("/v1/{endpoint_suffix}"), &body);
    let result = match endpoint_suffix {
        "chat/completions" => {
            let payload = request_context::parse_json_body(&body)?;
            let streaming = streaming::is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body =
                request_translation::build_anthropic_request_from_openai_chat(route, &payload)?;
            let response = state
                .client
                .post(format!(
                    "{}/messages",
                    route.upstream_base_url.trim_end_matches('/')
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_API_KEY_HEADER, route.api_key.trim())
                .header(ANTHROPIC_VERSION_HEADER, DEFAULT_ANTHROPIC_VERSION)
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at;
                Ok(ProxyRouteOutcome {
                    response: streaming::build_translated_openai_sse_response(
                        status,
                        response,
                        streaming::OpenAiTranslatedStreamState::new(
                            stream_endpoint
                                .unwrap_or(streaming::OpenAiStreamEndpoint::ChatCompletions),
                            requested_model_id,
                            "chatcmpl-local-proxy",
                        ),
                        streaming::handle_anthropic_openai_stream_frame,
                        started_at,
                        move |usage, ttft_ms, response_text| {
                            observability::record_proxy_route_usage_adjustment(
                                &observability,
                                &route_id,
                                &usage,
                            );
                            observability::record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    response_translation::build_openai_chat_completion_from_anthropic(
                        route.default_model_id.as_str(),
                        &upstream_body,
                    ),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "responses" => {
            let payload = request_context::parse_json_body(&body)?;
            let streaming = streaming::is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body =
                request_translation::build_anthropic_request_from_openai_response(route, &payload)?;
            let response = state
                .client
                .post(format!(
                    "{}/messages",
                    route.upstream_base_url.trim_end_matches('/')
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_API_KEY_HEADER, route.api_key.trim())
                .header(ANTHROPIC_VERSION_HEADER, DEFAULT_ANTHROPIC_VERSION)
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at;
                Ok(ProxyRouteOutcome {
                    response: streaming::build_translated_openai_sse_response(
                        status,
                        response,
                        streaming::OpenAiTranslatedStreamState::new(
                            stream_endpoint.unwrap_or(streaming::OpenAiStreamEndpoint::Responses),
                            requested_model_id,
                            "resp-local-proxy",
                        ),
                        streaming::handle_anthropic_openai_stream_frame,
                        started_at,
                        move |usage, ttft_ms, response_text| {
                            observability::record_proxy_route_usage_adjustment(
                                &observability,
                                &route_id,
                                &usage,
                            );
                            observability::record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    response_translation::build_openai_response_from_anthropic(
                        route.default_model_id.as_str(),
                        &upstream_body,
                    ),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "embeddings" => Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            "Anthropic routes do not expose an embeddings adapter through the local AI proxy.",
        )),
        _ => Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            &format!("Unsupported OpenAI-compatible endpoint: {endpoint_suffix}"),
        )),
    };

    observability::record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    observability::record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

async fn gemini_openai_compatible_handler(
    state: LocalAiProxyAppState,
    route: &LocalAiProxyRouteSnapshot,
    endpoint_suffix: &str,
    body: Bytes,
) -> ProxyHttpResult<Response> {
    let stream_endpoint = resolve_shared_openai_stream_endpoint(endpoint_suffix).ok();
    let started_at = Instant::now();
    let audit_context =
        observability::build_request_audit_context(route, &format!("/v1/{endpoint_suffix}"), &body);
    let result = match endpoint_suffix {
        "chat/completions" => {
            let payload = request_context::parse_json_body(&body)?;
            let streaming = streaming::is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body =
                request_translation::build_gemini_request_from_openai_chat(route, &payload)?;
            let api_version = infer_gemini_default_api_version(&route.upstream_base_url);
            let response = state
                .client
                .post(build_gemini_upstream_request_url(
                    route,
                    api_version,
                    &format!(
                        "{}:{}",
                        requested_model_id,
                        if streaming {
                            "streamGenerateContent"
                        } else {
                            "generateContent"
                        }
                    ),
                    streaming.then_some("alt=sse"),
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_GOOG_API_KEY_HEADER, route.api_key.trim())
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at;
                Ok(ProxyRouteOutcome {
                    response: streaming::build_translated_openai_sse_response(
                        status,
                        response,
                        streaming::OpenAiTranslatedStreamState::new(
                            stream_endpoint
                                .unwrap_or(streaming::OpenAiStreamEndpoint::ChatCompletions),
                            requested_model_id,
                            "chatcmpl-local-proxy",
                        ),
                        streaming::handle_gemini_openai_stream_frame,
                        started_at,
                        move |usage, ttft_ms, response_text| {
                            observability::record_proxy_route_usage_adjustment(
                                &observability,
                                &route_id,
                                &usage,
                            );
                            observability::record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    response_translation::build_openai_chat_completion_from_gemini(
                        route.default_model_id.as_str(),
                        &upstream_body,
                    ),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "responses" => {
            let payload = request_context::parse_json_body(&body)?;
            let streaming = streaming::is_openai_stream_request(&payload);
            let requested_model_id = resolve_request_model_id(route, &payload)?;
            let request_body =
                request_translation::build_gemini_request_from_openai_response(route, &payload)?;
            let api_version = infer_gemini_default_api_version(&route.upstream_base_url);
            let response = state
                .client
                .post(build_gemini_upstream_request_url(
                    route,
                    api_version,
                    &format!(
                        "{}:{}",
                        requested_model_id,
                        if streaming {
                            "streamGenerateContent"
                        } else {
                            "generateContent"
                        }
                    ),
                    streaming.then_some("alt=sse"),
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_GOOG_API_KEY_HEADER, route.api_key.trim())
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else if streaming {
                let status = response.status();
                let observability = state.observability.clone();
                let observability_repo = state.observability_repo.clone();
                let route_id = route.id.clone();
                let request_audit_context = audit_context.clone();
                let request_started_at = started_at;
                Ok(ProxyRouteOutcome {
                    response: streaming::build_translated_openai_sse_response(
                        status,
                        response,
                        streaming::OpenAiTranslatedStreamState::new(
                            stream_endpoint.unwrap_or(streaming::OpenAiStreamEndpoint::Responses),
                            requested_model_id,
                            "resp-local-proxy",
                        ),
                        streaming::handle_gemini_openai_stream_frame,
                        started_at,
                        move |usage, ttft_ms, response_text| {
                            observability::record_proxy_route_usage_adjustment(
                                &observability,
                                &route_id,
                                &usage,
                            );
                            observability::record_completed_stream_request_log(
                                &observability_repo,
                                request_audit_context,
                                status,
                                request_started_at,
                                usage,
                                ttft_ms,
                                response_text,
                            );
                        },
                    )
                    .await?,
                    status,
                    usage: LocalAiProxyTokenUsage::default(),
                    error: None,
                    response_preview: None,
                    response_body: None,
                })
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    response_translation::build_openai_response_from_gemini(
                        route.default_model_id.as_str(),
                        &upstream_body,
                    ),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        "embeddings" => {
            let payload = request_context::parse_json_body(&body)?;
            let model_id = resolve_request_model_id(route, &payload)?;
            let request_body =
                request_translation::build_gemini_request_from_openai_embeddings(&payload)?;
            let api_version = infer_gemini_default_api_version(&route.upstream_base_url);
            let response = state
                .client
                .post(build_gemini_upstream_request_url(
                    route,
                    api_version,
                    &format!("{model_id}:embedContent"),
                    None,
                ))
                .header(CONTENT_TYPE, HeaderValue::from_static("application/json"))
                .header(X_GOOG_API_KEY_HEADER, route.api_key.trim())
                .body(request_body.to_string())
                .send()
                .await
                .map_err(|error| {
                    proxy_error(
                        StatusCode::BAD_GATEWAY,
                        &format!("Local AI proxy upstream request failed: {error}"),
                    )
                })?;

            if !response.status().is_success() {
                build_buffered_upstream_response(response).await
            } else {
                let status = response.status();
                let upstream_body = parse_json_response(response).await?;
                build_json_outcome(
                    status,
                    response_translation::build_openai_embeddings_from_gemini(&upstream_body),
                    extract_token_usage(&upstream_body),
                )
            }
        }
        _ => Err(proxy_error(
            StatusCode::NOT_IMPLEMENTED,
            &format!("Unsupported OpenAI-compatible endpoint: {endpoint_suffix}"),
        )),
    };

    observability::record_proxy_route_outcome(&state, route, started_at.elapsed(), &result);
    observability::record_proxy_request_log(&state, &audit_context, started_at.elapsed(), &result);
    result.map(|outcome| outcome.response)
}

pub(super) fn resolve_request_model_id(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<String> {
    resolve_shared_request_model_id(payload, Some(route.default_model_id.as_str())).map_err(|_| {
        proxy_error(
            StatusCode::BAD_REQUEST,
            "OpenAI-compatible request must specify a non-empty model id.",
        )
    })
}
