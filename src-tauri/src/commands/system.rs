// System utility commands

use tauri::command;
use tauri_plugin_shell::ShellExt;
use serde::{Serialize, Deserialize};

#[command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

#[command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriverVersions {
    pub rclone_installed: bool,
    pub rclone_version: Option<String>,
    pub winfsp_installed: bool,
    pub winfsp_version: Option<String>,
}

// ── Scoop bootstrap ───────────────────────────────────────────────────────────

/// Scoop bucket sources.
///
/// `github` — the official, authoritative Scoop main bucket
///           (github.com/ScoopInstaller/Main). Default choice.
/// `gitee`  — a community-synced copy of the bucket on Gitee, a Git
///           hosting platform popular with mainland-China developers.
///           Use it when GitHub is slow or unreachable from your network.
///           It is NOT a mirror of GitHub: Gitee hosts its own repositories
///           that are synced from GitHub by a third party, so the package
///           list may lag behind GitHub or be missing some entries.
const SCOOP_BUCKET_URLS: &[(&str, &str)] = &[
    ("github", "https://github.com/ScoopInstaller/Main.git"),
    ("gitee", "https://gitee.com/ScoopInstaller/Main.git"),
];

fn scoop_bucket_url(source: &str) -> &'static str {
    SCOOP_BUCKET_URLS
        .iter()
        .find(|(code, _)| code.eq_ignore_ascii_case(source))
        .map(|(_, url)| *url)
        .unwrap_or(SCOOP_BUCKET_URLS[0].1)
}

/// Run a powershell one-liner and return (success, stdout, stderr).
///
/// `-NoProfile` keeps it fast and deterministic on a freshly-imaged system;
/// `-Command` is passed as a single quoted argument. The three-tuple return
/// shape (instead of the older two) is used by `scoop_run` and the Scoop
/// bootstrap, which need to surface the installer's output for diagnostics.
async fn ps1(app: &tauri::AppHandle, cmd: &str) -> (bool, String, String) {
    match app
        .shell()
        .command("powershell")
        .args(["-NoProfile", "-Command", cmd])
        .output()
        .await
    {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            (output.status.success(), stdout, stderr)
        }
        Err(e) => (false, String::new(), e.to_string()),
    }
}

/// Is the `scoop` binary present at the default install location
/// (`%USERPROFILE%\scoop\shims\scoop.exe`)?
///
/// We probe the file directly instead of spawning `scoop`: right after a
/// bootstrap, the shims folder is NOT on this process's cached PATH (it was
/// only merged into the *registry* user PATH, which new processes see).
/// A file-existence test sidesteps that entirely.
#[cfg(target_os = "windows")]
fn scoop_bin_exists() -> bool {
    let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
    let bin = format!(r"{}\scoop\shims\scoop.exe", userprofile);
    std::path::Path::new(&bin).exists()
}

/// Append Scoop's shims directory to the *process* PATH so later spawns in
/// this run can find `scoop` without a restart. Registry changes made by
/// the bootstrap only reach new processes; this refreshes the current one.
#[cfg(target_os = "windows")]
fn update_process_path_env() {
    let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
    let shims = format!(r"{}\scoop\shims", userprofile);
    if !std::path::Path::new(&shims).is_dir() {
        return;
    }
    let current = std::env::var("PATH").unwrap_or_default();
    if !current.split(';').any(|p| p.trim().eq_ignore_ascii_case(&shims)) {
        let next = format!("{};{}", shims, current);
        std::env::set_var("PATH", next);
    }
}

