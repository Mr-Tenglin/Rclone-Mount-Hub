# Release Notes

本文档记录各版本的发布内容。最新版本在上方。

---

## v0.1.9 — i18n（当前版本）

> 标签：`v0.1.9-i18n`

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

### 修复

#### Scoop 自动修复损坏的 main 仓库
- 启动安装流程时，若检测到 Scoop 的 `main` 仓库损坏（Scoop 0.6.0+ 常见：
  `Failed to remove local 'main' bucket` / `'main' bucket not found`），
  会自动 `bucket rm main` + 按所选源重新 `bucket add` + `scoop update`，
  而不是安装时静默失败。

#### 驱动状态红点不及时刷新
- 通过 Scoop 安装 rclone 后，左下角驱动状态圆点需要完全退出再打开才变绿的问题：
  - 根因：Windows 进程启动时缓存 PATH，新装的 Scoop shim 不在当前进程 PATH 中，
    直接 spawn `rclone` 找不到。
  - 修复：`get_driver_versions` 与 `check_rclone_installed` 改为经
    `powershell -NoProfile` 探测（PowerShell 每次调用重读注册表合并的 PATH），
    安装完成后 `loadDriverVersions()` 立即刷新为绿色，无需重启。

#### i18n 补漏
- `Connection Type`（添加连接页）→ `t("add.section.type")`
- 缓存目录 placeholder 中的 "(default)" → `t("settings.cache.placeholder")`
- 浏览按钮显示原始键 `settings.browse` → 补键 `settings.browse`（6 语言）

#### 其他
- 更新源切换到 `Mr-Tenglin/Rclone-Mount-Hub`（`check_app_update` / release notes /
  Velopack 自更新 feed 全部指向新仓库）。
- 修正 Gitee 说明文案：Gitee 是独立 Git 平台，非 GitHub 镜像。

### 构建与发布
- Windows 11 + Rust (stable) + MSVC 工具链构建。
- `build-release.ps1`（默认版本已设为 `0.1.9`）产出：
  - `Rclone Mount Hub_0.1.9_x64-setup.exe` — Velopack 安装器，支持原地自更新
  - `Rclone Mount Hub_0.1.9_x64-Portable.exe` — 单文件，随处可运行
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
