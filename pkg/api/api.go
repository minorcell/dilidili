package api

import (
	"encoding/json"
	"fmt"
	"net/http"
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

// GetVideoInfo 获取视频标题和 cid
func GetVideoInfo(bvid string) (*VideoInfo, error) {
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
		return nil, fmt.Errorf("API 返回错误，代码: %d", result.Code)
	}
	return &result, nil
}

// GetPlayURL 获取视频和音频的 URL
func GetPlayURL(bvid string, cid int) (*PlayURLResponse, error) {
	url := fmt.Sprintf("https://api.bilibili.com/x/player/playurl?bvid=%s&cid=%d&qn=80&fnval=80", bvid, cid)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	client := &http.Client{}
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
