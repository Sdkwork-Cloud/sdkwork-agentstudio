use crate::framework::{FrameworkError, Result as FrameworkResult};
use reqwest::{
    header::{CONTENT_DISPOSITION, CONTENT_TYPE},
    Url,
};
use serde::Serialize;
use std::time::Duration;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchedRemoteUrlPayload {
    url: String,
    bytes: Vec<u8>,
    content_type: Option<String>,
    file_name: Option<String>,
}

fn validate_remote_url(url: &str) -> FrameworkResult<Url> {
    let parsed =
        Url::parse(url).map_err(|error| FrameworkError::ValidationFailed(error.to_string()))?;

    match parsed.scheme() {
        "http" | "https" => Ok(parsed),
        other => Err(FrameworkError::ValidationFailed(format!(
            "unsupported remote url scheme: {other}"
        ))),
    }
}

fn derive_file_name_from_url(url: &Url) -> Option<String> {
    url.path_segments()
        .and_then(|segments| segments.last())
        .map(|segment| segment.trim())
        .filter(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
}

fn derive_file_name_from_content_disposition(value: &str) -> Option<String> {
    for part in value.split(';') {
        let trimmed = part.trim();
        if let Some(file_name) = trimmed.strip_prefix("filename=") {
            let normalized = file_name.trim().trim_matches('"').trim();
            if !normalized.is_empty() {
                return Some(normalized.to_string());
            }
        }
    }

    None
}

async fn fetch_remote_url_payload(url: String) -> FrameworkResult<FetchedRemoteUrlPayload> {
    let parsed = validate_remote_url(&url)?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(8))
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;

    let response = client
        .get(parsed.clone())
        .send()
        .await
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    let status = response.status();
    if !status.is_success() {
        return Err(FrameworkError::InvalidOperation(format!(
            "failed to fetch {url}: {status}"
        )));
    }

    let final_url = response.url().clone();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let file_name = response
        .headers()
        .get(CONTENT_DISPOSITION)
        .and_then(|value| value.to_str().ok())
        .and_then(derive_file_name_from_content_disposition)
        .or_else(|| derive_file_name_from_url(&final_url));
    let bytes = response
        .bytes()
        .await
        .map_err(|error| FrameworkError::Internal(error.to_string()))?
        .to_vec();

    Ok(FetchedRemoteUrlPayload {
        url: final_url.to_string(),
        bytes,
        content_type,
        file_name,
    })
}

#[tauri::command]
pub async fn fetch_remote_url(url: String) -> Result<FetchedRemoteUrlPayload, String> {
    fetch_remote_url_payload(url)
        .await
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        derive_file_name_from_content_disposition, derive_file_name_from_url, validate_remote_url,
    };

    #[test]
    fn validates_http_and_https_remote_urls_only() {
        assert!(validate_remote_url("https://sdk.work/demo.png").is_ok());
        assert!(validate_remote_url("http://localhost:3000/demo.png").is_ok());
        assert!(validate_remote_url("file:///etc/passwd").is_err());
        assert!(validate_remote_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn derives_file_name_from_content_disposition_header() {
        assert_eq!(
            derive_file_name_from_content_disposition("attachment; filename=\"demo.mp3\""),
            Some("demo.mp3".to_string())
        );
        assert_eq!(
            derive_file_name_from_content_disposition("inline; filename=screenshot.png"),
            Some("screenshot.png".to_string())
        );
        assert_eq!(
            derive_file_name_from_content_disposition("attachment"),
            None
        );
    }

    #[test]
    fn derives_file_name_from_final_url_path() {
        let url = validate_remote_url("https://example.com/assets/demo.mp3").expect("url");
        assert_eq!(
            derive_file_name_from_url(&url),
            Some("demo.mp3".to_string())
        );
    }
}
