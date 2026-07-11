use super::{types::LocalAiProxyTokenUsage, types::ProxyHttpResult};
use axum::{
    body::{Body, Bytes},
    http::{header::CONTENT_TYPE, HeaderValue, StatusCode},
    response::Response,
};
use sdkwork_local_api_proxy_native::streaming::{
    build_openai_chat_stream_chunk, build_openai_response_completed_event,
    build_openai_response_created_event, build_openai_response_delta_event,
    drain_json_line_payloads, drain_sse_frames, flush_json_line_payload, flush_sse_frame,
    merge_stream_usage, project_anthropic_openai_stream_frame, project_gemini_openai_stream_frame,
    project_ollama_openai_stream_frame, ParsedSseEvent,
};
use sdkwork_local_api_proxy_native::support::{duration_to_ms, proxy_error, trim_optional_text};
use serde_json::{json, Value};
use std::time::Instant;
use uuid::Uuid;

pub(super) use sdkwork_local_api_proxy_native::streaming::{
    is_openai_stream_request, OpenAiStreamEndpoint,
};

#[derive(Debug)]
pub(super) struct OpenAiTranslatedStreamState {
    endpoint: OpenAiStreamEndpoint,
    stream_id: String,
    model: String,
    accumulated_text: String,
    pub(super) usage: LocalAiProxyTokenUsage,
    role_sent: bool,
    response_created: bool,
    done_emitted: bool,
    finish_reason: Option<String>,
}

pub(super) async fn build_passthrough_response<G>(
    response: reqwest::Response,
    request_started_at: Instant,
    on_complete: G,
) -> ProxyHttpResult<Response>
where
    G: FnOnce(Option<u64>, Option<String>) + Send + 'static,
{
    let status = response.status();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .cloned()
        .unwrap_or_else(|| HeaderValue::from_static("application/json"));
    let stream = async_stream::stream! {
        let mut upstream = response;
        let mut preview = String::new();
        let mut first_chunk_latency_ms = None;
        let mut on_complete = Some(on_complete);

        loop {
            match upstream.chunk().await {
                Ok(Some(chunk)) => {
                    if first_chunk_latency_ms.is_none() {
                        first_chunk_latency_ms = Some(duration_to_ms(request_started_at.elapsed()));
                    }
                    if preview.len() < 4_000 {
                        preview.push_str(&String::from_utf8_lossy(&chunk));
                    }
                    yield Ok::<Bytes, std::io::Error>(chunk);
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }

        if let Some(on_complete) = on_complete.take() {
            on_complete(first_chunk_latency_ms, trim_optional_text(&preview));
        }
    };
    let mut builder = Response::builder().status(status);
    builder = builder.header(CONTENT_TYPE, content_type);
    builder.body(Body::from_stream(stream)).map_err(|error| {
        proxy_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Local AI proxy failed to build response: {error}"),
        )
    })
}

impl OpenAiTranslatedStreamState {
    pub(super) fn new(
        endpoint: OpenAiStreamEndpoint,
        model: impl Into<String>,
        id_prefix: &str,
    ) -> Self {
        Self {
            endpoint,
            stream_id: format!("{id_prefix}-{}", Uuid::new_v4().simple()),
            model: model.into(),
            accumulated_text: String::new(),
            usage: LocalAiProxyTokenUsage::default(),
            role_sent: false,
            response_created: false,
            done_emitted: false,
            finish_reason: None,
        }
    }

    fn update_stream_id(&mut self, stream_id: Option<&str>) {
        if let Some(value) = stream_id.map(str::trim).filter(|value| !value.is_empty()) {
            self.stream_id = value.to_string();
        }
    }

    fn update_model(&mut self, model: Option<&str>) {
        if let Some(value) = model.map(str::trim).filter(|value| !value.is_empty()) {
            self.model = value.to_string();
        }
    }

    fn ensure_response_created(&mut self) -> Option<Bytes> {
        if self.endpoint != OpenAiStreamEndpoint::Responses || self.response_created {
            return None;
        }

        self.response_created = true;
        Some(sse_json_bytes(build_openai_response_created_event(
            &self.stream_id,
            &self.model,
        )))
    }

    fn push_text_delta(&mut self, text: &str) -> Vec<Bytes> {
        if text.is_empty() {
            return Vec::new();
        }

        self.accumulated_text.push_str(text);

        match self.endpoint {
            OpenAiStreamEndpoint::ChatCompletions => {
                let mut events = Vec::new();
                if !self.role_sent {
                    self.role_sent = true;
                    events.push(sse_json_bytes(build_openai_chat_stream_chunk(
                        &self.stream_id,
                        &self.model,
                        json!({ "role": "assistant" }),
                        None,
                    )));
                }
                events.push(sse_json_bytes(build_openai_chat_stream_chunk(
                    &self.stream_id,
                    &self.model,
                    json!({ "content": text }),
                    None,
                )));
                events
            }
            OpenAiStreamEndpoint::Responses => {
                let mut events = Vec::new();
                if let Some(created) = self.ensure_response_created() {
                    events.push(created);
                }
                events.push(sse_json_bytes(build_openai_response_delta_event(
                    &self.stream_id,
                    text,
                )));
                events
            }
        }
    }

    fn complete(&mut self, finish_reason: Option<&str>) -> Vec<Bytes> {
        if let Some(value) = finish_reason
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            self.finish_reason = Some(value.to_string());
        }

        if self.done_emitted {
            return Vec::new();
        }
        self.done_emitted = true;

        match self.endpoint {
            OpenAiStreamEndpoint::ChatCompletions => {
                let finish_reason = self.finish_reason.as_deref().unwrap_or("stop");
                vec![
                    sse_json_bytes(build_openai_chat_stream_chunk(
                        &self.stream_id,
                        &self.model,
                        json!({}),
                        Some(finish_reason),
                    )),
                    sse_done_bytes(),
                ]
            }
            OpenAiStreamEndpoint::Responses => {
                let mut events = Vec::new();
                if let Some(created) = self.ensure_response_created() {
                    events.push(created);
                }
                events.push(sse_json_bytes(build_openai_response_completed_event(
                    &self.stream_id,
                    &self.model,
                    &self.accumulated_text,
                    &self.usage,
                )));
                events
            }
        }
    }

    pub(super) fn merge_usage(&mut self, usage: &LocalAiProxyTokenUsage) {
        merge_stream_usage(&mut self.usage, usage);
    }

    fn apply_projection(
        &mut self,
        projection: sdkwork_local_api_proxy_native::streaming::OpenAiStreamFrameProjection,
    ) -> Vec<Bytes> {
        let mut events = Vec::new();

        if let Some(stream_id) = projection.stream_id.as_deref() {
            self.update_stream_id(Some(stream_id));
        }
        if let Some(model) = projection.model.as_deref() {
            self.update_model(Some(model));
        }
        if let Some(usage) = projection.usage.as_ref() {
            self.merge_usage(usage);
        }
        if let Some(finish_reason) = projection.finish_reason.as_deref() {
            self.finish_reason = Some(finish_reason.to_string());
        }
        if projection.ensure_response_created {
            if let Some(created) = self.ensure_response_created() {
                events.push(created);
            }
        }
        if let Some(text) = projection.text_delta.as_deref() {
            events.extend(self.push_text_delta(text));
        }
        if projection.should_complete {
            events.extend(self.complete(projection.finish_reason.as_deref()));
        }

        events
    }
}