/// Run a Scoop subcommand. Prefers the process PATH; when that misses
/// (fresh bootstrap, cached PATH), falls back to the shims directory merged
/// from the *registry* PATH — exactly what a new process would see. This is
/// what makes "install Scoop → install rclone" work in one app run.
#[cfg(target_os = "windows")]
async fn scoop_run(app: &tauri::AppHandle, args: &[&str]) -> (bool, String, String) {
    let joined = args.join(" ");

    // Fast path: scoop on the process PATH.
    let (ok, out, err) = ps1(app, &format!("scoop {} 2>&1 | Out-String", joined)).await;
    // If `scoop` was not found on PATH, powershell still exits 0 because
    // the pipeline succeeded; the *content* says "not recognized".
    if ok && !out.contains("not recognized") && !out.contains("无法将") {
        return (ok, out, err);
    }
    // Also treat an outright failure to invoke powershell as "retry slow path".
    if ok {
        return (ok, out, err);
    }

    // Slow path: registry-merged PATH.
    fn reg_path_value(hive: &str, key: &str, value: &str) -> String {
        let out = std::process::Command::new("reg")
            .args(["query", &format!("{}\\{}", hive, key), "/v", value])
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
            .unwrap_or_default();
        out.lines()
            .filter_map(|l| {
                let t = l.trim();
                t.to_lowercase()
                    .starts_with(&value.to_lowercase())
                    .then(|| {
                        if let Some(pos) = t.find("REG_") {
                            t[pos + 4..]
                                .trim_start_matches(|c: char| c.is_whitespace() || c == '\t')
                                .to_string()
                        } else {
                            t.to_string()
                        }
                    })
            })
            .next()
            .unwrap_or_default()
    }

    let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
    let shims = format!(r"{}\scoop\shims", userprofile);
    let machine = reg_path_value("HKLM", "SYSTEM\\CurrentControlSet\\Control", "Path");
    let user = reg_path_value("HKCU", "Environment", "Path");
    let merged = format!("{};{};{}", machine, user, shims);
    let cmd = format!(
        "$env:PATH = '{}'; scoop {} 2>&1 | Out-String",
        merged, joined
    );
    ps1(app, &cmd).await
}

/// Is the Scoop `main` bucket a healthy, current git repo?
///
/// The known failure mode (Scoop 0.6.0+): the bucket dir exists but is *not*
/// a git repo, so `scoop update` aborts with "Failed to remove local 'main'
/// bucket" / "'main' bucket not found" and `scoop install` can't find
/// manifests. Detect that here so we can repair it.
#[cfg(target_os = "windows")]
async fn scoop_main_bucket_healthy(app: &tauri::AppHandle) -> bool {
    let (ok, out, _) = scoop_run(app, &["bucket", "list", "main"]).await;
    // `scoop bucket list main` prints the bucket + its source on success.
    ok && !out.contains("not found") && !out.contains("Failed to remove")
}

/// Apply or clear the user's HTTP proxy for the whole Scoop stack:
///   - `scoop config --global proxy <url>` — makes `scoop install/update`
///     download through the proxy (Scoop honours this for its downloads).
///   - `scoop config --global unset proxy` — clears it when the user turns
///     the proxy off.
/// A `None`/empty value clears the config. Best-effort: failure to set the
/// proxy does not abort the install flow, it is just logged.
#[cfg(target_os = "windows")]
async fn apply_scoop_proxy(app: &tauri::AppHandle, proxy_url: &str) -> Result<(), String> {
    if proxy_url.trim().is_empty() {
        let _ = scoop_run(app, &["config", "--global", "unset", "proxy"]).await;
        return Ok(());
    }

    let (ok, out, err) = scoop_run(app, &["config", "--global", "proxy", proxy_url]).await;
    if !ok {
        let detail = if out.trim().is_empty() { err } else { out };
        return Err(format!(
            "Failed to set Scoop proxy to {} — {}",
            proxy_url,
            detail.trim()
        ));
    }
    Ok(())
}

/// PowerShell snippet that makes `Invoke-WebRequest` / `Invoke-RestMethod`
/// honour the given proxy (Scoop bootstrap download + WinFsp installer both
/// use these). Empty proxy returns an empty string (no-op).
fn powershell_proxy_prefix(proxy_url: &str) -> String {
    if proxy_url.trim().is_empty() {
        return String::new();
    }
    format!(
        "$env:HTTP_PROXY = '{}'; $env:HTTPS_PROXY = '{}'; $env:NO_PROXY = 'localhost,127.0.0.1'; ",
        proxy_url, proxy_url
    )
}

