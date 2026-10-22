import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BadgeCheck, FolderOpen, LogOut, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { isTauriAvailable } from '../lib/tauri';
import Avatar from './ui/Avatar';
import Button from './ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card';
import { useMessage } from './ui/message-context';

export default function Settings() {
  const {
    downloadDir,
    isDownloadDirDefault,
    setDownloadDir,
    userProfile,
    isLoggedIn,
    logout,
  } = useAppStore();
  const { success, error, warning } = useMessage();
  const [isPicking, setIsPicking] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const isVip = userProfile?.vip_type === 1;

  // 打开系统原生的文件夹选择器
  const pickDownloadDir = async () => {
    if (!isTauriAvailable()) {
      warning('请在 Tauri 应用中使用此功能');
      return;
    }

    setIsPicking(true);
    try {
      const folder = await invoke<string | null>('select_download_folder', {
        currentDir: downloadDir || null,
      });

      if (!folder) {
        // 用户取消了选择
        return;
      }

      await setDownloadDir(folder);
      success(`下载目录已更新：${folder}`);
    } catch (pickError) {
      error(`选择文件夹失败：${pickError}`);
    } finally {
      setIsPicking(false);
    }
  };

  // 恢复为系统下载目录
  const resetDownloadDir = async () => {
    if (!isTauriAvailable()) {
      warning('请在 Tauri 应用中使用此功能');
      return;
    }

    setIsResetting(true);
    try {
      const settings = await setDownloadDir(null);
      success(`已恢复默认下载目录：${settings.download_dir}`);
    } catch (resetError) {
      error(`恢复默认目录失败：${resetError}`);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="custom-scrollbar h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-5 p-6">
        <div data-tauri-drag-region>
          <h1 className="pointer-events-none text-xl font-bold tracking-tight text-fg">我的</h1>
          <p className="pointer-events-none mt-0.5 text-xs text-muted">账户信息与下载设置。</p>
        </div>

        {isLoggedIn && (
          <Card>
            <CardBody className="space-y-4 p-6">
              <div className="flex items-center gap-4">
                <Avatar
                  src={userProfile?.avatar}
                  name={userProfile?.name}
                  className="h-14 w-14 ring-2 ring-accent/20"
                  iconSize={22}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-fg">
                      {userProfile?.name || '用户'}
                    </h2>
                    {isVip && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-attention-subtle px-2 py-0.5 text-xs font-medium text-attention-fg">
                        <BadgeCheck size={12} aria-hidden="true" />
                        大会员
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted">
                    UID {userProfile?.mid ?? '未知'}
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-line-muted text-sm">
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted">用户 ID</dt>
                  <dd className="font-mono text-fg">{userProfile?.mid ?? '未知'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted">会员状态</dt>
                  <dd className="font-medium text-fg">{isVip ? '大会员' : '普通用户'}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-muted">登录状态</dt>
                  <dd className="flex items-center gap-1.5 font-medium text-success-fg">
                    <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
                    已登录
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              <FolderOpen size={16} className="text-accent-fg" aria-hidden="true" />
              下载位置
            </CardTitle>
            {isDownloadDirDefault && (
              <span className="rounded-full bg-inset px-2.5 py-0.5 text-xs text-muted">默认</span>
            )}
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="rounded-xl bg-inset px-4 py-3">
              <p className="text-xs text-muted">当前下载目录</p>
              <p className="mt-1 break-all font-mono text-sm text-fg">
                {downloadDir || '正在加载…'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                className="rounded-full"
                onClick={pickDownloadDir}
                disabled={isPicking}
              >
                <FolderOpen size={14} aria-hidden="true" />
                {isPicking ? '选择中…' : '选择文件夹'}
              </Button>
              <Button
                className="rounded-full"
                onClick={resetDownloadDir}
                disabled={isDownloadDirDefault || isResetting}
              >
                <RotateCcw size={14} aria-hidden="true" />
                恢复默认
              </Button>
            </div>

            <p className="text-xs text-subtle-fg">
              新下载的视频会保存到此文件夹。默认使用系统下载目录，无需每次下载前重新选择。
            </p>
          </CardBody>
        </Card>

        {isLoggedIn && (
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-semibold text-fg">退出登录</p>
                <p className="mt-0.5 text-xs text-muted">清除本机保存的登录信息。</p>
              </div>
              <Button variant="danger" className="rounded-full" onClick={logout}>
                <LogOut size={14} aria-hidden="true" />
                退出登录
              </Button>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
