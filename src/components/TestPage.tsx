import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Play,
  ShieldCheck,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import type { PlayUrlData, VideoData } from '../types/bilibili';
import Button from './ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card';
import { isTauriAvailable } from '../lib/tauri';
import { userMessage } from '../lib/errors';
import { cn } from '../lib/utils';

/** 用来检查视频信息与下载地址是否正常的公开示例视频 */
const SAMPLE_VIDEO_ID = 'BV1qEVazqEv3';

type CheckState = 'pending' | 'running' | 'passed' | 'failed';

interface CheckItem {
  key: string;
  label: string;
  state: CheckState;
  detail?: string;
}

const INITIAL_CHECKS: CheckItem[] = [
  { key: 'app', label: '应用状态', state: 'pending' },
  { key: 'login', label: '账号登录', state: 'pending' },
  { key: 'tasks', label: '下载任务', state: 'pending' },
];

const FULL_CHECKS: CheckItem[] = [
  ...INITIAL_CHECKS,
  { key: 'video', label: '视频信息', state: 'pending' },
  { key: 'stream', label: '下载画质', state: 'pending' },
  { key: 'audio', label: '声音轨道', state: 'pending' },
];

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}

const STATE_ICON: Record<CheckState, typeof CircleDashed> = {
  pending: CircleDashed,
  running: Loader2,
  passed: CheckCircle2,
  failed: XCircle,
};

const STATE_STYLE: Record<CheckState, { icon: string; text: string }> = {
  pending: { icon: 'text-subtle-fg', text: 'text-muted' },
  running: { icon: 'animate-spin text-accent-fg', text: 'text-fg' },
  passed: { icon: 'text-success-fg', text: 'text-fg' },
  failed: { icon: 'text-danger-fg', text: 'text-fg' },
};