/// Make sure Scoop itself is present (bootstrapping it from get.scoop.sh when
/// missing), then guarantee the `main` bucket exists from the requested
/// source. If the existing bucket was built from the *other* source, it is
/// removed and re-added so `scoop update` actually pulls from the right place.
///
/// Flow:
///   1. Detect `scoop` by the shims file (PATH-independent).
///   2. If missing:
///      a. Set the user execution policy to RemoteSigned (the installer
///         refuses to run under Unrestricted-only/Restricted; a previous run
///         of the installer may have left it blocked — this mirrors what a
///         user would do manually, and is per-user so no UAC prompt).
///      b. Download `install.ps1` ourselves with `Invoke-WebRequest` and run
///         it in-process with `-Bypass`. We do NOT use `irm | iex`: when the
///         app runs elevated the stock one-liner aborts with "Running the
///         installer as administrator is disabled by default" (the installer
///         rejects elevated installs unless `-RunAsAdmin` is passed, which
///         we deliberately do *not* pass — we want the per-user install).
///      c. Poll up to 60 s until the shims land, then merge them into the
///         process PATH so the rest of this run can call `scoop`.
///   3. Repair / point the main bucket at the requested source.
#[cfg(target_os = "windows")]
async fn ensure_scoop_installed(
    app: &tauri::AppHandle,
    bucket_source: &str,
    proxy_url: &str,
) -> Result<(), String> {
    // 1. Is Scoop already installed (per-user layout)?
    if !scoop_bin_exists() {
        // 2a. The installer hard-fails unless the execution policy is one of
        //     Unrestricted / RemoteSigned / ByPass. Set CurrentUser scope
        //     (no elevation needed; does not affect other users).
        let (ep_ok, _ep_out, ep_err) = ps1(app, "Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force 2>&1 | Out-String").await;
        if !ep_ok {
            return Err(format!(
                "Could not set the PowerShell execution policy (needed to run the Scoop \
                 installer): {}. Run manually: Set-ExecutionPolicy RemoteSigned -Scope CurrentUser",
                ep_err.trim()
            ));
        }

        // 2b. Download the installer and run it in-process with -Bypass.
        //     - TLS 1.2 forced (PS 5.1 default is TLS 1.0/1.1 on older systems).
        //     - No `iex` on a downloaded pipeline (no execution-policy prompt).
        //     - No `-RunAsAdmin`: per-user install into %USERPROFILE%\scoop,
        //       even when this app itself runs elevated — the stock one-liner
        //       would abort otherwise.
        //     - Honours the user's proxy setting (Invoke-WebRequest).
        let proxy_prefix = powershell_proxy_prefix(proxy_url);
        let inner = format!(
            r#"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
$ErrorActionPreference = "Stop";
{}
$scriptPath = Join-Path $env:TEMP "rmh-scoop-install.ps1";
Invoke-WebRequest -UseBasicParsing -Uri "https://get.scoop.sh" -OutFile $scriptPath;
& $scriptPath -DisableMinShell;
if ($LASTEXITCODE -ne 0) {{ throw "Scoop installer exited with code $LASTEXITCODE" }};
"#,
            proxy_prefix
        );
        let cmd = format!(
            "powershell -NoProfile -ExecutionPolicy Bypass -Command \"{}\" 2>&1 | Out-String",
            inner.replace('\n', " ").replace('"', "\\\"")
        );
        let (inst_ok, out, err) = ps1(app, &cmd).await;
        if !inst_ok {
            let detail = if !out.trim().is_empty() { out } else { err };
            return Err(format!(
                "Scoop installation failed: {}\n\
                 (If your network requires a proxy, set it first: \
                 scoop config --global proxy http://<host>:<port> — then retry.)",
                detail.trim()
            ));
        }

        // 2c. Wait for the shims to appear, then refresh the process PATH.
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(90);
        while !scoop_bin_exists() {
            if std::time::Instant::now() >= deadline {
                return Err(
                    "Scoop installer finished but its shims were not found under \
                     %USERPROFILE%\\scoop\\shims. Check the log, then retry."
                        .to_string(),
                );
            }
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;
        }
        update_process_path_env();

        // Persist the proxy choice into Scoop's global config so subsequent
        // `scoop install` / `scoop update` in this flow honour it.
        apply_scoop_proxy(app, proxy_url).await?;
    } else {
        // Already installed — make sure the proxy setting is in sync with
        // what the user configured (they may have toggled it since the last
        // install attempt).
        apply_scoop_proxy(app, proxy_url).await?;
    }

    // 3. Repair / point the main bucket at the requested source.
    let url = scoop_bucket_url(bucket_source);
    let healthy = scoop_main_bucket_healthy(app).await;
    if !healthy {
        // Best-effort removal of a broken/directory-only bucket.
        let _ = scoop_run(app, &["bucket", "rm", "main"]).await;
    }
    // Re-add when missing, or when the recorded source differs from the
    // requested one. (The URL of the active bucket shows in `bucket list`.)
    let (_, list, _) = scoop_run(app, &["bucket", "list", "main"]).await;
    if !healthy || !list.contains(url) {
        let _ = scoop_run(app, &["bucket", "rm", "main"]).await;
        let (add_ok, _, add_err) = scoop_run(app, &["bucket", "add", "main", url]).await;
        if !add_ok {
            return Err(format!(
                "Failed to add Scoop main bucket from {} ({}) — check your network: {}",
                if bucket_source.eq_ignore_ascii_case("gitee") { "Gitee" } else { "GitHub" },
                url,
                add_err.trim()
            ));
        }
        let _ = scoop_run(app, &["update"]).await;
    } else {
        // Healthy bucket already on the right source — just refresh.
        let _ = scoop_run(app, &["update"]).await;
    }

    Ok(())
}

