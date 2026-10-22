mod types;
mod auth;
mod video;
mod download;
mod storage;
mod ffmpeg;
mod export;
mod settings;
mod fs_utils;

use auth::*;
use video::*;
use download::*;
use storage::*;
use ffmpeg::*;
use export::*;
use settings::*;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DownloadCancellations::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_login_qr_code,
            poll_login_status,
            get_user_info,
            get_video_info,
            get_video_streams,
            download_video,
            cancel_download,
            test_stream_url,
            save_login_data,
            load_login_data,
            clear_login_data,
            merge_video_audio,
            convert_video_format,
            extract_audio,
            get_local_video_info,
            get_download_settings,
            set_download_dir,
            select_download_folder,
            export_file_to_folder,
            batch_export_files,
            open_folder,
            get_file_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
} 