# 🎬 DILIDILI

**把喜欢的 B 站视频，稳稳当当保存到本地。**

DILIDILI 是一款免费、开源的哔哩哔哩视频下载工具，支持 Windows、macOS 和 Linux。
粘贴链接、选好画质，剩下的交给它。

[⬇️ 下载最新版本](https://github.com/minorcell/dilidili/releases/latest) · [🌐 访问官网](https://minorcell.github.io/dilidili/) · [💬 反馈问题](https://github.com/minorcell/dilidili/issues)

## ✨ 为什么用它

- **链接一贴就解析** —— 支持完整视频链接、`b23.tv` 短链，也可以直接输入 BV / av 号
- **画质不将就** —— 从流畅到 4K，视频支持什么就能选什么
- **下载即成品** —— 音视频自动合并，不用再手动处理
- **登录解锁高清** —— 扫码登录 B 站账号，获取更高清晰度的视频流
- **格式随你定** —— 支持 MP4 / AVI / MKV 转换，也能提取 MP3 / AAC / WAV 音频
- **文件好整理** —— 自定义导出目录，下载后可一键打开所在文件夹
- **进度看得见** —— 下载队列与实时进度，任务状态一目了然
- **数据不出本机** —— 下载、合并、转码全部在你的电脑上完成

## 📦 安装

### macOS(Homebrew)

```bash
brew tap minorcell/tap
```

```bash
brew install --cask dilidili
```

> 应用尚未进行 Apple 签名与公证。Homebrew 安装的副本通常可以直接打开；如果系统提示“无法验证开发者”，请执行下方命令，或前往“系统设置 → 隐私与安全性”选择“仍要打开”。

```bash
xattr -dr com.apple.quarantine "/Applications/DILIDILI.app"
```

### 其他平台

前往 [Releases](https://github.com/minorcell/dilidili/releases/latest) 下载对应平台的安装包。

## 🚀 三步开始

1. **安装** —— 使用 Homebrew，或从 Release 下载并打开应用
2. **登录** —— 点击登录，用手机扫码并确认
3. **下载** —— 粘贴视频链接，选择画质，开始下载

> 下载前需要先登录：B 站要求登录后才能获取视频流。

## 🔗 支持的链接

```
https://www.bilibili.com/video/BV...
https://www.bilibili.com/video/av...
https://b23.tv/...
BV... / av...
```

## 💻 系统要求

- Windows 10 及以上
- macOS 10.15 及以上
- Linux

## ❓ 常见问题

**下载的文件没有声音？**
应用会自动合并音视频；如果合并失败，请确认安装包完整（已内置音视频处理工具），或重新下载最新版本。

**登录信息安全吗？**
登录信息只保存在你的本机，仅用于向 B 站请求视频流，不会上传到其他服务器。

**可以下载多个视频吗？**
可以逐个添加任务，所有任务都会出现在下载队列中，方便统一查看和管理。

**能下载多高的画质？**
画质上限取决于视频本身和你的账号权限，最高支持 4K。

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

### macOS 打包与 Homebrew 发布

本地构建：

```bash
./script/build-dmg.sh
```

脚本会读取 `src-tauri/Cargo.toml` 的版本号，生成 `DILIDILI-<version>.dmg` 并打印 SHA256。

发布新版本推荐走 GitHub Actions：在 GitHub 上发布（Publish）一个 Release 后，`.github/workflows/release.yml` 会自动完成：

1. 校验 tag 与 `src-tauri/Cargo.toml` 中的版本一致
2. 下载 FFmpeg、构建 DMG，并上传到该 Release
3. 更新 `Casks/dilidili.rb` 的版本号与 SHA256，并提交到 `main`
4. 如果配置了 `HOMEBREW_TAP_TOKEN`，同时把 Cask 同步到 `minorcell/homebrew-tap`

`brew tap minorcell/tap` 依赖一个名为 `homebrew-tap` 的仓库（`minorcell/homebrew-tap`），仓库内放置 `Casks/dilidili.rb`。在 `minorcell/dilidili` 的仓库设置里添加可写该仓库的 PAT 作为 secret `HOMEBREW_TAP_TOKEN`，即可自动同步。

需要手动更新 Cask 时：

```bash
./script/update-cask.sh <version> <path-to-dmg>
```

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