/// Non-Windows stub: there is no Scoop, so just succeed no-op.
#[cfg(not(target_os = "windows"))]
async fn ensure_scoop_installed(
    _app: &tauri::AppHandle,
    _bucket_source: &str,
    _proxy_url: &str,
) -> Result<(), String> {
    Ok(())
}

#[command]
pub async fn enable_autostart(_app: tauri::AppHandle, minimized: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?;
        let exe_path_str = exe_path.to_string_lossy();

        let value = if minimized {
            format!("\"{}\" --minimized", exe_path_str)
        } else {
            format!("\"{}\"", exe_path_str)
        };

        let output = crate::util::cmd("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "RcloneMountHub",
                "/t",
                "REG_SZ",
                "/d",
                &value,
                "/f",
            ])
            .output()
            .map_err(|e| format!("Failed to add registry key: {}", e))?;

        if !output.status.success() {
            return Err("Failed to enable autostart".to_string());
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Autostart is only supported on Windows currently.".to_string())
    }
}

#[command]
pub async fn disable_autostart(_app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _output = crate::util::cmd("reg")
            .args([
                "delete",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "RcloneMountHub",
                "/f",
            ])
            .output()
            .map_err(|e| format!("Failed to delete registry key: {}", e))?;

        // Don't error if the key doesn't exist
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Autostart is only supported on Windows currently.".to_string())
    }
}

#[command]
pub async fn is_autostart_enabled(_app: tauri::AppHandle) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        let output = crate::util::cmd("reg")
            .args([
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "RcloneMountHub",
            ])
            .output()
            .map_err(|e| format!("Failed to query registry: {}", e))?;

        Ok(output.status.success())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(false)
    }
}

