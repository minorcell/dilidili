use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

// 同一目标的下载可能并发进行，临时文件名带上调用标识，
// 保证清理时只会删除本次调用创建的文件。
pub fn temp_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();

    format!("{}-{}", std::process::id(), nanos)
}

// 作用域守卫：除非显式 disarm，离开作用域时删除临时文件。
// 这样错误分支、任务取消（future 被 drop）以及 panic 都不会在磁盘上留下半成品。
pub struct TempFileGuard {
    path: PathBuf,
    keep: bool,
}

impl TempFileGuard {
    pub fn new(path: &Path) -> Self {
        Self {
            path: path.to_path_buf(),
            keep: false,
        }
    }

    // 文件已经完成并交由调用方处理，不再自动删除
    pub fn disarm(&mut self) {
        self.keep = true;
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        if !self.keep {
            // Drop 中无法 await，这里只做一次 unlink，开销可以忽略
            let _ = std::fs::remove_file(&self.path);
        }
    }
}

// 一组临时文件的作用域守卫，退出时清理仍然存在的文件。
// 文件被重命名或删除后，这里的清理是无害的空操作。
pub struct TempFileSet(Vec<PathBuf>);

impl TempFileSet {
    pub fn new(paths: Vec<PathBuf>) -> Self {
        Self(paths)
    }
}

impl Drop for TempFileSet {
    fn drop(&mut self) {
        for path in &self.0 {
            let _ = std::fs::remove_file(path);
        }
    }
}

// 用新文件替换目标文件。
// Unix 上 rename 会原子覆盖；Windows 上目标已存在时 rename 会失败，
// 因此先删除旧文件再重试，保持“覆盖同名输出”的原有语义。
pub async fn replace_file(from: &Path, to: &Path) -> Result<(), String> {
    match tokio::fs::rename(from, to).await {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            if tokio::fs::try_exists(to).await.unwrap_or(false) {
                tokio::fs::remove_file(to)
                    .await
                    .map_err(|e| format!("删除已存在的文件 {} 失败: {}", to.display(), e))?;

                tokio::fs::rename(from, to)
                    .await
                    .map_err(|e| format!("重命名 {} 失败: {}", to.display(), e))
            } else {
                Err(format!("重命名 {} 失败: {}", to.display(), rename_error))
            }
        }
    }
}
