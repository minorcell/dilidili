import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  Ban,
  CheckCircle2,
  Clock,
  Download,
  FolderOpen,
  Link2,
  Loader2,
  RotateCw,
  SlidersHorizontal,
  Trash2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import {
  DownloadItem,
  DownloadResult,
  VideoData,
  PlayUrlData,
  VideoStream,
  AudioStream,
  QualityPreference,
} from '../types/bilibili';
import ActionMenu, { type AudioFormat, type VideoFormat } from './ui/ActionMenu';
import Button from './ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card';
import CustomSelect from './ui/CustomSelect';
import StatusLabel from './ui/StatusLabel';
import { isTauriAvailable } from '../lib/tauri';
import { userMessage } from '../lib/errors';
import { useMessage } from './ui/message-context';

/** 获取文件所在目录，兼容 Windows 与 Unix 路径分隔符 */
function parentDirectory(filePath: string): string {
  const separatorIndex = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return separatorIndex > 0 ? filePath.slice(0, separatorIndex) : filePath;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}

function formatSize(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  const megabytes = bytes / 1024 / 1024;
  return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(1)} GB` : `${megabytes.toFixed(1)} MB`;
}

function formatSpeed(bytesPerSecond?: number): string | undefined {
  if (!bytesPerSecond || bytesPerSecond <= 0) return undefined;
  const megabytesPerSecond = bytesPerSecond / 1024 / 1024;
  return megabytesPerSecond >= 1
    ? `${megabytesPerSecond.toFixed(1)} MB/s`
    : `${Math.max(1, Math.round(bytesPerSecond / 1024))} KB/s`;
}

function formatRemaining(seconds?: number): string | undefined {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  if (seconds < 60) return `${Math.ceil(seconds)} 秒`;

  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest > 0 ? `${minutes} 分 ${rest} 秒` : `${minutes} 分钟`;
}

interface DownloadProgressEvent {
  downloadId: string;
  progress: number;
  downloaded: number;
  total: number;
}

/** 按用户偏好挑选画质，找不到时退回最高画质 */
function pickPreferredStream(
  streams: VideoStream[],
  preference: QualityPreference,
): VideoStream | undefined {
  if (!streams.length) return undefined;

  const highest = [...streams].sort((a, b) => b.quality - a.quality)[0];
  if (preference === 'highest') return highest;

  const targetQuality = preference === '1080p' ? 80 : 64;
  const byQuality = streams.find((stream) => stream.quality === targetQuality);
  if (byQuality) return byQuality;

  const keyword = preference === '1080p' ? /1080p/i : /720p/i;
  return streams.find((stream) => keyword.test(stream.description)) ?? highest;
}

export default function Downloader() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentVideoData, setCurrentVideoData] = useState<VideoData | null>(null);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [streamData, setStreamData] = useState<PlayUrlData | null>(null);

  const {
    downloads: downloadQueue,
    addDownloadItem,
    updateDownloadProgress,
    updateDownloadStatus,
    updateDownloadMetrics,
    completeDownload,
    removeDownloadItem,
    clearCompleted,
    qualityPreference,
    autoOpenFolder,
    isLoggedIn,
    cookies,
  } = useAppStore();
  const { success, error, warning, info } = useMessage();

  // 记录已经自动开始过的任务，避免失败后无限重试
  const startingRef = useRef<Set<string>>(new Set());
  // 用两次进度事件之间的字节差估算下载速度
  const speedSamples = useRef<Map<string, { bytes: number; time: number; speed: number }>>(
    new Map(),
  );

  // 提取视频 ID 的函数
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/,
      /(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/av(\d+)/,
      /(?:https?:\/\/)?b23\.tv\/([a-zA-Z0-9]+)/,
      /^(BV[a-zA-Z0-9]+)$/,
      /^av(\d+)$/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  };

  // 处理视频 URL 分析
  const handleAnalyzeVideo = async () => {
    if (!isTauriAvailable()) {
      warning('此功能暂时不可用，请重启应用后再试。');
      return;
    }

    const trimmedUrl = videoUrl.trim();
    if (!trimmedUrl) {
      warning('请先粘贴视频链接。');
      return;
    }

    const videoId = extractVideoId(trimmedUrl);
    if (!videoId) {
      error('没有识别出视频链接。请粘贴 B 站视频链接或 BV 号。', '链接格式不正确');
      return;
    }

    setIsAnalyzing(true);

    try {
      const videoData = await invoke<VideoData>('get_video_info', { videoId });
      setCurrentVideoData(videoData);

      if (!isLoggedIn || !cookies) {
        setCurrentVideoData(null);
        warning('登录状态已失效，请重新登录后再试。');
        return;
      }

      const firstPage = videoData.pages?.[0];
      if (!firstPage) {
        setCurrentVideoData(null);
        warning('没有找到这个视频的分集信息，请换一个视频试试。');
        return;
      }

      const streams = await invoke<PlayUrlData>('get_video_streams', {
        videoId: videoData.bvid,
        cid: firstPage.cid,
        cookies,
      });

      if (!streams.video_streams.length) {
        setCurrentVideoData(null);
        warning('这个视频没有可用的画质，请换一个视频试试。');
        return;
      }

      // 用户设定了默认画质时直接开始下载，不再弹窗询问
      if (qualityPreference !== 'ask') {
        const preferred = pickPreferredStream(streams.video_streams, qualityPreference);
        if (preferred) {
          const selectedAudio = streams.audio_streams[0] ?? { quality: 0, format: 'm4a' };
          handleQualitySelect(videoData, preferred, selectedAudio);
          return;
        }
      }

      setStreamData(streams);
      setShowQualitySelector(true);
    } catch (analyzeError) {
      setCurrentVideoData(null);
      setStreamData(null);
      warning(userMessage(analyzeError, '无法获取这个视频的信息，请确认链接有效后重试。'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 选择画质后直接加入任务，由下载队列自动开始
  const handleQualitySelect = (
    videoData: VideoData,
    videoStream: VideoStream,
    audioStream: AudioStream,
  ) => {
    const estimatedSize = (videoStream.filesize ?? 0) + (audioStream.filesize ?? 0);

    const item: DownloadItem = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: videoUrl,
      title: videoData.title,
      progress: 0,
      status: 'pending',
      videoData,
      selectedQuality: {
        video: videoStream,
        audio: audioStream,
      },
      thumbnail: videoData.pic,
      uploader: videoData.owner?.name,
      durationSeconds: videoData.duration,
      qualityLabel: videoStream.description,
      downloadSize: estimatedSize > 0 ? estimatedSize : undefined,
    };

    addDownloadItem(item);

    setVideoUrl('');
    setCurrentVideoData(null);
    setStreamData(null);
    setShowQualitySelector(false);
    info('已加入下载任务，正在开始下载。');
  };

  // 开始下载任务
  const startDownload = async (downloadItem: DownloadItem) => {
    if (!isTauriAvailable()) {
      updateDownloadStatus(downloadItem.id, 'failed');
      warning('此功能暂时不可用，请重启应用后再试。');
      return;
    }

    if (!downloadItem.videoData || !downloadItem.selectedQuality) {
      updateDownloadStatus(downloadItem.id, 'failed');
      warning('任务信息不完整，请重新粘贴视频链接。');
      return;
    }

    if (!isLoggedIn || !cookies) {
      updateDownloadStatus(downloadItem.id, 'failed');
      warning('登录状态已失效，请重新登录。');
      return;
    }

    let unlisten: (() => void) | undefined;

    try {
      updateDownloadStatus(downloadItem.id, 'downloading');
      updateDownloadProgress(downloadItem.id, 0);
      updateDownloadMetrics(downloadItem.id, {
        downloadedBytes: 0,
        totalBytes: downloadItem.downloadSize ?? 0,
        speedBytesPerSecond: 0,
      });
      speedSamples.current.delete(downloadItem.id);

      // 后端按已下载字节定期推送整体进度
      unlisten = await listen<DownloadProgressEvent>('download-progress', (event) => {
        if (event.payload.downloadId !== downloadItem.id) return;

        const { downloaded, total } = event.payload;
        const now = performance.now();
        const previous = speedSamples.current.get(downloadItem.id);

        let speed = previous?.speed ?? 0;
        if (previous && now > previous.time) {
          const instant = ((downloaded - previous.bytes) / (now - previous.time)) * 1000;
          if (instant > 0) {
            speed = previous.speed > 0 ? previous.speed * 0.6 + instant * 0.4 : instant;
          }
        }
        speedSamples.current.set(downloadItem.id, { bytes: downloaded, time: now, speed });

        updateDownloadProgress(downloadItem.id, Math.round(event.payload.progress));
        updateDownloadMetrics(downloadItem.id, {
          downloadedBytes: downloaded,
          totalBytes: total,
          speedBytesPerSecond: speed,
        });
      });

      const result = await invoke<DownloadResult>('download_video', {
        videoData: downloadItem.videoData,
        videoStream: downloadItem.selectedQuality.video,
        audioStream: downloadItem.selectedQuality.audio,
        cookies,
        downloadId: downloadItem.id,
      });

      completeDownload(downloadItem.id, {
        filePath: result.file_path,
        audioMerged: result.has_audio,
      });

      if (autoOpenFolder && result.file_path) {
        invoke('open_folder', { folderPath: parentDirectory(result.file_path) }).catch(
          (openError) => {
            console.error('下载完成后打开文件夹失败:', openError);
          },
        );
      }

      if (result.has_audio) {
        success(`《${downloadItem.title}》已保存到下载文件夹。`);
      } else {
        warning(
          '视频已保存，但声音没有合并成功，文件目前只有画面。可以重新下载再试一次。',
          '下载完成，但没有声音',
        );
      }
    } catch (downloadError) {
      const cancelled = /取消|cancel/i.test(String(downloadError));
      updateDownloadStatus(downloadItem.id, cancelled ? 'cancelled' : 'failed');
      if (!cancelled) {
        error(userMessage(downloadError, '未能完成下载，请检查网络后重试。'), '下载失败');
      }
    } finally {
      unlisten?.();
    }
  };

  // 下载任务按顺序自动开始，用户不需要再点一次「开始下载」
  useEffect(() => {
    if (!isLoggedIn || !cookies) return;
    if (downloadQueue.some((item) => item.status === 'downloading')) return;

    const next = downloadQueue.find(
      (item) => item.status === 'pending' && item.videoData && item.selectedQuality,
    );
    if (!next || startingRef.current.has(next.id)) return;

    startingRef.current.add(next.id);
    void startDownload(next);
    // startDownload 每次渲染都会重建，这里以任务状态为准，避免把它放进依赖导致重复触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadQueue, isLoggedIn, cookies]);

  // 声音没合并成功、失败或取消后，允许用户原样重下一次
  const retryDownload = (item: DownloadItem) => {
    if (!item.videoData || !item.selectedQuality) {
      warning('请重新粘贴视频链接后再下载。');
      return;
    }

    startingRef.current.delete(item.id);
    updateDownloadStatus(item.id, 'pending');
    void startDownload(item);
  };

  // 取消正在下载的任务，后端会停止写入并清理临时文件
  const cancelDownload = async (item: DownloadItem) => {
    try {
      await invoke('cancel_download', { downloadId: item.id });

      // 取消请求发出时任务可能刚好下载完，避免把已完成覆盖成已取消
      const latest = useAppStore.getState().downloads.find((download) => download.id === item.id);
      if (latest?.status !== 'downloading') return;

      updateDownloadStatus(item.id, 'cancelled');
      speedSamples.current.delete(item.id);
      info('已取消下载。');
    } catch (cancelError) {
      warning(userMessage(cancelError, '取消失败，请稍后重试。'));
    }
  };

  // 处理 Enter 键
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleAnalyzeVideo();
    }
  };

  // 转换视频格式
  const convertVideoFormat = async (filePath: string, format: VideoFormat) => {
    if (!isTauriAvailable()) {
      warning('此功能暂时不可用，请重启应用后再试。');
      return;
    }

    try {
      const outputPath = filePath.replace(/\.[^/.]+$/, `.${format}`);
      await invoke<string>('convert_video_format', {
        inputPath: filePath,
        outputPath,
        format,
      });
      success(`已转换为 ${format.toUpperCase()}，新文件保存在原视频旁边。`);
    } catch (convertError) {
      error(userMessage(convertError, '转换失败，请稍后重试。'), '转换失败');
    }
  };

  // 提取音频
  const extractAudio = async (filePath: string, format: AudioFormat = 'mp3') => {
    if (!isTauriAvailable()) {
      warning('此功能暂时不可用，请重启应用后再试。');
      return;
    }

    try {
      const audioPath = filePath.replace(/\.[^/.]+$/, `.${format}`);
      await invoke<string>('extract_audio', {
        videoPath: filePath,
        audioPath,
        format,
      });
      success(`已导出 ${format.toUpperCase()} 音频，保存在原视频旁边。`);
    } catch (extractError) {
      error(userMessage(extractError, '导出音频失败，请稍后重试。'), '导出失败');
    }
  };

  // 打开文件夹
  const openFolder = async (folderPath: string) => {
    if (!folderPath) {
      warning('还没有可打开的文件夹，请先在设置中选择下载目录。');
      return;
    }

    if (!isTauriAvailable()) {
      warning('此功能暂时不可用，请重启应用后再试。');
      return;
    }

    try {
      await invoke('open_folder', { folderPath });
    } catch (openError) {
      error(
        userMessage(openError, '无法打开所在位置，请确认文件还在原来的文件夹里。'),
        '无法打开所在位置',
      );
    }
  };

  // 取消清晰度选择
  const cancelQualitySelect = () => {
    setShowQualitySelector(false);
    setCurrentVideoData(null);
    setStreamData(null);
  };

  const renderStatusIcon = (status: DownloadItem['status']) => {
    switch (status) {
      case 'downloading':
        return <Loader2 size={16} className="animate-spin text-accent-fg" aria-hidden="true" />;
      case 'completed':
        return <CheckCircle2 size={16} className="text-success-fg" aria-hidden="true" />;
      case 'failed':
        return <XCircle size={16} className="text-danger-fg" aria-hidden="true" />;
      case 'cancelled':
        return <Ban size={16} className="text-muted" aria-hidden="true" />;
      default:
        return <Clock size={16} className="text-muted" aria-hidden="true" />;
    }
  };

  const activeTasks = downloadQueue.filter(
    (item) => item.status === 'pending' || item.status === 'downloading',
  );
  const finishedTasks = downloadQueue.filter(
    (item) =>
      item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled',
  );
  const completedCount = downloadQueue.filter((item) => item.status === 'completed').length;

  const renderTask = (item: DownloadItem) => {
    const itemSize = formatSize(item.downloadSize);
    const downloadedSize = formatSize(item.downloadedBytes);
    const totalSize = formatSize(item.totalBytes || item.downloadSize);
    const speedText =
      item.status === 'downloading' ? formatSpeed(item.speedBytesPerSecond) : undefined;
    const remainingText =
      item.status === 'downloading' && item.speedBytesPerSecond && item.totalBytes
        ? formatRemaining(
            (item.totalBytes - (item.downloadedBytes ?? 0)) / item.speedBytesPerSecond,
          )
        : undefined;
    const canRetry = Boolean(item.videoData && item.selectedQuality);

    return (
      <li
        key={item.id}
        className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-inset/60 sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 gap-3.5">
          {(item.videoData?.pic || item.thumbnail) && (
            <img
              src={item.videoData?.pic || item.thumbnail}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="hidden h-[63px] w-[112px] shrink-0 rounded-lg border border-line-muted object-cover sm:block"
            />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="shrink-0">{renderStatusIcon(item.status)}</span>
              <h3 className="truncate text-sm font-semibold text-fg">{item.title}</h3>
              <StatusLabel status={item.status} />
              {item.status === 'completed' && item.audioMerged === false && (
                <span
                  title="声音没有合并成功，文件目前只有画面"
                  className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-attention-subtle px-2.5 py-1 text-[11px] font-medium leading-none text-attention-fg"
                >
                  <VolumeX size={12} aria-hidden="true" />
                  无声音
                </span>
              )}
            </div>

            {item.uploader ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-subtle-fg">
                <span className="truncate">{item.uploader}</span>
                {item.durationSeconds ? <span>{formatDuration(item.durationSeconds)}</span> : null}
                {item.qualityLabel && (
                  <span className="rounded-full bg-inset px-2 py-0.5">{item.qualityLabel}</span>
                )}
                {itemSize && <span>约 {itemSize}</span>}
              </p>
            ) : (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-subtle-fg">
                <Link2 size={12} className="shrink-0" aria-hidden="true" />
                <span className="truncate font-mono">{item.url}</span>
                {item.qualityLabel && <span>{item.qualityLabel}</span>}
                {itemSize && <span>约 {itemSize}</span>}
              </p>
            )}

            {(item.status === 'downloading' || (item.status === 'failed' && item.progress > 0)) && (
              <div className="mt-2.5 space-y-1.5">
                <div className="flex items-center gap-2.5">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-subtle">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#fb7299] to-[#ff9db9] transition-[width] duration-300"
                      style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-xs font-medium tabular-nums text-accent-fg">
                    {item.progress}%
                  </span>
                </div>
                {(downloadedSize || totalSize || speedText || remainingText) && (
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[11px] text-subtle-fg">
                    <span>
                      {downloadedSize
                        ? totalSize
                          ? `${downloadedSize} / ${totalSize}`
                          : downloadedSize
                        : null}
                    </span>
                    {item.status === 'downloading' && (speedText || remainingText) && (
                      <span>
                        {[speedText, remainingText ? `剩余 ${remainingText}` : undefined]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {item.status === 'completed' && item.filePath && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => openFolder(parentDirectory(item.filePath!))}>
                  <FolderOpen size={12} aria-hidden="true" />
                  在文件夹中显示
                </Button>
                <ActionMenu
                  onOpenFolder={() => openFolder(parentDirectory(item.filePath!))}
                  onConvert={(format) => convertVideoFormat(item.filePath!, format)}
                  onExtractAudio={(format) => extractAudio(item.filePath!, format)}
                />
                {item.audioMerged === false && canRetry && (
                  <Button size="sm" onClick={() => retryDownload(item)}>
                    <RotateCw size={12} aria-hidden="true" />
                    重新下载
                  </Button>
                )}
              </div>
            )}

            {item.status === 'completed' && !item.filePath && (
              <p className="mt-2 text-xs text-subtle-fg">文件已保存到下载目录。</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          {item.status === 'downloading' && (
            <Button size="sm" onClick={() => cancelDownload(item)}>
              <X size={12} aria-hidden="true" />
              取消
            </Button>
          )}
          {(item.status === 'failed' || item.status === 'cancelled') && (
            <Button size="sm" onClick={() => retryDownload(item)}>
              <RotateCw size={12} aria-hidden="true" />
              重试
            </Button>
          )}
          {item.status !== 'downloading' && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="移除任务"
              title="移除任务"
              onClick={() => removeDownloadItem(item.id)}
            >
              <Trash2 size={13} aria-hidden="true" />
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="shrink-0" data-tauri-drag-region>
        <h1 className="pointer-events-none text-xl font-bold tracking-tight text-fg">下载</h1>
        <p className="pointer-events-none mt-0.5 text-xs text-muted">
          粘贴 B 站视频链接，选好画质就开始下载。
        </p>
      </div>

      {/* 视频链接输入区域 */}
      <Card className="shrink-0">
        <CardBody className="space-y-3 p-5">
          <label htmlFor="video-url" className="block text-sm font-semibold text-fg">
            视频链接
          </label>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              id="video-url"
              type="text"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="粘贴 B 站视频链接，如 https://b23.tv/xxxx"
              className="h-11 flex-1 rounded-full border border-transparent bg-inset px-5 font-mono text-sm text-fg outline-none transition-all placeholder:font-sans placeholder:text-subtle-fg hover:bg-neutral-subtle focus:border-accent focus:bg-canvas focus:ring-4 focus:ring-accent/10 disabled:opacity-60"
              disabled={isAnalyzing}
            />
            <Button
              variant="primary"
              size="lg"
              className="rounded-full px-7"
              onClick={handleAnalyzeVideo}
              disabled={isAnalyzing || !videoUrl.trim()}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  获取中
                </>
              ) : (
                '获取视频'
              )}
            </Button>
          </div>
          <p className="text-xs text-subtle-fg">
            支持 bilibili.com 视频链接、b23.tv 短链接，也可以直接输入 BV 号。
          </p>
        </CardBody>
      </Card>

      {/* 质量选择弹窗 */}
      {showQualitySelector && currentVideoData && streamData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-overlay-in"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              cancelQualitySelect();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="quality-dialog-title"
            className="w-full max-w-lg animate-dialog-in overflow-hidden rounded-2xl border border-line bg-canvas"
          >
            <div className="flex items-center justify-between border-b border-line-muted px-5 py-4">
              <h2
                id="quality-dialog-title"
                className="flex items-center gap-2 text-base font-semibold text-fg"
              >
                <SlidersHorizontal size={17} className="text-accent-fg" aria-hidden="true" />
                选择画质
              </h2>
              <button
                type="button"
                onClick={cancelQualitySelect}
                aria-label="取消选择"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-inset hover:text-fg"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row">
                <img
                  src={currentVideoData.pic}
                  alt={currentVideoData.title}
                  referrerPolicy="no-referrer"
                  className="h-28 w-full shrink-0 rounded-xl border border-line-muted object-cover sm:h-24 sm:w-44"
                />
                <div className="min-w-0">
                  <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-fg">
                    {currentVideoData.title}
                  </h3>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-muted">
                    <dt>UP 主</dt>
                    <dd className="truncate font-medium text-fg">
                      {currentVideoData.owner?.name || '未知'}
                    </dd>
                    <dt>时长</dt>
                    <dd>{formatDuration(currentVideoData.duration)}</dd>
                  </dl>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-fg">画质</label>
                <CustomSelect
                  options={streamData.video_streams.map((videoStream, index) => ({
                    value: index,
                    label: videoStream.description,
                    filesize: videoStream.filesize,
                  }))}
                  onChange={(selectedIndex) => {
                    const selectedVideo = streamData.video_streams[selectedIndex as number];
                    // 个别视频没有独立音频流，传一个空轨道，后端会保存为无声视频
                    const selectedAudio = streamData.audio_streams[0] ?? {
                      quality: 0,
                      format: 'm4a',
                    };
                    handleQualitySelect(currentVideoData, selectedVideo, selectedAudio);
                  }}
                  placeholder="请选择画质"
                />
                <p className="text-xs text-subtle-fg">
                  选择画质后会自动开始下载，画面和声音会合并成一个完整视频。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 下载任务 */}
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="shrink-0">
          <CardTitle>
            <Download size={16} className="text-accent-fg" aria-hidden="true" />
            下载任务
            <span className="font-normal text-muted">({downloadQueue.length})</span>
          </CardTitle>
        </CardHeader>

        {downloadQueue.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-subtle text-accent-fg">
              <Download size={24} aria-hidden="true" />
            </div>
            <p className="mt-4 text-sm font-semibold text-fg">暂无下载任务</p>
            <p className="mt-1 text-xs text-subtle-fg">在上方粘贴视频链接开始下载。</p>
          </div>
        ) : (
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {activeTasks.length > 0 && (
              <section>
                <h3 className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-line-muted bg-canvas/95 px-5 py-2.5 text-xs font-semibold text-muted backdrop-blur">
                  进行中
                  <span className="font-normal">({activeTasks.length})</span>
                </h3>
                <ul className="divide-y divide-line-muted">{activeTasks.map(renderTask)}</ul>
              </section>
            )}

            {finishedTasks.length > 0 && (
              <section>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line-muted bg-canvas/95 px-5 py-2.5 backdrop-blur">
                  <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    已结束
                    <span className="font-normal">({finishedTasks.length})</span>
                  </h3>
                  {completedCount > 0 && (
                    <button
                      type="button"
                      onClick={clearCompleted}
                      className="text-xs text-muted transition-colors hover:text-fg"
                    >
                      清空已完成
                    </button>
                  )}
                </div>
                <ul className="divide-y divide-line-muted">{finishedTasks.map(renderTask)}</ul>
              </section>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