#[command]
pub async fn install_rclone(
    app: tauri::AppHandle,
    scoop_bucket_source: Option<String>,
    proxy_url: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Ensure scoop is installed and its main bucket is healthy / on the
        // requested source (github or gitee). Proxy is applied first so
        // both the bootstrap download (when Scoop is missing) and the
        // subsequent bucket git-clone honour it.
        let src = scoop_bucket_source.as_deref().unwrap_or("github");
        let proxy = proxy_url.unwrap_or_default();
        ensure_scoop_installed(&app, src, &proxy).await?;

        // Run through `scoop_run` so a freshly-bootstrapped Scoop (whose shims
        // are not on this process's cached PATH) is still found.
        let (ok, out, err) = scoop_run(&app, &["install", "rclone"]).await;
        if !ok {
            let detail = if !out.trim().is_empty() {
                out
            } else if !err.trim().is_empty() {
                err
            } else {
                "unknown error".to_string()
            };
            return Err(format!(
                "Rclone installation failed: {}\n\
                 (If your network requires a proxy, set it in Settings → Proxy \
                 and retry.)",
                detail.trim()
            ));
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Auto-install is only supported on Windows. Please install rclone manually.".to_string())
    }
}

#[command]
pub async fn install_winfsp(_app: tauri::AppHandle) -> Result<(), String> {
    // This is kept for API compatibility but WinFsp is now installed via download_and_launch_winfsp_installer
    Err("Use download_and_launch_winfsp_installer instead".to_string())
}

#[command]
pub async fn download_and_launch_winfsp_installer(
    app: tauri::AppHandle,
    proxy_url: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let proxy = proxy_url.unwrap_or_default();
        let proxy_prefix = powershell_proxy_prefix(&proxy);

        // Fetch latest release info from GitHub API
        let api_output = app
            .shell()
            .command("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    r#"
                    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;
                    {}
                    $response = Invoke-RestMethod -Uri 'https://api.github.com/repos/winfsp/winfsp/releases/latest' -UseBasicParsing;
                    $asset = $response.assets | Where-Object {{ $_.name -like '*.msi' -and $_.name -notlike '*arm*' }} | Select-Object -First 1;
                    Write-Output "$($asset.browser_download_url)|$($asset.name)|$($response.tag_name)"
                    "#,
                    proxy_prefix
                ),
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to fetch release info: {}", e))?;

        let stdout = String::from_utf8_lossy(&api_output.stdout);
        let trimmed = stdout.trim();

        if trimmed.is_empty() || !trimmed.contains('|') {
            let detail = if trimmed.is_empty() {
                String::from_utf8_lossy(&api_output.stderr).to_string()
            } else {
                trimmed.to_string()
            };
            return Err(format!(
                "Failed to get WinFsp download URL from GitHub: {} \
                 (if your network requires a proxy, enable it in Settings → Proxy and retry)",
                detail.trim()
            ));
        }

        let parts: Vec<&str> = trimmed.split('|').collect();
        let download_url = parts[0];
        let file_name = if parts.len() > 1 { parts[1] } else { "winfsp.msi" };
        let version = if parts.len() > 2 { parts[2] } else { "unknown" };

        // Download to temp directory
        let temp_path = format!("{}\\{}", std::env::temp_dir().to_string_lossy(), file_name);

        let download_output = app
            .shell()
            .command("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!(
                    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; \
                     {}Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
                    proxy_prefix, download_url, temp_path
                ),
            ])
            .output()
            .await
            .map_err(|e| format!("Failed to download installer: {}", e))?;

        if !download_output.status.success() {
            let stderr = String::from_utf8_lossy(&download_output.stderr);
            return Err(format!(
                "Download failed: {} (if your network requires a proxy, enable it in \
                 Settings → Proxy and retry)",
                stderr.trim()
            ));
        }

        // Launch the installer (user goes through wizard)
        crate::util::cmd("msiexec")
            .args(["/i", &temp_path])
            .spawn()
            .map_err(|e| format!("Failed to launch installer: {}", e))?;

        Ok(version.to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("WinFsp is Windows-only. On macOS/Linux, use FUSE instead.".to_string())
    }
}

#[command]
pub async fn refresh_path() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // On Windows, we need to reload the PATH from the registry
        // This doesn't actually update the current process, but we can notify the user
        // The PATH will be updated on next app restart
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

