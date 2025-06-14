package main

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"
)

type VideoInfo struct {
	Code int `json:"code"`
	Data struct {
		Title string `json:"title"`
		Cid   int    `json:"cid"`
	} `json:"data"`
}

type PlayURLResponse struct {
	Data struct {
		Dash struct {
			Video []struct {
				BaseURL string `json:"baseUrl"`
			} `json:"video"`
			Audio []struct {
				BaseURL string `json:"baseUrl"`
			} `json:"audio"`
		} `json:"dash"`
	} `json:"data"`
}

type DownloadProgress struct {
	videoProgress   *widget.ProgressBar
	audioProgress   *widget.ProgressBar
	overallProgress *widget.ProgressBar
	statusLabel     *widget.Label
	saveButton      *widget.Button
	tempVideoPath   string
	tempAudioPath   string
	videoTitle      string
	bvid            string
}

func main() {
	a := app.New()
	w := a.NewWindow("B站视频下载器")

	entry := widget.NewEntry()
	entry.SetPlaceHolder("输入 B 站 BV 号或视频链接")

	// 创建进度显示组件
	statusLabel := widget.NewLabel("准备就绪")
	videoProgress := widget.NewProgressBar()
	audioProgress := widget.NewProgressBar()
	overallProgress := widget.NewProgressBar()

	videoLabel := widget.NewLabel("视频进度:")
	audioLabel := widget.NewLabel("音频进度:")
	overallLabel := widget.NewLabel("总体进度:")

	saveButton := widget.NewButton("保存文件", nil)
	saveButton.Hide() // 初始隐藏

	progressContainer := container.NewVBox(
		statusLabel,
		videoLabel, videoProgress,
		audioLabel, audioProgress,
		overallLabel, overallProgress,
		saveButton,
	)

	downloadProgress := &DownloadProgress{
		videoProgress:   videoProgress,
		audioProgress:   audioProgress,
		overallProgress: overallProgress,
		statusLabel:     statusLabel,
		saveButton:      saveButton,
	}

	btn := widget.NewButton("开始下载", func() {
		bvid := extractBVID(entry.Text)
		if bvid == "" {
			dialog.ShowError(fmt.Errorf("请输入正确的BV号或链接"), w)
			return
		}

		downloadProgress.bvid = bvid
		downloadProgress.statusLabel.SetText("正在获取视频信息...")
		downloadProgress.saveButton.Hide()

		go func() {
			err := downloadAndMerge(bvid, downloadProgress, w)
			if err != nil {
				downloadProgress.statusLabel.SetText(fmt.Sprintf("错误: %v", err))
			}
		}()
	})

	content := container.NewVBox(entry, btn, progressContainer)
	w.SetContent(content)
	w.Resize(fyne.NewSize(600, 450))
	w.ShowAndRun()
}

func extractBVID(input string) string {
	input = strings.TrimSpace(input)
	if strings.HasPrefix(input, "BV") {
		return input
	}
	if strings.Contains(input, "bilibili.com") {
		// 从 URL 中提取 BV 号
		parts := strings.Split(input, "/")
		for _, p := range parts {
			if strings.HasPrefix(p, "BV") {
				return p
			}
		}
	}
	return ""
}

