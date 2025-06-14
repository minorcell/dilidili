package utils

import "strings"

// ExtractBVID 从输入提取 BV 号或者 URL 中的 BV 号
func ExtractBVID(input string) string {
	input = strings.TrimSpace(input)
	if strings.HasPrefix(input, "BV") {
		return input
	}
	if strings.Contains(input, "bilibili.com") {
		parts := strings.Split(input, "/")
		for _, p := range parts {
			if strings.HasPrefix(p, "BV") {
				return p
			}
		}
	}
	return ""
}
