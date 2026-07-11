use crate::framework::{
    config::AppConfig,
    kernel::{DesktopPermissionInfo, DesktopPermissionStatus, DesktopPermissionsInfo},
};

#[derive(Clone, Debug, Default)]
pub struct PermissionService;

impl PermissionService {
    pub fn new() -> Self {
        Self
    }

    pub fn kernel_info(&self, config: &AppConfig) -> DesktopPermissionsInfo {
        DesktopPermissionsInfo {
            entries: vec![
                DesktopPermissionInfo {
                    key: "window.chromeControls".to_string(),
                    status: DesktopPermissionStatus::Granted,
                    required: true,
                    detail: "Desktop capability grants the custom title-bar controls permission to minimize, maximize, restore, hide to tray, reveal, drag, and close the main window.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "window.stateInspection".to_string(),
                    status: DesktopPermissionStatus::Granted,
                    required: true,
                    detail: "Desktop capability grants fullscreen, maximized, minimized, and visibility inspection so the shell can recover the main window from tray and keep custom chrome in sync.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "dialog.fileOpen".to_string(),
                    status: DesktopPermissionStatus::Granted,
                    required: false,
                    detail: "Native file and folder picking is available through the managed desktop dialog commands.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "dialog.fileSave".to_string(),
                    status: DesktopPermissionStatus::Granted,
                    required: false,
                    detail: "Native save-file flows are available through the managed desktop dialog commands.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "filesystem.managedRoots".to_string(),
                    status: DesktopPermissionStatus::Managed,
                    required: true,
                    detail: "Filesystem access is constrained to managed runtime roots.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "process.restrictedSpawn".to_string(),
                    status: DesktopPermissionStatus::Managed,
                    required: true,
                    detail: "Child process execution is limited to allowlisted commands and managed working directories.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "browser.externalHttp".to_string(),
                    status: DesktopPermissionStatus::Managed,
                    required: false,
                    detail: if config.security.allow_external_http {
                        "External http/https links are allowed by security policy.".to_string()
                    } else {
                        "External http/https links are denied by security policy; only mailto/tel remain available.".to_string()
                    },
                },
                DesktopPermissionInfo {
                    key: "media.audioPlayback".to_string(),
                    status: DesktopPermissionStatus::Granted,
                    required: false,
                    detail: "Audio playback is available inside the webview runtime and does not require an additional native permission adapter.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "media.videoPlayback".to_string(),
                    status: DesktopPermissionStatus::Granted,
                    required: false,
                    detail: "Video playback is available inside the webview runtime and does not require an additional native permission adapter.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "media.cameraCapture".to_string(),
                    status: DesktopPermissionStatus::Planned,
                    required: false,
                    detail: "Camera capture is not bridged by the desktop shell yet and should only be enabled with an explicit native/browser permission flow.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "media.microphoneCapture".to_string(),
                    status: DesktopPermissionStatus::Planned,
                    required: false,
                    detail: "Microphone capture is not bridged by the desktop shell yet and should only be enabled with an explicit native/browser permission flow.".to_string(),
                },
                DesktopPermissionInfo {
                    key: "notifications.userConsent".to_string(),
                    status: DesktopPermissionStatus::Planned,
                    required: config.notifications.require_user_consent,
                    detail: if config.notifications.enabled {
                        "Notification delivery is reserved behind future native permission adapters.".to_string()
                    } else {
                        "Notifications are disabled in config and native permission adapters are not active.".to_string()
                    },
                },
                DesktopPermissionInfo {
                    key: "integrations.pluginTrust".to_string(),
                    status: if config.integrations.allow_unsigned_plugins {
                        DesktopPermissionStatus::Planned
                    } else {
                        DesktopPermissionStatus::Managed
                    },
                    required: config.integrations.plugins_enabled,
                    detail: if config.integrations.allow_unsigned_plugins {
                        "Unsigned plugin governance is relaxed in config and should be hardened before enabling third-party plugin execution.".to_string()
                    } else {
                        "Plugin trust policy requires signed plugins before future native adapters are enabled.".to_string()
                    },
                },
                DesktopPermissionInfo {
                    key: "payments.providerAccess".to_string(),
                    status: DesktopPermissionStatus::Planned,
                    required: config.payments.provider != "none",
                    detail: "Payment provider credentials and secure authorization remain reserved for a later native adapter.".to_string(),
                },
            ],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::PermissionService;
    use crate::framework::{config::AppConfig, kernel::DesktopPermissionStatus};

    fn find_entry<'a>(
        entries: &'a [crate::framework::kernel::DesktopPermissionInfo],
        key: &str,
    ) -> &'a crate::framework::kernel::DesktopPermissionInfo {
        entries
            .iter()
            .find(|entry| entry.key == key)
            .unwrap_or_else(|| panic!("missing permission entry: {key}"))
    }

    #[test]
    fn permission_service_exposes_desktop_baseline_entries() {
        let service = PermissionService::new();
        let info = service.kernel_info(&AppConfig::default());

        let chrome_controls = find_entry(&info.entries, "window.chromeControls");
        assert_eq!(chrome_controls.status, DesktopPermissionStatus::Granted);
        assert!(chrome_controls.required);

        let window_state = find_entry(&info.entries, "window.stateInspection");
        assert_eq!(window_state.status, DesktopPermissionStatus::Granted);
        assert!(window_state.required);

        let file_open = find_entry(&info.entries, "dialog.fileOpen");
        assert_eq!(file_open.status, DesktopPermissionStatus::Granted);
        assert!(!file_open.required);

        let file_save = find_entry(&info.entries, "dialog.fileSave");
        assert_eq!(file_save.status, DesktopPermissionStatus::Granted);
        assert!(!file_save.required);

        let audio_playback = find_entry(&info.entries, "media.audioPlayback");
        assert_eq!(audio_playback.status, DesktopPermissionStatus::Granted);
        assert!(!audio_playback.required);

        let video_playback = find_entry(&info.entries, "media.videoPlayback");
        assert_eq!(video_playback.status, DesktopPermissionStatus::Granted);
        assert!(!video_playback.required);

        let camera_capture = find_entry(&info.entries, "media.cameraCapture");
        assert_eq!(camera_capture.status, DesktopPermissionStatus::Planned);
        assert!(!camera_capture.required);

        let microphone_capture = find_entry(&info.entries, "media.microphoneCapture");
        assert_eq!(microphone_capture.status, DesktopPermissionStatus::Planned);
        assert!(!microphone_capture.required);
    }

    #[test]
    fn permission_service_reflects_external_http_policy_in_browser_entry() {
        let service = PermissionService::new();
        let config = AppConfig {
            security: crate::framework::config::SecurityConfig {
                allow_external_http: false,
                ..crate::framework::config::SecurityConfig::default()
            },
            ..AppConfig::default()
        };
        let info = service.kernel_info(&config);
        let browser_http = find_entry(&info.entries, "browser.externalHttp");

        assert_eq!(browser_http.status, DesktopPermissionStatus::Managed);
        assert!(browser_http.detail.contains("denied"));
    }
}
