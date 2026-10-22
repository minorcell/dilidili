#!/bin/bash

# DILIDILI macOS 打包脚本
# 将应用打包成 DMG 格式，包含 FFmpeg

set -e  # 遇到错误就退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 项目信息
APP_NAME="DILIDILI"
# 版本号与 Cargo.toml 保持一致，避免 DMG 命名与 Cask 版本不一致
APP_VERSION="$(sed -n 's/^version = "\(.*\)"/\1/p' "$(dirname "${BASH_SOURCE[0]}")/../src-tauri/Cargo.toml" | head -n 1)"
BUNDLE_ID="com.minorcell.DILIDILI"
DEVELOPER_TEAM=""  # 如果有开发者账号，填入 Team ID

# 路径定义
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"  # 项目根目录
BUILD_DIR="$PROJECT_DIR/src-tauri/target/release/bundle/macos"
RESOURCES_DIR="$PROJECT_DIR/resources"
DMG_DIR="$PROJECT_DIR/dmg-build"
OUTPUT_DIR="$PROJECT_DIR"  # 输出目录设为根目录
DMG_NAME="${APP_NAME}-${APP_VERSION}"

print_status "开始构建 ${APP_NAME} macOS 应用..."

# 检查必要工具
print_status "检查构建环境..."

if ! command -v npm &> /dev/null; then
    print_error "npm 未安装，请先安装 Node.js"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    print_error "cargo 未安装，请先安装 Rust"
    exit 1
fi

if ! command -v create-dmg &> /dev/null; then
    print_warning "create-dmg 未安装，正在安装..."
    if command -v brew &> /dev/null; then
        brew install create-dmg
    else
        print_error "请先安装 Homebrew 或手动安装 create-dmg"
        exit 1
    fi
fi

# 清理旧的构建文件
print_status "清理旧的构建文件..."
rm -rf "$BUILD_DIR"
rm -rf "$DMG_DIR"
rm -f "$OUTPUT_DIR/${DMG_NAME}.dmg"
rm -rf "$OUTPUT_DIR/${APP_NAME}.app"

# 安装前端依赖
print_status "安装前端依赖..."
cd "$PROJECT_DIR"
npm install

# 构建 Tauri 应用
print_status "构建 Tauri 应用..."
npm run tauri build

# 检查构建是否成功
if [ ! -d "$BUILD_DIR" ]; then
    print_error "Tauri 构建失败，未找到构建目录"
    exit 1
fi

# 查找生成的 .app 文件
APP_PATH=$(find "$BUILD_DIR" -name "*.app" -type d | head -n 1)
if [ -z "$APP_PATH" ]; then
    print_error "未找到生成的 .app 文件"
    exit 1
fi

APP_BUNDLE_NAME=$(basename "$APP_PATH")
print_success "找到应用包: $APP_BUNDLE_NAME"

# 创建 DMG 构建目录
print_status "准备 DMG 构建环境..."
mkdir -p "$DMG_DIR"

# 复制应用到 DMG 目录
print_status "复制应用文件..."
cp -R "$APP_PATH" "$DMG_DIR/"

# 确保 FFmpeg 被包含在应用包中
FFMPEG_SOURCE="$RESOURCES_DIR/ffmpeg"
FFMPEG_TARGET="$DMG_DIR/$APP_BUNDLE_NAME/Contents/Resources/ffmpeg"

if [ -f "$FFMPEG_SOURCE" ]; then
    print_success "使用仓库中的 FFmpeg: $FFMPEG_SOURCE"
    print_status "将 FFmpeg 复制到应用包中..."
    mkdir -p "$(dirname "$FFMPEG_TARGET")"
    cp "$FFMPEG_SOURCE" "$FFMPEG_TARGET"
    chmod +x "$FFMPEG_TARGET"
    print_success "FFmpeg 已添加到应用包中"
else
    print_warning "未找到仓库中的 FFmpeg 文件: $FFMPEG_SOURCE"
    print_status "尝试下载 FFmpeg..."
    
    # 创建 resources 目录
    mkdir -p "$RESOURCES_DIR"
    
    # 下载 FFmpeg (macOS 版本)
    FFMPEG_URL="https://evermeet.cx/ffmpeg/ffmpeg-6.0.zip"
    print_status "正在从 $FFMPEG_URL 下载 FFmpeg..."
    
    cd "$RESOURCES_DIR"
    curl -L -o ffmpeg.zip "$FFMPEG_URL"
    unzip -o ffmpeg.zip
    rm ffmpeg.zip
    chmod +x ffmpeg
    
    # 再次复制到应用包
    cp ffmpeg "$FFMPEG_TARGET"
    print_success "FFmpeg 下载并添加完成"
    
    cd "$PROJECT_DIR"
fi

# 创建 Applications 符号链接
print_status "创建 Applications 快捷方式..."
ln -sf /Applications "$DMG_DIR/Applications"

# 创建 DMG 文件
print_status "创建 DMG 文件..."

# DMG 背景和图标设置
DMG_BACKGROUND="$PROJECT_DIR/dmg-background.png"
DMG_ICON="$PROJECT_DIR/src-tauri/icons/icon.png"

