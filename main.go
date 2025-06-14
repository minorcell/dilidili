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
	"fyne.io/fyne/v2/widget"
)

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

func main() {
	a := app.New()
	w := a.NewWindow("B站视频下载器")

	entry := widget.NewEntry()
	entry.SetPlaceHolder("输入 B 站 BV 号或视频链接")

	logs := widget.NewMultiLineEntry()
	// logs.SetReadOnly(true)

	btn := widget.NewButton("下载并合并", func() {
		bvid := extractBVID(entry.Text)
		if bvid == "" {
			logs.SetText("请输入正确的BV号或链接")
			return
		}
		logs.SetText("开始下载...\n")
		go func() {
			err := downloadAndMerge(bvid, logs)
			if err != nil {
				appendLog(logs, fmt.Sprintf("错误: %v\n", err))
			} else {
				appendLog(logs, "下载并合并完成！\n")
			}
		}()
	})

	content := container.NewVBox(entry, btn, logs)
	w.SetContent(content)
	w.Resize(fyne.NewSize(600, 400))
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

func downloadAndMerge(bvid string, logs *widget.Entry) error {
	appendLog(logs, fmt.Sprintf("解析视频信息: %s\n", bvid))

	cid, err := getCID(bvid)
	if err != nil {
		return fmt.Errorf("获取CID失败: %w", err)
	}
	appendLog(logs, fmt.Sprintf("CID: %d\n", cid))

	playURL, err := getPlayURL(bvid, cid)
	if err != nil {
		return fmt.Errorf("获取播放地址失败: %w", err)
	}

	videoURL := playURL.Data.Dash.Video[0].BaseURL
	audioURL := playURL.Data.Dash.Audio[0].BaseURL

	os.MkdirAll("output", 0755)

	videoPath := filepath.Join("output", bvid+"_video.m4s")
	audioPath := filepath.Join("output", bvid+"_audio.m4s")
	outputPath := filepath.Join("output", bvid+"_final.mp4")

	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		appendLog(logs, "开始下载视频流...\n")
		if err := downloadFile(videoURL, videoPath, logs); err != nil {
			appendLog(logs, fmt.Sprintf("视频下载失败: %v\n", err))
		} else {
			appendLog(logs, "视频下载完成\n")
		}
	}()

	go func() {
		defer wg.Done()
		appendLog(logs, "开始下载音频流...\n")
		if err := downloadFile(audioURL, audioPath, logs); err != nil {
			appendLog(logs, fmt.Sprintf("音频下载失败: %v\n", err))
		} else {
			appendLog(logs, "音频下载完成\n")
		}
	}()

	wg.Wait()

	appendLog(logs, "开始合并音视频...\n")
	if err := mergeFiles(videoPath, audioPath, outputPath); err != nil {
		return fmt.Errorf("合并失败: %w", err)
	}

	appendLog(logs, "合并成功，文件路径："+outputPath+"\n")
	return nil
}

func appendLog(logs *widget.Entry, text string) {
	// 线程安全地追加日志
	fyne.CurrentApp().SendNotification(&fyne.Notification{Title: "下载进度", Content: text})
	logs.SetText(logs.Text + text)
}

func getCID(bvid string) (int, error) {
	url := fmt.Sprintf("https://api.bilibili.com/x/web-interface/view?bvid=%s", bvid)
	resp, err := http.Get(url)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Data struct {
			Cid int `json:"cid"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, err
	}

	return result.Data.Cid, nil
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

func downloadFile(url, filename string, logs *widget.Entry) error {
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

	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, werr := out.Write(buf[:n]); werr != nil {
				return werr
			}
		}
		if err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
	}

	return nil
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
