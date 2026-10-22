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
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { QrCodeData, LoginSuccessData, LoginStatus, UserProfile } from '../types/bilibili';
import { cn } from '../lib/utils';
import { isTauriAvailable } from '../lib/tauri';
import Button from './ui/Button';

interface QrLoginPanelProps {
  className?: string;
  /** 登录成功后的回调，例如关闭弹窗 */
  onSuccess?: () => void;
}

/** 哔哩哔哩扫码登录面板：挂载后自动获取并轮询二维码状态 */
export default function QrLoginPanel({ className, onSuccess }: QrLoginPanelProps) {
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [loginStatus, setLoginStatus] = useState<
    'idle' | 'loading' | 'polling' | 'success' | 'error'
  >('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [pollInterval, setPollInterval] = useState<number | null>(null);

  const { setLoginStatus: setGlobalLoginStatus } = useAppStore();

  // 挂载时自动获取二维码
  useEffect(() => {
    if (!isTauriAvailable()) {
      setLoginStatus('error');
      setStatusMessage('请在 Tauri 桌面应用中使用登录功能');
    } else {
      getQrCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

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

      startPolling(qrCodeData.qrcode_key);
    } catch (qrError) {
      setLoginStatus('error');
      setStatusMessage(`获取二维码失败：${qrError}`);
    }
  };

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
          case LoginStatus.SUCCESS: {
            setStatusMessage('登录成功！正在获取用户信息...');
            setLoginStatus('success');
            clearInterval(interval);

            try {
              const userProfile = await invoke<UserProfile>('get_user_info', {
                cookies: result.cookies,
              });
              setGlobalLoginStatus(true, userProfile, result.cookies);
            } catch {
              // 即使获取用户信息失败，也使用默认信息登录
              const defaultProfile = { name: '用户', avatar: '', mid: 0, vip_type: 0 };
              setGlobalLoginStatus(true, defaultProfile, result.cookies);
            }
            setStatusMessage('登录成功！正在跳转...');

            setTimeout(() => {
              onSuccess?.();
            }, 1500);
            break;
          }
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
          : 'bg-inset text-muted';

  return (
    <div className={cn('space-y-4', className)}>
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
            <code className="rounded bg-attention/10 px-1 py-0.5 font-mono">pnpm tauri dev</code>{' '}
            启动桌面应用。
          </span>
        </div>
      )}
    </div>
  );
}
