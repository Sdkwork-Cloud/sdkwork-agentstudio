use super::{
    anthropic_native, gemini_native, health, openai_compatible, types::LocalAiProxyAppState,
};
use axum::{
    routing::{get, post},
    Router,
};

pub(super) fn build_router(state: LocalAiProxyAppState) -> Router {
    Router::new()
        .route("/health", get(health::health_handler))
        .route("/v1/health", get(health::health_handler))
        .route("/v1/models", get(openai_compatible::models_handler))
        .route(
            "/v1/chat/completions",
            post(openai_compatible::chat_completions_handler),
        )
        .route(
            "/v1/responses",
            post(openai_compatible::openai_responses_handler),
        )
        .route(
            "/v1/embeddings",
            post(openai_compatible::openai_embeddings_handler),
        )
        .route("/v1/messages", post(anthropic_native::messages_handler))
        .route("/v1beta/models", get(gemini_native::models_handler_v1beta))
        .route(
            "/v1beta/models/{model_action}",
            post(gemini_native::model_action_handler_v1beta),
        )
        .route(
            "/v1/models/{model_action}",
            post(gemini_native::model_action_handler_v1),
        )
        .with_state(state)
}
