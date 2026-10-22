import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  UserProfile,
  DownloadItem,
  StoredLoginData,
  DownloadSettings,
  DownloadPreferences,
  QualityPreference,
} from '../types/bilibili';

const HISTORY_KEY = 'dilidili.download-history.v1';
const HISTORY_LIMIT = 200;
const PREFERENCES_KEY = 'dilidili.preferences.v1';
const DEFAULT_PREFERENCES: DownloadPreferences = { quality: 'ask', autoOpenFolder: false };

/** 历史记录只保留展示需要的轻量字段，避免把视频详情和会过期的流地址写进本地存储 */
function toHistoryItem(item: DownloadItem): DownloadItem {
  return {
    id: item.id,
    url: item.url,
    title: item.title,
    progress: 100,
    status: 'completed',
    filePath: item.filePath,
    audioMerged: item.audioMerged,
    completedAt: item.completedAt,
    thumbnail: item.thumbnail,
    uploader: item.uploader,
    durationSeconds: item.durationSeconds,
    qualityLabel: item.qualityLabel,
    downloadSize: item.downloadSize,
  };
}

function readHistory(): DownloadItem[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is DownloadItem => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as DownloadItem;
        return typeof candidate.id === 'string' && typeof candidate.title === 'string';
      })
      .map((item) => ({ ...item, status: 'completed' as const, progress: 100 }))
      .slice(-HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function writeHistory(downloads: DownloadItem[]) {
  if (typeof localStorage === 'undefined') return;

  try {
    const history = downloads
      .filter((item) => item.status === 'completed')
      .slice(-HISTORY_LIMIT)
      .map(toHistoryItem);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('保存下载记录失败:', error);
  }
}

function readPreferences(): DownloadPreferences {
  if (typeof localStorage === 'undefined') return DEFAULT_PREFERENCES;

  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(raw) as Partial<DownloadPreferences>;
    const quality: QualityPreference =
      parsed.quality === 'highest' || parsed.quality === '1080p' || parsed.quality === '720p'
        ? parsed.quality
        : 'ask';

    return { quality, autoOpenFolder: Boolean(parsed.autoOpenFolder) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function writePreferences(preferences: DownloadPreferences) {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error('保存偏好设置失败:', error);
  }
}

interface AppState {
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  cookies: string;
  downloads: DownloadItem[];
  downloadDir: string;
  isDownloadDirDefault: boolean;
  qualityPreference: QualityPreference;
  autoOpenFolder: boolean;
  setLoginStatus: (isLoggedIn: boolean, userProfile?: UserProfile, cookies?: string) => void;
  addDownloadItem: (item: DownloadItem) => void;
  updateDownloadProgress: (id: string, progress: number) => void;
  updateDownloadStatus: (
    id: string,
    status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled',
  ) => void;
  updateDownloadMetrics: (
    id: string,
    metrics: {
      downloadedBytes?: number;
      totalBytes?: number;
      speedBytesPerSecond?: number;
    },
  ) => void;
  completeDownload: (id: string, result: { filePath: string; audioMerged: boolean }) => void;
  removeDownloadItem: (id: string) => void;
  clearCompleted: () => void;
  setQualityPreference: (quality: QualityPreference) => void;
  setAutoOpenFolder: (enabled: boolean) => void;
  logout: () => void;
  loadLoginData: () => Promise<void>;
  saveLoginData: () => Promise<void>;
  loadSettings: () => Promise<void>;
  setDownloadDir: (dir: string | null) => Promise<DownloadSettings>;
}

const initialPreferences = readPreferences();

export const useAppStore = create<AppState>((set, get) => ({
  isLoggedIn: false,
  userProfile: null,
  cookies: '',
  downloads: readHistory(),
  downloadDir: '',
  isDownloadDirDefault: true,
  qualityPreference: initialPreferences.quality,
  autoOpenFolder: initialPreferences.autoOpenFolder,
  setLoginStatus: async (isLoggedIn, userProfile, cookies) => {
    set({ isLoggedIn, userProfile, cookies: cookies || '' });

    // 如果登录成功，自动保存登录数据
    if (isLoggedIn && userProfile && cookies) {
      const { saveLoginData } = get();
      await saveLoginData();
    }
  },
  addDownloadItem: (item) =>
    set((state) => ({
      downloads: [...state.downloads, item],
    })),
  updateDownloadProgress: (id, progress) =>
    set((state) => ({
      downloads: state.downloads.map((item) => (item.id === id ? { ...item, progress } : item)),
    })),
  updateDownloadStatus: (id, status) =>
    set((state) => ({
      downloads: state.downloads.map((item) => (item.id === id ? { ...item, status } : item)),
    })),
  updateDownloadMetrics: (id, metrics) =>
    set((state) => ({
      downloads: state.downloads.map((item) => (item.id === id ? { ...item, ...metrics } : item)),
    })),
  completeDownload: (id, { filePath, audioMerged }) => {
    set((state) => ({
      downloads: state.downloads.map((item) =>
        item.id === id
          ? {
              ...item,
              status: 'completed',
              progress: 100,
              filePath,
              audioMerged,
              completedAt: Date.now(),
            }
          : item,
      ),
    }));

    writeHistory(get().downloads);
  },
  removeDownloadItem: (id) => {
    set((state) => ({ downloads: state.downloads.filter((item) => item.id !== id) }));
    writeHistory(get().downloads);
  },
  clearCompleted: () => {
    set((state) => ({
      downloads: state.downloads.filter((item) => item.status !== 'completed'),
    }));
    writeHistory(get().downloads);
  },
  setQualityPreference: (quality) => {
    set({ qualityPreference: quality });
    writePreferences({ quality, autoOpenFolder: get().autoOpenFolder });
  },
  setAutoOpenFolder: (autoOpenFolder) => {
    set({ autoOpenFolder });
    writePreferences({ quality: get().qualityPreference, autoOpenFolder });
  },
  logout: async () => {
    set({
      isLoggedIn: false,
      userProfile: null,
      cookies: '',
    });

    try {
      await invoke('clear_login_data');
    } catch {
      // 清除本地登录数据失败不影响退出登录
    }
  },
  loadLoginData: async () => {
    try {
      const loginData = await invoke<StoredLoginData | null>('load_login_data');

      if (loginData) {
        const isExpired = Date.now() - loginData.login_time > 7 * 24 * 60 * 60 * 1000;

        if (!isExpired) {
          set({
            isLoggedIn: true,
            userProfile: loginData.user_profile || null,
            cookies: loginData.cookies,
          });
        } else {
          await invoke('clear_login_data');
        }
      }
    } catch (error) {
      console.error('加载登录数据失败:', error);
    }
  },
  saveLoginData: async () => {
    const { isLoggedIn, userProfile, cookies } = get();

    if (isLoggedIn && userProfile && cookies) {
      const loginData: StoredLoginData = {
        cookies,
        user_profile: userProfile,
        login_time: Date.now(),
      };

      try {
        await invoke('save_login_data', { loginData });
      } catch (error) {
        console.error('保存登录数据失败:', error);
      }
    }
  },
  loadSettings: async () => {
    try {
      const settings = await invoke<DownloadSettings>('get_download_settings');
      set({
        downloadDir: settings.download_dir,
        isDownloadDirDefault: settings.is_default,
      });
    } catch (error) {
      console.error('加载下载设置失败:', error);
    }
  },
  setDownloadDir: async (dir) => {
    // path 为 null 时恢复系统默认下载目录
    const settings = await invoke<DownloadSettings>('set_download_dir', { path: dir });
    set({
      downloadDir: settings.download_dir,
      isDownloadDirDefault: settings.is_default,
    });
    return settings;
  },
}));
