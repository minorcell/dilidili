package downloader

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"dilidili/pkg/api"
)

// ProgressHandler 界面进度回调接口，在 GUI 中实现
type ProgressHandler interface {
	SetVideoProgress(p float64)
	SetAudioProgress(p float64)
	SetOverallProgress(p float64)
	SetStatus(text string)
	OnDownloadComplete(outputPath, title string)
}

// DownloadAndMerge 执行下载并合并逻辑，同步调用或在 goroutine 中调用
func DownloadAndMerge(bvid string, handler ProgressHandler) error {
	handler.SetStatus("正在获取视频信息...")
	videoInfo, err := api.GetVideoInfo(bvid)
	if err != nil {
		return fmt.Errorf("获取视频信息失败: %w", err)
	}
	title := videoInfo.Data.Title
	handler.SetStatus(fmt.Sprintf("获取到视频: %s", title))

	playURL, err := api.GetPlayURL(bvid, videoInfo.Data.Cid)
	if err != nil {
		return fmt.Errorf("获取播放地址失败: %w", err)
	}
	if len(playURL.Data.Dash.Video) == 0 || len(playURL.Data.Dash.Audio) == 0 {
		return fmt.Errorf("未找到视频或音频流")
	}
	videoURL := playURL.Data.Dash.Video[0].BaseURL
	audioURL := playURL.Data.Dash.Audio[0].BaseURL

	tmpDir := "temp"
	os.MkdirAll(tmpDir, 0755)

	videoPath := filepath.Join(tmpDir, bvid+"_video.m4s")
	audioPath := filepath.Join(tmpDir, bvid+"_audio.m4s")
	outputPath := filepath.Join(tmpDir, bvid+"_merged.mp4")

	// 并行下载
	var wg sync.WaitGroup
	wg.Add(2)

	handler.SetVideoProgress(0)
	handler.SetAudioProgress(0)
	handler.SetOverallProgress(0)

	go func() {
		defer wg.Done()
		handler.SetStatus("正在下载视频流...")
		if err := downloadFileWithProgress(videoURL, videoPath, handler.SetVideoProgress); err != nil {
			handler.SetStatus(fmt.Sprintf("视频下载失败: %v", err))
		}
	}()
	go func() {
		defer wg.Done()
		handler.SetStatus("正在下载音频流...")
		if err := downloadFileWithProgress(audioURL, audioPath, handler.SetAudioProgress); err != nil {
			handler.SetStatus(fmt.Sprintf("音频下载失败: %v", err))
		}
	}()
	wg.Wait()

	handler.SetStatus("正在合并音视频...")
	handler.SetOverallProgress(0.8)
	if err := MergeFiles(videoPath, audioPath, outputPath); err != nil {
		return fmt.Errorf("合并失败: %w", err)
	}
	handler.SetOverallProgress(1.0)
	handler.SetStatus("下载完成")
	handler.OnDownloadComplete(outputPath, title)
	return nil
}

// downloadFileWithProgress 下载文件并周期性调用 progressCb
func downloadFileWithProgress(url, filename string, progressCb func(float64)) error {
	client := &http.Client{}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	out, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer out.Close()

	totalSize := resp.ContentLength
	var downloaded int64
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := out.Write(buf[:n]); werr != nil {
				return werr
			}
			downloaded += int64(n)
			if totalSize > 0 {
				progressCb(float64(downloaded) / float64(totalSize))
			}
		}
		if err != nil {
			if err == io.EOF {
				progressCb(1.0)
				break
			}
			return err
		}
	}
	return nil
}
