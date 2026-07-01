use crate::framework::{runtime, FrameworkError, Result as FrameworkResult};
use image::{DynamicImage, ImageFormat};
use serde::Serialize;
use std::{
    io::Cursor,
    time::{SystemTime, UNIX_EPOCH},
};
use xcap::Monitor;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedScreenshotPayload {
    bytes: Vec<u8>,
    file_name: String,
    mime_type: String,
    width: u32,
    height: u32,
    display_name: Option<String>,
}

fn sanitize_label(value: &str) -> String {
    let sanitized = value
        .trim()
        .chars()
        .map(|character| match character {
            'a'..='z' | 'A'..='Z' | '0'..='9' => character,
            _ => '-',
        })
        .collect::<String>();

    sanitized
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn capture_primary_monitor_png() -> FrameworkResult<CapturedScreenshotPayload> {
    let monitors = Monitor::all().map_err(|error| FrameworkError::Internal(error.to_string()))?;
    let monitor = monitors
        .into_iter()
        .find(|entry| entry.is_primary().unwrap_or(false))
        .or_else(|| {
            Monitor::all()
                .ok()
                .and_then(|items| items.into_iter().next())
        })
        .ok_or_else(|| FrameworkError::NotFound("desktop monitor".to_string()))?;

    let display_name = monitor.name().ok().filter(|value| !value.trim().is_empty());
    let image = monitor
        .capture_image()
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;
    let width = image.width();
    let height = image.height();
    let mut cursor = Cursor::new(Vec::new());

    DynamicImage::ImageRgba8(image)
        .write_to(&mut cursor, ImageFormat::Png)
        .map_err(|error| FrameworkError::Internal(error.to_string()))?;

    let monitor_label = display_name
        .as_deref()
        .map(sanitize_label)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "display".to_string());

    Ok(CapturedScreenshotPayload {
        bytes: cursor.into_inner(),
        file_name: format!("screenshot-{}-{}.png", monitor_label, now_unix_seconds()),
        mime_type: "image/png".to_string(),
        width,
        height,
        display_name,
    })
}

#[tauri::command]
pub async fn capture_screenshot() -> Result<CapturedScreenshotPayload, String> {
    runtime::run_blocking_async("desktop.capture_screenshot", capture_primary_monitor_png)
        .await
        .map_err(|error| error.to_string())
}
