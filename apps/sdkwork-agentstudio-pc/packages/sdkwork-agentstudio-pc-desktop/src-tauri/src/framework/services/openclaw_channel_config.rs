use serde_json::{Map, Value};
use std::collections::BTreeSet;
#[cfg(test)]
use std::{fs, path::Path};

pub(super) const BUNDLED_OPENCLAW_CHANNEL_IDS: [&str; 9] = [
    "qqbot",
    "feishu",
    "imessage",
    "irc",
    "matrix",
    "mattermost",
    "signal",
    "slack",
    "telegram",
];

const OPENCLAW_CHANNEL_CONFIG_META_KEYS: [&str; 2] = ["defaults", "modelByChannel"];
const LEGACY_QQ_CHANNEL_ID: &str = "qq";
const CANONICAL_QQBOT_CHANNEL_ID: &str = "qqbot";

pub(super) fn bundled_openclaw_channel_id_set() -> BTreeSet<String> {
    BUNDLED_OPENCLAW_CHANNEL_IDS
        .iter()
        .map(|channel_id| (*channel_id).to_string())
        .collect()
}

#[cfg(test)]
pub(crate) fn write_test_openclaw_channel_metadata(runtime_root: &Path) {
    for channel_id in BUNDLED_OPENCLAW_CHANNEL_IDS {
        let package_json_path = runtime_root
            .join("package")
            .join("node_modules")
            .join("openclaw")
            .join("dist")
            .join("extensions")
            .join(channel_id)
            .join("package.json");
        fs::create_dir_all(
            package_json_path
                .parent()
                .expect("test OpenClaw channel metadata parent"),
        )
        .expect("test OpenClaw channel metadata dir");
        fs::write(
            package_json_path,
            format!(
                r#"{{
  "name": "@openclaw/{channel_id}",
  "version": "0.0.0-test",
  "openclaw": {{
    "extensions": ["./index.js"],
    "channel": {{
      "id": "{channel_id}",
      "label": "{channel_id}"
    }}
  }}
}}
"#
            ),
        )
        .expect("test OpenClaw channel metadata package");
    }
}

pub(super) fn sanitize_openclaw_channel_config(
    config: &mut Value,
    available_channel_ids: &BTreeSet<String>,
) {
    let Some(channels_root) = config.get_mut("channels").and_then(Value::as_object_mut) else {
        if config.get("channels").is_some() {
            remove_nested_key(config, &["channels"]);
        }
        return;
    };

    if channels_root
        .get("defaults")
        .is_some_and(|defaults| !defaults.is_object())
    {
        channels_root.remove("defaults");
    }

    migrate_legacy_qq_channel_root(channels_root, available_channel_ids);

    if let Some(model_by_channel) = channels_root
        .get_mut("modelByChannel")
        .and_then(Value::as_object_mut)
    {
        migrate_legacy_qq_model_mapping(model_by_channel, available_channel_ids);
        sanitize_model_by_channel(model_by_channel, available_channel_ids);
        if model_by_channel.is_empty() {
            channels_root.remove("modelByChannel");
        }
    } else if channels_root.contains_key("modelByChannel") {
        channels_root.remove("modelByChannel");
    }

    channels_root.retain(|channel_id, value| {
        OPENCLAW_CHANNEL_CONFIG_META_KEYS.contains(&channel_id.as_str())
            || (available_channel_ids.contains(channel_id) && value.is_object())
    });

    if channels_root.is_empty() {
        remove_nested_key(config, &["channels"]);
    }
}

fn legacy_qq_can_migrate(available_channel_ids: &BTreeSet<String>) -> bool {
    available_channel_ids.contains(CANONICAL_QQBOT_CHANNEL_ID)
}

fn migrate_legacy_qq_channel_root(
    channels_root: &mut Map<String, Value>,
    available_channel_ids: &BTreeSet<String>,
) {
    if !legacy_qq_can_migrate(available_channel_ids)
        || channels_root.contains_key(CANONICAL_QQBOT_CHANNEL_ID)
    {
        return;
    }

    let Some(legacy_value) = channels_root.remove(LEGACY_QQ_CHANNEL_ID) else {
        return;
    };

    channels_root.insert(CANONICAL_QQBOT_CHANNEL_ID.to_string(), legacy_value);
}

