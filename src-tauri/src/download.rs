use crate::types::*;
use std::io::Write;
use std::fs;

// 用户代理
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// 下载视频
#[tauri::command]
pub async fn download_video(
    app_handle: tauri::AppHandle,
    video_data: VideoData,
    video_stream: VideoStream,
    audio_stream: AudioStream,
    cookies: String
) -> Result<String, String> {
    println!("=== 开始下载视频 ===");
    println!("视频标题: {}", video_data.title);
    println!("视频质量: {}", video_stream.description);
    println!("视频URL: {:?}", video_stream.url);
    println!("音频URL: {:?}", audio_stream.url);
    println!("Cookies长度: {}", cookies.len());
    
    // 创建下载目录：优先使用设置页保存的目录，默认使用系统下载目录
    let downloads_dir = crate::settings::resolve_download_dir(&app_handle)?;

    fs::create_dir_all(&downloads_dir).map_err(|e| e.to_string())?;
    
    // 安全的文件名
    let safe_title = video_data.title
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect::<String>();
    
    let video_filename = format!("{}_video.mp4", safe_title);
    let audio_filename = format!("{}_audio.mp3", safe_title);
    let final_filename = format!("{}.mp4", safe_title);
    
    let video_path = downloads_dir.join(&video_filename);
    let audio_path = downloads_dir.join(&audio_filename);
    let final_path = downloads_dir.join(&final_filename);

    // 创建带超时的客户端
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300)) // 5分钟超时
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())?;

    // 下载视频流
    if let Some(video_url) = &video_stream.url {
        println!("=== 开始下载视频流 ===");
        println!("视频URL: {}", video_url);
        println!("保存到: {:?}", video_path);
        
        let response = client.get(video_url)
            .header("Cookie", &cookies)
            .header("Referer", &format!("https://www.bilibili.com/video/{}", video_data.bvid))
            .header("Origin", "https://www.bilibili.com")
            .header("Accept", "*/*")
            .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
            .header("Accept-Encoding", "gzip, deflate, br")
            .header("Connection", "keep-alive")
            .header("Sec-Fetch-Dest", "empty")
            .header("Sec-Fetch-Mode", "cors")
            .header("Sec-Fetch-Site", "cross-site")
            .send()
            .await
            .map_err(|e| format!("视频流请求失败: {}", e))?;

        println!("视频流响应状态: {}", response.status());
        println!("视频流响应头: {:?}", response.headers());

        let status = response.status();
        if status.is_success() {
            let content = response.bytes().await.map_err(|e| format!("读取视频流内容失败: {}", e))?;
            println!("视频流大小: {} bytes", content.len());
            
            let mut file = std::fs::File::create(&video_path).map_err(|e| format!("创建视频文件失败: {}", e))?;
            file.write_all(&content).map_err(|e| format!("写入视频文件失败: {}", e))?;
            println!("✅ 视频流下载完成");
        } else {
            let error_text = response.text().await.unwrap_or_else(|_| "无法读取错误信息".to_string());
            return Err(format!("视频流下载失败: {} - {}", status, error_text));
        }
    } else {
        return Err("视频流URL为空".to_string());
    }

    // 下载音频流
    if let Some(audio_url) = &audio_stream.url {
        println!("=== 开始下载音频流 ===");
        println!("音频URL: {}", audio_url);
        println!("保存到: {:?}", audio_path);
        
        let response = client.get(audio_url)
            .header("Cookie", &cookies)
            .header("Referer", &format!("https://www.bilibili.com/video/{}", video_data.bvid))
            .header("Origin", "https://www.bilibili.com")
            .header("Accept", "*/*")
            .header("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")
            .header("Accept-Encoding", "gzip, deflate, br")
            .header("Connection", "keep-alive")
            .header("Sec-Fetch-Dest", "empty")
            .header("Sec-Fetch-Mode", "cors")
            .header("Sec-Fetch-Site", "cross-site")
            .send()
            .await
            .map_err(|e| format!("音频流请求失败: {}", e))?;

        println!("音频流响应状态: {}", response.status());
        println!("音频流响应头: {:?}", response.headers());

        let status = response.status();
        if status.is_success() {
            let content = response.bytes().await.map_err(|e| format!("读取音频流内容失败: {}", e))?;
            println!("音频流大小: {} bytes", content.len());
            
            let mut file = std::fs::File::create(&audio_path).map_err(|e| format!("创建音频文件失败: {}", e))?;
            file.write_all(&content).map_err(|e| format!("写入音频文件失败: {}", e))?;
            println!("✅ 音频流下载完成");
        } else {
            let error_text = response.text().await.unwrap_or_else(|_| "无法读取错误信息".to_string());
            return Err(format!("音频流下载失败: {} - {}", status, error_text));
        }
    } else {
        println!("⚠️ 音频流URL为空，跳过音频下载");
    }

    println!("=== 处理下载完成的文件 ===");
    
    // 检查文件是否存在
    let video_exists = video_path.exists();
    let audio_exists = audio_path.exists();
    
    println!("视频文件存在: {}, 音频文件存在: {}", video_exists, audio_exists);

    // 如果只有视频流，直接重命名
    if video_exists && !audio_exists {
        println!("只有视频流，重命名为最终文件");
        fs::rename(&video_path, &final_path).map_err(|e| format!("重命名视频文件失败: {}", e))?;
        return Ok(format!("视频下载完成: {:?}", final_path));
    }

    // 如果只有音频流，直接重命名
    if !video_exists && audio_exists {
        println!("只有音频流，重命名为最终文件");
        let audio_final_path = downloads_dir.join(format!("{}.mp3", safe_title));
        fs::rename(&audio_path, &audio_final_path).map_err(|e| format!("重命名音频文件失败: {}", e))?;
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
        ).await {
            Ok(_) => {
                println!("✅ FFmpeg合并成功");
                return Ok(format!("视频下载并合并完成: {:?}", final_path));
            }
            Err(e) => {
                println!("⚠️ FFmpeg合并失败: {}，使用视频流", e);
                // 合并失败，保留视频流
                let _ = fs::remove_file(&audio_path);
                fs::rename(&video_path, &final_path).map_err(|e| format!("重命名合成文件失败: {}", e))?;
                return Ok(format!("视频下载完成（合并失败，仅视频）: {:?}", final_path));
            }
        }
    }

    // 如果都不存在
    Err("下载失败：没有成功下载任何文件".to_string())
} 