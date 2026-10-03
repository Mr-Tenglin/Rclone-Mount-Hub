# Rclone Mount Hub

[🇬🇧 English](README.md) | 🇨🇳 中文 | [🇷🇺 Русский](README.ru.md) | [🇪🇸 Español](README.es.md) | [🇯🇵 日本語](README.ja.md)

> 一个精致的 Windows 11 桌面应用，用于管理 rclone 挂载 — 从一个 PowerShell 脚本起步，成长为完整的 GUI。

[![Platform](https://img.shields.io/badge/platform-Windows%2011%20x64-0078d4?logo=windows11&logoColor=white)](https://www.microsoft.com/windows/windows-11)
[![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-ffc131?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/frontend-React%2019-61dafb?logo=react&logoColor=black)](https://react.dev)
[![Rust](https://img.shields.io/badge/backend-Rust-ce422b?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Version](https://img.shields.io/badge/version-0.1.9-22c55e)](https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-a855f7)](LICENSE)

> 本文件为英文 README 的中文翻译。原始英文见 [README.md](README.md)。

---

## 用途

Rclone Mount Hub 让你只需一键，就能把远程存储 — NAS、Unraid、Nextcloud、SFTP、SMB、S3、FTP — 挂载为真正的 Windows 盘符。不需要终端、不需要脚本、不需要折腾。它用一个干净现代的界面封装了 [rclone](https://rclone.org)，并统一管理连接、智能网络切换（LAN ↔ Tailscale）、驱动安装、性能调优、自动更新 — 全部集中在一个地方。

> **这个项目最初只是一个简单的 PowerShell 脚本**，作者用它在自己家和家人机器上部署 rclone 挂载 — 自动安装 rclone 和 WinFsp、配置 WebDAV 远程、设置 Windows 开机自启。随着配置越来越复杂、且需要让不懂技术的家庭成员也能用，这个脚本最终演变成了这个完整的桌面应用。

**仅支持 Windows 11（x64）。** rclone 通过 [WinFsp](https://winfsp.dev) 挂载为 Windows 盘符，WinFsp 是 Windows 内核驱动 — 不支持 macOS 或 Linux。

---

## 目录

- [用途](#用途)
- [功能](#功能)
  - [挂载](#挂载)
  - [智能网络](#智能网络)
  - [性能预设](#性能预设)
  - [协议支持](#协议支持)
  - [诊断](#诊断)
  - [管理](#管理)
  - [Windows 集成](#windows-集成)
- [平台与要求](#平台与要求)
- [快速开始](#快速开始)
  - [安装](#安装)
  - [更新](#更新)
- [技术栈](#技术栈)
  - [桌面外壳](#桌面外壳)
  - [前端](#前端)
  - [Tauri 插件](#tauri-插件)
- [从源码构建](#从源码构建)
- [文档](#文档)
- [项目更新](#项目更新)
- [故事](#故事)
  - [解决方案](#解决方案)
- [贡献](#贡献)
- [许可证](#许可证)

---

## 功能

### 挂载
- 一键将任意远程挂载 / 卸载为盘符（D: – Z:）
- 同时管理多个连接
- Windows 启动时自动挂载
- 盘符选择器只显示可用的（空闲）盘符
- 系统托盘实时显示挂载状态和"在资源管理器中打开"快捷方式

### 智能网络
- **自动在 LAN / Tailscale 之间切换** — 在家用本地 IP，出门自动回落到 Tailscale IP
- 每个连接可手动覆盖（强制仅 LAN 或仅 Tailscale）
- 保存前进行基于 Ping 的连接测试

### 性能预设

每连接可选三套调好的 rclone 参数预设：

|           | 极速            | 均衡     | 低资源          |
| --------- | -------------- | -------- | --------------- |
| VFS 缓存  | 50 GB          | 10 GB    | 2 GB            |
| 缓冲区    | 512 MB         | 256 MB   | 64 MB           |
| 传输数    | 16             | 8        | 4               |
| 适用      | 10Gbps 局域网/光纤 | 日常使用 | 电池/慢速 WiFi |

### 协议支持
- **WebDAV** — Unraid（Copyparty）、Nextcloud、ownCloud、SharePoint
- **SFTP** — 任意 SSH 服务器
- **SMB / Samba** — Windows 共享、NAS 设备
- **S3** — AWS、MinIO、Backblaze B2、Wasabi
- **FTP** — 传统 FTP 服务器

### 诊断
- 对任意已挂载盘符做上传 / 下载速度测试
- 瓶颈定位（网络 vs. 本地磁盘 vs. rclone 开销）
- 网络路径分析（带延迟分解）
- Rclone Web UI 启动器

### 管理
- 将所有连接配置导出 / 导入为 JSON
- 为任意连接生成独立的 PowerShell 脚本
- 在应用内安装、更新或移除 rclone 和 WinFsp
- 可配置 rclone 配置文件路径
- 内置更新检查器 — 一键下载并应用应用更新（Velopack）

### Windows 集成
- 安装到 `%LocalAppData%` — **无需管理员权限**
- 随 Windows 启动、最小化启动、关闭到托盘
- 挂载 / 卸载时显示 Windows 通知（正确显示应用名）
- 添加到开始菜单 / 注册 AUMID，保证通知归属正确

---

## 平台与要求

|                      |                                                                    |
| -------------------- | ------------------------------------------------------------------ |
| **操作系统**         | Windows 11 x64                                                     |
| **必需驱动**         | rclone + WinFsp — 应用首次运行时会为你自动安装两者 |
| **macOS / Linux**    | 不支持                                                             |

---

## 快速开始

### 安装

从 [Releases](https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases) 下载最新的 `Rclone Mount Hub_x.x.x_x64-setup.exe` 并运行。无需管理员权限。

首次启动时，应用会检查 rclone 和 WinFsp，并主动询问是否为你安装。

### 更新

在已有安装上重新运行安装程序（原地升级），或在应用内使用 **设置 → 关于与更新 → 检查更新**。

---

## 技术栈

### 桌面外壳
|                                   |                                                                     |
| --------------------------------- | ------------------------------------------------------------------- |
| [Tauri 2](https://tauri.app)      | 桌面外壳 — Rust 后端、Web 前端、约 5 MB 二进制            |
| [Rust](https://www.rust-lang.org) | 后端：启动 rclone、网络探测、托盘、系统集成 |
| [Velopack](https://velopack.io)   | 安装器与自动更新框架                                 |

### 前端
|                                                 |                                                |
| ----------------------------------------------- | ---------------------------------------------- |
| [React 19](https://react.dev)                   | UI 框架                                   |
| [TypeScript](https://www.typescriptlang.org)    | 类型安全                                    |
| [Vite 7](https://vitejs.dev)                    | 构建工具                                  |
| [Tailwind CSS v4](https://tailwindcss.com)      | 工具类样式，配自定义深色设计 tokens |
| [Zustand](https://zustand-demo.pmnd.rs)         | 持久化的客户端状态                         |
| [Radix UI](https://www.radix-ui.com)            | 可访问的无头原语                 |
| [Framer Motion](https://www.framer.com/motion/) | 动画                                     |
| [dnd-kit](https://dndkit.com)                   | 拖拽排序                       |
| [Phosphor Icons](https://phosphoricons.com)     | 图标库                                   |
| [sonner](https://sonner.emilkowal.ski)          | Toast 通知                            |

### Tauri 插件
|                             |                               |
| --------------------------- | ----------------------------- |
| `tauri-plugin-shell`        | 启动 rclone 进程        |
| `tauri-plugin-store`        | 以 JSON 持久化配置       |
| `tauri-plugin-autostart`    | 注册 Windows 开机启动  |
| `tauri-plugin-notification` | 系统原生 Toast 通知 |
| `tauri-plugin-dialog`       | 文件 / 文件夹选择器          |

---

## 从源码构建

完整指南见 **[docs/Building-Src.md](docs/Building-Src.md)**。

```bash
# 前置：Rust (stable)、Node.js 18+、pnpm
pnpm install
pnpm tauri dev          # 开发模式，热重载
pnpm tauri build --bundles nsis   # 生产 NSIS 安装器
```

---

## 文档

|                                              |                                               |
| -------------------------------------------- | --------------------------------------------- |
| [docs/Building-Src.md](docs/Building-Src.md)         | 构建、打包、分发、版本递增    |
| [docs/Architecture.md](docs/Architecture.md) | 完整架构、数据模型、设计系统 |
| [docs/Updater-System.md](docs/Updater-System.md) | Velopack 自动更新系统（用户 + 开发者） |

---

## 项目更新

本节以倒序记录项目的重要更新。

### v0.1.9（当前）

#### 国际化（i18n）
- 加入轻量的 i18n 体系（`i18n/` 目录 + `src/lib/i18n.ts`），通过 Vite 的 `import.meta.glob`
  自动发现所有语言包。
- 新增语言包：`i18n/en.json`（基础包）、`i18n/zh-Hans.json`、`i18n/zh-Hant.json`、
  `i18n/ja.json`、`i18n/es.json`、`i18n/ru.json` — 与英文基础包完全键对齐（每个 498 词条）。
- 所有页面、Toast、日志、弹窗中的界面文案现在都经由 `t("...")` 路由。缺失的键
  回退到英文，再回退到键路径本身。
- 设置 → 语言可让用户在 **跟随系统 / 简体中文 / English / 繁體中文 / 日本語 /
  Español / Русский** 间切换；选择会持久化到设置存储并即时生效（无需重启）。

#### 驱动安装（Scoop）
- Rclone 通过 Scoop 安装。新增 **Scoop 仓库源**设置（设置 → "Scoop 仓库源"）：
  **GitHub**（官方 main 仓库，默认）或 **Gitee**（Gitee 平台上社区同步的副本，
  适用于 GitHub 访问不畅的网络）。Gitee **不是** GitHub 的镜像 —— 其仓库内容
  独立同步，可能滞后或缺少部分软件包。
- 启动流程现在会**自动修复损坏的 Scoop `main` 仓库**（Scoop 0.6.0+ 出现的
  "Failed to remove local 'main' bucket" / "'main' bucket not found" 故障），
  而不是安装时静默失败。
- 修复了安装 rclone 后驱动状态圆点不刷新的问题：rclone 检测现在通过
  `powershell` 探测，刚装好的 Scoop shim 可被立即发现，尽管 app 进程的 PATH
  是在启动时缓存的。

#### 依赖对齐与构建工具
- 将 `@tauri-apps/api` 升级到 **2.12**，并把 `@tauri-apps/plugin-dialog` /
  `@tauri-apps/plugin-store` 对齐到匹配版本，使 Rust crate 不再报版本不匹配。
- 移除 `tauri-plugin-mcp-bridge`：它的所有已发布版本（0.1.3–0.13.0）都锁死
  `webview2-com 0.38`，与 Tauri 2.12 的 `webview2-com 0.39` 不兼容。该插件仅在
  `#[cfg(debug_assertions)]` 下使用，Release 构建用不到。
- Rust `tauri` crate 与插件 crate 的版本现在能针对 npm 包（均为 2.12.x）一致地解析。

#### 构建与发布
- 项目在 Windows 11 上以 Rust + MSVC 工具链构建。
- `build-release.ps1` 生成：
  - `Rclone Mount Hub_<ver>_x64-setup.exe`（Velopack 安装器，支持原地更新）
  - `Rclone Mount Hub_<ver>_x64-Portable.exe`（单文件，随处可运行）
- 更新源地址：`https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases/latest/download`

---

## 故事

这一切始于是我拿到第一台 NAS，然后发现 SMB 网络共享听起来很酷（剧透：它跟"酷"八竿子打不着）。但小 Bristopher 开始遇到各种奇怪的凭据问题...

> **警告：** 如果你不想读吐槽，请跳过下一段；如果你也被 Windows SMB 折磨得够呛，那就继续读（如果真是这样，去这个仓库的讨论区聊聊你有多讨厌它，告诉我你的故事！）。

...我明明登录了，但事实上...我并没有？如果用我的用户名和密码登录会提示"错误"，可我在 NAS 上强行改了一个新密码，它还是"错误"。清掉 Windows 凭据？还是不行。即使我的网络是 WiFi 6E（而且我的 NAS 是插网线的），速度也被锁死在 15MB/s，而速度测试到 NAS 能跑出机械硬盘该有的 150+MB/s。

别忘了：打开一个临时断连的网络共享会让整个 Windows 资源管理器崩溃！！（太棒了，我最喜欢在我复制文件到一半时，看所有 VSCode 实例和浏览器窗口被随机重排、所有资源管理器窗口凭空消失！这是我最爱的爱好！）。我也只是如实陈述：这些都是老掉牙的已知 bug，我不是个例，更不是什么"技术问题"。长话短说，它不仅对我来说是噩梦，对家里每个"只是普通人"（不是像我这样的技术恶魔）的家庭成员来说也是噩梦。

### 解决方案

在 SMB 地狱里挣扎三年后，我加了一张 x8 NVMe SSD 的 PCIe 卡（很推荐，超好玩，机械硬盘是给极客玩的 :P），速度还是上不去 30MB/s...直到我终于尝试了我一直盯上的那个跟 Windows 契合度很好的东西：**WebDAV**（具体是 Copyparty）。

等等等等，我知道你在想什么：*"但是 Bristopher，WebDAV 会带来大量不必要的开销，而且其实很慢，呜呜。"* 是的，你说得对，但嘿，它简单又"真能用"，所以...我其实很欣赏 **RaiDrive**（要付费解锁"物理驱动器"附加功能，能突破 30MB/s，但我的速度还是没变，我就放弃了）和 **CloudMounter**（很好的程序，但挂载工作时有点不稳）。

于是，我创建了 **Rclone Mount Hub**，用来轻松管理我的 NAS 挂载，甚至本地网络上其他电脑的挂载（比如挂到我的笔记本上）。我目前在同步方案上一直很纠结，所以我觉得这是适合我的路，因为 Syncthing 和 Resilio Sync 对我来说都是又慢又卡的噩梦。如果你有更好用过的方案，请在讨论区分享，谢谢！！

---

## 贡献

欢迎提 Issue、提功能需求、提 Pull Request。如果你也被 Windows SMB 折磨到生活不能自理，开个讨论 — 苦中作乐也是一种乐。

### 使用 DeepSeek Harness 开发

本项目由 **DeepSeek Harness**（一个 AI 编程智能体）积极参与维护和升级。近期的更新 — 包括 i18n 体系、Tauri 2.12 依赖对齐、Velopack 打包工作流 — 均由 DeepSeek Harness 协助生成，并通过 `tsc` / `vite build` / Tauri Release 构建验证。贡献方式不限：无论是手写还是借助 DeepSeek Harness 生成，都欢迎 — 开一个 Issue 或 Pull Request，说明改了什么、为什么改即可。

---

## 许可证

Rclone Mount Hub 以 **GNU Affero General Public License v3.0（AGPL-3.0）** 开源。

**这意味着：**
- 你可以自由使用、修改和分发本软件
- 如果你分发了修改版或将其作为托管服务提供，你必须以相同的许可证开源你的修改
- 你不能把这份代码闭源后作为专有产品售卖，而不公开你的修改

**商业授权：** 如果你的组织希望在没有 AGPL 义务的情况下使用或基于 Rclone Mount Hub 开发（例如在专有产品中），可获取商业授权 — 请开一个 Issue 或直接联系。

版权 © 2025 Bristopher。保留所有权利。