fn migrate_legacy_qq_model_mapping(
    model_by_channel: &mut Map<String, Value>,
    available_channel_ids: &BTreeSet<String>,
) {
    if !legacy_qq_can_migrate(available_channel_ids)
        || model_by_channel.contains_key(CANONICAL_QQBOT_CHANNEL_ID)
    {
        return;
    }

    let Some(legacy_value) = model_by_channel.remove(LEGACY_QQ_CHANNEL_ID) else {
        return;
    };

    model_by_channel.insert(CANONICAL_QQBOT_CHANNEL_ID.to_string(), legacy_value);
}

fn sanitize_model_by_channel(
    model_by_channel: &mut Map<String, Value>,
    available_channel_ids: &BTreeSet<String>,
) {
    model_by_channel.retain(|channel_id, value| {
        if !available_channel_ids.contains(channel_id) {
            return false;
        }

        let Some(channel_overrides) = value.as_object_mut() else {
            return false;
        };

        channel_overrides.retain(|_, model_ref| model_ref.is_string());
        !channel_overrides.is_empty()
    });
}

fn remove_nested_key(value: &mut Value, path: &[&str]) {
    if path.is_empty() {
        return;
    }

    let Some(root) = value.as_object_mut() else {
        return;
    };

    if path.len() == 1 {
        root.remove(path[0]);
        return;
    }

    let Some(next) = root.get_mut(path[0]) else {
        return;
    };

    remove_nested_key(next, &path[1..]);
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sanitizer_migrates_legacy_qq_to_qqbot_when_runtime_supports_qqbot() {
        let mut config = json!({
            "channels": {
                "qq": {
                    "appId": "legacy-app-id",
                    "clientSecret": "legacy-secret",
                    "enabled": true
                },
                "modelByChannel": {
                    "qq": {
                        "*": "sdkwork-local-proxy/gpt-legacy"
                    }
                }
            }
        });
        let available_channel_ids = BTreeSet::from([CANONICAL_QQBOT_CHANNEL_ID.to_string()]);

        sanitize_openclaw_channel_config(&mut config, &available_channel_ids);

        assert_eq!(
            config
                .pointer("/channels/qqbot/appId")
                .and_then(Value::as_str),
            Some("legacy-app-id")
        );
        assert!(config.pointer("/channels/qq").is_none());
        assert_eq!(
            config
                .pointer("/channels/modelByChannel/qqbot/*")
                .and_then(Value::as_str),
            Some("sdkwork-local-proxy/gpt-legacy")
        );
    }

    #[test]
    fn sanitizer_prunes_legacy_qq_when_runtime_does_not_support_qqbot() {
        let mut config = json!({
            "channels": {
                "qq": {
                    "enabled": true
                },
                "modelByChannel": {
                    "qq": {
                        "*": "sdkwork-local-proxy/gpt-legacy"
                    }
                }
            }
        });
        let available_channel_ids = BTreeSet::from(["telegram".to_string()]);

        sanitize_openclaw_channel_config(&mut config, &available_channel_ids);

        assert!(config.get("channels").is_none());
    }

    #[test]
    fn sanitizer_does_not_overwrite_existing_qqbot_with_legacy_qq() {
        let mut config = json!({
            "channels": {
                "qqbot": {
                    "appId": "canonical-app-id",
                    "clientSecret": "canonical-secret",
                    "enabled": true
                },
                "qq": {
                    "appId": "legacy-app-id",
                    "clientSecret": "legacy-secret",
                    "enabled": false
                },
                "modelByChannel": {
                    "qqbot": {
                        "*": "sdkwork-local-proxy/gpt-current"
                    },
                    "qq": {
                        "*": "sdkwork-local-proxy/gpt-legacy"
                    }
                }
            }
        });
        let available_channel_ids = BTreeSet::from([CANONICAL_QQBOT_CHANNEL_ID.to_string()]);

        sanitize_openclaw_channel_config(&mut config, &available_channel_ids);

        assert_eq!(
            config
                .pointer("/channels/qqbot/appId")
                .and_then(Value::as_str),
            Some("canonical-app-id")
        );
        assert!(config.pointer("/channels/qq").is_none());
        assert_eq!(
            config
                .pointer("/channels/modelByChannel/qqbot/*")
                .and_then(Value::as_str),
            Some("sdkwork-local-proxy/gpt-current")
        );
    }
}
