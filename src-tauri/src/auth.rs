use crate::types::*;
use reqwest::header::{HeaderMap, SET_COOKIE};

// 从响应的 Set-Cookie 头中提取登录需要的 cookie 对。
// 之前用 per-request 的 cookie Jar，会迫使每次轮询都新建 Client（TLS 握手）；
// 现在复用共享 Client，直接从响应头取 cookie。
fn collect_set_cookie(headers: &HeaderMap) -> String {
    headers
        .get_all(SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .filter_map(|raw| raw.split(';').next())
        .map(str::trim)
        .filter(|pair| pair.contains('='))
        .map(|pair| pair.to_string())
        .collect::<Vec<_>>()
        .join("; ")
}

// 获取登录二维码
#[tauri::command]
pub async fn get_login_qr_code() -> Result<QrCodeData, String> {
    let url = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate";

    let res = crate::http::client()
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let body = res
            .json::<QrCodeResponse>()
            .await
            .map_err(|e| e.to_string())?;
        Ok(body.data)
    } else {
        Err(format!("Failed to get QR code: {}", res.status()))
    }
}

// 轮询登录状态
#[tauri::command]
pub async fn poll_login_status(qrcode_key: String) -> Result<LoginSuccessData, String> {
    let url = format!(
        "https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key={}",
        qrcode_key
    );

    let res = crate::http::client()
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let cookies_str = collect_set_cookie(res.headers());
        let poll_resp = res
            .json::<PollResponse>()
            .await
            .map_err(|e| e.to_string())?;

        Ok(LoginSuccessData {
            poll_data: poll_resp.data,
            cookies: cookies_str,
        })
    } else {
        Err(format!("Polling failed: {}", res.status()))
    }
}

// 获取用户信息
#[tauri::command]
pub async fn get_user_info(cookies: String) -> Result<UserProfile, String> {
    println!("获取用户信息，cookies长度: {}", cookies.len());

    let url = "https://api.bilibili.com/x/web-interface/nav";

    let res = crate::http::client()
        .get(url)
        .header("Cookie", cookies)
        .header("Referer", "https://www.bilibili.com/")
        .send()
        .await
        .map_err(|e| {
            println!("请求失败: {}", e);
            e.to_string()
        })?;

    println!("响应状态: {}", res.status());

    if res.status().is_success() {
        let body_text = res.text().await.map_err(|e| e.to_string())?;

        let body: UserInfoResponse = serde_json::from_str(&body_text).map_err(|e| {
            println!("JSON解析失败: {}", e);
            e.to_string()
        })?;

        if body.code == 0 {
            // vip_status: 0=非大会员, 1=大会员
            let vip_status = body.data.vip_status;
            println!(
                "VIP状态: vip_status={}, vip_type={}",
                vip_status, body.data.vip_type
            );

            let user_profile = UserProfile {
                name: body.data.uname,
                avatar: body.data.face,
                mid: body.data.mid,
                vip_type: vip_status, // 使用vip_status而不是vip.vip_type
            };
            println!("用户信息获取成功: {:?}", user_profile);
            Ok(user_profile)
        } else {
            println!("API返回错误: code={}, message={}", body.code, body.message);
            Err(format!("Failed to get user info: {}", body.message))
        }
    } else {
        println!("HTTP请求失败: {}", res.status());
        Err(format!("Failed to get user info: {}", res.status()))
    }
}