func downloadAndMerge(bvid string, downloadProgress *DownloadProgress, w fyne.Window) error {
	downloadProgress.statusLabel.SetText("正在获取视频信息...")

	// 获取视频信息（包含标题）
	videoInfo, err := getVideoInfo(bvid)
	if err != nil {
		return fmt.Errorf("获取视频信息失败: %w", err)
	}

	downloadProgress.videoTitle = videoInfo.Data.Title
	downloadProgress.statusLabel.SetText(fmt.Sprintf("获取到视频: %s", videoInfo.Data.Title))

	playURL, err := getPlayURL(bvid, videoInfo.Data.Cid)
	if err != nil {
		return fmt.Errorf("获取播放地址失败: %w", err)
	}

	videoURL := playURL.Data.Dash.Video[0].BaseURL
	audioURL := playURL.Data.Dash.Audio[0].BaseURL

	os.MkdirAll("temp", 0755)

	videoPath := filepath.Join("temp", bvid+"_video.m4s")
	audioPath := filepath.Join("temp", bvid+"_audio.m4s")

	downloadProgress.tempVideoPath = videoPath
	downloadProgress.tempAudioPath = audioPath

	var wg sync.WaitGroup
	wg.Add(2)

	// 重置进度条
	downloadProgress.videoProgress.SetValue(0)
	downloadProgress.audioProgress.SetValue(0)
	downloadProgress.overallProgress.SetValue(0)

	go func() {
		defer wg.Done()
		downloadProgress.statusLabel.SetText("正在下载视频流...")
		if err := downloadFileWithProgress(videoURL, videoPath, downloadProgress.videoProgress); err != nil {
			downloadProgress.statusLabel.SetText(fmt.Sprintf("视频下载失败: %v", err))
		}
	}()

	go func() {
		defer wg.Done()
		downloadProgress.statusLabel.SetText("正在下载音频流...")
		if err := downloadFileWithProgress(audioURL, audioPath, downloadProgress.audioProgress); err != nil {
			downloadProgress.statusLabel.SetText(fmt.Sprintf("音频下载失败: %v", err))
		}
	}()

	wg.Wait()

	downloadProgress.statusLabel.SetText("正在合并音视频...")
	downloadProgress.overallProgress.SetValue(0.8)

	outputPath := filepath.Join("temp", bvid+"_merged.mp4")
	if err := mergeFiles(videoPath, audioPath, outputPath); err != nil {
		return fmt.Errorf("合并失败: %w", err)
	}

	downloadProgress.overallProgress.SetValue(1.0)
	downloadProgress.statusLabel.SetText("下载完成！点击保存文件选择保存位置")

	// 设置保存按钮的回调
	downloadProgress.saveButton.OnTapped = func() {
		saveFile(outputPath, downloadProgress.videoTitle, downloadProgress.tempVideoPath, downloadProgress.tempAudioPath, w)
	}
	downloadProgress.saveButton.Show()

	return nil
}

// 获取视频详细信息
func getVideoInfo(bvid string) (*VideoInfo, error) {
	url := fmt.Sprintf("https://api.bilibili.com/x/web-interface/view?bvid=%s", bvid)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result VideoInfo
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if result.Code != 0 {
		return nil, fmt.Errorf("API返回错误，代码: %d", result.Code)
	}

	return &result, nil
}

// 带进度的文件下载
func downloadFileWithProgress(url, filename string, progressBar *widget.ProgressBar) error {
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

	// 获取文件总大小
	totalSize := resp.ContentLength
	var downloaded int64 = 0

	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := out.Write(buf[:n]); werr != nil {
				return werr
			}
			downloaded += int64(n)

			// 更新进度条
			if totalSize > 0 {
				progress := float64(downloaded) / float64(totalSize)
				progressBar.SetValue(progress)
			}
		}
		if err != nil {
			if err == io.EOF {
				progressBar.SetValue(1.0)
				break
			}
			return err
		}
	}

	return nil
}

// 保存文件对话框
func saveFile(tempPath, videoTitle, tempVideoPath, tempAudioPath string, w fyne.Window) {
	// 清理文件名中的非法字符
	safeTitle := strings.ReplaceAll(videoTitle, "/", "_")
	safeTitle = strings.ReplaceAll(safeTitle, "\\", "_")
	safeTitle = strings.ReplaceAll(safeTitle, ":", "_")
	safeTitle = strings.ReplaceAll(safeTitle, "*", "_")
	safeTitle = strings.ReplaceAll(safeTitle, "?", "_")
	safeTitle = strings.ReplaceAll(safeTitle, "\"", "_")
	safeTitle = strings.ReplaceAll(safeTitle, "<", "_")
	safeTitle = strings.ReplaceAll(safeTitle, ">", "_")
	safeTitle = strings.ReplaceAll(safeTitle, "|", "_")

	defaultName := fmt.Sprintf("%s.mp4", safeTitle)

	saveDialog := dialog.NewFileSave(func(writer fyne.URIWriteCloser, err error) {
		if err != nil {
			dialog.ShowError(err, w)
			return
		}
		if writer == nil {
			return // 用户取消了保存
		}
		defer writer.Close()

		// 读取临时文件
		tempFile, err := os.Open(tempPath)
		if err != nil {
			dialog.ShowError(fmt.Errorf("无法打开临时文件: %w", err), w)
			return
		}
		defer tempFile.Close()

		// 拷贝文件内容
		if _, err := io.Copy(writer, tempFile); err != nil {
			dialog.ShowError(fmt.Errorf("保存文件失败: %w", err), w)
			return
		}

		// 清理所有临时文件
		cleanupTempFiles(tempPath, tempVideoPath, tempAudioPath)

		dialog.ShowInformation("保存成功", "视频已成功保存到指定位置！", w)
	}, w)

	// 设置默认文件名
	saveDialog.SetFileName(defaultName)
	saveDialog.Show()
}

