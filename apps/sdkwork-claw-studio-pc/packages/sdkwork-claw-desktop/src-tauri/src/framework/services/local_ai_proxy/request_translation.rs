use super::{
    openai_compatible::resolve_request_model_id, types::ProxyHttpResult, LocalAiProxyRouteSnapshot,
};
use axum::http::StatusCode;
use sdkwork_local_api_proxy_native::support::proxy_error;
use sdkwork_local_api_proxy_native::translation::{
    build_anthropic_request_from_openai_chat as build_shared_anthropic_request_from_openai_chat,
    build_anthropic_request_from_openai_response as build_shared_anthropic_request_from_openai_response,
    build_gemini_request_from_openai_chat as build_shared_gemini_request_from_openai_chat,
    build_gemini_request_from_openai_embeddings as build_shared_gemini_request_from_openai_embeddings,
    build_gemini_request_from_openai_response as build_shared_gemini_request_from_openai_response,
    build_ollama_request_from_openai_chat as build_shared_ollama_request_from_openai_chat,
    build_ollama_request_from_openai_embeddings as build_shared_ollama_request_from_openai_embeddings,
    build_ollama_request_from_openai_response as build_shared_ollama_request_from_openai_response,
};
use serde_json::Value;

pub(super) fn build_anthropic_request_from_openai_chat(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    build_shared_anthropic_request_from_openai_chat(&model_id, payload)
        .map_err(|error| proxy_error(StatusCode::BAD_REQUEST, &error.to_string()))
}

pub(super) fn build_anthropic_request_from_openai_response(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    build_shared_anthropic_request_from_openai_response(&model_id, payload)
        .map_err(|error| proxy_error(StatusCode::BAD_REQUEST, &error.to_string()))
}

pub(super) fn build_gemini_request_from_openai_chat(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let _ = resolve_request_model_id(route, payload)?;
    build_shared_gemini_request_from_openai_chat(payload)
        .map_err(|error| proxy_error(StatusCode::BAD_REQUEST, &error.to_string()))
}

pub(super) fn build_gemini_request_from_openai_response(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let _ = resolve_request_model_id(route, payload)?;
    build_shared_gemini_request_from_openai_response(payload)
        .map_err(|error| proxy_error(StatusCode::BAD_REQUEST, &error.to_string()))
}

pub(super) fn build_gemini_request_from_openai_embeddings(
    payload: &Value,
) -> ProxyHttpResult<Value> {
    build_shared_gemini_request_from_openai_embeddings(payload)
        .map_err(|error| proxy_error(StatusCode::BAD_REQUEST, &error.to_string()))
}

pub(super) fn build_ollama_request_from_openai_chat(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    build_shared_ollama_request_from_openai_chat(&model_id, payload)
        .map_err(|error| proxy_error(StatusCode::BAD_REQUEST, &error.to_string()))
}

pub(super) fn build_ollama_request_from_openai_response(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    build_shared_ollama_request_from_openai_response(&model_id, payload)
        .map_err(|error| proxy_error(StatusCode::BAD_REQUEST, &error.to_string()))
}

pub(super) fn build_ollama_request_from_openai_embeddings(
    route: &LocalAiProxyRouteSnapshot,
    payload: &Value,
) -> ProxyHttpResult<Value> {
    let model_id = resolve_request_model_id(route, payload)?;
    build_shared_ollama_request_from_openai_embeddings(&model_id, payload)
        .map_err(|error| proxy_error(StatusCode::BAD_REQUEST, &error.to_string()))
}
