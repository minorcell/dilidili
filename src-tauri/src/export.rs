use std::path::Path;
use tauri::Manager;

// 打开文件夹选择器
#[tauri::command]
pub async fn select_export_folder(app_handle: tauri::AppHandle) -> Result<String, String> {
    // 获取默认下载目录
    let downloads_dir = app_handle.path().download_dir()
        .map_err(|e| e.to_string())?;
    
    // 返回下载目录路径供前端使用
    Ok(downloads_dir.to_string_lossy().to_string())
}

// 复制文件到指定文件夹
#[tauri::command]
pub async fn export_file_to_folder(
    source_path: String,
    target_folder: String,
    new_filename: Option<String>
) -> Result<String, String> {
    println!("=== 开始导出文件 ===");
    println!("源文件: {}", source_path);
    println!("目标文件夹: {}", target_folder);
    
    let source = Path::new(&source_path);
    tokio::fs::metadata(source)
        .await
        .map_err(|_| format!("源文件不存在: {}", source_path))?;

    // 使用异步文件系统操作，复制大文件时不会阻塞异步运行时
    let target_dir = Path::new(&target_folder);
    tokio::fs::create_dir_all(target_dir)
        .await
        .map_err(|e| format!("创建目标目录失败: {}", e))?;
    
    // 确定目标文件名
    let filename = if let Some(new_name) = new_filename {
        new_name
    } else {
        source.file_name()
            .ok_or("无法获取源文件名")?
            .to_string_lossy()
            .to_string()
    };
    
    let target_path = target_dir.join(&filename);
    
    // 如果目标文件已存在，添加序号
    let mut final_target = target_path.clone();
    let mut counter = 1;

    while tokio::fs::try_exists(&final_target).await.unwrap_or(false) {
        let stem = target_path.file_stem().unwrap_or_default().to_string_lossy();
        let extension = target_path.extension().unwrap_or_default().to_string_lossy();
        
        let new_name = if extension.is_empty() {
            format!("{}_{}", stem, counter)
        } else {
            format!("{}_{}.{}", stem, counter, extension)
        };
        
        final_target = target_dir.join(new_name);
        counter += 1;
    }
    
    // 复制文件
    tokio::fs::copy(&source, &final_target)
        .await
        .map_err(|e| format!("复制文件失败: {}", e))?;
    
    println!("✅ 文件导出成功: {:?}", final_target);
    Ok(final_target.to_string_lossy().to_string())
}

// 批量导出文件
#[tauri::command]
pub async fn batch_export_files(
    source_files: Vec<String>,
    target_folder: String
) -> Result<Vec<String>, String> {
    println!("=== 开始批量导出 ===");
    println!("源文件数量: {}", source_files.len());
    println!("目标文件夹: {}", target_folder);
    
    let target_dir = Path::new(&target_folder);
    tokio::fs::create_dir_all(target_dir)
        .await
        .map_err(|e| format!("创建目标目录失败: {}", e))?;
    
    let mut exported_files = Vec::new();
    let mut errors = Vec::new();
    
    for source_path in source_files {
        match export_file_to_folder(source_path.clone(), target_folder.clone(), None).await {
            Ok(exported_path) => {
                exported_files.push(exported_path);
            }
            Err(e) => {
                errors.push(format!("导出文件 {} 失败: {}", source_path, e));
            }
        }
    }
    
    if !errors.is_empty() {
        println!("部分文件导出失败: {:?}", errors);
        return Err(format!("部分文件导出失败: {}", errors.join(", ")));
    }
    
    println!("✅ 批量导出完成，共 {} 个文件", exported_files.len());
    Ok(exported_files)
}

// 打开文件夹
#[tauri::command]
pub async fn open_folder(folder_path: String) -> Result<(), String> {
    let path = Path::new(&folder_path);
    
    if !path.exists() {
        return Err(format!("文件夹不存在: {}", folder_path));
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }
    
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&folder_path)
            .spawn()
            .map_err(|e| format!("打开文件夹失败: {}", e))?;
    }
    
    Ok(())
}

// 获取文件信息
#[tauri::command]
pub async fn get_file_info(file_path: String) -> Result<FileInfo, String> {
    let path = Path::new(&file_path);
    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|_| format!("文件不存在: {}", file_path))?;
    
    let file_info = FileInfo {
        path: file_path.clone(),
        name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        size: metadata.len(),
        is_dir: metadata.is_dir(),
        created: metadata.created().ok()
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()),
        modified: metadata.modified().ok()
            .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs()),
    };
    
    Ok(file_info)
}

// 文件信息结构
#[derive(serde::Serialize, serde::Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_dir: bool,
    pub created: Option<u64>,
    pub modified: Option<u64>,
} 