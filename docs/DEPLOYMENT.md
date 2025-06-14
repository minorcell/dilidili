# 部署指南 - FFmpeg 集成与 DMG 分发

## 🎯 回答您的问题

### 1. 是否必须把ffmpeg放在根目录？
**不是必须的！** 新的实现支持多种路径查找策略：

- ✅ **应用程序包内**：`MyApp.app/Contents/Resources/ffmpeg`
- ✅ **当前目录**：`./ffmpeg`
- ✅ **子目录**：`./bin/ffmpeg`, `./resources/ffmpeg`
- ✅ **系统PATH**：已安装的系统ffmpeg

### 2. 放在其他目录是否可运行？
**完全可以！** 查找优先级：
1. **应用包内** → 2. **本地目录** → 3. **系统PATH**

### 3. DMG分发时用户需要注意什么？
按照下面的指南操作，用户**无需手动安装FFmpeg**！

---

## 📦 DMG 分发最佳实践

### 方案一：自包含分发（推荐）

将FFmpeg打包到应用程序内，用户无需安装任何依赖。

#### 1. 下载FFmpeg二进制文件

```bash
# 下载适用于macOS的FFmpeg静态构建版本
# Intel Mac (x86_64)
curl -L https://github.com/eugeneware/ffmpeg-static/releases/download/b4.4.0/darwin-x64 -o ffmpeg-intel

# Apple Silicon Mac (arm64)  
curl -L https://github.com/eugeneware/ffmpeg-static/releases/download/b4.4.0/darwin-arm64 -o ffmpeg-arm64

# 或者使用官方FFmpeg构建
# 访问 https://ffmpeg.org/download.html#build-mac
```

#### 2. 项目目录结构

```
your-app/
├── cmd/
│   └── main.go
├── pkg/
│   └── downloader/
│       └── merge.go
├── resources/
│   ├── ffmpeg-intel      # Intel版本
│   ├── ffmpeg-arm64      # Apple Silicon版本
│   └── ffmpeg            # 当前架构的符号链接
├── build/
│   └── darwin/
│       └── MyApp.app/
│           └── Contents/
│               ├── MacOS/
│               │   └── MyApp
│               └── Resources/
│                   └── ffmpeg
└── scripts/
    ├── build.sh
    └── create_dmg.sh
```

#### 3. 构建脚本

创建 `scripts/build.sh`：

```bash
#!/bin/bash

# 检测当前架构
ARCH=$(uname -m)
APP_NAME="MyApp"
BUILD_DIR="build/darwin"

# 清理旧构建
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/$APP_NAME.app/Contents/MacOS"
mkdir -p "$BUILD_DIR/$APP_NAME.app/Contents/Resources"

# 构建Go应用
echo "构建 $APP_NAME for $ARCH..."
GOOS=darwin GOARCH=amd64 go build -o "$BUILD_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME" ./cmd

# 复制FFmpeg
if [ "$ARCH" = "arm64" ]; then
    cp resources/ffmpeg-arm64 "$BUILD_DIR/$APP_NAME.app/Contents/Resources/ffmpeg"
else
    cp resources/ffmpeg-intel "$BUILD_DIR/$APP_NAME.app/Contents/Resources/ffmpeg"
fi

# 设置可执行权限
chmod +x "$BUILD_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME"
chmod +x "$BUILD_DIR/$APP_NAME.app/Contents/Resources/ffmpeg"

# 创建Info.plist
cat > "$BUILD_DIR/$APP_NAME.app/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>$APP_NAME</string>
    <key>CFBundleIdentifier</key>
    <string>com.yourcompany.$APP_NAME</string>
    <key>CFBundleName</key>
    <string>$APP_NAME</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
</dict>
</plist>
EOF

echo "构建完成: $BUILD_DIR/$APP_NAME.app"
```

#### 4. 创建DMG脚本

创建 `scripts/create_dmg.sh`：

