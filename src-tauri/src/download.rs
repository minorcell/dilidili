use crate::fs_utils::{replace_file, temp_suffix, TempFileGuard, TempFileSet};
use crate::types::*;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;
use tokio::io::AsyncWriteExt;

// 正在下载的任务 ID 到取消标记的映射
pub type DownloadCancellations = Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>;

// 任务结束时从注册表移除，避免长期占用内存
struct CancelGuard {
    registry: DownloadCancellations,
    download_id: String,
}

impl Drop for CancelGuard {
    fn drop(&mut self) {
        if let Ok(mut registry) = self.registry.lock() {
            registry.remove(&self.download_id);
        }
    }
}

fn is_cancelled(cancel: &Option<Arc<AtomicBool>>) -> bool {
    cancel
        .as_ref()
        .is_some_and(|flag| flag.load(Ordering::Relaxed))
}

// 用户代理
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// 写文件时使用的缓冲区大小（256 KiB），避免每个网络分片都触发一次系统调用
const WRITE_BUFFER_SIZE: usize = 256 * 1024;

// 推送给前端的下载进度
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgressPayload {
    download_id: String,
    progress: f64,
    downloaded: u64,
    total: u64,
}

// 视频流与音频流并发下载，两者共享同一个进度统计：
// 已下载字节累加后除以两路总大小，得到一个整体百分比。
struct ProgressReporter {
    app: tauri::AppHandle,
    download_id: String,
    total: AtomicU64,
    downloaded: AtomicU64,
    last_percent: AtomicU8,
}

impl ProgressReporter {
    fn new(app: tauri::AppHandle, download_id: String, total: u64) -> Self {
        Self {
            app,
            download_id,
            total: AtomicU64::new(total),
            downloaded: AtomicU64::new(0),
            last_percent: AtomicU8::new(0),
        }
    }

    fn add_downloaded(&self, bytes: u64) {
        self.downloaded.fetch_add(bytes, Ordering::Relaxed);
        self.report();
    }

    // HEAD 探测失败时，用实际响应的 Content-Length 兜底
    fn ensure_total(&self, total: u64) {
        let _ = self.total.compare_exchange(
            0,
            total,
            Ordering::Relaxed,
            Ordering::Relaxed,
        );
    }

    fn report(&self) {
        let total = self.total.load(Ordering::Relaxed);
        if total == 0 {
            return;
        }

        let downloaded = self.downloaded.load(Ordering::Relaxed);

        // 保留最后的 1%，等 ffmpeg 合并完成后再由前端置为 100%
        let percent = ((downloaded * 100 / total).min(99)) as u8;
        if percent == 0 {
            return;
        }

        let last = self.last_percent.load(Ordering::Relaxed);
        if percent > last
            && self
                .last_percent
                .compare_exchange(last, percent, Ordering::Relaxed, Ordering::Relaxed)
                .is_ok()
        {
            let _ = self.app.emit(
                "download-progress",
                DownloadProgressPayload {
                    download_id: self.download_id.clone(),
                    progress: percent as f64,
                    downloaded,
                    total,
                },
            );
        }
    }
}

// 构建媒体流请求，视频流和音频流共用同一套请求头
fn stream_request_with_method(
    client: &reqwest::Client,
    method: reqwest::Method,
    url: &str,
    cookies: &str,
    referer: &str,
) -> reqwest::RequestBuilder {
    client
        .request(method, url)
        .header("Cookie", cookies)
        .header("Referer", referer)
        .header("Origin", "https://www.bilibili.com")
        .header("Accept", "*/*")
        .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
        .header("Connection", "keep-alive")
        .header("Sec-Fetch-Dest", "empty")
        .header("Sec-Fetch-Mode", "cors")
        .header("Sec-Fetch-Site", "cross-site")
}

fn stream_request(
    client: &reqwest::Client,
    url: &str,
    cookies: &str,
    referer: &str,
) -> reqwest::RequestBuilder {
    stream_request_with_method(client, reqwest::Method::GET, url, cookies, referer)
}

// 用 HEAD 请求探测媒体流大小，用于计算整体下载进度。
// B 站的 DASH 接口不返回文件大小，只能从 CDN 响应里取。
async fn probe_content_length(
    client: &reqwest::Client,
    url: &str,
    cookies: &str,
    referer: &str,
) -> Option<u64> {
    stream_request_with_method(client, reqwest::Method::HEAD, url, cookies, referer)
        .send()
        .await
        .ok()?
        .content_length()
}

