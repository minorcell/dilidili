package gui

import (
	"fmt"
	"io"
	"os"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"

	"dilidili/pkg/downloader"
	"dilidili/pkg/utils"
)

type downloadUI struct {
	window          fyne.Window
	entry           *widget.Entry
	downloadBtn     *widget.Button
	saveBtn         *widget.Button
	statusLabel     *widget.Label
	videoProgress   *widget.ProgressBar
	audioProgress   *widget.ProgressBar
	overallProgress *widget.ProgressBar
	bvid            string
	title           string
}

func (ui *downloadUI) SetVideoProgress(p float64) {
	ui.videoProgress.SetValue(p)
}
func (ui *downloadUI) SetAudioProgress(p float64) {
	ui.audioProgress.SetValue(p)
}
func (ui *downloadUI) SetOverallProgress(p float64) {
	ui.overallProgress.SetValue(p)
}
func (ui *downloadUI) SetStatus(text string) {
	// 切换到主线程更新 UI
	fyne.CurrentApp().SendNotification(&fyne.Notification{Title: "状态更新", Content: text})
	ui.statusLabel.SetText(text)
}
func (ui *downloadUI) OnDownloadComplete(outputPath, title string) {
	ui.title = title
	ui.saveBtn.OnTapped = func() {
		safeTitle := sanitizeFileName(title)
		defaultName := fmt.Sprintf("%s.mp4", safeTitle)
		sd := dialog.NewFileSave(func(writer fyne.URIWriteCloser, err error) {
			if err != nil {
				dialog.ShowError(err, ui.window)
				return
			}
			if writer == nil {
				return
			}
			in, err := os.Open(outputPath)
			if err != nil {
				dialog.ShowError(fmt.Errorf("无法打开临时文件: %w", err), ui.window)
				return
			}
			defer in.Close()
			if _, err := io.Copy(writer, in); err != nil {
				dialog.ShowError(fmt.Errorf("保存失败: %w", err), ui.window)
				return
			}
			// 清理 temp
			os.Remove(outputPath)
			dialog.ShowInformation("保存成功", "视频已保存", ui.window)
		}, ui.window)
		sd.SetFileName(defaultName)
		sd.Show()
	}
	ui.saveBtn.Show()
}

func sanitizeFileName(name string) string {
	replacer := []struct{ old, new string }{
		{"/", "_"},
		{"\\", "_"},
		{":", "_"},
		{"*", "_"},
		{"?", "_"},
		{"\"", "_"},
		{"<", "_"},
		{">", "_"},
		{"|", "_"},
	}
	for _, r := range replacer {
		name = strings.ReplaceAll(name, r.old, r.new)
	}
	return name
}

// Run 启动 GUI
func Run() {
	a := app.New()
	a.SetIcon(resourceLogoPng)
	w := a.NewWindow("B站视频下载器")

	ui := &downloadUI{
		window:          w,
		entry:           widget.NewEntry(),
		statusLabel:     widget.NewLabel("准备就绪"),
		videoProgress:   widget.NewProgressBar(),
		audioProgress:   widget.NewProgressBar(),
		overallProgress: widget.NewProgressBar(),
	}
	ui.entry.SetPlaceHolder("输入 B 站 BV 号或视频链接")

	ui.saveBtn = widget.NewButton("保存文件", nil)
	ui.saveBtn.Hide()

	downloadBtn := widget.NewButton("开始下载", func() {
		bvid := utils.ExtractBVID(ui.entry.Text)
		if bvid == "" {
			dialog.ShowError(fmt.Errorf("请输入正确的BV号或链接"), w)
			return
		}
		ui.bvid = bvid
		ui.SetStatus("开始下载...")
		ui.saveBtn.Hide()
		// 在后台执行下载
		go func() {
			if err := downloader.DownloadAndMerge(bvid, ui); err != nil {
				ui.SetStatus(fmt.Sprintf("错误: %v", err))
			}
		}()
	})
	ui.downloadBtn = downloadBtn

	// 创建logo图像
	logoImg := canvas.NewImageFromResource(resourceLogoPng)
	logoImg.FillMode = canvas.ImageFillContain
	logoImg.Resize(fyne.NewSize(80, 80))

	// 创建标题容器
	titleContainer := container.NewHBox(
		logoImg,
		widget.NewLabel("Dilidili - B站视频下载器"),
	)

	content := container.NewVBox(
		titleContainer,
		widget.NewSeparator(),
		ui.entry,
		downloadBtn,
		ui.statusLabel,
		widget.NewLabel("视频进度:"), ui.videoProgress,
		widget.NewLabel("音频进度:"), ui.audioProgress,
		widget.NewLabel("总体进度:"), ui.overallProgress,
		ui.saveBtn,
	)
	w.SetContent(content)
	w.Resize(fyne.NewSize(600, 500))
	w.ShowAndRun()
}
