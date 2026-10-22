import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
    UserProfile,
    DownloadItem,
    StoredLoginData,
    DownloadSettings,
} from '../types/bilibili';

interface AppState {
    isLoggedIn: boolean;
    userProfile: UserProfile | null;
    cookies: string;
    downloads: DownloadItem[];
    downloadDir: string;
    isDownloadDirDefault: boolean;
    setLoginStatus: (isLoggedIn: boolean, userProfile?: UserProfile, cookies?: string) => void;
    addDownloadItem: (item: DownloadItem) => void;
    updateDownloadProgress: (id: string, progress: number) => void;
    updateDownloadStatus: (id: string, status: 'pending' | 'downloading' | 'completed' | 'failed') => void;
    setDownloadFilePath: (id: string, filePath?: string) => void;
    logout: () => void;
    loadLoginData: () => Promise<void>;
    saveLoginData: () => Promise<void>;
    loadSettings: () => Promise<void>;
    setDownloadDir: (dir: string | null) => Promise<DownloadSettings>;
}

export const useAppStore = create<AppState>((set, get) => ({
    isLoggedIn: false,
    userProfile: null,
    cookies: '',
    downloads: [],
    downloadDir: '',
    isDownloadDirDefault: true,
    setLoginStatus: async (isLoggedIn, userProfile, cookies) => {
        set({ isLoggedIn, userProfile, cookies: cookies || '' });

        // 如果登录成功，自动保存登录数据
        if (isLoggedIn && userProfile && cookies) {
            const { saveLoginData } = get();
            await saveLoginData();
        }
    },
    addDownloadItem: (item) => set((state) => ({
        downloads: [...state.downloads, item]
    })),
    updateDownloadProgress: (id, progress) => set((state) => ({
        downloads: state.downloads.map(item =>
            item.id === id ? { ...item, progress } : item
        )
    })),
    updateDownloadStatus: (id, status) => set((state) => ({
        downloads: state.downloads.map(item =>
            item.id === id ? { ...item, status } : item
        )
    })),
    setDownloadFilePath: (id, filePath) => set((state) => ({
        downloads: state.downloads.map(item =>
            item.id === id ? { ...item, filePath } : item
        )
    })),
    logout: async () => {
        set({
            isLoggedIn: false,
            userProfile: null,
            cookies: ''
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
                        cookies: loginData.cookies
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
                login_time: Date.now()
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
                isDownloadDirDefault: settings.is_default
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
            isDownloadDirDefault: settings.is_default
        });
        return settings;
    }
}));