// 流式下载单个媒体流到文件。
//
// 旧实现使用 `response.bytes()` 把整个视频/音频读进内存后再写盘，
// 大文件会造成明显的内存峰值和界面卡顿。这里改为边收边写，
// 内存占用只与缓冲区大小相关。
//
// 文件在下载过程中由 `TempFileGuard` 守护：任何错误（包括 flush/shutdown）
// 或 future 被取消时都会删除未完成的文件。
async fn download_stream_to_file(
    client: &reqwest::Client,
    url: &str,
    cookies: &str,
    referer: &str,
    path: &Path,
    label: &str,
    reporter: Option<Arc<ProgressReporter>>,
    cancel: Option<Arc<AtomicBool>>,
) -> Result<u64, String> {
    if is_cancelled(&cancel) {
        return Err(format!("{}下载已取消", label));
    }

    println!("=== 开始下载{} ===", label);
    println!("{}URL: {}", label, url);
    println!("保存到: {:?}", path);

    let mut response = stream_request(client, url, cookies, referer)
        .send()
        .await
        .map_err(|e| format!("{}请求失败: {}", label, e))?;

    let status = response.status();
    println!("{}响应状态: {}", label, status);

    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "无法读取错误信息".to_string());
        return Err(format!("{}下载失败: {} - {}", label, status, error_text));
    }

    if let Some(length) = response.content_length() {
        if let Some(reporter) = reporter.as_ref() {
            reporter.ensure_total(length);
        }
    }

    let file = tokio::fs::File::create(path)
        .await
        .map_err(|e| format!("创建{}文件失败: {}", label, e))?;

    // 创建成功后立刻交给守卫，后续任何失败分支都会清理
    let mut cleanup = TempFileGuard::new(path);

    let mut writer = tokio::io::BufWriter::with_capacity(WRITE_BUFFER_SIZE, file);
    let mut downloaded: u64 = 0;

    loop {
        if is_cancelled(&cancel) {
            return Err(format!("{}下载已取消", label));
        }

        match response.chunk().await {
            Ok(Some(chunk)) => {
                writer
                    .write_all(&chunk)
                    .await
                    .map_err(|e| format!("写入{}文件失败: {}", label, e))?;
                downloaded += chunk.len() as u64;
                if let Some(reporter) = reporter.as_ref() {
                    reporter.add_downloaded(chunk.len() as u64);
                }
            }
            Ok(None) => break,
            Err(e) => return Err(format!("读取{}内容失败: {}", label, e)),
        }
    }

    writer
        .flush()
        .await
        .map_err(|e| format!("写入{}文件失败: {}", label, e))?;

    writer
        .shutdown()
        .await
        .map_err(|e| format!("关闭{}文件失败: {}", label, e))?;

    cleanup.disarm();

    println!("✅ {}下载完成，共 {} bytes", label, downloaded);
    Ok(downloaded)
}

