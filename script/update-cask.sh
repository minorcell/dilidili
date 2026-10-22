#!/bin/bash

# 发布 DMG 后更新 Homebrew Cask 的版本号与校验值
# 用法: ./script/update-cask.sh <version> <path-to-dmg>

set -euo pipefail

if [ $# -ne 2 ]; then
    echo "用法: $0 <version> <path-to-dmg>"
    echo "示例: $0 0.5.0 ./DILIDILI-0.5.0.dmg"
    exit 1
fi

VERSION="$1"
DMG="$2"
CASK_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/Casks/dilidili.rb"

if [ ! -f "$DMG" ]; then
    echo "找不到 DMG 文件: $DMG"
    exit 1
fi

if [ ! -f "$CASK_FILE" ]; then
    echo "找不到 Cask 文件: $CASK_FILE"
    exit 1
fi

SHA256=$(shasum -a 256 "$DMG" | awk '{print $1}')

perl -0pi -e "s/^  version \".*\"/  version \"${VERSION}\"/m" "$CASK_FILE"
perl -0pi -e "s/^  sha256 \".*\"/  sha256 \"${SHA256}\"/m" "$CASK_FILE"

echo "已更新 $(basename "$CASK_FILE")"
echo "  version: $VERSION"
echo "  sha256:  $SHA256"
