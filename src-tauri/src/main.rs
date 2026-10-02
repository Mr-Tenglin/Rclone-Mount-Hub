// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// Returns true when this binary lives inside a Velopack-managed layout
/// (Update.exe sits next to the `current` dir that contains the exe).
///
/// Without that layout the embedded `VelopackApp` runtime can only swallow a
/// "NotInstalled" error. That is harmless, but it also means the process
/// can exit silently with no console to show why — which is exactly what
/// looked like a "silent crash" when the portable exe was run from the
/// build tree. Gate the runtime on the layout so the raw portable binary
/// skips it entirely.
fn in_velopack_layout() -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };

    // Pattern 1: .../current/rclone-mount-hub.exe with Update.exe in the parent
    if let Some(parent) = exe.parent() {
        if parent.join("Update.exe").exists() {
            return true;
        }
    }

    // Pattern 2: path contains a `\current\` segment with Update.exe above it
    let path = exe.to_string_lossy().to_string();
    if let Some(i) = path.rfind("\\current\\") {
        let root = std::path::PathBuf::from(&path[..i]);
        if root.join("Update.exe").exists() {
            return true;
        }
    }

    false
}

fn main() {
    if in_velopack_layout() {
        // Must be called before anything else — handles install/update/uninstall hooks
        velopack::VelopackApp::build()
            .on_before_update_fast_callback(|_version| {
                // Kill any rclone processes so the installer can replace files
                // without "Failed to remove existing application directory" errors.
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/IM", "rclone.exe"])
                    .output();
            })
            .on_before_uninstall_fast_callback(|_version| {
                // Kill rclone processes before uninstall cleanup
                let _ = std::process::Command::new("taskkill")
                    .args(["/F", "/IM", "rclone.exe"])
                    .output();
                // Clean up Tauri plugin store data left in %AppData%
                if let Ok(app_data) = std::env::var("APPDATA") {
                    let _ = std::fs::remove_dir_all(
                        format!("{}\\com.cbuzi.rclone-mount-hub", app_data)
                    );
                }
                // Remove Start Menu shortcut if it exists
                if let Ok(app_data) = std::env::var("APPDATA") {
                    let lnk = format!(
                        "{}\\Microsoft\\Windows\\Start Menu\\Programs\\Rclone Mount Hub.lnk",
                        app_data
                    );
                    let _ = std::fs::remove_file(lnk);
                }
            })
            .run();
    }

    rclone_mount_hub_lib::run()
}