// 下载视频
#[tauri::command]
pub async fn download_video(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, DownloadCancellations>,
    video_data: VideoData,
    video_stream: VideoStream,
    audio_stream: AudioStream,
    cookies: String,
    download_id: Option<String>,
) -> Result<DownloadResult, String> {
    println!("=== 开始下载视频 ===");
    println!("视频标题: {}", video_data.title);
    println!("视频质量: {}", video_stream.description);

    // 注册取消标记，任务结束（成功、失败或取消）时由 guard 清理
    let cancel_flag = download_id.as_ref().map(|id| {
        let flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut registry) = state.lock() {
            registry.insert(id.clone(), flag.clone());
        }
        flag
    });
    let _cancel_guard = download_id.as_ref().map(|id| CancelGuard {
        registry: state.inner().clone(),
        download_id: id.clone(),
    });

    // 创建下载目录：优先使用设置页保存的目录，默认使用系统下载目录
    let downloads_dir = crate::settings::resolve_download_dir(&app_handle)?;

    tokio::fs::create_dir_all(&downloads_dir)
        .await
        .map_err(|e| e.to_string())?;

    // 安全的文件名
    let safe_title = video_data
        .title
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect::<String>();

    // 临时文件名带本次调用的唯一后缀，避免并发下载同一标题时互相删除对方的文件
    let temp_id = temp_suffix();
    let video_temp = downloads_dir.join(format!("{}_video_{}.mp4", safe_title, temp_id));
    let audio_temp = downloads_dir.join(format!("{}_audio_{}.m4a", safe_title, temp_id));
    let final_path = downloads_dir.join(format!("{}.mp4", safe_title));

    // 无论成功、失败还是提前返回，都不在下载目录留下本次调用的临时文件
    let _temp_cleanup = TempFileSet::new(vec![video_temp.clone(), audio_temp.clone()]);

    let video_url = video_stream
        .url
        .as_deref()
        .ok_or_else(|| "视频流URL为空".to_string())?;
    let audio_url = audio_stream.url.as_deref();

    // 视频流和音频流共用同一个客户端，复用连接池。
    // 使用 read_timeout 限制单次读取的等待时间，而不是限制整个下载的总时长，
    // 避免大文件在慢速网络下被整体超时中断。
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .read_timeout(Duration::from_secs(60))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())?;

    let referer = format!("https://www.bilibili.com/video/{}", video_data.bvid);

    // DASH 数据里没有文件大小，先并发探测两路流的总字节数，
    // 这样并发下载时也能按整体字节数计算进度。
    let (video_size, audio_size) = tokio::join!(
        probe_content_length(&client, video_url, &cookies, &referer),
        async {
            match audio_url {
                Some(url) => probe_content_length(&client, url, &cookies, &referer).await,
                None => None,
            }
        }
    );

    let reporter = download_id.map(|id| {
        Arc::new(ProgressReporter::new(
            app_handle.clone(),
            id,
            video_size.unwrap_or(0) + audio_size.unwrap_or(0),
        ))
    });

    // 视频流和音频流互不依赖，并发下载可以显著缩短总耗时。
    let mut video_fut = Box::pin(download_stream_to_file(
        &client,
        video_url,
        &cookies,
        &referer,
        &video_temp,
        "视频流",
        reporter.clone(),
        cancel_flag.clone(),
    ));

    let mut audio_fut = match audio_url {
        Some(url) => Some(Box::pin(download_stream_to_file(
            &client,
            url,
            &cookies,
            &referer,
            &audio_temp,
            "音频流",
            reporter.clone(),
            cancel_flag.clone(),
        ))),
        None => {
            println!("⚠️ 音频流URL为空，跳过音频下载");
            None
        }
    };

    // 只等待先结束的一方：任一条流失败时立刻处理，而不是像 join! 那样
    // 等另一条流完整下载结束。被放弃的 future 会在 drop 时删除半成品文件。
    let mut video_done: Option<Result<u64, String>> = None;
    let mut audio_done: Option<Result<u64, String>> = None;

    match audio_fut.as_mut() {
        Some(audio) => {
            tokio::select! {
                result = &mut video_fut => video_done = Some(result),
                result = audio => audio_done = Some(result),
            }
        }
        None => video_done = Some((&mut video_fut).await),
    }

    // 音频先失败且视频还没下完：音频单独存在没有意义，立即放弃视频流，
    // 避免用户白等整条视频下载结束才看到错误。
    if let Some(Err(e)) = &audio_done {
        if video_done.is_none() {
            println!("⚠️ 音频下载失败，中止视频下载: {}", e);
            return Err(format!("音频下载失败: {}", e));
        }
    }

    // 视频先失败：同样不再等待音频
    if matches!(video_done, Some(Err(_))) {
        audio_fut = None;
    }

    let video_result = match video_done {
        Some(result) => result,
        None => (&mut video_fut).await,
    };

    let audio_result: Option<Result<u64, String>> = match audio_done {
        Some(result) => Some(result),
        None => match audio_fut {
            Some(audio) => Some(audio.await),
            None => None,
        },
    };

    if let Err(e) = video_result {
        return Err(format!("视频下载失败: {}", e));
    }

    println!("=== 处理下载完成的文件 ===");

    // 视频成功、音频失败时，视频本身是完整的，退化为“仅视频”而不是丢弃。
    let audio_downloaded = match &audio_result {
        Some(Ok(_)) => true,
        Some(Err(e)) => {
            println!("⚠️ 音频下载失败，仅保存视频: {}", e);
            false
        }
        None => false,
    };

    if !audio_downloaded {
        replace_file(&video_temp, &final_path).await?;
        if audio_result.is_some() {
            println!("⚠️ 音频下载失败，已保存仅视频");
        } else {
            println!("⚠️ 没有音频流，已保存仅视频");
        }
        return Ok(DownloadResult {
            file_path: final_path.to_string_lossy().to_string(),
            has_audio: false,
        });
    }

    println!("视频和音频都存在，开始FFmpeg合并");

    // 调用FFmpeg合并
    match crate::ffmpeg::merge_video_audio(
        app_handle.clone(),
        video_temp.to_string_lossy().to_string(),
        audio_temp.to_string_lossy().to_string(),
        final_path.to_string_lossy().to_string(),
    )
    .await
    {
        Ok(_) => {
            println!("✅ FFmpeg合并成功");
            Ok(DownloadResult {
                file_path: final_path.to_string_lossy().to_string(),
                has_audio: true,
            })
        }
        Err(e) => {
            println!("⚠️ FFmpeg合并失败: {}，保留视频流", e);
            // 合并失败，保留完整的视频流
            replace_file(&video_temp, &final_path).await?;
            Ok(DownloadResult {
                file_path: final_path.to_string_lossy().to_string(),
                has_audio: false,
            })
        }
    }
}

// 取消正在进行的下载：设置标记后，下载循环会在下一个数据块处退出并清理临时文件
#[tauri::command]
pub fn cancel_download(
    state: tauri::State<'_, DownloadCancellations>,
    download_id: String,
) -> Result<(), String> {
    let registry = state.lock().map_err(|e| e.to_string())?;
    if let Some(flag) = registry.get(&download_id) {
        flag.store(true, Ordering::Relaxed);
    }
    Ok(())
}
