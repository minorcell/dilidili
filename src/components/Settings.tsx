import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, FolderOpen, RotateCcw } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { isTauriAvailable } from '../lib/tauri';
import Button from './ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card';
import { useMessage } from './ui/message-context';

interface SettingsProps {
  onBack: () => void;
}

export default function Settings({ onBack }: SettingsProps) {
  const { downloadDir, isDownloadDirDefault, setDownloadDir } = useAppStore();
  const { success, error, warning } = useMessage();
  const [isPicking, setIsPicking] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg">设置</h1>
          <p className="mt-1 text-sm text-muted">配置下载文件的保存位置。</p>
        </div>
        <Button size="sm" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" />
          返回
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <FolderOpen size={16} aria-hidden="true" />
            下载位置
          </CardTitle>
          {isDownloadDirDefault && (
            <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-xs text-muted">
              默认
            </span>
          )}
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="rounded-md border border-line bg-subtle px-3 py-2">
            <p className="text-xs text-muted">当前下载目录</p>
            <p className="mt-1 break-all font-mono text-sm text-fg">{downloadDir || '正在加载…'}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={pickDownloadDir} disabled={isPicking}>
              <FolderOpen size={14} aria-hidden="true" />
              {isPicking ? '选择中…' : '选择文件夹'}
            </Button>
            <Button onClick={resetDownloadDir} disabled={isDownloadDirDefault || isResetting}>
              <RotateCcw size={14} aria-hidden="true" />
              恢复默认
            </Button>
          </div>

          <p className="text-xs text-subtle-fg">
            新下载的视频会保存到此文件夹。默认使用系统下载目录，无需每次下载前重新选择。
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
