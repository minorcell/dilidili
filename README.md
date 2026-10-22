# 🎬 DILIDILI

**把喜欢的 B 站视频，稳稳当当保存到本地。**

DILIDILI 是一款免费、开源的哔哩哔哩视频下载工具。粘贴链接、选好画质，剩下的交给它。

[🌐 官网](https://minorcell.github.io/dilidili/) · [💬 反馈问题](https://github.com/minorcell/dilidili/issues)

## 📦 安装（macOS）

DILIDILI 目前通过 Homebrew 分发。**不建议从 Releases 页面直接下载 DMG**：应用尚未进行 Apple 签名与公证，浏览器下载的副本会被 macOS 拦截；Homebrew 安装的副本不携带隔离标记，可以直接运行。

```bash
brew tap minorcell/dilidili-homebrew https://github.com/minorcell/dilidili-homebrew
brew trust minorcell/dilidili-homebrew
brew install --cask dilidili
```

如果首次启动仍提示“无法验证开发者”，执行：

```bash
xattr -dr com.apple.quarantine "/Applications/DILIDILI.app"
```

更新到新版本：

```bash
brew upgrade --cask dilidili
```

## 🚀 开始使用

1. 打开 DILIDILI，点击登录
2. 使用哔哩哔哩手机 App 扫码确认
3. 粘贴视频链接，选择画质，开始下载

> B 站要求登录后才能获取视频流，因此下载前需要先登录。

## ✨ 功能

- **链接一贴就解析**：支持完整链接、`b23.tv` 短链，也可以直接输入 BV / av 号
- **画质不将就**：从流畅到 4K，视频支持什么就能选什么
- **下载即成品**：音视频自动合并，并实时显示下载进度
- **登录解锁高清**：扫码登录后获取更高清晰度的视频流
- **格式随你定**：支持 MP4 / AVI / MKV 转换，也能提取 MP3 等音频
- **数据不出本机**：下载、合并、转码全部在本机完成

## 🔗 支持的链接

```
https://www.bilibili.com/video/BV...
https://www.bilibili.com/video/av...
https://b23.tv/...
BV... / av...
```

## ❓ 常见问题

**下载的文件没有声音？**
应用会自动合并音视频；如果合并失败，请确认安装包完整，或重新安装最新版本。

**登录信息安全吗？**
登录信息只保存在本机，仅用于向 B 站请求视频流，不会上传到其他服务器。

**可以下载多个视频吗？**
可以逐个添加任务，所有任务都会出现在下载队列中。

**能下载多高的画质？**
画质上限取决于视频本身和你的账号权限，最高支持 4K。

**支持 Windows / Linux 吗？**
目前只为 macOS 提供 Homebrew 安装包。其他平台可以从源码构建，见下方开发说明。

## 🛠 开发与构建

<details>
<summary>展开查看</summary>

需要 Node.js 18+、Rust 1.70+ 和 pnpm。

```bash
pnpm install     # 安装依赖
pnpm tauri dev   # 本地开发
pnpm tauri build # 打包应用
pnpm lint        # 代码检查
```

macOS 打包（生成 DMG 并输出 SHA256）：

```bash
./script/build-dmg.sh
```

发布新版本使用 GitHub Release：发布后 `.github/workflows/release.yml` 会自动构建 DMG、上传资产并更新 Homebrew Cask。

</details>

## 📄 许可证

本项目采用 MIT 许可证，详见 [LICENSE](LICENSE)。

## ⚠️ 免责声明

本工具仅供个人学习与研究使用。请遵守相关法律法规及哔哩哔哩用户协议，下载内容仅限个人使用，禁止用于商业用途。

---

<div align="center">

如果 DILIDILI 帮到了你，欢迎点一个 ⭐ 支持一下！

Made with ❤️ by [minorcell](https://github.com/minorcell)

</div>