fn sse_json_bytes(value: Value) -> Bytes {
    Bytes::from(format!("data: {}\n\n", value))
}

fn sse_done_bytes() -> Bytes {
    Bytes::from("data: [DONE]\n\n")
}

pub(super) async fn build_translated_openai_sse_response<F, G>(
    status: StatusCode,
    response: reqwest::Response,
    mut state: OpenAiTranslatedStreamState,
    mut map_frame: F,
    request_started_at: Instant,
    on_complete: G,
) -> ProxyHttpResult<Response>
where
    F: FnMut(&mut OpenAiTranslatedStreamState, ParsedSseEvent) -> Vec<Bytes> + Send + 'static,
    G: FnOnce(LocalAiProxyTokenUsage, Option<u64>, Option<String>) + Send + 'static,
{
    let stream = async_stream::stream! {
        let mut upstream = response;
        let mut buffer = String::new();
        let mut first_chunk_latency_ms = None;
        let mut on_complete = Some(on_complete);

        loop {
            match upstream.chunk().await {
                Ok(Some(chunk)) => {
                    buffer.push_str(&String::from_utf8_lossy(&chunk));
                    for frame in drain_sse_frames(&mut buffer) {
                        for translated_chunk in map_frame(&mut state, frame) {
                            if first_chunk_latency_ms.is_none() {
                                first_chunk_latency_ms =
                                    Some(duration_to_ms(request_started_at.elapsed()));
                            }
                            yield Ok::<Bytes, std::io::Error>(translated_chunk);
                        }
                    }
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }

        if let Some(frame) = flush_sse_frame(&mut buffer) {
            for translated_chunk in map_frame(&mut state, frame) {
                if first_chunk_latency_ms.is_none() {
                    first_chunk_latency_ms = Some(duration_to_ms(request_started_at.elapsed()));
                }
                yield Ok::<Bytes, std::io::Error>(translated_chunk);
            }
        }

        for translated_chunk in state.complete(None) {
            if first_chunk_latency_ms.is_none() {
                first_chunk_latency_ms = Some(duration_to_ms(request_started_at.elapsed()));
            }
            yield Ok::<Bytes, std::io::Error>(translated_chunk);
        }

        if let Some(on_complete) = on_complete.take() {
            on_complete(
                state.usage.clone(),
                first_chunk_latency_ms,
                trim_optional_text(&state.accumulated_text),
            );
        }
    };

    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, HeaderValue::from_static("text/event-stream"))
        .body(Body::from_stream(stream))
        .map_err(|error| {
            proxy_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Local AI proxy failed to build translated SSE response: {error}"),
            )
        })
}