export default function TestPage() {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL_CHECKS);
  const [isRunning, setIsRunning] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const { isLoggedIn, cookies, downloads, userProfile } = useAppStore();

  const tauriReady = isTauriAvailable();
  const activeCount = downloads.filter(
    (item) => item.status === 'pending' || item.status === 'downloading',
  ).length;

  const updateCheck = (key: string, patch: Partial<CheckItem>) => {
    setChecks((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const clearChecks = () => {
    setChecks(INITIAL_CHECKS);
    setSummary('');
  };

  const checkBasics = () => {
    updateCheck(
      'app',
      tauriReady
        ? { state: 'passed', detail: '运行正常' }
        : { state: 'failed', detail: '需要在 DiliDili 桌面应用中运行' },
    );
    updateCheck(
      'login',
      isLoggedIn
        ? {
            state: 'passed',
            detail: userProfile?.name ? `已登录（${userProfile.name}）` : '已登录',
          }
        : { state: 'failed', detail: '请先登录后再检查' },
    );
    updateCheck('tasks', {
      state: 'passed',
      detail:
        downloads.length === 0
          ? '还没有下载任务'
          : `共 ${downloads.length} 个任务${activeCount > 0 ? `，${activeCount} 个正在进行` : ''}`,
    });
  };

  const runQuickCheck = () => {
    setChecks(INITIAL_CHECKS.map((item) => ({ ...item, state: 'running' })));
    setSummary('');
    checkBasics();
    setSummary('基础检查完成。');
  };

  const runFullCheck = async () => {
    setIsRunning(true);
    setSummary('');
    setChecks(FULL_CHECKS.map((item) => ({ ...item, state: 'pending' })));

    updateCheck('app', { state: 'running' });
    if (!tauriReady) {
      updateCheck('app', { state: 'failed', detail: '需要在 DiliDili 桌面应用中运行' });
      setSummary('当前不在桌面应用中运行，无法继续检查。');
      setIsRunning(false);
      return;
    }
    updateCheck('app', { state: 'passed', detail: '运行正常' });

    updateCheck('login', { state: 'running' });
    if (!isLoggedIn || !cookies) {
      updateCheck('login', { state: 'failed', detail: '请先登录后再检查' });
      setSummary('登录后才能检查下载功能。');
      setIsRunning(false);
      return;
    }
    updateCheck('login', {
      state: 'passed',
      detail: userProfile?.name ? `已登录（${userProfile.name}）` : '已登录',
    });

    updateCheck('tasks', {
      state: 'passed',
      detail:
        downloads.length === 0
          ? '还没有下载任务'
          : `共 ${downloads.length} 个任务${activeCount > 0 ? `，${activeCount} 个正在进行` : ''}`,
    });

    updateCheck('video', { state: 'running' });
    let stage = 'video';
    try {
      const videoData = await invoke<VideoData>('get_video_info', { videoId: SAMPLE_VIDEO_ID });
      updateCheck('video', {
        state: 'passed',
        detail: `${videoData.title} · ${formatDuration(videoData.duration)}`,
      });

      const firstPage = videoData.pages?.[0];
      if (!firstPage) {
        updateCheck('stream', { state: 'failed', detail: '没有找到分集信息' });
        setSummary('视频信息可以读取，但找不到可分集，请换一个视频试试。');
        return;
      }

      stage = 'stream';
      updateCheck('stream', { state: 'running' });
      const streams = await invoke<PlayUrlData>('get_video_streams', {
        videoId: videoData.bvid,
        cid: firstPage.cid,
        cookies,
      });

      if (!streams.video_streams.length) {
        updateCheck('stream', { state: 'failed', detail: '没有可用的画质' });
        updateCheck('audio', { state: 'pending', detail: '等待下载画质检查通过' });
        setSummary('没有获取到可下载的画质，请稍后重试。');
        return;
      }

      const highest = streams.video_streams[0]?.description ?? '未知';
      updateCheck('stream', {
        state: 'passed',
        detail: `可用 ${streams.video_streams.length} 档画质，最高 ${highest}`,
      });

      stage = 'audio';
      updateCheck('audio', { state: 'running' });
      updateCheck(
        'audio',
        streams.audio_streams.length > 0
          ? { state: 'passed', detail: '已就绪，下载时会和画面合并' }
          : { state: 'passed', detail: '这个视频没有声音轨道，会保存为无声视频' },
      );

      setSummary('全部检查通过，可以正常下载。');
    } catch (checkError) {
      updateCheck(stage, {
        state: 'failed',
        detail: userMessage(checkError, '检查没有通过，请稍后重试。'),
      });
      setSummary('有项目没有通过，按提示处理后可以再检查一次。');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div data-tauri-drag-region>
          <h1 className="pointer-events-none text-xl font-bold tracking-tight text-fg">自检</h1>
          <p className="pointer-events-none mt-0.5 text-xs text-muted">
            检查下载功能是否正常。遇到问题时，可以先在这里跑一遍检查。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <ShieldCheck size={16} className="text-accent-fg" aria-hidden="true" />
              检查项目
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                className="rounded-full"
                onClick={runFullCheck}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    检查中
                  </>
                ) : (
                  <>
                    <Play size={14} aria-hidden="true" />
                    开始检查
                  </>
                )}
              </Button>
              <Button className="rounded-full" onClick={runQuickCheck} disabled={isRunning}>
                <Zap size={14} aria-hidden="true" />
                快速检查
              </Button>
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={clearChecks}
                disabled={isRunning || !summary}
              >
                <Trash2 size={14} aria-hidden="true" />
                清除结果
              </Button>
            </div>
          </CardHeader>

          <CardBody className="space-y-3">
            <ul className="divide-y divide-line-muted">
              {checks.map((item) => {
                const Icon = STATE_ICON[item.state];
                const style = STATE_STYLE[item.state];
                return (
                  <li key={item.key} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <Icon
                      size={17}
                      aria-hidden="true"
                      className={cn('mt-0.5 shrink-0', style.icon)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-sm font-medium', style.text)}>{item.label}</p>
                      {item.detail && (
                        <p className="mt-0.5 break-words text-xs leading-relaxed text-muted">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {summary ? (
              <p className="rounded-xl bg-inset px-4 py-3 text-sm text-fg">{summary}</p>
            ) : (
              <p className="text-xs text-subtle-fg">
                「开始检查」会用一段公开示例视频检查视频信息和下载地址，不会真的下载文件。
              </p>
            )}
          </CardBody>
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <Activity size={16} className="text-accent-fg" aria-hidden="true" />
                当前状态
              </CardTitle>
            </CardHeader>
            <dl className="divide-y divide-line-muted text-sm">
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-muted">应用状态</dt>
                <dd className="flex items-center gap-1.5 font-medium text-fg">
                  {tauriReady ? (
                    <CheckCircle2 size={14} className="text-success-fg" aria-hidden="true" />
                  ) : (
                    <XCircle size={14} className="text-danger-fg" aria-hidden="true" />
                  )}
                  {tauriReady ? '运行正常' : '需要在桌面应用中运行'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-muted">登录状态</dt>
                <dd
                  className={cn(
                    'flex items-center gap-1.5 font-medium',
                    isLoggedIn ? 'text-success-fg' : 'text-muted',
                  )}
                >
                  <span
                    className={cn('h-2 w-2 rounded-full', isLoggedIn ? 'bg-success' : 'bg-muted')}
                    aria-hidden="true"
                  />
                  {isLoggedIn ? '已登录' : '未登录'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-muted">当前用户</dt>
                <dd className="min-w-0 truncate font-medium text-fg">{userProfile?.name || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-muted">下载任务</dt>
                <dd className="font-medium text-fg">
                  {downloads.length} 个{activeCount > 0 ? `，${activeCount} 个正在进行` : ''}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <ShieldCheck size={16} className="text-accent-fg" aria-hidden="true" />
                检查说明
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-2.5 text-sm leading-relaxed text-muted">
              <p>「快速检查」只确认应用、登录和任务状态，不会联网。</p>
              <p>「开始检查」会额外读取示例视频的信息和下载地址，用来确认下载链路是否通畅。</p>
              <p>检查过程不会保存任何文件，也不会影响正在进行的下载。</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
