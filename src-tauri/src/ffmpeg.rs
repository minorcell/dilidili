use crate::fs_utils::{replace_file, temp_suffix, TempFileGuard};
use std::path::{Path, PathBuf};
use tauri::Manager;
use tokio::process::Command;

// 进程内缓存已解析的 ffmpeg 路径，避免每条命令都重复探测
static FFMPEG_PATH: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

// 获取ffmpeg可执行文件路径
fn get_ffmpeg_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Some(path) = FFMPEG_PATH.get() {
        return Ok(path.clone());
    }

    let path = resolve_ffmpeg_path(app_handle)?;
    let _ = FFMPEG_PATH.set(path.clone());
    Ok(path)
}

fn resolve_ffmpeg_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    println!("开始查找ffmpeg可执行文件...");
    println!("当前工作目录: {:?}", std::env::current_dir().unwrap_or_default());
    
    // 尝试的路径列表
    let possible_paths = vec![
        // 1. 项目根目录下的ffmpeg（回退到父目录）
        Path::new("../../../ffmpeg").to_path_buf(),
        Path::new("../../ffmpeg").to_path_buf(), 
        Path::new("../ffmpeg").to_path_buf(),
        // 2. resources目录
        Path::new("resources/ffmpeg").to_path_buf(),
        Path::new("../resources/ffmpeg").to_path_buf(),
        Path::new("../../resources/ffmpeg").to_path_buf(),
        Path::new("../../../resources/ffmpeg").to_path_buf(),
        // 3. 当前目录
        Path::new("./ffmpeg").to_path_buf(),
        Path::new("ffmpeg").to_path_buf(),
    ];
    
    // 逐一检查路径
    for path in &possible_paths {
        if path.exists() {
            let canonical_path = path.canonicalize().unwrap_or(path.clone());
            println!("✅ 找到ffmpeg: {:?}", canonical_path);
            return Ok(canonical_path);
        }
    }
    
    // 4. 尝试应用资源目录（生产环境）
    if let Ok(resource_dir) = app_handle.path().resource_dir() {
        let ffmpeg_path = resource_dir.join("ffmpeg");
        if ffmpeg_path.exists() {
            println!("✅ 找到资源目录ffmpeg: {:?}", ffmpeg_path);
            return Ok(ffmpeg_path);
        }
    }
    
    // 5. 最后尝试系统PATH中的ffmpeg
    match which::which("ffmpeg") {
        Ok(path) => {
            println!("✅ 使用系统ffmpeg: {:?}", path);
            Ok(path)
        }
        Err(_) => {
            println!("❌ 未找到ffmpeg可执行文件");
            println!("尝试的路径:");
            for path in &possible_paths {
                println!("  - {:?} (存在: {})", path, path.exists());
            }
            if let Ok(resource_dir) = app_handle.path().resource_dir() {
                println!("  - {:?}", resource_dir.join("ffmpeg"));
            }
            println!("  - 系统PATH");
            Err("未找到ffmpeg可执行文件".to_string())
        }
    }
}

// 合并音视频文件
#[tauri::command]
pub async fn merge_video_audio(
    app_handle: tauri::AppHandle,
    video_path: String,
    audio_path: String,
    output_path: String
) -> Result<String, String> {
    println!("=== 开始合并音视频 ===");
    println!("视频文件: {}", video_path);
    println!("音频文件: {}", audio_path);
    println!("输出文件: {}", output_path);
    
    let ffmpeg_path = get_ffmpeg_path(&app_handle)?;
    
    // 检查输入文件是否存在
    ensure_file_exists(&video_path, "视频文件").await?;
    ensure_file_exists(&audio_path, "音频文件").await?;
    
    // 确保输出目录存在
    let output = Path::new(&output_path);
    if let Some(parent) = output.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("创建输出目录失败: {}", e))?;
    }
    
    // 先写入同目录下的临时文件，成功后再替换目标文件。
    // 这样即使 ffmpeg 在探测输入阶段就失败（从未创建输出），
    // 也不会误删用户已存在的同名文件。
    let temp_output = temp_output_path(output);
    let mut cleanup = TempFileGuard::new(&temp_output);
    let temp_output_arg = temp_output.to_string_lossy().to_string();

    // 先尝试直接复制音频流（B站DASH音频本身已是AAC，无需重新编码）。
    // 复制模式远快于重新编码；只有封装不兼容时才回退到AAC转码。
    let first = run_merge(
        &ffmpeg_path,
        &video_path,
        &audio_path,
        &temp_output_arg,
        true,
    )
    .await?;

    if !first.status.success() {
        let first_stderr = String::from_utf8_lossy(&first.stderr).to_string();

        // 磁盘写满、权限、输入损坏等错误重试也没有意义，直接返回首次的 stderr
        if !is_container_mismatch(&first_stderr) {
            println!("ffmpeg错误输出: {}", first_stderr);
            return Err(format!("ffmpeg合并失败: {}", first_stderr));
        }

        println!("⚠️ 音频流复制不兼容，回退到AAC转码: {}", first_stderr);
        let second = run_merge(
            &ffmpeg_path,
            &video_path,
            &audio_path,
            &temp_output_arg,
            false,
        )
        .await?;

        if !second.status.success() {
            let stderr = String::from_utf8_lossy(&second.stderr);
            println!("ffmpeg错误输出: {}", stderr);
            return Err(format!(
                "ffmpeg合并失败: {}（音频流复制尝试失败原因: {}）",
                stderr, first_stderr
            ));
        }
    }

    replace_file(&temp_output, output).await?;
    cleanup.disarm();

    println!("✅ 音视频合并成功");
    println!("输出文件: {}", output_path);

    // 删除临时文件
    let _ = tokio::fs::remove_file(&video_path).await;
    let _ = tokio::fs::remove_file(&audio_path).await;

    Ok(output_path)
}

