import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileVideo,
  FolderOpen,
  Link2,
  Loader2,
  Music,
  RotateCw,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { DownloadItem, VideoData, PlayUrlData } from '../types/bilibili';
import Button from './ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from './ui/Card';
import CustomSelect from './ui/CustomSelect';
import StatusLabel from './ui/StatusLabel';
import { isTauriAvailable } from '../lib/tauri';
import { useMessage } from './ui/message-context';

/** 从 rust 端返回的提示语中提取实际文件路径，例如：下载完成: "/Users/me/Downloads/xxx.mp4" */
function extractFilePath(message: string): string | undefined {
  const match = message.match(/"([^"]+)"/);
  return match?.[1];
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`;
}

export default function Downloader() {
  const [videoUrl, setVideoUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentVideoData, setCurrentVideoData] = useState<VideoData | null>(null);
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [streamData, setStreamData] = useState<PlayUrlData | null>(null);
  const [exportFolder, setExportFolder] = useState<string>('');

  const {
    downloads: downloadQueue,
    addDownloadItem,
    updateDownloadProgress,
    updateDownloadStatus,
    setDownloadFilePath,
    isLoggedIn,
    cookies,
  } = useAppStore();
  const { success, error, warning, info } = useMessage();

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
      warning('请在 Tauri 应用中使用此功能');
      return;
    }

    if (!videoUrl.trim()) {
      warning('请输入视频链接或 BV 号');
      return;
    }

    const videoId = extractVideoId(videoUrl.trim());

    if (!videoId) {
      error(
        '支持格式：\n- https://www.bilibili.com/video/BV...\n- https://www.bilibili.com/video/av...\n- https://b23.tv/...\n- BV...\n- av...',
        '无效的视频链接格式',
      );
      return;
    }

    setIsAnalyzing(true);

    try {
      const videoData: VideoData = await invoke('get_video_info', { videoId });
      setCurrentVideoData(videoData);

      if (isLoggedIn && cookies) {
        try {
          const streams: PlayUrlData = await invoke('get_video_streams', {
            videoId: videoData.bvid,
            cid: videoData.pages[0].cid,
            cookies,
          });
          setStreamData(streams);
          setShowQualitySelector(true);
        } catch (streamError) {
          addDownloadItem({
            id: Date.now().toString(),
            url: videoUrl,
            title: videoData.title,
            progress: 0,
            status: 'pending',
          });
          setVideoUrl('');
          warning(`获取视频流失败：${streamError}`);
        }
      } else {
        warning('请先登录以获取视频下载链接');
        addDownloadItem({
          id: Date.now().toString(),
          url: videoUrl,
          title: videoData.title,
          progress: 0,
          status: 'pending',
        });
        setVideoUrl('');
      }
    } catch (analyzeError) {
      warning(`分析视频失败：${analyzeError}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 处理质量选择
  const handleQualitySelect = (videoStream: any, audioStream: any) => {
    if (!currentVideoData) return;

    addDownloadItem({
      id: Date.now().toString(),
      url: videoUrl,
      title: currentVideoData.title,
      progress: 0,
      status: 'pending',
      videoData: currentVideoData,
      selectedQuality: {
        video: videoStream,
        audio: audioStream,
      },
    });

    setVideoUrl('');
    setCurrentVideoData(null);
    setStreamData(null);
    setShowQualitySelector(false);
    info(`已加入下载队列：${currentVideoData.title}`);
  };

  // 开始下载任务
  const startDownload = async (downloadItem: DownloadItem) => {
    if (!isTauriAvailable()) {
      updateDownloadStatus(downloadItem.id, 'failed');
      warning('Tauri 环境不可用，请在应用中使用此功能');
      return;
    }

    if (!downloadItem.videoData || !downloadItem.selectedQuality) {
      updateDownloadStatus(downloadItem.id, 'failed');
      warning('下载信息不完整，请重新解析视频');
      return;
    }

    if (!isLoggedIn || !cookies) {
      updateDownloadStatus(downloadItem.id, 'failed');
      warning('请先登录后再下载');
      return;
    }

    try {
      updateDownloadStatus(downloadItem.id, 'downloading');
      updateDownloadProgress(downloadItem.id, 0);

      const result = await invoke<string>('download_video', {
        videoData: downloadItem.videoData,
        videoStream: downloadItem.selectedQuality.video,
        audioStream: downloadItem.selectedQuality.audio,
        cookies,
      });

      updateDownloadStatus(downloadItem.id, 'completed');
      updateDownloadProgress(downloadItem.id, 100);
      setDownloadFilePath(downloadItem.id, extractFilePath(result));
      success(`下载完成：${downloadItem.title}`);
    } catch (downloadError) {
      updateDownloadStatus(downloadItem.id, 'failed');
      error(`下载失败：${downloadError}`);
    }
  };

  // 处理 Enter 键
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleAnalyzeVideo();
    }
  };

  // 选择导出文件夹
  const selectExportFolder = async () => {
    if (!isTauriAvailable()) {
      warning('请在 Tauri 应用中使用此功能');
      return;
    }

    try {
      const folder = await invoke<string>('select_export_folder');
      setExportFolder(folder);
      success(`已选择导出文件夹：${folder}`);
    } catch (selectError) {
      error(`选择文件夹失败：${selectError}`);
    }
  };

  // 导出文件到指定文件夹
  const exportFileToFolder = async (filePath: string) => {
    if (!exportFolder) {
      warning('请先选择导出文件夹');
      return;
    }

    if (!isTauriAvailable()) {
      warning('请在 Tauri 应用中使用此功能');
      return;
    }

    try {
      const exportedPath = await invoke<string>('export_file_to_folder', {
        sourcePath: filePath,
        targetFolder: exportFolder,
      });
      success(`文件已导出：${exportedPath}`);
    } catch (exportError) {
      error(`导出失败：${exportError}`);
    }
  };

  // 转换视频格式
  const convertVideoFormat = async (filePath: string, format: string) => {
    if (!isTauriAvailable()) {
      warning('请在 Tauri 应用中使用此功能');
      return;
    }

    try {
      const outputPath = filePath.replace(/\.[^/.]+$/, `.${format}`);
      const result = await invoke<string>('convert_video_format', {
        inputPath: filePath,
        outputPath,
        format,
      });
      success(`格式转换完成：${result}`);
    } catch (convertError) {
      error(`格式转换失败：${convertError}`);
    }
  };

  // 提取音频
  const extractAudio = async (filePath: string, format: string = 'mp3') => {
    if (!isTauriAvailable()) {
      warning('请在 Tauri 应用中使用此功能');
      return;
    }

    try {
      const audioPath = filePath.replace(/\.[^/.]+$/, `.${format}`);
      const result = await invoke<string>('extract_audio', {
        videoPath: filePath,
        audioPath,
        format,
      });
      success(`音频提取完成：${result}`);
    } catch (extractError) {
      error(`音频提取失败：${extractError}`);
    }
  };

  // 打开文件夹
  const openFolder = async (folderPath: string) => {
    if (!folderPath) {
      warning('请先选择导出文件夹');
      return;
    }

    if (!isTauriAvailable()) {
      warning('请在 Tauri 应用中使用此功能');
      return;
    }

    try {
      await invoke('open_folder', { folderPath });
    } catch (openError) {
      error(`打开文件夹失败：${openError}`);
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
      default:
        return <Clock size={16} className="text-muted" aria-hidden="true" />;
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold text-fg">下载</h1>
        <p className="mt-1 text-sm text-muted">粘贴视频链接或 BV 号，选择清晰度后加入下载队列。</p>
      </div>

      {/* 视频链接输入区域 */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Link2 size={16} aria-hidden="true" />
            添加下载任务
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <label htmlFor="video-url" className="block text-sm font-semibold text-fg">
            视频链接或 BV 号
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="video-url"
              type="text"
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://www.bilibili.com/video/BV... 或 BV1xx411c7mD"
              className="h-8 flex-1 rounded-md border border-line bg-canvas px-3 font-mono text-sm text-fg outline-none transition-colors placeholder:font-sans placeholder:text-subtle-fg hover:border-muted focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
              disabled={isAnalyzing}
            />
            <Button
              variant="primary"
              onClick={handleAnalyzeVideo}
              disabled={isAnalyzing || !videoUrl.trim()}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  解析中
                </>
              ) : (
                '解析'
              )}
            </Button>
          </div>
          <p className="text-xs text-subtle-fg">
            支持 bilibili.com/video/BV…、av…、b23.tv 短链接，或直接输入 BV 号。
          </p>
        </CardBody>
      </Card>

      {/* 质量选择器 */}
      {showQualitySelector && currentVideoData && streamData && (
        <Card>
          <CardHeader>
            <CardTitle>
              <SlidersHorizontal size={16} aria-hidden="true" />
              选择清晰度
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={cancelQualitySelect}>
              <X size={14} aria-hidden="true" />
              取消
            </Button>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex gap-4">
              <img
                src={currentVideoData.pic}
                alt={currentVideoData.title}
                className="h-20 w-36 shrink-0 rounded-md border border-line object-cover"
              />
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-semibold text-fg">
                  {currentVideoData.title}
                </h3>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-muted">
                  <dt>UP 主</dt>
                  <dd className="truncate">{currentVideoData.owner_info?.name || '未知'}</dd>
                  <dt>时长</dt>
                  <dd>{formatDuration(currentVideoData.duration)}</dd>
                  <dt>BV 号</dt>
                  <dd className="truncate font-mono">{currentVideoData.bvid}</dd>
                </dl>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-fg">视频清晰度</label>
              <CustomSelect
                options={streamData.video_streams.map((videoStream, index) => ({
                  value: index,
                  label: videoStream.description,
                  description: videoStream.format ? `格式：${videoStream.format}` : undefined,
                  filesize: videoStream.filesize,
                }))}
                onChange={(selectedIndex) => {
                  const selectedVideo = streamData.video_streams[selectedIndex as number];
                  const selectedAudio = streamData.audio_streams[0];
                  handleQualitySelect(selectedVideo, selectedAudio);
                }}
                placeholder="请选择视频清晰度"
              />
              <p className="text-xs text-subtle-fg">选择后会自动加入下载队列，音频流将自动合并。</p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* 下载队列 */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Download size={16} aria-hidden="true" />
            下载队列
            <span className="font-normal text-muted">({downloadQueue.length})</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={selectExportFolder}>
              <FolderOpen size={14} aria-hidden="true" />
              导出文件夹
            </Button>
            <Button size="sm" onClick={() => openFolder(exportFolder)} disabled={!exportFolder}>
              <ExternalLink size={14} aria-hidden="true" />
              打开
            </Button>
          </div>
        </CardHeader>

        {exportFolder && (
          <div className="flex items-center gap-2 border-b border-line bg-subtle px-4 py-2 text-xs text-muted">
            <FolderOpen size={12} className="shrink-0" aria-hidden="true" />
            <span className="truncate font-mono">{exportFolder}</span>
          </div>
        )}

        {downloadQueue.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-line bg-subtle text-muted">
              <Download size={18} aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-fg">暂无下载任务</p>
            <p className="mt-1 text-xs text-subtle-fg">在上方粘贴视频链接开始下载。</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {downloadQueue.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <div className="mt-0.5 shrink-0">{renderStatusIcon(item.status)}</div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-fg">{item.title}</h3>
                      <StatusLabel status={item.status} />
                    </div>

                    <p className="mt-1 flex items-center gap-1 text-xs text-subtle-fg">
                      <Link2 size={12} className="shrink-0" aria-hidden="true" />
                      <span className="truncate font-mono">{item.url}</span>
                    </p>

                    {(item.status === 'downloading' || item.progress > 0) && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-subtle">
                          <div
                            className="h-full rounded-full bg-accent transition-[width] duration-300"
                            style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-muted">
                          {item.progress}%
                        </span>
                      </div>
                    )}

                    {item.status === 'completed' && item.filePath && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => exportFileToFolder(item.filePath!)}>
                          <Download size={12} aria-hidden="true" />
                          导出
                        </Button>
                        <Button size="sm" onClick={() => convertVideoFormat(item.filePath!, 'avi')}>
                          <FileVideo size={12} aria-hidden="true" />
                          转码为 AVI
                        </Button>
                        <Button size="sm" onClick={() => extractAudio(item.filePath!, 'mp3')}>
                          <Music size={12} aria-hidden="true" />
                          提取音频
                        </Button>
                      </div>
                    )}

                    {item.status === 'completed' && !item.filePath && (
                      <p className="mt-2 text-xs text-subtle-fg">
                        文件已保存到系统下载目录的 DILIDILI 文件夹。
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2">
                  {item.status === 'pending' && (
                    <Button size="sm" variant="primary" onClick={() => startDownload(item)}>
                      开始下载
                    </Button>
                  )}
                  {item.status === 'failed' && (
                    <Button
                      size="sm"
                      onClick={() => {
                        updateDownloadStatus(item.id, 'pending');
                        startDownload(item);
                      }}
                    >
                      <RotateCw size={12} aria-hidden="true" />
                      重试
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