```bash
#!/bin/bash

APP_NAME="MyApp"
BUILD_DIR="build/darwin"
DMG_NAME="$APP_NAME-installer"

# 创建临时DMG目录
TEMP_DMG_DIR="build/dmg_temp"
rm -rf "$TEMP_DMG_DIR"
mkdir -p "$TEMP_DMG_DIR"

# 复制.app到临时目录
cp -R "$BUILD_DIR/$APP_NAME.app" "$TEMP_DMG_DIR/"

# 创建应用程序文件夹的符号链接
ln -s /Applications "$TEMP_DMG_DIR/Applications"

# 创建DMG
hdiutil create -volname "$APP_NAME" \
    -srcfolder "$TEMP_DMG_DIR" \
    -ov -format UDRO \
    "build/$DMG_NAME.dmg"

# 清理临时文件
rm -rf "$TEMP_DMG_DIR"

echo "DMG创建完成: build/$DMG_NAME.dmg"
```

### 方案二：通用二进制（Universal Binary）

支持Intel和Apple Silicon的通用应用：

```bash
#!/bin/bash
# 构建通用二进制
APP_NAME="MyApp"
BUILD_DIR="build/darwin"

# 构建两种架构
GOOS=darwin GOARCH=amd64 go build -o "build/tmp/$APP_NAME-amd64" ./cmd
GOOS=darwin GOARCH=arm64 go build -o "build/tmp/$APP_NAME-arm64" ./cmd

# 合并为通用二进制
lipo -create -output "$BUILD_DIR/$APP_NAME.app/Contents/MacOS/$APP_NAME" \
    "build/tmp/$APP_NAME-amd64" \
    "build/tmp/$APP_NAME-arm64"

# 复制对应架构的FFmpeg
# 这里需要创建通用的FFmpeg二进制或在运行时选择
```

---

## 🔧 开发和测试

### 本地开发
开发时可以将FFmpeg放在项目根目录：
```bash
# 下载FFmpeg到项目根目录
curl -L [ffmpeg-url] -o ffmpeg
chmod +x ffmpeg
```

### 测试不同部署方式
```bash
# 测试1: 使用本地FFmpeg
./ffmpeg --version

# 测试2: 使用系统FFmpeg
which ffmpeg

# 测试3: 模拟应用包环境
mkdir -p test.app/Contents/MacOS
mkdir -p test.app/Contents/Resources
cp your-app test.app/Contents/MacOS/
cp ffmpeg test.app/Contents/Resources/
./test.app/Contents/MacOS/your-app
```

---

## ⚠️ 重要注意事项

### 1. 代码签名
对于DMG分发，需要对应用和FFmpeg进行代码签名：
```bash
# 签名FFmpeg
codesign --force --sign "Developer ID Application: Your Name" \
    MyApp.app/Contents/Resources/ffmpeg

# 签名应用
codesign --force --sign "Developer ID Application: Your Name" \
    MyApp.app
```

### 2. 公证（Notarization）
macOS 10.15+需要公证：
```bash
# 创建签名的DMG
xcrun altool --notarize-app \
    --primary-bundle-id "com.yourcompany.myapp" \
    --username "your-apple-id" \
    --password "@keychain:AC_PASSWORD" \
    --file MyApp-installer.dmg
```

### 3. 用户权限
首次运行时macOS可能会提示安全警告，用户需要：
- 在"系统偏好设置 > 安全性与隐私"中允许应用运行
- 或者右键点击应用，选择"打开"

---

## 🎯 用户安装指南

### 对于DMG分发的用户：
1. **下载并打开DMG文件**
2. **拖拽应用到Applications文件夹**
3. **双击运行**（无需额外安装FFmpeg）

### 如果遇到安全提示：
1. 打开"系统偏好设置 > 安全性与隐私"
2. 点击"仍要打开"
3. 或者：按住Control键点击应用，选择"打开"

---

## 📋 总结

✅ **推荐方案**：自包含DMG分发
✅ **用户体验**：零依赖安装
✅ **跨平台**：支持Intel和Apple Silicon
✅ **专业**：符合macOS应用分发标准

这样用户只需要安装一个DMG文件，无需关心FFmpeg的安装和配置！ 