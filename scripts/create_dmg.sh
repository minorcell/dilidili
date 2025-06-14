#!/bin/bash

# DMG创建脚本 - 将.app打包为DMG安装文件
set -e

# 配置变量
APP_NAME="Dilidili"
BUILD_DIR="build/darwin"
DMG_NAME="$APP_NAME-installer"
VOLUME_NAME="$APP_NAME Installer"

echo "📦 开始创建DMG安装包..."

# 检查.app是否存在
if [ ! -d "$BUILD_DIR/$APP_NAME.app" ]; then
    echo "❌ 错误: 未找到 $BUILD_DIR/$APP_NAME.app"
    echo "请先运行: ./scripts/build.sh"
    exit 1
fi

# 创建临时DMG目录
TEMP_DMG_DIR="build/dmg_temp"
echo "🧹 清理临时文件..."
rm -rf "$TEMP_DMG_DIR"
rm -f "build/$DMG_NAME.dmg"

echo "📁 创建DMG临时目录..."
mkdir -p "$TEMP_DMG_DIR"

# 复制.app到临时目录
echo "📋 复制应用程序到DMG..."
cp -R "$BUILD_DIR/$APP_NAME.app" "$TEMP_DMG_DIR/"

# 创建应用程序文件夹的符号链接
echo "🔗 创建Applications链接..."
ln -s /Applications "$TEMP_DMG_DIR/Applications"

# 创建自述文件
echo "📝 创建安装说明..."
cat > "$TEMP_DMG_DIR/安装说明.txt" << EOF
$APP_NAME 安装说明
========================

安装步骤：
1. 将 $APP_NAME.app 拖拽到 Applications 文件夹
2. 从 Applications 文件夹或 Launchpad 启动应用程序
3. 首次运行时，如果出现安全提示，请：
   - 打开"系统偏好设置" > "安全性与隐私"
   - 点击"仍要打开"

特点：
- ✅ 自包含应用程序，无需安装FFmpeg
- ✅ 支持.m4s文件合并
- ✅ 高质量视频下载和处理

如有问题，请访问项目主页获取支持。

版本: 1.0.0
EOF

# 设置DMG目录的图标位置（可选）
echo "🎨 配置DMG布局..."

# 创建DMG
echo "💿 创建DMG文件..."
hdiutil create -volname "$VOLUME_NAME" \
    -srcfolder "$TEMP_DMG_DIR" \
    -ov -format UDZO \
    -imagekey zlib-level=9 \
    "build/$DMG_NAME.dmg"

# 清理临时文件
echo "🧹 清理临时文件..."
rm -rf "$TEMP_DMG_DIR"

# 验证DMG
echo "🔍 验证DMG文件..."
if [ -f "build/$DMG_NAME.dmg" ]; then
    DMG_SIZE=$(ls -lh "build/$DMG_NAME.dmg" | awk '{print $5}')
    echo "✅ DMG创建成功！"
    echo "📍 DMG路径: build/$DMG_NAME.dmg"
    echo "📊 DMG大小: $DMG_SIZE"
    echo ""
    echo "🎉 您现在可以："
    echo "   1. 测试DMG: open build/$DMG_NAME.dmg"
    echo "   2. 分发给用户安装"
    echo "   3. 上传到网站供下载"
else
    echo "❌ DMG创建失败！"
    exit 1
fi 