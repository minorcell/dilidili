import { isTauriAvailable } from './tauri';

/**
 * 窗口是否使用覆盖式标题栏（macOS 桌面端）。
 * 激活后窗口内容延伸到交通灯所在行，页面需自行给左上角留出按钮空间。
 */
export const hasOverlayTitleBar = (): boolean =>
  isTauriAvailable() && /Mac/i.test(navigator.userAgent);
