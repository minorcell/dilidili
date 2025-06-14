#!/bin/bash

# 构建脚本 - 创建自包含的macOS应用程序
set -e

# 配置变量
APP_NAME="Dilidili"
BUILD_DIR="build/darwin"
RESOURCES_DIR="resources"

echo "🚀 开始构建 $APP_NAME.app..."

# 检测当前架构
ARCH=$(uname -m)
echo "📋 检测到架构: $ARCH"

# 清理旧构建
echo "🧹 清理旧构建文件..."
rm -rf "$BUILD_DIR"

# 创建.app目录结构
echo "📁 创建应用程序目录结构..."
mkdir -p "$BUILD_DIR/$APP_NAME.app/Contents/MacOS"
mkdir -p "$BUILD_DIR/$APP_NAME.app/Contents/Resources"

# 构建Go应用
echo "🔨 构建Go应用程序..."
if [ "$ARCH" = "arm64" ]; then
    GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o "$BUILD_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME" ./cmd
else
    GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o "$BUILD_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME" ./cmd
fi

# 复制FFmpeg到Resources目录
echo "📦 复制FFmpeg到应用程序包..."
if [ -f "$RESOURCES_DIR/ffmpeg" ]; then
    cp "$RESOURCES_DIR/ffmpeg" "$BUILD_DIR/$APP_NAME.app/Contents/Resources/ffmpeg"
    echo "✅ FFmpeg已复制到应用程序包"
else
    echo "❌ 错误: 未找到FFmpeg文件在 $RESOURCES_DIR/ffmpeg"
    exit 1
fi

# 设置可执行权限
echo "🔐 设置可执行权限..."
chmod +x "$BUILD_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME"
chmod +x "$BUILD_DIR/$APP_NAME.app/Contents/Resources/ffmpeg"

# 创建Info.plist
echo "📋 创建Info.plist..."
cat > "$BUILD_DIR/$APP_NAME.app/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.dilidili.app</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleDisplayName</key>
    <string>$APP_NAME</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>DILI</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.15</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSApplicationCategoryType</key>
    <string>public.app-category.video</string>
</dict>
</plist>
EOF

# 验证构建结果
echo "🔍 验证构建结果..."
if [ -f "$BUILD_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME" ] && [ -f "$BUILD_DIR/$APP_NAME.app/Contents/Resources/ffmpeg" ]; then
    echo "✅ 构建成功！"
    echo "📍 应用程序路径: $BUILD_DIR/$APP_NAME.app"
    
    # 显示应用程序信息
    echo ""
    echo "📊 应用程序信息:"
    echo "   - 可执行文件: $(ls -lh "$BUILD_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME" | awk '{print $5}')"
    echo "   - FFmpeg大小: $(ls -lh "$BUILD_DIR/$APP_NAME.app/Contents/Resources/ffmpeg" | awk '{print $5}')"
    
    # 测试FFmpeg
    echo ""
    echo "🧪 测试FFmpeg..."
    if "$BUILD_DIR/$APP_NAME.app/Contents/Resources/ffmpeg" -version | head -1; then
        echo "✅ FFmpeg测试通过"
    else
        echo "❌ FFmpeg测试失败"
    fi
    
    echo ""
    echo "🎉 构建完成！您可以："
    echo "   1. 直接运行: open '$BUILD_DIR/$APP_NAME.app'"
    echo "   2. 创建DMG: ./scripts/create_dmg.sh"
    
else
    echo "❌ 构建失败！缺少必要文件"
    exit 1
fi 