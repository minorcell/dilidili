import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  QrCode,
  RefreshCw,
  ScanLine,
  X,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { QrCodeData, LoginSuccessData, LoginStatus, UserProfile } from '../types/bilibili';
import Button from './ui/Button';
import { cn } from '../lib/utils';

interface LoginProps {
  onClose?: () => void;
}

// 检查是否在 Tauri 环境中
const isTauriAvailable = () => {
  return typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;
};

export default function Login({ onClose }: LoginProps) {
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [loginStatus, setLoginStatus] = useState<
    'idle' | 'loading' | 'polling' | 'success' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [pollInterval, setPollInterval] = useState<number | null>(null);

  const { setLoginStatus: setGlobalLoginStatus } = useAppStore();

  // 检查 Tauri 环境
  useEffect(() => {
    if (!isTauriAvailable()) {
      setLoginStatus('error');
      setStatusMessage('请在 Tauri 桌面应用中使用登录功能');
    } else {
      // 自动获取二维码（仅挂载时执行一次）
      getQrCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  // 支持 Esc 关闭
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 获取二维码
  const getQrCode = async () => {
    if (!isTauriAvailable()) {
      setLoginStatus('error');
      setStatusMessage('Tauri 环境不可用，请运行 pnpm tauri dev');
      return;
    }

    try {
      setLoginStatus('loading');
      setStatusMessage('正在获取登录二维码...');

      const qrCodeData: QrCodeData = await invoke('get_login_qr_code');

      setQrData(qrCodeData);
      setLoginStatus('polling');
      setStatusMessage('请使用哔哩哔哩 App 扫码登录');

      // 开始轮询登录状态
      startPolling(qrCodeData.qrcode_key);
    } catch (qrError) {
      setLoginStatus('error');
      setStatusMessage(`获取二维码失败：${qrError}`);
    }
  };

  // 开始轮询登录状态
  const startPolling = (qrcodeKey: string) => {
    const interval = window.setInterval(async () => {
      try {
        const result: LoginSuccessData = await invoke('poll_login_status', { qrcodeKey });
        const code = result.poll_data.code;

        switch (code) {
          case LoginStatus.PENDING:
            setStatusMessage('等待扫码中...');
            break;
          case LoginStatus.SCANNED:
            setStatusMessage('扫码成功，请在手机上确认登录');
            break;
          case LoginStatus.SUCCESS:
            setStatusMessage('登录成功！正在获取用户信息...');
            setLoginStatus('success');
            clearInterval(interval);

            // 获取用户信息
            try {
              const userProfile = await invoke<UserProfile>('get_user_info', {
                cookies: result.cookies,
              });
              setGlobalLoginStatus(true, userProfile, result.cookies);
              setStatusMessage('登录成功！正在跳转...');
            } catch {
              // 即使获取用户信息失败，也使用默认信息登录
              const defaultProfile = { name: '用户', avatar: '', mid: 0, vip_type: 0 };
              setGlobalLoginStatus(true, defaultProfile, result.cookies);
              setStatusMessage('登录成功！正在跳转...');
            }

            setTimeout(() => {
              onClose?.();
            }, 1500);
            break;
          case LoginStatus.EXPIRED:
            setStatusMessage('二维码已过期');
            setLoginStatus('error');
            clearInterval(interval);
            break;
          default:
            setStatusMessage(`状态：${result.poll_data.message}`);
            break;
        }
      } catch {
        setStatusMessage('网络连接错误，请检查网络');
        setLoginStatus('error');
        clearInterval(interval);
      }
    }, 2000);

    setPollInterval(interval);
  };

  // 重新获取二维码
  const refreshQrCode = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    setQrData(null);
    setLoginStatus('idle');
    setStatusMessage('');
    getQrCode();
  };

  const statusIcon = () => {
    switch (loginStatus) {
      case 'success':
        return <CheckCircle2 size={14} className="text-success-fg" aria-hidden="true" />;
      case 'error':
        return <XCircle size={14} className="text-danger-fg" aria-hidden="true" />;
      case 'loading':
        return <Loader2 size={14} className="animate-spin text-accent-fg" aria-hidden="true" />;
      case 'polling':
        return <ScanLine size={14} className="text-accent-fg" aria-hidden="true" />;
      default:
        return <QrCode size={14} className="text-muted" aria-hidden="true" />;
    }
  };

  const statusTone =
    loginStatus === 'success'
      ? 'bg-success-subtle text-success-fg'
      : loginStatus === 'error'
        ? 'bg-danger-subtle text-danger-fg'
        : loginStatus === 'polling' || loginStatus === 'loading'
          ? 'bg-accent-subtle text-accent-fg'
          : 'bg-subtle text-muted';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-overlay-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-dialog-title"
        className="w-full max-w-sm animate-dialog-in overflow-hidden rounded-2xl border border-line bg-canvas shadow-pop"
      >
        <div className="flex items-center justify-between border-b border-line-muted px-5 py-4">
          <h2 id="login-dialog-title" className="text-base font-semibold text-fg">
            登录账户
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭登录窗口"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-subtle hover:text-fg"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="text-sm text-muted">使用哔哩哔哩手机 App 扫描二维码完成登录。</p>

          {/* 二维码区域 */}
          <div className="flex justify-center">
            <div className="flex h-[212px] w-[212px] items-center justify-center rounded-2xl border border-line-muted bg-white p-3">
              {qrData ? (
                <QRCodeSVG
                  value={qrData.url}
                  size={184}
                  level="M"
                  includeMargin={false}
                  className="rounded-sm"
                />
              ) : loginStatus === 'error' ? (
                <div className="flex flex-col items-center gap-2 text-center">
                  <XCircle size={32} className="text-danger-fg" aria-hidden="true" />
                  <p className="text-xs text-muted">二维码获取失败</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Loader2 size={28} className="animate-spin text-accent-fg" aria-hidden="true" />
                  <p className="text-xs text-muted">正在生成二维码...</p>
                </div>
              )}
            </div>
          </div>

          {/* 状态信息 */}
          <div
            className={cn(
              'flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed',
              statusTone,
            )}
            role="status"
            aria-live="polite"
          >
            <span className="mt-0.5 shrink-0">{statusIcon()}</span>
            <span>{statusMessage || '准备获取登录二维码'}</span>
          </div>

          {/* 操作按钮 */}
          {loginStatus === 'error' && (
            <Button
              variant="primary"
              size="lg"
              className="w-full rounded-full"
              onClick={refreshQrCode}
              disabled={!isTauriAvailable()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              重新获取二维码
            </Button>
          )}

          {loginStatus === 'polling' && (
            <Button
              variant="default"
              size="lg"
              className="w-full rounded-full"
              onClick={refreshQrCode}
              disabled={!isTauriAvailable()}
            >
              <RefreshCw size={16} aria-hidden="true" />
              刷新二维码
            </Button>
          )}

          {loginStatus === 'success' && (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-success-subtle px-3 py-2.5 text-sm font-medium text-success-fg">
              <CheckCircle2 size={16} aria-hidden="true" />
              登录成功，正在初始化...
            </div>
          )}

          {!isTauriAvailable() && (
            <div className="flex items-start gap-2 rounded-xl bg-attention-subtle px-3.5 py-2.5 text-xs text-attention-fg">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                当前在浏览器环境中运行，登录需要桌面应用支持。请运行{' '}
                <code className="rounded bg-attention/10 px-1 py-0.5 font-mono">
                  pnpm tauri dev
                </code>{' '}
                启动桌面应用。
              </span>
            </div>
          )}

          <p className="text-center text-xs text-subtle-fg">
            登录信息仅保存在本机，不会上传到任何服务器。
          </p>
        </div>
      </div>
    </div>
  );
}
