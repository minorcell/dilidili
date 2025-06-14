# Dilidili 构建脚本说明

本目录包含用于构建和打包 Dilidili 应用程序的脚本。

## 📁 脚本概览

| 脚本文件 | 功能描述 | 平台支持 |
|---------|---------|---------|
| `build.sh` | 构建自包含的macOS应用程序 | 🍎 macOS |
| `create_dmg.sh` | 创建macOS DMG安装包 | 🍎 macOS |

## 🚀 快速开始

### 1. 构建应用程序

```bash
# 构建macOS .app应用程序
./scripts/build.sh
```

### 2. 创建安装包

```bash
# 创建DMG安装包（需要先构建应用）
./scripts/create_dmg.sh
```

## 📋 详细说明

### build.sh - macOS应用构建

**功能：** 创建自包含的macOS应用程序包(.app)，内置FFmpeg，无需用户单独安装依赖。

**构建产物：**
- `build/darwin/Dilidili.app` - 完整的macOS应用程序包
- 内置FFmpeg在 `Contents/Resources/ffmpeg`
- 包含完整的Info.plist配置

**构建流程：**
1. 🧹 清理旧构建文件
2. 📁 创建.app目录结构
3. 🔨 交叉编译Go应用程序
4. 📦 复制FFmpeg到应用包
5. 🔐 设置可执行权限
6. 📋 生成Info.plist
7. 🔍 验证构建结果

**系统要求：**
- macOS 10.15+ (构建环境)
- Go 1.19+ 编译器
- 预先下载的FFmpeg binary (`resources/ffmpeg`)

### create_dmg.sh - DMG安装包创建

**功能：** 将构建好的.app打包为用户友好的DMG安装文件。

**构建产物：**
- `build/Dilidili-installer.dmg` - 最终分发的安装包

**DMG内容：**
- Dilidili.app - 应用程序
- Applications链接 - 方便拖拽安装
- 安装说明.txt - 详细安装指南

**特性：**
- 🗜️ 高压缩率（zlib-level=9）
- 🎨 预配置的安装界面
- 📝 中文安装说明
- 🔗 便捷的Applications文件夹链接

## ⚙️ 环境准备

### 必需依赖

```bash
# 1. 确保有Go编译环境
go version  # 需要 1.19+

# 2. 确保有FFmpeg binary
ls resources/ffmpeg  # 需要预先下载

# 3. 确保脚本可执行
chmod +x scripts/*.sh
```

### FFmpeg准备

如果 `resources/ffmpeg` 不存在，需要手动下载：

```bash
# 创建resources目录
mkdir -p resources

# 下载Apple Silicon版本FFmpeg
curl -L https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip -o resources/ffmpeg.zip
cd resources && unzip ffmpeg.zip && rm ffmpeg.zip && cd ..

# 验证FFmpeg
./resources/ffmpeg -version
```

## 🏗️ 完整构建流程

```bash
# 1. 准备环境
chmod +x scripts/*.sh

# 2. 构建应用程序
./scripts/build.sh

# 3. 创建安装包
./scripts/create_dmg.sh

# 4. 验证结果
open build/Dilidili-installer.dmg
```

## 📊 构建产物大小

典型构建产物大小：
- **Go应用程序**: ~22MB
- **FFmpeg binary**: ~76MB  
- **总.app大小**: ~98MB
- **压缩DMG**: ~37MB

## 🐛 故障排除

### 常见问题

**1. FFmpeg未找到**
```
❌ 错误: 未找到FFmpeg文件在 resources/ffmpeg
```
**解决方案：** 按照上述"FFmpeg准备"步骤下载FFmpeg

**2. Go编译错误**
```
❌ 错误: 未找到Go编译器
```
**解决方案：** 安装Go 1.19+并确保在PATH中

**3. 权限错误**
```
Permission denied
```
**解决方案：** 
```bash
chmod +x scripts/*.sh
```

**4. DMG创建失败**
```
❌ 错误: 未找到 build/darwin/Dilidili.app
```
**解决方案：** 先运行 `./scripts/build.sh` 构建应用

### 清理构建

```bash
# 清理所有构建产物
rm -rf build/

# 清理临时文件
rm -rf build/dmg_temp
```

## 🔄 开发工作流

### 日常开发构建
```bash
# 快速构建+测试
./scripts/build.sh && open build/darwin/Dilidili.app
```

### 发布版本构建
```bash
# 完整构建流程
./scripts/build.sh
./scripts/create_dmg.sh

# 验证DMG
open build/Dilidili-installer.dmg
```

### 构建验证
```bash
# 检查应用签名（可选）
codesign -dv build/darwin/Dilidili.app

# 检查FFmpeg集成
build/darwin/Dilidili.app/Contents/Resources/ffmpeg -version
```

## 📝 自定义配置

### 修改应用信息

编辑 `build.sh` 中的变量：
```bash
APP_NAME="Dilidili"           # 应用名称
BUILD_DIR="build/darwin"      # 构建目录
RESOURCES_DIR="resources"     # 资源目录
```

### 修改DMG配置

编辑 `create_dmg.sh` 中的变量：
```bash
DMG_NAME="Dilidili-installer"    # DMG文件名
VOLUME_NAME="Dilidili Installer" # DMG卷名
```

## 🚀 未来扩展

计划中的功能：
- [ ] Windows构建支持
- [ ] Linux构建支持  
- [ ] 自动代码签名
- [ ] CI/CD集成
- [ ] 多架构支持(Intel + Apple Silicon)

## 📞 技术支持

如果遇到构建问题：
1. 检查上述故障排除部分
2. 确认环境依赖已正确安装
3. 在项目主页提交Issue

---

**注意：** 本脚本集专为macOS环境设计，在其他操作系统上可能需要调整。
