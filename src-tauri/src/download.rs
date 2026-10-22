use crate::fs_utils::{replace_file, temp_suffix, TempFileGuard, TempFileSet};
use crate::types::*;
use std::path::Path;
use std::time::Duration;
use tokio::io::AsyncWriteExt;

// 用户代理
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// 写文件时使用的缓冲区大小（256 KiB），避免每个网络分片都触发一次系统调用
const WRITE_BUFFER_SIZE: usize = 256 * 1024;

// 构建媒体流请求，视频流和音频流共用同一套请求头
fn stream_request(
    client: &reqwest::Client,
    url: &str,
    cookies: &str,
    referer: &str,
) -> reqwest::RequestBuilder {
    client
        .get(url)
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
) -> Result<u64, String> {
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

    let file = tokio::fs::File::create(path)
        .await
        .map_err(|e| format!("创建{}文件失败: {}", label, e))?;

    // 创建成功后立刻交给守卫，后续任何失败分支都会清理
    let mut cleanup = TempFileGuard::new(path);

    let mut writer = tokio::io::BufWriter::with_capacity(WRITE_BUFFER_SIZE, file);
    let mut downloaded: u64 = 0;

    loop {
        match response.chunk().await {
            Ok(Some(chunk)) => {
                writer
                    .write_all(&chunk)
                    .await
                    .map_err(|e| format!("写入{}文件失败: {}", label, e))?;
                downloaded += chunk.len() as u64;
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
    video_data: VideoData,
    video_stream: VideoStream,
    audio_stream: AudioStream,
    cookies: String,
) -> Result<String, String> {
    println!("=== 开始下载视频 ===");
    println!("视频标题: {}", video_data.title);
    println!("视频质量: {}", video_stream.description);

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

    // 视频流和音频流互不依赖，并发下载可以显著缩短总耗时。
    let mut video_fut = Box::pin(download_stream_to_file(
        &client,
        video_url,
        &cookies,
        &referer,
        &video_temp,
        "视频流",
    ));

    let mut audio_fut = match audio_url {
        Some(url) => Some(Box::pin(download_stream_to_file(
            &client,
            url,
            &cookies,
            &referer,
            &audio_temp,
            "音频流",
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
        let message = if audio_result.is_some() {
            "视频下载完成（音频下载失败，已保存仅视频）"
        } else {
            "视频下载完成（无音频流）"
        };
        return Ok(format!("{}: {:?}", message, final_path));
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
            Ok(format!("视频下载并合并完成: {:?}", final_path))
        }
        Err(e) => {
            println!("⚠️ FFmpeg合并失败: {}，保留视频流", e);
            // 合并失败，保留完整的视频流
            replace_file(&video_temp, &final_path).await?;
            Ok(format!("视频下载完成（合并失败，仅视频）: {:?}", final_path))
        }
    }
}
