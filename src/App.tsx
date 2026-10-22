import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Download,
  FlaskConical,
  QrCode,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from 'lucide-react';
import './App.css';
import Downloader from './components/Downloader';
import QrLoginPanel from './components/QrLoginPanel';
import SettingsPage from './components/Settings';
import TestPage from './components/TestPage';
import { Card, CardBody } from './components/ui/Card';
import { MessageProvider } from './components/ui/MessageContext';
import { hasOverlayTitleBar } from './lib/platform';
import { useSystemTheme } from './lib/theme';
import { cn } from './lib/utils';
import { useAppStore } from './store/appStore';

type Page = 'download' | 'test' | 'settings';

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Zap,
    title: '最高 4K 清晰度',
    description: '登录后可获取大会员专属的超清视频流。',
  },
  {
    icon: Download,
    title: '音视频自动合并',
    description: '内置 FFmpeg，下载完成后自动合并为完整 MP4。',
  },
  {
    icon: Sparkles,
    title: '转码与提取音频',
    description: '一键导出、转换为 AVI/MKV 或提取 MP3。',
  },
  {
    icon: ShieldCheck,
    title: '数据只留在本机',
    description: 'Cookie 与下载记录均保存在本地。',
  },
];

interface SideNavItemProps {
  active: boolean;
  icon: LucideIcon;
  onClick: () => void;
  badge?: number;
  children: React.ReactNode;
}

function SideNavItem({ active, icon: Icon, onClick, badge, children }: SideNavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition-colors',
        active
          ? 'bg-accent-subtle font-semibold text-accent-fg'
          : 'text-muted hover:bg-inset hover:text-fg',
      )}
    >
      <Icon
        size={18}
        aria-hidden="true"
        className={cn(
          'shrink-0 transition-colors',
          active ? 'text-accent-fg' : 'text-subtle-fg group-hover:text-fg',
        )}
      />
      <span className="flex-1 text-left">{children}</span>
      {badge ? (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none',
            active ? 'bg-accent text-white' : 'bg-neutral-subtle text-muted',
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** 未登录时的欢迎/登录页 */
function Welcome() {
  return (
    <div className="relative h-full overflow-y-auto">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(251,114,153,0.14),transparent_72%)] dark:bg-[radial-gradient(60%_50%_at_50%_0%,rgba(251,114,153,0.1),transparent_72%)]"
        aria-hidden="true"
      />
      {/* 无侧边栏时也要保留窗口拖动区域 */}
      <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-12" aria-hidden="true" />
      <div className="relative mx-auto grid min-h-full w-full max-w-4xl items-center gap-10 px-10 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <section>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-subtle px-3 py-1 text-xs font-medium text-accent-fg">
            <Sparkles size={12} aria-hidden="true" />
            本地运行 · 无需上传
          </span>
          <h1 className="mt-4 text-4xl/[1.18] font-bold tracking-tight text-fg sm:text-[44px]/[1.14]">
            下载你喜欢的
            <br />
            <span className="bg-gradient-to-r from-[#fb7299] via-[#ff85a8] to-[#ffa3c0] bg-clip-text text-transparent">
              哔哩哔哩视频
            </span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            支持最高 4K 清晰度，自动合并音视频流，并可直接导出、转码或提取音频。
          </p>

          <ul className="mt-7 grid gap-x-7 gap-y-5 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent-fg">
                  <Icon size={15} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-fg">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <Card className="rounded-2xl">
          <CardBody className="space-y-4 p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-subtle text-accent-fg">
                <QrCode size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-fg">扫码登录</h2>
                <p className="text-xs text-muted">使用哔哩哔哩手机 App 扫码即可开始下载</p>
              </div>
            </div>
            <QrLoginPanel />
            <p className="text-center text-xs text-subtle-fg">登录信息仅保存在本机。</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function App() {
  const { isLoggedIn, loadLoginData, loadSettings, downloads } = useAppStore();
  const [page, setPage] = useState<Page>('download');

  useSystemTheme();

  // 应用启动时自动加载登录状态与下载设置
  useEffect(() => {
    loadLoginData();
    loadSettings();
  }, [loadLoginData, loadSettings]);

  // 退出登录后回到首页，避免下次登录直接落在"我的"
  useEffect(() => {
    if (!isLoggedIn) {
      setPage('download');
    }
  }, [isLoggedIn]);

  return (
    <MessageProvider>
      <div className="flex h-screen overflow-hidden bg-subtle text-fg">
        {/* 登录后才显示侧边栏导航 */}
        {isLoggedIn && (
          <aside className="flex w-[228px] shrink-0 flex-col border-r border-line bg-canvas">
            {/* macOS 覆盖式标题栏：顶部留出交通灯空间，同时作为窗口拖动区 */}
            {hasOverlayTitleBar() && <div data-tauri-drag-region className="h-10 shrink-0" />}

            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="主导航">
              <SideNavItem
                active={page === 'download'}
                icon={Download}
                onClick={() => setPage('download')}
                badge={downloads.length || undefined}
              >
                下载
              </SideNavItem>
              <SideNavItem
                active={page === 'test'}
                icon={FlaskConical}
                onClick={() => setPage('test')}
              >
                测试
              </SideNavItem>
              <SideNavItem
                active={page === 'settings'}
                icon={UserRound}
                onClick={() => setPage('settings')}
              >
                我的
              </SideNavItem>
            </nav>
          </aside>
        )}

        {/* 内容区：独立滚动 */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!isLoggedIn ? (
            <Welcome />
          ) : page === 'settings' ? (
            <SettingsPage />
          ) : page === 'test' ? (
            <TestPage />
          ) : (
            <Downloader />
          )}
        </main>
      </div>
    </MessageProvider>
  );
}

export default App;