/// Creates a Start Menu shortcut and registers the AppUserModelID so Windows
/// attributes toast notifications to "Rclone Mount Hub" instead of "Windows PowerShell".
#[command]
pub async fn add_to_start_menu() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get exe path: {}", e))?;
        let exe_str = exe_path.to_string_lossy().replace('\'', "''");

        // PowerShell script:
        // 1. Create the .lnk in %APPDATA%\Microsoft\Windows\Start Menu\Programs\
        // 2. Set the AppUserModelID on the shortcut via IPropertyStore (Windows Shell COM)
        //    This is what tells Windows which "app" is sending notifications.
        let script = format!(r#"
$ExePath = '{exe}'
$AppName = 'Rclone Mount Hub'
$Aumid   = 'com.cbuzi.rclone-mount-hub'
$StartMenuDir = [Environment]::GetFolderPath('Programs')
$LnkPath = Join-Path $StartMenuDir "$AppName.lnk"

# Create the shortcut
$WshShell = New-Object -ComObject WScript.Shell
$sc = $WshShell.CreateShortcut($LnkPath)
$sc.TargetPath      = $ExePath
$sc.WorkingDirectory = Split-Path -Parent $ExePath
$sc.IconLocation    = "$ExePath,0"
$sc.Description     = 'Manage rclone drive mounts'
$sc.Save()

# Set AppUserModelID on the .lnk via IPropertyStore so Windows uses our
# app name/icon for toast notifications instead of "Windows PowerShell"
$sig = @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
public static class Lnk {{
    [DllImport("shell32.dll")] static extern int SHGetPropertyStoreFromParsingName(
        [MarshalAs(UnmanagedType.LPWStr)] string path, IntPtr pbc,
        int flags, ref Guid riid, out IPropertyStore ppv);
    [ComImport][Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPropertyStore {{
        int GetCount(out uint c); int GetAt(uint i, out PROPERTYKEY k);
        int GetValue(ref PROPERTYKEY k, out PROPVARIANT v);
        int SetValue(ref PROPERTYKEY k, ref PROPVARIANT v);
        int Commit();
    }}
    [StructLayout(LayoutKind.Sequential)] public struct PROPERTYKEY {{
        public Guid fmtid; public uint pid;
    }}
    [StructLayout(LayoutKind.Explicit)] public struct PROPVARIANT {{
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pwszVal;
    }}
    public static void SetAumid(string lnkPath, string aumid) {{
        var riid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
        IPropertyStore ps;
        SHGetPropertyStoreFromParsingName(lnkPath, IntPtr.Zero, 1, ref riid, out ps);
        var key = new PROPERTYKEY {{
            fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5
        }};
        var pv = new PROPVARIANT();
        pv.vt = 31; // VT_LPWSTR
        pv.pwszVal = Marshal.StringToCoTaskMemUni(aumid);
        ps.SetValue(ref key, ref pv);
        ps.Commit();
        Marshal.ReleaseComObject(ps);
        Marshal.FreeCoTaskMem(pv.pwszVal);
    }}
}}
'@
Add-Type -TypeDefinition $sig -Language CSharp
[Lnk]::SetAumid($LnkPath, $Aumid)
Write-Output "OK: $LnkPath"
"#, exe = exe_str);

        let output = crate::util::cmd("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &script])
            .output()
            .map_err(|e| format!("Failed to run PowerShell: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to create Start Menu shortcut:\n{}", stderr.trim()));
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Start Menu is Windows-only.".to_string())
    }
}

#[command]
pub async fn remove_from_start_menu() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let start_menu_dir = std::env::var("APPDATA")
            .map_err(|e| format!("Failed to get APPDATA: {}", e))?;
        let lnk_path = format!(
            "{}\\Microsoft\\Windows\\Start Menu\\Programs\\Rclone Mount Hub.lnk",
            start_menu_dir
        );

        if std::path::Path::new(&lnk_path).exists() {
            std::fs::remove_file(&lnk_path)
                .map_err(|e| format!("Failed to remove shortcut: {}", e))?;
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Start Menu is Windows-only.".to_string())
    }
}

