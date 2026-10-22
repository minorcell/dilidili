use crate::types::*;
use std::path::Path;
use std::time::Duration;
use tauri::Manager;
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

    // 优先使用服务端返回的文件大小预分配空间，减少写入过程中的碎片
    let expected_size = response.content_length();

    let file = tokio::fs::File::create(path)
        .await
        .map_err(|e| format!("创建{}文件失败: {}", label, e))?;

    if let Some(size) = expected_size {
        // 预分配失败不影响正常下载
        let _ = file.set_len(size).await;
    }

    let mut writer = tokio::io::BufWriter::with_capacity(WRITE_BUFFER_SIZE, file);
    let mut downloaded: u64 = 0;

    loop {
        match response.chunk().await {
            Ok(Some(chunk)) => {
                if let Err(e) = writer.write_all(&chunk).await {
                    drop(writer);
                    let _ = tokio::fs::remove_file(path).await;
                    return Err(format!("写入{}文件失败: {}", label, e));
                }
                downloaded += chunk.len() as u64;
            }
            Ok(None) => break,
            Err(e) => {
                drop(writer);
                let _ = tokio::fs::remove_file(path).await;
                return Err(format!("读取{}内容失败: {}", label, e));
            }
        }
    }

    writer
        .flush()
        .await
        .map_err(|e| format!("写入{}文件失败: {}", label, e))?;

    // 若实际大小和预分配大小不一致，截断到真实长度
    if let Some(size) = expected_size {
        if size != downloaded {
            let file = writer.get_mut();
            let _ = file.set_len(downloaded).await;
        }
    }

    writer
        .shutdown()
        .await
        .map_err(|e| format!("关闭{}文件失败: {}", label, e))?;

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

    // 创建下载目录
    let downloads_dir = app_handle
        .path()
        .download_dir()
        .map_err(|e| e.to_string())?
        .join("DILIDILI");

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

    let video_path = downloads_dir.join(format!("{}_video.mp4", safe_title));
    let audio_path = downloads_dir.join(format!("{}_audio.mp3", safe_title));
    let final_path = downloads_dir.join(format!("{}.mp4", safe_title));

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

    // 视频流和音频流互不依赖，并发下载可以显著缩短总耗时。
    // 使用 join! 而不是 try_join!，保证一方失败时另一方也能完整收敛，
    // 避免留下写了一半的临时文件。
    let referer = format!("https://www.bilibili.com/video/{}", video_data.bvid);

    let video_fut = download_stream_to_file(
        &client,
        video_url,
        &cookies,
        &referer,
        &video_path,
        "视频流",
    );

    let audio_fut = async {
        match audio_url {
            Some(url) => download_stream_to_file(
                &client,
                url,
                &cookies,
                &referer,
                &audio_path,
                "音频流",
            )
            .await
            .map(Some),
            None => {
                println!("⚠️ 音频流URL为空，跳过音频下载");
                Ok(None)
            }
        }
    };

    let (video_result, audio_result) = tokio::join!(video_fut, audio_fut);

    if let Err(e) = video_result {
        let _ = tokio::fs::remove_file(&audio_path).await;
        return Err(e);
    }

    let audio_downloaded = match audio_result {
        Ok(downloaded) => downloaded.is_some(),
        Err(e) => {
            // 音频失败时清理可能残留的半成品，避免污染下载目录
            let _ = tokio::fs::remove_file(&audio_path).await;
            return Err(e);
        }
    };

    println!("=== 处理下载完成的文件 ===");

    let video_exists = tokio::fs::try_exists(&video_path).await.unwrap_or(false);
    let audio_exists = audio_downloaded
        && tokio::fs::try_exists(&audio_path).await.unwrap_or(false);

    println!(
        "视频文件存在: {}, 音频文件存在: {}",
        video_exists, audio_exists
    );

    // 如果只有视频流，直接重命名
    if video_exists && !audio_exists {
        println!("只有视频流，重命名为最终文件");
        tokio::fs::rename(&video_path, &final_path)
            .await
            .map_err(|e| format!("重命名视频文件失败: {}", e))?;
        return Ok(format!("视频下载完成: {:?}", final_path));
    }

    // 如果只有音频流，直接重命名
    if !video_exists && audio_exists {
        println!("只有音频流，重命名为最终文件");
        let audio_final_path = downloads_dir.join(format!("{}.mp3", safe_title));
        tokio::fs::rename(&audio_path, &audio_final_path)
            .await
            .map_err(|e| format!("重命名音频文件失败: {}", e))?;
        return Ok(format!("音频下载完成: {:?}", audio_final_path));
    }

    // 如果都有，进行FFmpeg合并
    if video_exists && audio_exists {
        println!("视频和音频都存在，开始FFmpeg合并");

        // 调用FFmpeg合并
        match crate::ffmpeg::merge_video_audio(
            app_handle.clone(),
            video_path.to_string_lossy().to_string(),
            audio_path.to_string_lossy().to_string(),
            final_path.to_string_lossy().to_string(),
        )
        .await
        {
            Ok(_) => {
                println!("✅ FFmpeg合并成功");
                return Ok(format!("视频下载并合并完成: {:?}", final_path));
            }
            Err(e) => {
                println!("⚠️ FFmpeg合并失败: {}，使用视频流", e);
                // 合并失败，保留视频流
                let _ = tokio::fs::remove_file(&audio_path).await;
                tokio::fs::rename(&video_path, &final_path)
                    .await
                    .map_err(|e| format!("重命名合成文件失败: {}", e))?;
                return Ok(format!("视频下载完成（合并失败，仅视频）: {:?}", final_path));
            }
        }
    }

    // 如果都不存在
    Err("下载失败：没有成功下载任何文件".to_string())
}
