// 二维码数据
export interface QrCodeData {
  url: string;
  qrcode_key: string;
}

// 轮询状态数据
export interface PollData {
  code: number;
  message: string;
  url?: string;
  refresh_token?: string;
  timestamp?: number;
}

// 登录成功数据
export interface LoginSuccessData {
  poll_data: PollData;
  cookies: string;
}

// 登录状态枚举
export enum LoginStatus {
  PENDING = 86101, // 未扫码
  SCANNED = 86090, // 已扫码未确认
  SUCCESS = 0, // 登录成功
  EXPIRED = 86038, // 二维码已过期
  ERROR = -1, // 错误状态
}

// 用户基本信息
export interface UserProfile {
  name: string;
  avatar: string;
  mid: number;
  vip_type: number;
}

// 视频信息相关接口
export interface VideoPage {
  cid: number;
  page: number;
  part: string;
  duration: number;
}

export interface VideoOwner {
  name: string;
  face?: string;
  mid: number;
}

export interface VideoData {
  bvid: string;
  aid: number;
  title: string;
  desc: string;
  pic: string;
  /** 后端序列化为 owner */
  owner: VideoOwner;
  duration: number;
  pages: VideoPage[];
  author?: string;
}

// 视频流信息
export interface VideoStream {
  quality: number;
  format: string;
  description: string;
  url?: string;
  filesize?: number;
}

export interface AudioStream {
  quality: number;
  format: string;
  url?: string;
  filesize?: number;
}

export interface PlayUrlData {
  video_streams: VideoStream[];
  audio_streams: AudioStream[];
}

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  // 下载完成后的本地文件路径
  filePath?: string;
  // 是否成功合入声音；false 表示最终文件只有画面
  audioMerged?: boolean;
  completedAt?: number;
  // 用于历史记录展示的轻量信息（持久化时保留）
  thumbnail?: string;
  uploader?: string;
  durationSeconds?: number;
  qualityLabel?: string;
  // 预估的最终文件大小（视频 + 音频）
  downloadSize?: number;
  // 下载过程中的实时数据，不持久化
  downloadedBytes?: number;
  totalBytes?: number;
  speedBytesPerSecond?: number;
  // 可选的额外下载信息
  videoData?: VideoData;
  selectedQuality?: {
    video: VideoStream;
    audio: AudioStream;
  };
}

// download_video 命令的返回值
export interface DownloadResult {
  file_path: string;
  has_audio: boolean;
}

export interface StoredLoginData {
  cookies: string;
  user_profile?: UserProfile;
  login_time: number;
}

// 应用设置
export interface DownloadSettings {
  download_dir: string;
  is_default: boolean;
}

// 默认画质偏好：每次询问、最高画质、1080P、720P
export type QualityPreference = 'ask' | 'highest' | '1080p' | '720p';

export interface DownloadPreferences {
  quality: QualityPreference;
  autoOpenFolder: boolean;
}

// FFmpeg和导出相关类型
export interface FileInfo {
  path: string;
  name: string;
  size: number;
  is_dir: boolean;
  created?: number;
  modified?: number;
}

export interface ExportOptions {
  targetFolder: string;
  newFilename?: string;
  format?: 'mp4' | 'avi' | 'mkv' | 'mp3' | 'aac' | 'wav';
}

export interface MergeProgress {
  progress: number;
  message: string;
  stage: 'preparing' | 'merging' | 'completed' | 'failed';
}