#[command]
pub async fn open_rclone_web_ui(app: tauri::AppHandle) -> Result<(), String> {
    // Spawn rclone rcd --rc-web-gui in a new terminal window
    #[cfg(target_os = "windows")]
    {
        app.shell()
            .command("cmd")
            .args(["/c", "start", "cmd", "/k", "rclone", "rcd", "--rc-web-gui"])
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    {
        app.shell()
            .command("open")
            .args(["-a", "Terminal", "rclone", "rcd", "--rc-web-gui"])
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        app.shell()
            .command("x-terminal-emulator")
            .args(["-e", "rclone", "rcd", "--rc-web-gui"])
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}

#[command]
pub async fn get_driver_versions(app: tauri::AppHandle) -> Result<DriverVersions, String> {
    // Check Rclone version.
    //
    // NOTE: we probe via `powershell -Command "rclone version"` instead of
    // spawning `rclone` directly. Windows caches the process PATH at startup,
    // so right after `scoop install rclone` the new shim dir is not yet in
    // our PATH — a direct spawn fails and the status dot stays red until the
    // app is restarted. PowerShell re-reads the registry-merged PATH on
    // each invocation, which is why the green dot only appeared after a
    // full quit/restart.
    let (rclone_installed, rclone_version) = match app
        .shell()
        .command("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "if (Get-Command rclone -ErrorAction SilentlyContinue) { rclone version 2>&1 | Select-Object -First 1 } else { exit 1 }",
        ])
        .output()
        .await
    {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // First line looks like "rclone v1.65.0"
            let version = stdout
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
                .map(|v| v.to_string());
            (true, version)
        }
        _ => (false, None),
    };

    // Check WinFsp installation
    let (winfsp_installed, winfsp_version) = {
        #[cfg(target_os = "windows")]
        {
            // Check if WinFsp registry key exists (means it's installed)
            let reg_check = crate::util::cmd("reg")
                .args([
                    "query",
                    "HKLM\\SOFTWARE\\WOW6432Node\\WinFsp",
                ])
                .output();

            if let Ok(output) = reg_check {
                if output.status.success() {
                    // WinFsp is installed, try to get install dir for version
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    // Just report as "ready" since version extraction is complex
                    let _ = stdout; // suppress unused warning
                    (true, Some("ready".to_string()))
                } else {
                    (false, None)
                }
            } else {
                (false, None)
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            (false, None)
        }
    };

    Ok(DriverVersions {
        rclone_installed,
        rclone_version,
        winfsp_installed,
        winfsp_version,
    })
}

#[command]
pub async fn uninstall_rclone(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // Through `scoop_run` so a per-user Scoop (shims not on the cached
        // process PATH) is still found.
        let (ok, out, err) = scoop_run(&app, &["uninstall", "rclone"]).await;
        if !ok {
            let detail = if out.trim().is_empty() {
                err
            } else {
                out
            };
            return Err(format!(
                "Failed to uninstall rclone: {}",
                detail.trim()
            ));
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Uninstall is only supported on Windows via scoop.".to_string())
    }
}

#[command]
pub async fn uninstall_winfsp(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let output = app
            .shell()
            .command("powershell")
            .args(["-Command", "scoop uninstall winfsp-np"])
            .output()
            .await
            .map_err(|e| e.to_string())?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Failed to uninstall WinFsp: {}", stderr));
        }

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("WinFsp is Windows-only.".to_string())
    }
}

#[command]
pub async fn check_driver_updates(
    app: tauri::AppHandle,
    scoop_bucket_source: Option<String>,
    proxy_url: Option<String>,
) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        // Repair + update Scoop's main bucket from the requested source
        // (github or gitee) before checking package status.
        let src = scoop_bucket_source.as_deref().unwrap_or("github");
        let proxy = proxy_url.unwrap_or_default();
        let _ = ensure_scoop_installed(&app, src, &proxy).await;

        // Check for updates
        let (ok, out, _) = scoop_run(&app, &["status"]).await;
        if !ok {
            return Err("scoop status failed".to_string());
        }
        if out.contains("Latest versions") || out.contains("up to date") {
            Ok("All drivers are up to date".to_string())
        } else if out.contains("rclone") || out.contains("winfsp") {
            Ok("Updates available. Click Install/Update Drivers to update.".to_string())
        } else {
            Ok("All drivers are up to date".to_string())
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok("Update checking is only supported on Windows.".to_string())
    }
}

