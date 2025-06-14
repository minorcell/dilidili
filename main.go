package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
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
	cmd := exec.Command("./ffmpeg", "-i", videoPath, "-i", audioPath, "-c", "copy", outputPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
