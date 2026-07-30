use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TranslationConfig {
    base_url: String,
    model: String,
    timeout_seconds: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Segment {
    id: String,
    text: String,
}

#[tauri::command]
async fn translate_segments(
    segments: Vec<Segment>,
    direction: String,
    config: TranslationConfig,
) -> Result<Vec<Segment>, String> {
    let _ = (direction, config.base_url, config.model, config.timeout_seconds);
    Err("原生翻译服务尚未配置。请在开发模式中使用兼容 API。".into())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![translate_segments])
        .run(tauri::generate_context!())
        .expect("failed to run Codex Chinese Bridge");
}