// ── App self-update (Velopack) ────────────────────────────────────────────────

/// Change this to your GitHub releases URL once you publish releases, e.g.:
/// "https://github.com/YOUR_USERNAME/YOUR_REPO/releases/latest/download"
const UPDATE_FEED_URL: &str = "https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases/latest/download";

#[derive(serde::Serialize)]
pub struct AppUpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub release_notes: Option<String>,
    pub download_size: Option<u64>,
}

const GITHUB_API_URL: &str = "https://api.github.com/repos/Mr-Tenglin/Rclone-Mount-Hub/releases/latest";

#[command]
pub async fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[command]
pub async fn check_app_update() -> Result<AppUpdateInfo, String> {
    // Check Velopack for available updates
    let velopack_result: Option<String> = tokio::task::spawn_blocking(|| -> Result<Option<String>, String> {
        let source = velopack::sources::AutoSource::new(UPDATE_FEED_URL);
        let um = velopack::UpdateManager::new(source, None, None)
            .map_err(|e| e.to_string())?;
        match um.check_for_updates().map_err(|e| e.to_string())? {
            velopack::UpdateCheck::UpdateAvailable(info) => Ok(Some(info.TargetFullRelease.Version.clone())),
            _ => Ok(None),
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    if let Some(version) = velopack_result {
        // Fetch release notes and size from GitHub API
        let (notes, size) = fetch_github_release_info().await;
        Ok(AppUpdateInfo {
            available: true,
            version: Some(version),
            release_notes: notes,
            download_size: size,
        })
    } else {
        Ok(AppUpdateInfo { available: false, version: None, release_notes: None, download_size: None })
    }
}

/// Fetch release notes and total asset size from GitHub releases API
async fn fetch_github_release_info() -> (Option<String>, Option<u64>) {
    let client = match reqwest::Client::builder()
        .user_agent("RcloneMountHub")
        .build()
    {
        Ok(c) => c,
        Err(_) => return (None, None),
    };

    let resp = match client.get(GITHUB_API_URL).send().await {
        Ok(r) => r,
        Err(_) => return (None, None),
    };

    let json: serde_json::Value = match resp.json().await {
        Ok(j) => j,
        Err(_) => return (None, None),
    };

    let notes = json.get("body")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Sum all asset sizes for the download size estimate
    let size = json.get("assets")
        .and_then(|a| a.as_array())
        .map(|assets| {
            assets.iter()
                .filter_map(|a| a.get("size").and_then(|s| s.as_u64()))
                .sum()
        });

    (notes, size)
}

#[command]
pub async fn apply_app_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Emitter;

    // Kill all rclone mount processes before the update replaces files
    crate::commands::rclone::kill_all_mounts();

    // Set up a channel to forward download progress to the frontend
    let (tx, rx) = std::sync::mpsc::channel::<i16>();
    let handle = app.clone();

    // Spawn a task to forward progress events from the channel to Tauri
    tauri::async_runtime::spawn(async move {
        loop {
            match rx.recv() {
                Ok(progress) => {
                    let _ = handle.emit("update-download-progress", progress);
                }
                Err(_) => break, // channel closed
            }
        }
    });

    tokio::task::spawn_blocking(move || {
        let source = velopack::sources::AutoSource::new(UPDATE_FEED_URL);
        let um = velopack::UpdateManager::new(source, None, None)
            .map_err(|e| e.to_string())?;
        if let velopack::UpdateCheck::UpdateAvailable(updates) =
            um.check_for_updates().map_err(|e| e.to_string())?
        {
            um.download_updates(&updates, Some(tx)).map_err(|e| e.to_string())?;
            um.apply_updates_and_restart(&updates).map_err(|e| e.to_string())?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
