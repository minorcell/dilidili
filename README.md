# 🎬 DiliDili - B站视频下载器

一个现代化的B站视频下载工具，采用Go开发，**内置FFmpeg**，开箱即用！

## ✨ 特性

- 🎬 **自包含分发**: 内置FFmpeg，用户无需安装任何依赖
- 🎯 **简单易用**: 支持BV号和视频链接直接下载
- 🔧 **专业合并**: 使用FFmpeg进行高质量音视频合并
- 💻 **跨平台**: 支持Windows、macOS、Linux
- 🎨 **图形界面**: 基于Fyne的现代化界面
- 📦 **一键安装**: macOS提供DMG安装包，拖拽即用

## 🚀 快速开始

### 方式一：下载预编译版本（推荐）

**macOS用户**:
1. 下载 `Dilidili-installer.dmg`
2. 双击DMG文件，将应用拖拽到Applications文件夹
3. 从Launchpad或Applications文件夹启动应用

**Windows/Linux用户**:
- 即将支持，敬请期待！

### 方式二：从源码编译

```bash
# 克隆项目
git clone https://github.com/minorcell/dilidili.git
cd dilidili

# 构建macOS应用（需要先下载FFmpeg）
./scripts/build.sh

# 创建DMG安装包
./scripts/create_dmg.sh
```

### 使用方法
1. 启动程序后，在输入框中输入B站视频的BV号或完整链接
2. 选择视频质量和保存位置
3. 点击"下载并合并"按钮
4. 程序会自动下载视频和音频，使用内置FFmpeg合并为MP4

## 📋 系统要求

- **macOS**: 10.15+ (Catalina及更高版本)
- **内存**: 至少512MB可用内存  
- **存储**: 200MB可用空间（包含内置FFmpeg）
- **网络**: 稳定的互联网连接

## 🔧 技术实现

### 核心特性
- ✅ **智能FFmpeg集成**: 自动查找应用内置 → 本地 → 系统FFmpeg
- ✅ **专业音视频处理**: 使用FFmpeg进行无损合并
- ✅ **自包含分发**: 76MB FFmpeg + 22MB应用 = 37MB压缩DMG
- ✅ **零配置运行**: 用户无需安装任何依赖

### 技术栈
- **后端**: Go 1.21+ 
- **GUI**: Fyne v2.6.1 现代化跨平台界面
- **音视频**: FFmpeg 7.1.1 专业音视频处理
- **打包**: 标准macOS .app + DMG分发

### 项目结构
```
dilidili/
├── cmd/                    # 主程序入口
├── pkg/
│   ├── downloader/        # 核心下载逻辑
│   │   ├── downloader.go  # B站API与下载
│   │   └── merge.go       # FFmpeg智能集成
│   ├── gui/               # Fyne GUI界面
│   └── utils/             # 工具函数
├── resources/
│   └── ffmpeg             # 内置FFmpeg二进制(76MB)
├── scripts/
│   ├── build.sh           # 应用构建脚本
│   └── create_dmg.sh      # DMG创建脚本
└── build/
    ├── darwin/Dilidili.app    # macOS应用包
    └── Dilidili-installer.dmg # 用户安装包(37MB)
```

## 📦 开发者指南

### 构建本地开发版本
```bash
# 克隆仓库
git clone https://github.com/minorcell/dilidili.git
cd dilidili

# 下载FFmpeg（仅首次）
curl -L https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip -o resources/ffmpeg.zip
cd resources && unzip ffmpeg.zip && rm ffmpeg.zip && cd ..

# 本地运行
go run ./cmd
```

### 构建生产版本
```bash
# 构建.app应用包
./scripts/build.sh

# 创建DMG安装包  
./scripts/create_dmg.sh

# 输出: build/Dilidili-installer.dmg (37MB)
```

## 🤝 贡献

我们欢迎各种形式的贡献！

### 如何贡献
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)  
5. 打开 Pull Request

### 开发环境
```bash
# 安装依赖
go mod download

# 运行测试
go test ./...

# 本地开发
go run ./cmd
```

## 🐛 问题反馈

遇到问题？请：
1. 检查 [FAQ](../../wiki/FAQ)
2. 搜索 [现有Issues](../../issues)
3. 创建 [新Issue](../../issues/new)

## 🙏 致谢

- [Fyne](https://fyne.io/) - 优秀的Go GUI框架
- [FFmpeg](https://ffmpeg.org/) - 强大的音视频处理工具
- [Evermeet](https://evermeet.cx/ffmpeg/) - macOS FFmpeg构建

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可证。

---

<div align="center">

**如果这个项目对您有帮助，请给个⭐️!**

Made with ❤️ in Go

</div>