pub(super) async fn build_translated_openai_jsonl_response<F, G>(
    status: StatusCode,
    response: reqwest::Response,
    mut state: OpenAiTranslatedStreamState,
    mut map_frame: F,
    request_started_at: Instant,
    on_complete: G,
) -> ProxyHttpResult<Response>
where
    F: FnMut(&mut OpenAiTranslatedStreamState, Value) -> Vec<Bytes> + Send + 'static,
    G: FnOnce(LocalAiProxyTokenUsage, Option<u64>, Option<String>) + Send + 'static,
{
    let stream = async_stream::stream! {
        let mut upstream = response;
        let mut buffer = String::new();
        let mut first_chunk_latency_ms = None;
        let mut on_complete = Some(on_complete);

        loop {
            match upstream.chunk().await {
                Ok(Some(chunk)) => {
                    buffer.push_str(&String::from_utf8_lossy(&chunk));
                    for frame in drain_json_line_payloads(&mut buffer) {
                        for translated_chunk in map_frame(&mut state, frame) {
                            if first_chunk_latency_ms.is_none() {
                                first_chunk_latency_ms =
                                    Some(duration_to_ms(request_started_at.elapsed()));
                            }
                            yield Ok::<Bytes, std::io::Error>(translated_chunk);
                        }
                    }
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }

        if let Some(frame) = flush_json_line_payload(&mut buffer) {
            for translated_chunk in map_frame(&mut state, frame) {
                if first_chunk_latency_ms.is_none() {
                    first_chunk_latency_ms = Some(duration_to_ms(request_started_at.elapsed()));
                }
                yield Ok::<Bytes, std::io::Error>(translated_chunk);
            }
        }

        for translated_chunk in state.complete(None) {
            if first_chunk_latency_ms.is_none() {
                first_chunk_latency_ms = Some(duration_to_ms(request_started_at.elapsed()));
            }
            yield Ok::<Bytes, std::io::Error>(translated_chunk);
        }

        if let Some(on_complete) = on_complete.take() {
            on_complete(
                state.usage.clone(),
                first_chunk_latency_ms,
                trim_optional_text(&state.accumulated_text),
            );
        }
    };

    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, HeaderValue::from_static("text/event-stream"))
        .body(Body::from_stream(stream))
        .map_err(|error| {
            proxy_error(
                StatusCode::INTERNAL_SERVER_ERROR,
                &format!("Local AI proxy failed to build translated JSONL response: {error}"),
            )
        })
}

pub(super) fn handle_anthropic_openai_stream_frame(
    state: &mut OpenAiTranslatedStreamState,
    frame: ParsedSseEvent,
) -> Vec<Bytes> {
    project_anthropic_openai_stream_frame(&frame)
        .map(|projection| state.apply_projection(projection))
        .unwrap_or_default()
}

pub(super) fn handle_gemini_openai_stream_frame(
    state: &mut OpenAiTranslatedStreamState,
    frame: ParsedSseEvent,
) -> Vec<Bytes> {
    project_gemini_openai_stream_frame(&frame)
        .map(|projection| state.apply_projection(projection))
        .unwrap_or_default()
}

pub(super) fn handle_ollama_openai_stream_frame(
    state: &mut OpenAiTranslatedStreamState,
    payload: Value,
) -> Vec<Bytes> {
    project_ollama_openai_stream_frame(&payload)
        .map(|projection| state.apply_projection(projection))
        .unwrap_or_default()
}