// 同目录下的临时输出文件。保留 .mp4 扩展名，让 ffmpeg 能推断封装格式。
fn temp_output_path(output: &Path) -> PathBuf {
    let stem = output.file_stem().unwrap_or_default().to_string_lossy();
    output.with_file_name(format!(".{}.{}.part.mp4", stem, temp_suffix()))
}

// 判断失败原因是否属于封装/编码不兼容（值得用转码重试）
fn is_container_mismatch(stderr: &str) -> bool {
    [
        "Could not find tag for codec",
        "not currently supported in container",
        "Unsupported codec",
    ]
    .iter()
    .any(|hint| stderr.contains(hint))
}

// 输入文件检查：保留原始 I/O 错误，只有 NotFound 才报告“不存在”
async fn ensure_file_exists(path: &str, label: &str) -> Result<(), String> {
    match tokio::fs::metadata(path).await {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            Err(format!("{}不存在: {}", label, path))
        }
        Err(e) => Err(format!("无法访问{} {}: {}", label, path, e)),
    }
}

// 构建合并命令。`copy_audio` 为 true 时直接复制音频流，否则转码为 AAC。
fn merge_command(
    ffmpeg_path: &Path,
    video_path: &str,
    audio_path: &str,
    output_path: &str,
    copy_audio: bool,
) -> Command {
    let mut cmd = Command::new(ffmpeg_path);
    cmd.args(["-hide_banner", "-loglevel", "error", "-nostdin"])
        .args(["-i", video_path])
        .args(["-i", audio_path])
        .args(["-c:v", "copy"]);

    if copy_audio {
        cmd.args(["-c:a", "copy"]);
    } else {
        cmd.args(["-c:a", "aac", "-b:a", "128k"]);
    }

    cmd.args([
        "-movflags", "+faststart",          // 优化流媒体播放
        "-avoid_negative_ts", "make_zero",  // 避免负时间戳
        "-y",                               // 覆盖输出文件
        output_path,
    ]);

    cmd
}

async fn run_merge(
    ffmpeg_path: &Path,
    video_path: &str,
    audio_path: &str,
    output_path: &str,
    copy_audio: bool,
) -> Result<std::process::Output, String> {
    let mut cmd = merge_command(ffmpeg_path, video_path, audio_path, output_path, copy_audio);
    println!("执行命令: {:?}", cmd);
    cmd.output()
        .await
        .map_err(|e| format!("执行ffmpeg失败: {}", e))
}

