package downloader

import (
	"encoding/binary"
	"fmt"
	"os"
)

// MergeFiles 合并 video.m4s 和 audio.m4s 为 mp4
func MergeFiles(videoPath, audioPath, outputPath string) error {
	videoData, err := os.ReadFile(videoPath)
	if err != nil {
		return fmt.Errorf("读取视频文件失败: %w", err)
	}
	audioData, err := os.ReadFile(audioPath)
	if err != nil {
		return fmt.Errorf("读取音频文件失败: %w", err)
	}

	out, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建输出文件失败: %w", err)
	}
	defer out.Close()

	// 写 ftyp
	if _, err := out.Write(createFtypBox()); err != nil {
		return fmt.Errorf("写入 ftyp 失败: %w", err)
	}
	// 写视频 fragment
	vs := findFirstNonFtypBox(videoData)
	if _, err := out.Write(videoData[vs:]); err != nil {
		return fmt.Errorf("写入视频数据失败: %w", err)
	}
	// 写音频 fragment
	as := findFirstNonFtypBox(audioData)
	if _, err := out.Write(audioData[as:]); err != nil {
		return fmt.Errorf("写入音频数据失败: %w", err)
	}
	return nil
}

func createFtypBox() []byte {
	return []byte{
		0x00, 0x00, 0x00, 0x20,
		'f', 't', 'y', 'p',
		'i', 's', 'o', 'm',
		0x00, 0x00, 0x02, 0x00,
		'i', 's', 'o', 'm',
		'm', 'p', '4', '1',
		'd', 'a', 's', 'h',
		'm', 's', 'e', '1',
	}
}

func findFirstNonFtypBox(data []byte) int {
	if len(data) < 8 {
		return 0
	}
	pos := 0
	for pos < len(data)-8 {
		size := int(binary.BigEndian.Uint32(data[pos : pos+4]))
		if size < 8 {
			break
		}
		boxType := string(data[pos+4 : pos+8])
		if boxType != "ftyp" {
			return pos
		}
		pos += size
	}
	return pos
}
