use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_store::StoreExt;

const SETTINGS_STORE: &str = "settings.json";
const DOWNLOAD_DIR_KEY: &str = "download_dir";

// 下载设置
#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadSettings {
    pub download_dir: String,
    pub is_default: bool,
}

// 系统默认下载目录，读取失败时回退到 ~/Downloads
fn default_download_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(dir) = app_handle.path().download_dir() {
        return Ok(dir);
    }

    app_handle
        .path()
        .home_dir()
        .map(|home| home.join("Downloads"))
        .map_err(|e| format!("无法获取系统下载目录: {}", e))
}

// 读取用户保存的下载目录
fn stored_download_dir(app_handle: &tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app_handle
        .store(SETTINGS_STORE)
        .map_err(|e| e.to_string())?;

    Ok(store
        .get(DOWNLOAD_DIR_KEY)
        .and_then(|value| value.as_str().map(|dir| dir.trim().to_string()))
        .filter(|dir| !dir.is_empty()))
}

// 供下载流程使用：优先使用用户配置的目录，否则使用系统下载目录
pub fn resolve_download_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    match stored_download_dir(app_handle)? {
        Some(dir) => Ok(PathBuf::from(dir)),
        None => default_download_dir(app_handle),
    }
}

// 获取当前下载设置
#[tauri::command]
pub async fn get_download_settings(
    app_handle: tauri::AppHandle,
) -> Result<DownloadSettings, String> {
    let stored = stored_download_dir(&app_handle)?;
    let download_dir = match &stored {
        Some(dir) => PathBuf::from(dir),
        None => default_download_dir(&app_handle)?,
    };

    Ok(DownloadSettings {
        download_dir: download_dir.to_string_lossy().to_string(),
        is_default: stored.is_none(),
    })
}

// 保存下载目录；path 为 None 时恢复系统默认目录
#[tauri::command]
pub async fn set_download_dir(
    app_handle: tauri::AppHandle,
    path: Option<String>,
) -> Result<DownloadSettings, String> {
    let store = app_handle
        .store(SETTINGS_STORE)
        .map_err(|e| e.to_string())?;

    match path.map(|dir| dir.trim().to_string()).filter(|dir| !dir.is_empty()) {
        Some(dir) => {
            let dir_path = PathBuf::from(&dir);
            fs::create_dir_all(&dir_path).map_err(|e| format!("创建下载目录失败: {}", e))?;

            if !dir_path.is_dir() {
                return Err(format!("所选路径不是文件夹: {}", dir));
            }

            store.set(
                DOWNLOAD_DIR_KEY,
                serde_json::Value::String(dir_path.to_string_lossy().to_string()),
            );
            store.save().map_err(|e| e.to_string())?;
        }
        None => {
            store.delete(DOWNLOAD_DIR_KEY);
            store.save().map_err(|e| e.to_string())?;
        }
    }

    get_download_settings(app_handle).await
}

// 弹出系统原生的文件夹选择器
#[tauri::command]
pub async fn select_download_folder(
    app_handle: tauri::AppHandle,
    current_dir: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = app_handle
        .dialog()
        .file()
        .set_title("选择下载文件夹");

    if let Some(dir) = current_dir.filter(|dir| !dir.trim().is_empty()) {
        dialog = dialog.set_directory(dir);
    }

    Ok(dialog
        .blocking_pick_folder()
        .and_then(|folder| folder.into_path().ok())
        .map(|folder| folder.to_string_lossy().to_string()))
}
