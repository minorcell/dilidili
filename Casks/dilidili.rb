cask "dilidili" do
  version "0.5.0"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"

  url "https://github.com/minorcell/dilidili/releases/download/v#{version}/DILIDILI-#{version}.dmg"
  name "DILIDILI"
  desc "哔哩哔哩视频下载器"
  homepage "https://github.com/minorcell/dilidili"

  depends_on macos: ">= :catalina"

  app "DILIDILI.app"

  caveats <<~EOS
    DILIDILI 尚未使用 Apple 开发者证书签名与公证。通过 Homebrew 安装的副本通常可以直接打开；
    如果 macOS 仍提示“无法验证开发者”，请执行：

      xattr -dr com.apple.quarantine "#{appdir}/DILIDILI.app"

    或前往“系统设置 → 隐私与安全性”，选择“仍要打开”。
  EOS
end
