use serde::{Deserialize, Serialize};

// API 返回的二维码数据结构
#[derive(Debug, Serialize, Deserialize)]
pub struct QrCodeData {
    pub url: String,
    pub qrcode_key: String,
}

// API 返回的二维码数据结构
#[derive(Debug, Serialize, Deserialize)]
pub struct QrCodeResponse {
    pub data: QrCodeData,
}

// API 返回的轮询数据结构
#[derive(Debug, Serialize, Deserialize)]
pub struct PollData {
    pub code: i32,
    pub message: String,
    pub url: Option<String>,
    pub refresh_token: Option<String>,
    pub timestamp: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PollResponse {
    pub data: PollData,
}

// 登录成功后返回给前端的结构
#[derive(Debug, Serialize, Deserialize)]
pub struct LoginSuccessData {
    pub poll_data: PollData,
    pub cookies: String,
}

// 视频信息相关结构体
#[derive(Debug, Serialize, Deserialize)]
pub struct VideoPage {
    pub cid: u64,
    pub page: u32,
    pub part: String,
    pub duration: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoData {
    pub bvid: String,
    pub aid: u64,
    pub title: String,
    pub desc: String,
    pub pic: String,
    #[serde(rename = "owner")]
    pub owner_info: VideoOwner,
    pub duration: u32,
    pub pages: Vec<VideoPage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoOwner {
    pub name: String,
    pub face: Option<String>,
    pub mid: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VideoInfoResponse {
    pub code: i32,
    pub message: String,
    pub data: Option<VideoData>,
}

// B站实际返回的DASH格式数据结构
#[derive(Debug, Serialize, Deserialize)]
pub struct DashVideo {
    pub id: u32,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub backup_url: Option<Vec<String>>,
    pub bandwidth: Option<u32>,
    pub mime_type: Option<String>,
    pub codecs: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub frame_rate: Option<String>,
    pub sar: Option<String>,
    pub start_with_sap: Option<u32>,
    pub segment_base: Option<serde_json::Value>,
    pub codecid: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashAudio {
    pub id: u32,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub backup_url: Option<Vec<String>>,
    pub bandwidth: Option<u32>,
    pub mime_type: Option<String>,
    pub codecs: Option<String>,
    pub segment_base: Option<serde_json::Value>,
    pub codecid: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashData {
    pub duration: u32,
    #[serde(rename = "minBufferTime")]
    pub min_buffer_time: f32,
    pub video: Vec<DashVideo>,
    pub audio: Vec<DashAudio>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayUrlData {
    pub from: String,
    pub result: String,
    pub message: String,
    pub quality: u32,
    pub format: String,
    pub timelength: u64,
    pub accept_format: String,
    pub accept_description: Vec<String>,
    pub accept_quality: Vec<u32>,
    pub video_codecid: u32,
    pub seek_param: String,
    pub seek_type: String,
    pub dash: DashData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlayUrlResponse {
    pub code: i32,
    pub message: String,
    pub data: Option<PlayUrlData>,
}

// 为了保持前端兼容性，创建转换结构
#[derive(Debug, Serialize, Deserialize)]
pub struct VideoStream {
    pub quality: u32,
    pub format: String,
    pub description: String,
    pub url: Option<String>,
    pub filesize: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AudioStream {
    pub quality: u32,
    pub format: String,
    pub url: Option<String>,
    pub filesize: Option<u64>,
}

// 用于前端的简化结构
#[derive(Debug, Serialize, Deserialize)]
pub struct SimplifiedPlayUrlData {
    pub video_streams: Vec<VideoStream>,
    pub audio_streams: Vec<AudioStream>,
}

// 下载完成后的结果。has_audio 为 false 表示只保存了画面，
// 前端据此提醒用户，而不是一律提示“下载成功”。
#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadResult {
    pub file_path: String,
    pub has_audio: bool,
}

// 存储的登录信息
#[derive(Debug, Serialize, Deserialize)]
pub struct StoredLoginData {
    pub cookies: String,
    pub user_profile: Option<UserProfile>,
    pub login_time: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserProfile {
    pub name: String,
    pub avatar: String,
    pub mid: u64,
    pub vip_type: u32,
}

// 用户信息API响应结构
#[derive(Debug, Serialize, Deserialize)]
pub struct VipInfo {
    #[serde(rename = "type")]
    pub vip_type: u32,
    #[serde(rename = "status")]
    pub vip_status: u32,
    #[serde(rename = "due_date")]
    pub due_date: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfoData {
    #[serde(rename = "isLogin")]
    pub is_login: bool,
    #[serde(rename = "email_verified")]
    pub email_verified: u32,
    pub face: String,
    #[serde(rename = "level_info")]
    pub level_info: serde_json::Value,
    pub mid: u64,
    #[serde(rename = "mobile_verified")]
    pub mobile_verified: u32,
    pub money: f64,
    pub moral: u32,
    pub official: serde_json::Value,
    #[serde(rename = "officialVerify")]
    pub official_verify: serde_json::Value,
    pub pendant: serde_json::Value,
    pub scores: u32,
    pub uname: String,
    #[serde(rename = "vipDueDate")]
    pub vip_due_date: Option<u64>,
    #[serde(rename = "vipStatus")]
    pub vip_status: u32,
    #[serde(rename = "vipType")]
    pub vip_type: u32,
    #[serde(rename = "vip_pay_type")]
    pub vip_pay_type: Option<u32>,
    #[serde(rename = "vip_theme_type")]
    pub vip_theme_type: Option<u32>,
    #[serde(rename = "vip_label")]
    pub vip_label: Option<serde_json::Value>,
    #[serde(rename = "vip_avatar_subscript")]
    pub vip_avatar_subscript: Option<u32>,
    #[serde(rename = "vip_nickname_color")]
    pub vip_nickname_color: Option<String>,
    pub vip: VipInfo,
    pub wallet: serde_json::Value,
    #[serde(rename = "has_shop")]
    pub has_shop: bool,
    #[serde(rename = "shop_url")]
    pub shop_url: Option<String>,
    #[serde(rename = "answer_status")]
    pub answer_status: u32,
    #[serde(rename = "is_senior_member")]
    pub is_senior_member: Option<u32>,
    #[serde(rename = "wbi_img")]
    pub wbi_img: Option<serde_json::Value>,
    #[serde(rename = "is_jury")]
    pub is_jury: Option<bool>,
    #[serde(rename = "name_render")]
    pub name_render: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserInfoResponse {
    pub code: i32,
    pub message: String,
    pub ttl: u32,
    pub data: UserInfoData,
}