// 清理临时文件
func cleanupTempFiles(mergedPath, videoPath, audioPath string) {
	// 删除合并后的临时文件
	os.Remove(mergedPath)

	// 删除视频临时文件
	os.Remove(videoPath)

	// 删除音频临时文件
	os.Remove(audioPath)

	// 尝试删除temp目录（如果为空的话）
	os.Remove("temp")
}

func getPlayURL(bvid string, cid int) (*PlayURLResponse, error) {
	url := fmt.Sprintf("https://api.bilibili.com/x/player/playurl?bvid=%s&cid=%d&qn=80&fnval=80", bvid, cid)
	client := &http.Client{}
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result PlayURLResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

func mergeFiles(videoPath, audioPath, outputPath string) error {
	// 对于B站的.m4s文件，我们可以用一个简化的合并方法
	// 因为它们实际上是fMP4格式，可以直接进行容器级合并

	videoFile, err := os.Open(videoPath)
	if err != nil {
		return fmt.Errorf("打开视频文件失败: %w", err)
	}
	defer videoFile.Close()

	audioFile, err := os.Open(audioPath)
	if err != nil {
		return fmt.Errorf("打开音频文件失败: %w", err)
	}
	defer audioFile.Close()

	outputFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建输出文件失败: %w", err)
	}
	defer outputFile.Close()

	// 先处理视频文件的头部
	videoData, err := io.ReadAll(videoFile)
	if err != nil {
		return fmt.Errorf("读取视频数据失败: %w", err)
	}

	audioData, err := io.ReadAll(audioFile)
	if err != nil {
		return fmt.Errorf("读取音频数据失败: %w", err)
	}

	// 合并MP4容器 - 这是一个简化的实现
	// 对于B站的m4s文件，通常可以通过简单的数据拷贝和重新组织来实现
	if err := mergeMP4Data(videoData, audioData, outputFile); err != nil {
		return fmt.Errorf("合并MP4数据失败: %w", err)
	}

	return nil
}

// 简化的MP4合并实现
func mergeMP4Data(videoData, audioData []byte, outputFile *os.File) error {
	// 对于B站的.m4s文件，实际上它们是fMP4 (fragmented MP4) 格式
	// 我们需要创建一个有效的MP4容器来包含这些数据

	// 写入ftyp box (文件类型头)
	ftypBox := createFtypBox()
	if _, err := outputFile.Write(ftypBox); err != nil {
		return fmt.Errorf("写入文件类型头失败: %w", err)
	}

	// 直接写入视频数据（跳过它的ftyp）
	videoStart := findFirstNonFtypBox(videoData)
	if _, err := outputFile.Write(videoData[videoStart:]); err != nil {
		return fmt.Errorf("写入视频数据失败: %w", err)
	}

	// 直接写入音频数据（跳过它的ftyp）
	audioStart := findFirstNonFtypBox(audioData)
	if _, err := outputFile.Write(audioData[audioStart:]); err != nil {
		return fmt.Errorf("写入音频数据失败: %w", err)
	}

	return nil
}

// 创建标准的ftyp box
func createFtypBox() []byte {
	return []byte{
		0x00, 0x00, 0x00, 0x20, // box size (32 bytes)
		'f', 't', 'y', 'p', // box type "ftyp"
		'i', 's', 'o', 'm', // major brand "isom"
		0x00, 0x00, 0x02, 0x00, // minor version
		'i', 's', 'o', 'm', // compatible brand "isom"
		'm', 'p', '4', '1', // compatible brand "mp41"
		'd', 'a', 's', 'h', // compatible brand "dash"
		'm', 's', 'e', '1', // compatible brand "mse1"
	}
}

// 找到第一个非ftyp box的位置
func findFirstNonFtypBox(data []byte) int {
	if len(data) < 8 {
		return 0
	}

	pos := 0
	for pos < len(data)-8 {
		// 读取box大小
		size := int(binary.BigEndian.Uint32(data[pos : pos+4]))
		if size < 8 {
			break
		}

		// 读取box类型
		boxType := string(data[pos+4 : pos+8])

		// 如果不是ftyp，返回当前位置
		if boxType != "ftyp" {
			return pos
		}

		// 跳到下一个box
		pos += size
	}

	return pos
}
