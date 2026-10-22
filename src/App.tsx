import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  Download,
  FlaskConical,
  FolderOpen,
  LogIn,
  LogOut,
  MonitorPlay,
  Moon,
  QrCode,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserRound,
  Zap,
} from 'lucide-react';
import './App.css';
import Downloader from './components/Downloader';
import Login from './components/Login';
import SettingsPage from './components/Settings';
import TestPage from './components/TestPage';
import UserProfile from './components/UserProfile';
import Avatar from './components/ui/Avatar';
import Button from './components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from './components/ui/Card';
import Logo from './components/ui/Logo';
import { MessageProvider } from './components/ui/MessageContext';
import { useTheme } from './lib/theme';
import { cn } from './lib/utils';
import { useAppStore } from './store/appStore';

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: MonitorPlay,
    title: '最高 4K 清晰度',
    description: '登录后可获取大会员专属的超清视频流。',
  },
  {
    icon: Zap,
    title: '音视频自动合并',
    description: '内置 FFmpeg，下载完成后自动合并为完整 MP4。',
  },
  {
    icon: FolderOpen,
    title: '导出、转码与提取音频',
    description: '一键导出到指定文件夹，或转换为 AVI/MKV、提取 MP3。',
  },
  {
    icon: ShieldCheck,
    title: '数据只留在本机',
    description: 'Cookie 与下载记录均保存在本地，不经过任何第三方服务器。',
  },
];

interface NavTabProps {
  active: boolean;
  icon: LucideIcon;
  onClick: () => void;
  children: React.ReactNode;
}

function NavTab({ active, icon: Icon, onClick, children }: NavTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors',
        active
          ? 'border-[#fd8c73] font-semibold text-fg'
          : 'border-transparent text-muted hover:border-line hover:text-fg',
      )}
    >
      <Icon size={16} aria-hidden="true" />
      {children}
    </button>
  );
}

