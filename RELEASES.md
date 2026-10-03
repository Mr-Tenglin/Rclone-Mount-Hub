# Release Notes

本文档记录各版本的发布内容。最新版本在上方。

---

## v0.2.0 — i18n + 驱动安装修复 + 全局代理（当前版本）

> 标签：`v0.2.0`

### 新增

#### 多语言（i18n）
- 全新轻量 i18n 体系（`i18n/` 目录 + `src/lib/i18n.ts`），通过 Vite `import.meta.glob`
  自动发现语言包，无需第三方 i18n 库。
- 6 个语言包，498 个词条，全部与英文基础包键对齐：

  | 语言 | 文件 |
  | --- | --- |
  | English（基础） | `i18n/en.json` |
  | 简体中文 | `i18n/zh-Hans.json` |
  | 繁體中文 | `i18n/zh-Hant.json` |
  | 日本語 | `i18n/ja.json` |
  | Español | `i18n/es.json` |
  | Русский | `i18n/ru.json` |

- 全应用 UI（所有页面、Toast、日志、弹窗、菜单）文案统一经 `t("...")` 路由；
  缺失键自动回退英文，再回退键路径。
- **设置 → 语言**：跟随系统 / 6 种语言可选，即时生效、持久化保存。

#### Scoop 仓库源切换
- **设置 → "Scoop 仓库源"**：驱动安装/更新时可从 **GitHub**（官方 main 仓库，默认）
  或 **Gitee**（社区同步副本）拉取 rclone。
- Gitee 并非 GitHub 的镜像，其仓库内容独立同步；适用于 GitHub 访问不畅的网络
  （常见于中国大陆）。

#### Scoop 自动引导安装（全新机器首装）
- 首次安装 rclone 时若系统未装 Scoop，应用会**自动引导安装 Scoop 本体**：
  1. 将用户 PowerShell 执行策略设为 `RemoteSigned`（当前用户范围，无需 UAC）
  2. 下载官方安装器 `get.scoop.sh`，以 `-ExecutionPolicy Bypass` 运行
     （**不**传 `-RunAsAdmin` —— 避免提权安装时安装器以
     "Running the installer as administrator is disabled by default" 中止）
  3. 轮询等待 `%USERPROFILE%\scoop\shims` 生成完成
  4. 将新 shims 目录合并进当前进程 PATH，使同一会话内即可继续 `scoop install rclone`
- 全程无需重启应用。

#### 全局代理设置（新增）
- **设置 → 代理**：开关独立可控（不再依赖地址是否为空），并支持选择协议
  （`http` / `https` / `socks4` / `socks5`）+ 填写纯 `host:port` 地址；
  最终代理 URL 由前端按所选协议拼装。
- 生效范围：
  - 驱动安装/更新（Scoop 下载、bucket git 同步）—— 通过 `scoop config --global proxy`
    写入 Scoop 全局配置；关闭时自动清除
  - Scoop 引导下载（`get.scoop.sh`）与 WinFsp 安装包下载 —— 通过
    `HTTP_PROXY`/`HTTPS_PROXY` 环境变量
  - rclone 挂载（含双挂载的 archive 盘）与直接上传（`rclone copy`）—— 通过
    `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY` 环境变量（`NO_PROXY` 排除
    localhost/127.0.0.1，避免本地回环流量误入代理）

### 修复

#### 驱动状态红点不及时刷新
- 通过 Scoop 安装 rclone 后，左下角驱动状态圆点需要完全退出再打开才变绿的问题：
  - 根因：Windows 进程启动时缓存 PATH，新装的 Scoop shim 不在当前进程 PATH 中，
    直接 spawn `rclone` 找不到。
  - 修复：`get_driver_versions` 与 `check_rclone_installed` 改为经
    `powershell -NoProfile` 探测（PowerShell 每次调用重读注册表合并的 PATH），
    安装完成后 `loadDriverVersions()` 立即刷新为绿色，无需重启。

#### Scoop 0.6.0+ 损坏的 main 仓库自动修复
- 安装流程检测到 main bucket 损坏（`Failed to remove local 'main' bucket` /
  `'main' bucket not found`）时，自动 `bucket rm main` + 按所选源重新
  `bucket add` + `scoop update`，而不是安装时静默失败。

#### i18n 补漏
- `Connection Type`（添加连接页）→ `t("add.section.type")`
- 缓存目录 placeholder 中的 "(default)" → `t("settings.cache.placeholder")`
- 浏览按钮显示原始键 `settings.browse` → 补键 `settings.browse`（6 语言）

#### 其他
- 更新源切换到 `Mr-Tenglin/Rclone-Mount-Hub`（`check_app_update` / release notes /
  Velopack 自更新 feed 全部指向新仓库）。
- 修正 Gitee 说明文案：Gitee 是独立 Git 平台，非 GitHub 镜像。
- 清理调试探针 `probe_main.rs` 与 `Cargo.toml` 中对应 `[[bin]]` 段。

### 构建与发布
- Windows 11 + Rust (stable) + MSVC 工具链构建。
- `build-release.ps1`（默认版本已设为 `0.2.0`）产出：
  - `Rclone Mount Hub_0.2.0_x64-setup.exe` — Velopack 安装器，支持原地自更新
  - `Rclone Mount Hub_0.2.0_x64-Portable.exe` — 单文件，随处可运行
- 自更新 feed：`https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases/latest/download`
  （release 需附带 `RELEASES` 文件，Velopack 才能发现更新）

### 依赖
- `@tauri-apps/api` 升至 2.12，`plugin-dialog` / `plugin-store` 对齐至 2.8 / 2.5，
  消除 Rust crate 与 npm 包的版本不匹配告警。
- 移除 `tauri-plugin-mcp-bridge`（所有已发布版本锁死 `webview2-com 0.38`，
  与 Tauri 2.12 的 `webview2-com 0.39` 冲突；且仅 debug 构建使用）。

---

## v0.1.8 及更早

历史版本详见原项目 [GitHub Releases](https://github.com/Bristopher/Rclone-Mount-Hub/releases)。
