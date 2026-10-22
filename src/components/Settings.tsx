import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { BadgeCheck, FolderOpen, LogOut, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { isTauriAvailable } from '../lib/tauri';
import { userMessage } from '../lib/errors';
import { cn } from '../lib/utils';
import type { QualityPreference } from '../types/bilibili';
import Avatar from './ui/Avatar';
import Button from './ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card';
import CustomSelect from './ui/CustomSelect';
import { useMessage } from './ui/message-context';

export default function Settings() {
  const {
    downloadDir,
    isDownloadDirDefault,
    setDownloadDir,
    userProfile,
    isLoggedIn,
    logout,
    qualityPreference,
    autoOpenFolder,
    setQualityPreference,
    setAutoOpenFolder,
  } = useAppStore();
  const { success, error, warning } = useMessage();
  const [isPicking, setIsPicking] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const isVip = userProfile?.vip_type === 1;

  // 打开系统原生的文件夹选择器
  const pickDownloadDir = async () => {
    if (!isTauriAvailable()) {
      warning('此功能暂时不可用，请重启应用后再试。');
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
      success('下载位置已更新。');
    } catch (pickError) {
      error(userMessage(pickError, '无法选择文件夹，请稍后重试。'), '选择位置失败');
    } finally {
      setIsPicking(false);
    }
  };

  // 恢复为系统下载目录
  const resetDownloadDir = async () => {
    if (!isTauriAvailable()) {
      warning('此功能暂时不可用，请重启应用后再试。');
      return;
    }

    setIsResetting(true);
    try {
      await setDownloadDir(null);
      success('已恢复为系统默认的下载文件夹。');
    } catch (resetError) {
      error(userMessage(resetError, '恢复默认下载位置失败，请稍后重试。'), '操作失败');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="custom-scrollbar h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-5 p-6">
        <div data-tauri-drag-region>
          <h1 className="pointer-events-none text-xl font-bold tracking-tight text-fg">设置</h1>
          <p className="pointer-events-none mt-0.5 text-xs text-muted">账号信息与下载设置。</p>
        </div>

        {isLoggedIn && (
          <Card>
            <CardBody className="flex flex-wrap items-center gap-4 p-6">
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
                <p className="mt-0.5 text-xs text-muted">
                  {isVip ? '大会员 · 可下载 4K 超清画质' : '已登录 · 可下载高清视频'}
                </p>
              </div>
              <Button variant="ghost" className="rounded-full" onClick={logout}>
                <LogOut size={14} aria-hidden="true" />
                退出登录
              </Button>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              <SlidersHorizontal size={16} className="text-accent-fg" aria-hidden="true" />
              下载偏好
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-fg">默认画质</label>
              <CustomSelect
                value={qualityPreference}
                options={[
                  { value: 'ask', label: '每次询问' },
                  { value: 'highest', label: '最高画质' },
                  { value: '1080p', label: '1080P 高清' },
                  { value: '720p', label: '720P 高清' },
                ]}
                onChange={(value) => setQualityPreference(value as QualityPreference)}
              />
              <p className="text-xs text-subtle-fg">
                选择固定画质后，粘贴链接会直接开始下载；「每次询问」会先让你挑选。
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-line-muted pt-4">
              <div>
                <p className="text-sm font-medium text-fg">下载完成后在文件夹中显示</p>
                <p className="mt-0.5 text-xs text-muted">下载完成后自动打开文件所在位置。</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={autoOpenFolder}
                aria-label="下载完成后在文件夹中显示"
                onClick={() => setAutoOpenFolder(!autoOpenFolder)}
                className={cn(
                  'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                  autoOpenFolder ? 'bg-accent' : 'bg-neutral-subtle',
                )}
              >
                <span
                  className={cn(
                    'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                    autoOpenFolder && 'translate-x-5',
                  )}
                />
              </button>
            </div>
          </CardBody>
        </Card>

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
              <p className="text-xs text-muted">视频会保存到</p>
              <p className="mt-1 break-all font-mono text-sm text-fg">
                {downloadDir || '正在读取…'}
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
                {isPicking ? '正在选择…' : '更改位置'}
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
              默认保存到系统的「下载」文件夹。下载完成后可以直接从任务列表打开所在位置。
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
