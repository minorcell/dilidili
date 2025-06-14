package downloader

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// MergeFiles 合并 video.m4s 和 audio.m4s 为 mp4
func MergeFiles(videoPath, audioPath, outputPath string) error {
	ffmpegPath, err := findFFmpegPath()
	if err != nil {
		return fmt.Errorf("找不到FFmpeg: %w", err)
	}

	cmd := exec.Command(ffmpegPath,
		"-i", videoPath,
		"-i", audioPath,
		"-c", "copy",
		"-y", // 覆盖输出文件
		outputPath,
	)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// findFFmpegPath 查找FFmpeg可执行文件的路径
func findFFmpegPath() (string, error) {
	// 查找策略按优先级排序：
	// 1. 应用程序包内的FFmpeg（用于DMG分发）
	// 2. 当前工作目录的FFmpeg
	// 3. 系统PATH中的FFmpeg

	// 1. 检查应用程序包内的FFmpeg
	if bundledPath := getBundledFFmpegPath(); bundledPath != "" {
		if _, err := os.Stat(bundledPath); err == nil {
			return bundledPath, nil
		}
	}

	// 2. 检查当前工作目录
	localPaths := []string{
		"./ffmpeg",
		"./bin/ffmpeg",
		"./resources/ffmpeg",
	}

	for _, path := range localPaths {
		if _, err := os.Stat(path); err == nil {
			return path, nil
		}
	}

	// 3. 检查系统PATH
	if path, err := exec.LookPath("ffmpeg"); err == nil {
		return path, nil
	}

	return "", fmt.Errorf("未找到FFmpeg可执行文件")
}

// getBundledFFmpegPath 获取应用程序包内FFmpeg的路径
func getBundledFFmpegPath() string {
	// 获取当前可执行文件的路径
	execPath, err := os.Executable()
	if err != nil {
		return ""
	}

	execDir := filepath.Dir(execPath)

	// 根据不同操作系统确定可能的路径
	switch runtime.GOOS {
	case "darwin": // macOS
		// 对于.app包结构: MyApp.app/Contents/MacOS/MyApp
		// FFmpeg应该在: MyApp.app/Contents/Resources/ffmpeg
		appDir := filepath.Dir(filepath.Dir(execDir)) // 向上两级到.app目录
		resourcesDir := filepath.Join(appDir, "Resources")

		candidates := []string{
			filepath.Join(resourcesDir, "ffmpeg"),
			filepath.Join(execDir, "ffmpeg"),
			filepath.Join(execDir, "bin", "ffmpeg"),
		}

		for _, candidate := range candidates {
			if _, err := os.Stat(candidate); err == nil {
				return candidate
			}
		}

	case "windows":
		// Windows下的可能路径
		candidates := []string{
			filepath.Join(execDir, "ffmpeg.exe"),
			filepath.Join(execDir, "bin", "ffmpeg.exe"),
			filepath.Join(execDir, "resources", "ffmpeg.exe"),
		}

		for _, candidate := range candidates {
			if _, err := os.Stat(candidate); err == nil {
				return candidate
			}
		}

	default: // Linux等
		candidates := []string{
			filepath.Join(execDir, "ffmpeg"),
			filepath.Join(execDir, "bin", "ffmpeg"),
			filepath.Join(execDir, "resources", "ffmpeg"),
		}

		for _, candidate := range candidates {
			if _, err := os.Stat(candidate); err == nil {
				return candidate
			}
		}
	}

	return ""
}
