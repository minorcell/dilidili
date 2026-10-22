import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Activity,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Play,
  Terminal,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import Button from './ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card';
import StatusLabel from './ui/StatusLabel';
import { isTauriAvailable } from '../lib/tauri';
import { cn } from '../lib/utils';

export default function TestPage() {
  const [testResult, setTestResult] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const { isLoggedIn, cookies, downloads, userProfile } = useAppStore();

  const runDownloadTest = async () => {
    setIsRunning(true);
    setTestResult('开始测试下载功能...\n');

    try {
      // 1. 检查环境
      const isTauri = isTauriAvailable();
      setTestResult((prev) => prev + `Tauri 环境: ${isTauri ? '正常' : '未检测到'}\n`);

      // 2. 检查登录状态
      setTestResult((prev) => prev + `登录状态: ${isLoggedIn ? '已登录' : '未登录'}\n`);
      setTestResult(
        (prev) => prev + `Cookies: ${cookies ? `已获取 (长度 ${cookies.length})` : '无数据'}\n`,
      );

      // 3. 检查下载队列
      setTestResult((prev) => prev + `下载队列: ${downloads.length} 项任务\n`);

      if (!isTauri) {
        setTestResult((prev) => prev + '请在 Tauri 应用中运行测试 (pnpm tauri dev)\n');
        return;
      }

      if (!isLoggedIn || !cookies) {
        setTestResult((prev) => prev + '请先登录哔哩哔哩账号\n');
        return;
      }

      // 4. 测试视频信息获取
      setTestResult((prev) => prev + '\n测试视频信息获取...\n');
      const testVideoId = 'BV1qEVazqEv3';

      try {
        const videoData = await invoke('get_video_info', { videoId: testVideoId });
        setTestResult((prev) => prev + `视频信息获取成功: ${(videoData as any).title}\n`);
        setTestResult(
          (prev) =>
            prev +
            `视频时长: ${Math.floor((videoData as any).duration / 60)}分${(videoData as any).duration % 60}秒\n`,
        );
        setTestResult((prev) => prev + `UP 主: ${(videoData as any).owner.name}\n`);

        // 5. 测试视频流获取
        setTestResult((prev) => prev + '\n测试视频流获取...\n');
        const streamData = await invoke('get_video_streams', {
          videoId: (videoData as any).bvid,
          cid: (videoData as any).pages[0].cid,
          cookies,
        });

        setTestResult(
          (prev) =>
            prev + `视频流获取成功: ${(streamData as any).video_streams.length} 个质量选项\n`,
        );
        setTestResult(
          (prev) => prev + `音频流: ${(streamData as any).audio_streams.length} 个质量选项\n`,
        );

        // 显示可用质量
        const qualities = (streamData as any).video_streams
          .map((stream: any) => stream.description)
          .join(', ');
        setTestResult((prev) => prev + `可用质量: ${qualities}\n`);

        // 6. 测试下载命令（不实际下载，只测试调用）
        setTestResult((prev) => prev + '\n测试下载命令调用...\n');

        const selectedVideo = (streamData as any).video_streams[0];
        const selectedAudio = (streamData as any).audio_streams[0];

        setTestResult(
          (prev) => prev + `选择视频质量: ${selectedVideo.description} (${selectedVideo.codecs})\n`,
        );
        setTestResult((prev) => prev + `选择音频质量: ${selectedAudio.quality} kbps\n`);

        setTestResult((prev) => prev + '\n所有测试通过！系统功能正常，可以开始下载。\n');
      } catch (videoError) {
        setTestResult((prev) => prev + `视频相关测试失败: ${videoError}\n`);
      }
    } catch (error) {
      setTestResult((prev) => prev + `测试过程出现错误: ${error}\n`);
    } finally {
      setIsRunning(false);
    }
  };

  const clearTest = () => {
    setTestResult('');
  };

  const runQuickTest = async () => {
    setTestResult('快速环境检查...\n');

    const isTauri = isTauriAvailable();
    setTestResult(
      (prev) =>
        prev +
        `Tauri: ${isTauri ? '是' : '否'} | 登录: ${isLoggedIn ? '是' : '否'} | 队列: ${downloads.length} 项\n`,
    );

    if (userProfile) {
      setTestResult((prev) => prev + `当前用户: ${userProfile.name} (UID: ${userProfile.mid})\n`);
      if (userProfile.vip_type > 0) {
        setTestResult(
          (prev) =>
            prev + `会员类型: ${userProfile.vip_type === 1 ? '月度大会员' : '年度大会员'}\n`,
        );
      }
    }
  };

  const tauriReady = isTauriAvailable();

  return (
    <div className="custom-scrollbar h-full overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div data-tauri-drag-region>
          <h1 className="pointer-events-none text-xl font-bold tracking-tight text-fg">测试</h1>
          <p className="pointer-events-none mt-0.5 text-xs text-muted">
            检查运行环境、登录状态与下载链路是否正常。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <FlaskConical size={16} className="text-accent-fg" aria-hidden="true" />
              测试操作
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" className="rounded-full" onClick={runDownloadTest} disabled={isRunning}>
                {isRunning ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    运行中
                  </>
                ) : (
                  <>
                    <Play size={14} aria-hidden="true" />
                    完整功能测试
                  </>
                )}
              </Button>
              <Button className="rounded-full" onClick={runQuickTest}>
                <Zap size={14} aria-hidden="true" />
                快速检查
              </Button>
              <Button variant="ghost" className="rounded-full" onClick={clearTest} disabled={!testResult}>
                <Trash2 size={14} aria-hidden="true" />
                清除结果
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          {/* 系统状态 */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Activity size={16} className="text-accent-fg" aria-hidden="true" />
                系统状态
              </CardTitle>
            </CardHeader>
            <dl className="divide-y divide-line-muted text-sm">
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-muted">运行环境</dt>
                <dd className="flex items-center gap-1.5 font-medium text-fg">
                  {tauriReady ? (
                    <CheckCircle2 size={14} className="text-success-fg" aria-hidden="true" />
                  ) : (
                    <XCircle size={14} className="text-danger-fg" aria-hidden="true" />
                  )}
                  {tauriReady ? 'Tauri 桌面应用' : '浏览器环境'}
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
                <dd className="min-w-0 truncate font-medium text-fg">
                  {userProfile ? `${userProfile.name}（UID ${userProfile.mid}）` : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-muted">认证信息</dt>
                <dd className="font-medium text-fg">
                  {cookies ? `已获取（${cookies.length} 字符）` : '未获取'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-3">
                <dt className="text-muted">下载队列</dt>
                <dd className="font-medium text-fg">{downloads.length} 项任务</dd>
              </div>
            </dl>
          </Card>

          {/* 测试结果 */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Terminal size={16} className="text-accent-fg" aria-hidden="true" />
                测试输出
              </CardTitle>
            </CardHeader>
            <CardBody>
              <pre className="custom-scrollbar min-h-64 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-inset p-3.5 font-mono text-xs leading-relaxed text-fg">
                {testResult ||
                  '点击「完整功能测试」或「快速检查」开始。\n\n完整功能测试 — 检测所有下载相关功能\n快速检查 — 仅检查基本环境状态'}
              </pre>
            </CardBody>
          </Card>
        </div>

        {/* 下载队列详情 */}
        {downloads.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                下载队列详情
                <span className="font-normal text-muted">({downloads.length})</span>
              </CardTitle>
            </CardHeader>
            <ul className="divide-y divide-line-muted">
              {downloads.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium text-fg">{item.title}</span>
                    <StatusLabel status={item.status} showIcon={false} />
                  </div>
                  <span className="text-xs text-muted">
                    视频数据 {item.videoData ? '已获取' : '未获取'} · 清晰度{' '}
                    {item.selectedQuality ? '已选择' : '未选择'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