# 如果没有背景图，创建一个简单的
if [ ! -f "$DMG_BACKGROUND" ]; then
    print_status "创建 DMG 背景图..."
    # 这里可以放置自定义背景图的创建逻辑
    # 现在我们跳过，使用默认背景
    DMG_BACKGROUND=""
fi

# 构建 create-dmg 命令
CREATE_DMG_CMD="create-dmg"
CREATE_DMG_CMD="$CREATE_DMG_CMD --volname '$APP_NAME'"
CREATE_DMG_CMD="$CREATE_DMG_CMD --volicon '$DMG_ICON'"
CREATE_DMG_CMD="$CREATE_DMG_CMD --window-pos 200 120"
CREATE_DMG_CMD="$CREATE_DMG_CMD --window-size 800 520"
CREATE_DMG_CMD="$CREATE_DMG_CMD --icon-size 128"
CREATE_DMG_CMD="$CREATE_DMG_CMD --icon '$APP_BUNDLE_NAME' 200 190"
CREATE_DMG_CMD="$CREATE_DMG_CMD --hide-extension '$APP_BUNDLE_NAME'"
CREATE_DMG_CMD="$CREATE_DMG_CMD --app-drop-link 600 190"

# 如果有背景图，添加背景设置
if [ -n "$DMG_BACKGROUND" ] && [ -f "$DMG_BACKGROUND" ]; then
    CREATE_DMG_CMD="$CREATE_DMG_CMD --background '$DMG_BACKGROUND'"
fi

CREATE_DMG_CMD="$CREATE_DMG_CMD '$OUTPUT_DIR/${DMG_NAME}.dmg' '$DMG_DIR'"

# 执行 create-dmg 命令
print_status "正在生成 DMG 文件..."
eval $CREATE_DMG_CMD

# 检查 DMG 是否创建成功
if [ -f "$OUTPUT_DIR/${DMG_NAME}.dmg" ]; then
    print_success "DMG 文件创建成功: ${DMG_NAME}.dmg"

    # 获取文件大小
    DMG_SIZE=$(du -h "$OUTPUT_DIR/${DMG_NAME}.dmg" | cut -f1)
    print_status "文件大小: $DMG_SIZE"

    # 计算校验值，用于更新 Homebrew Cask
    DMG_SHA256=$(shasum -a 256 "$OUTPUT_DIR/${DMG_NAME}.dmg" | awk '{print $1}')
    print_status "SHA256: $DMG_SHA256"
    print_status "更新 Cask: ./script/update-cask.sh ${APP_VERSION} ${DMG_NAME}.dmg"

    # 显示文件路径
    DMG_FULL_PATH="$OUTPUT_DIR/${DMG_NAME}.dmg"
    print_status "完整路径: $DMG_FULL_PATH"
else
    print_error "DMG 文件创建失败"
    exit 1
fi

# 复制独立的 .app 文件到根目录
print_status "复制 .app 文件到根目录..."
cp -R "$APP_PATH" "$OUTPUT_DIR/"
print_success ".app 文件已复制到根目录: ${APP_BUNDLE_NAME}"

# 清理临时文件
print_status "清理临时文件..."
rm -rf "$DMG_DIR"

# 代码签名 (如果有开发者证书)
if [ -n "$DEVELOPER_TEAM" ]; then
    print_status "对产物进行代码签名..."
    codesign --sign "$DEVELOPER_TEAM" --timestamp --options runtime "$OUTPUT_DIR/${DMG_NAME}.dmg"
    codesign --sign "$DEVELOPER_TEAM" --timestamp --options runtime "$OUTPUT_DIR/${APP_BUNDLE_NAME}"
    print_success "代码签名完成"
else
    print_warning "未配置开发者团队，跳过代码签名"
    print_warning "要启用代码签名，请在脚本中设置 DEVELOPER_TEAM 变量"
fi

# 验证 DMG
print_status "验证 DMG 文件..."
if hdiutil verify "$OUTPUT_DIR/${DMG_NAME}.dmg" > /dev/null 2>&1; then
    print_success "DMG 文件验证通过"
else
    print_warning "DMG 文件验证失败，但文件可能仍然可用"
fi

# 完成
echo ""
print_success "🎉 构建完成！"
echo ""
print_status "构建信息:"
echo "  应用名称: $APP_NAME"
echo "  版本: $APP_VERSION"
echo "  打包产物保存在根目录:"
echo "    - DMG 文件: ${DMG_NAME}.dmg (大小: $DMG_SIZE)"
echo "    - APP 文件: ${APP_BUNDLE_NAME}"
echo ""
print_status "你可以:"
echo "  1. 双击 ${DMG_NAME}.dmg 进行安装测试"
echo "  2. 直接运行 ${APP_BUNDLE_NAME} 进行测试"
echo "  3. 将 DMG 文件分发给用户"
echo "  4. 上传到应用商店或网站"
echo ""
print_status "所有打包产物已保存到根目录，不会自动打开。"

print_success "构建脚本执行完成！" 