// 转换视频格式
#[tauri::command]
pub async fn convert_video_format(
    app_handle: tauri::AppHandle,
    input_path: String,
    output_path: String,
    format: String // mp4, avi, mkv等
) -> Result<String, String> {
    println!("=== 开始转换视频格式 ===");
    println!("输入文件: {}", input_path);
    println!("输出文件: {}", output_path);
    println!("目标格式: {}", format);
    
    let ffmpeg_path = get_ffmpeg_path(&app_handle)?;
    
    if !tokio::fs::try_exists(&input_path).await.unwrap_or(false) {
        return Err(format!("输入文件不存在: {}", input_path));
    }
    
    // 确保输出目录存在
    if let Some(parent) = Path::new(&output_path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("创建输出目录失败: {}", e))?;
    }
    
    let mut cmd = Command::new(&ffmpeg_path);
    cmd.args(["-hide_banner", "-loglevel", "error", "-nostdin"]);

    // 根据格式选择不同的编码参数
    match format.to_lowercase().as_str() {
        "mp4" => {
            cmd.args(&[
                "-i", &input_path,
                "-c:v", "libx264",
                "-c:a", "aac",
                "-crf", "23",
                "-preset", "medium",
                "-y",
                &output_path
            ]);
        }
        "avi" => {
            cmd.args(&[
                "-i", &input_path,
                "-c:v", "libx264",
                "-c:a", "mp3",
                "-y",
                &output_path
            ]);
        }
        "mkv" => {
            cmd.args(&[
                "-i", &input_path,
                "-c:v", "copy",
                "-c:a", "copy",
                "-y",
                &output_path
            ]);
        }
        _ => {
            return Err(format!("不支持的格式: {}", format));
        }
    }
    
    println!("执行命令: {:?}", cmd);
    
    let output = cmd.output().await.map_err(|e| format!("执行ffmpeg失败: {}", e))?;
    
    if output.status.success() {
        println!("✅ 视频格式转换成功");
        Ok(output_path)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("ffmpeg错误输出: {}", stderr);
        Err(format!("ffmpeg转换失败: {}", stderr))
    }
}

// 提取音频
#[tauri::command]
pub async fn extract_audio(
    app_handle: tauri::AppHandle,
    video_path: String,
    audio_path: String,
    format: String // mp3, aac, wav等
) -> Result<String, String> {
    println!("=== 开始提取音频 ===");
    println!("视频文件: {}", video_path);
    println!("音频文件: {}", audio_path);
    println!("音频格式: {}", format);
    
    let ffmpeg_path = get_ffmpeg_path(&app_handle)?;
    
    if !tokio::fs::try_exists(&video_path).await.unwrap_or(false) {
        return Err(format!("视频文件不存在: {}", video_path));
    }
    
    // 确保输出目录存在
    if let Some(parent) = Path::new(&audio_path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("创建输出目录失败: {}", e))?;
    }
    
    let mut cmd = Command::new(&ffmpeg_path);
    cmd.args(["-hide_banner", "-loglevel", "error", "-nostdin"]);

    match format.to_lowercase().as_str() {
        "mp3" => {
            cmd.args(&[
                "-i", &video_path,
                "-vn",                  // 不处理视频流
                "-acodec", "mp3",       // 音频编码为MP3
                "-ab", "192k",          // 音频比特率
                "-y",
                &audio_path
            ]);
        }
        "aac" => {
            cmd.args(&[
                "-i", &video_path,
                "-vn",
                "-acodec", "aac",
                "-ab", "192k",
                "-y",
                &audio_path
            ]);
        }
        "wav" => {
            cmd.args(&[
                "-i", &video_path,
                "-vn",
                "-acodec", "pcm_s16le",
                "-y",
                &audio_path
            ]);
        }
        _ => {
            return Err(format!("不支持的音频格式: {}", format));
        }
    }
    
    println!("执行命令: {:?}", cmd);
    
    let output = cmd.output().await.map_err(|e| format!("执行ffmpeg失败: {}", e))?;
    
    if output.status.success() {
        println!("✅ 音频提取成功");
        Ok(audio_path)
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        println!("ffmpeg错误输出: {}", stderr);
        Err(format!("ffmpeg提取音频失败: {}", stderr))
    }
}

// 获取视频信息
#[tauri::command]
pub async fn get_local_video_info(
    app_handle: tauri::AppHandle,
    video_path: String
) -> Result<String, String> {
    let ffmpeg_path = get_ffmpeg_path(&app_handle)?;
    
    if !tokio::fs::try_exists(&video_path).await.unwrap_or(false) {
        return Err(format!("视频文件不存在: {}", video_path));
    }
    
    // 使用ffprobe获取视频信息
    let ffprobe_path = ffmpeg_path.parent()
        .ok_or("无法获取ffmpeg父目录")?
        .join("ffprobe");
    
    let mut cmd = Command::new(&ffprobe_path);
    cmd.args(&[
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        &video_path
    ]);
    
    let output = cmd.output().await.map_err(|e| format!("执行ffprobe失败: {}", e))?;
    
    if output.status.success() {
        let info = String::from_utf8_lossy(&output.stdout);
        Ok(info.to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("获取视频信息失败: {}", stderr))
    }
} 