use crate::types::*;

// 用户代理
const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// DASH 接口不返回文件大小，用带宽和时长估算一个供界面展示的“约 xx MB”
fn estimate_size(bandwidth: Option<u32>, duration: u32) -> Option<u64> {
    bandwidth
        .map(|bits_per_second| (bits_per_second as u64).saturating_mul(duration as u64) / 8)
        .filter(|size| *size > 0)
}

// 获取视频信息
#[tauri::command]
pub async fn get_video_info(video_id: String) -> Result<VideoData, String> {
    let client = reqwest::Client::new();
    let url = if video_id.starts_with("BV") {
        format!("https://api.bilibili.com/x/web-interface/view?bvid={}", video_id)
    } else if video_id.starts_with("av") {
        let aid = video_id[2..].parse::<u64>().map_err(|_| "Invalid AV number".to_string())?;
        format!("https://api.bilibili.com/x/web-interface/view?aid={}", aid)
    } else {
        return Err("Invalid video ID format".to_string());
    };

    let res = client.get(&url)
        .header("User-Agent", USER_AGENT)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        // 先获取原始文本看看格式
        let text = res.text().await.map_err(|e| e.to_string())?;
        
        // 安全地截取前500个字符（不是字节）
        let preview = if text.chars().count() > 500 {
            text.chars().take(500).collect::<String>() + "..."
        } else {
            text.clone()
        };
        println!("API 原始响应: {}", preview);
        
        // 尝试解析 JSON
        let response: VideoInfoResponse = serde_json::from_str(&text)
            .map_err(|e| format!("JSON 解析错误: {}", e))?;
        
        if response.code == 0 {
            response.data.ok_or_else(|| "No video data".to_string())
        } else {
            Err(format!("API Error: {} - {}", response.code, response.message))
        }
    } else {
        Err(format!("HTTP Error: {}", res.status()))
    }
}

// 获取视频流
#[tauri::command]
pub async fn get_video_streams(video_id: String, cid: u64, cookies: String) -> Result<SimplifiedPlayUrlData, String> {
    let client = reqwest::Client::new();
    
    // B站视频流接口
    let url = format!(
        "https://api.bilibili.com/x/player/playurl?bvid={}&cid={}&qn=127&fourk=1&fnval=4048",
        video_id, cid
    );

    println!("=== 获取视频流 ===");
    println!("请求URL: {}", url);
    println!("Cookies长度: {}", cookies.len());

    let res = client.get(&url)
        .header("User-Agent", USER_AGENT)
        .header("Cookie", cookies)
        .header("Referer", "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    println!("响应状态: {}", res.status());

    if res.status().is_success() {
        // 先获取原始文本看看格式
        let text = res.text().await.map_err(|e| e.to_string())?;
        
        // 安全地截取前1000个字符（不是字节）
        let preview = if text.chars().count() > 1000 {
            text.chars().take(1000).collect::<String>() + "..."
        } else {
            text.clone()
        };
        println!("API 原始响应: {}", preview);
        
        // 尝试解析 JSON
        let response: PlayUrlResponse = serde_json::from_str(&text)
            .map_err(|e| format!("JSON 解析错误: {} - 原始响应: {}", e, preview))?;
        
        if response.code == 0 {
            let data = response.data.ok_or_else(|| "No stream data".to_string())?;
            
            // 转换DASH格式到简化格式
            let mut video_streams = Vec::new();
            let mut audio_streams = Vec::new();
            
            // 处理视频流
            for (index, dash_video) in data.dash.video.iter().enumerate() {
                let quality_index = if index < data.accept_quality.len() { index } else { 0 };
                let description_index = if index < data.accept_description.len() { index } else { 0 };
                
                video_streams.push(VideoStream {
                    quality: data.accept_quality.get(quality_index).copied().unwrap_or(dash_video.id),
                    format: "mp4".to_string(), // DASH通常是mp4
                    description: data.accept_description.get(description_index).cloned().unwrap_or_else(|| format!("质量 {}", dash_video.id)),
                    url: Some(dash_video.base_url.clone()),
                    filesize: estimate_size(dash_video.bandwidth, data.dash.duration),
                });
            }
            
            // 处理音频流
            for dash_audio in &data.dash.audio {
                audio_streams.push(AudioStream {
                    quality: dash_audio.id,
                    format: "m4a".to_string(), // DASH音频通常是m4a
                    url: Some(dash_audio.base_url.clone()),
                    filesize: estimate_size(dash_audio.bandwidth, data.dash.duration),
                });
            }
            
            println!("转换后的视频流: {} 个", video_streams.len());
            println!("转换后的音频流: {} 个", audio_streams.len());
            
            Ok(SimplifiedPlayUrlData {
                video_streams,
                audio_streams,
            })
        } else {
            Err(format!("API Error: {} - {}", response.code, response.message))
        }
    } else {
        Err(format!("HTTP Error: {}", res.status()))
    }
}

// 测试流URL可访问性
#[tauri::command]
pub async fn test_stream_url(url: String, cookies: String) -> Result<String, String> {
    println!("=== 测试流URL可访问性 ===");
    println!("URL: {}", url);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent(USER_AGENT)
        .build()
        .map_err(|e| e.to_string())?;

    let response = client.head(&url)
        .header("Cookie", &cookies)
        .header("Referer", "https://www.bilibili.com/")
        .header("Origin", "https://www.bilibili.com")
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let content_length = response.headers().get("content-length").cloned();
    let content_type = response.headers().get("content-type").cloned();

    println!("响应状态: {}", status);
    println!("Content-Length: {:?}", content_length);
    println!("Content-Type: {:?}", content_type);

    if status.is_success() {
        Ok(format!("URL可访问，状态: {}", status))
    } else {
        Err(format!("URL不可访问，状态: {}", status))
    }
} 