function App() {
  const { isLoggedIn, userProfile, logout, loadLoginData, loadSettings } = useAppStore();
  const [showLogin, setShowLogin] = useState(false);
  const [showTestPage, setShowTestPage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { isDark, toggleTheme } = useTheme();

  // 应用启动时自动加载登录状态与下载设置
  useEffect(() => {
    loadLoginData();
    loadSettings();
  }, [loadLoginData, loadSettings]);

  // 点击菜单外部或按下 Esc 关闭用户菜单
  useEffect(() => {
    if (!showUserMenu) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showUserMenu]);

  return (
    <MessageProvider>
      <div className="flex min-h-screen flex-col bg-canvas text-fg">
        <header className="sticky top-0 z-40 border-b border-header-line bg-header text-header-fg">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
            <Logo onDark className="h-9 w-9" iconSize={20} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">DILIDILI</p>
              <p className="truncate text-xs leading-tight text-white/60">哔哩哔哩视频下载器</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                title="设置"
                aria-label="打开设置"
                aria-pressed={showSettings}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                <SettingsIcon size={16} aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                title={isDark ? '切换到浅色模式' : '切换到深色模式'}
                aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white/75 transition-colors hover:bg-white/10 hover:text-white"
              >
                {isDark ? (
                  <Sun size={16} aria-hidden="true" />
                ) : (
                  <Moon size={16} aria-hidden="true" />
                )}
              </button>

              {isLoggedIn ? (
                <div className="relative" ref={userMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowUserMenu((open) => !open)}
                    aria-haspopup="menu"
                    aria-expanded={showUserMenu}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1 text-header-fg transition-colors hover:bg-white/10"
                  >
                    <Avatar
                      src={userProfile?.avatar}
                      name={userProfile?.name}
                      className="h-6 w-6 border-white/20 bg-white/10 text-white/70"
                      iconSize={14}
                    />
                    <span className="hidden max-w-32 truncate text-sm sm:block">
                      {userProfile?.name || '用户'}
                    </span>
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={cn(
                        'text-white/60 transition-transform',
                        showUserMenu && 'rotate-180',
                      )}
                    />
                  </button>

                  {showUserMenu && (
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-2 w-60 animate-menu-in overflow-hidden rounded-md border border-line bg-canvas text-fg shadow-lg"
                    >
                      <div className="flex items-center gap-3 border-b border-line bg-subtle px-3 py-3">
                        <Avatar
                          src={userProfile?.avatar}
                          name={userProfile?.name}
                          className="h-8 w-8"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {userProfile?.name || '用户'}
                          </p>
                          <p className="truncate font-mono text-xs text-muted">
                            UID {userProfile?.mid ?? '未知'}
                          </p>
                        </div>
                      </div>

                      <div className="py-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowUserMenu(false);
                            setShowUserProfile(true);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-subtle"
                        >
                          <UserRound size={16} className="text-muted" aria-hidden="true" />
                          个人信息
                        </button>
                      </div>

                      <div className="border-t border-line py-1">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setShowUserMenu(false);
                            logout();
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-fg transition-colors hover:bg-danger-subtle"
                        >
                          <LogOut size={16} aria-hidden="true" />
                          退出登录
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="border-white/25 text-header-fg hover:border-white/40 hover:bg-white/10 hover:text-white"
                  onClick={() => setShowLogin(true)}
                >
                  <LogIn size={16} aria-hidden="true" />
                  登录
                </Button>
              )}
            </div>
          </div>
        </header>

        {isLoggedIn && (
          <nav className="border-b border-line bg-canvas" aria-label="主导航">
            <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4">
              <NavTab
                active={!showTestPage && !showSettings}
                icon={Download}
                onClick={() => {
                  setShowSettings(false);
                  setShowTestPage(false);
                }}
              >
                下载
              </NavTab>
              <NavTab
                active={showTestPage && !showSettings}
                icon={FlaskConical}
                onClick={() => {
                  setShowSettings(false);
                  setShowTestPage(true);
                }}
              >
                测试
              </NavTab>
            </div>
          </nav>
        )}

        <main className="flex-1">
          {showSettings ? (
            <SettingsPage onBack={() => setShowSettings(false)} />
          ) : showTestPage ? (
            <TestPage />
          ) : isLoggedIn ? (
            <Downloader onOpenSettings={() => setShowSettings(true)} />
          ) : (
            <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-20">
              <section>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-subtle px-2.5 py-1 text-xs text-muted">
                  <Sparkles size={12} className="text-accent-fg" aria-hidden="true" />
                  本地运行 · 无需上传
                </span>
                <h1 className="mt-4 text-4xl/[1.2] font-semibold tracking-tight text-fg sm:text-5xl/[1.15]">
                  下载你喜欢的
                  <br className="hidden sm:block" />
                  哔哩哔哩视频
                </h1>
                <p className="mt-4 max-w-md text-base text-muted">
                  支持最高 4K 清晰度，自动合并音视频流，并可直接导出、转码或提取音频。
                </p>

                <ul className="mt-8 space-y-4">
                  {FEATURES.map(({ icon: Icon, title, description }) => (
                    <li key={title} className="flex gap-3">
                      <Icon
                        size={16}
                        className="mt-0.5 shrink-0 text-accent-fg"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-semibold text-fg">{title}</p>
                        <p className="text-sm text-muted">{description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <Card>
                <CardHeader>
                  <CardTitle>
                    <QrCode size={16} aria-hidden="true" />
                    登录账户
                  </CardTitle>
                </CardHeader>
                <CardBody className="space-y-4">
                  <p className="text-sm text-muted">
                    使用哔哩哔哩手机 App 扫码登录，以获取高清与大会员清晰度的下载权限。
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => setShowLogin(true)}
                  >
                    <LogIn size={16} aria-hidden="true" />
                    使用二维码登录
                  </Button>
                  <p className="text-center text-xs text-subtle-fg">登录信息仅保存在本机。</p>
                </CardBody>
              </Card>
            </div>
          )}
        </main>

        <footer className="border-t border-line py-6">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-xs text-subtle-fg">
            <span>DILIDILI · 哔哩哔哩视频下载器</span>
            <span>MIT License</span>
          </div>
        </footer>

        {showLogin && <Login onClose={() => setShowLogin(false)} />}

        {showUserProfile && <UserProfile onClose={() => setShowUserProfile(false)} />}
      </div>
    </MessageProvider>
  );
}

export default App;
