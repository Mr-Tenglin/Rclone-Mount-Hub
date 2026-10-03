# Rclone Mount Hub

🇬🇧 English | [🇨🇳 中文](README.zh.md) | [🇷🇺 Русский](README.ru.md) | [🇪🇸 Español](README.es.md) | [🇯🇵 日本語](README.ja.md)

> A polished Windows 11 desktop app for managing rclone mounts — born from a PowerShell script, grown into a full GUI.

[![Platform](https://img.shields.io/badge/platform-Windows%2011%20x64-0078d4?logo=windows11&logoColor=white)](https://www.microsoft.com/windows/windows-11)
[![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-ffc131?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/frontend-React%2019-61dafb?logo=react&logoColor=black)](https://react.dev)
[![Rust](https://img.shields.io/badge/backend-Rust-ce422b?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Version](https://img.shields.io/badge/version-0.2.0-22c55e)](https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-a855f7)](LICENSE)

---

## Purpose

Rclone Mount Hub lets you mount remote storage — NAS, Unraid, Nextcloud, SFTP, SMB, S3, FTP — as real Windows drive letters with a single click. No terminal, no scripts, no fuss. It wraps [rclone](https://rclone.org) in a clean, modern interface and handles connection management, smart network switching (LAN ↔ Tailscale), driver installation, performance tuning, and auto-update — all from one place.

> **Originally this was a simple PowerShell script** that I used to deploy rclone mounts on my own machine and for family— automatically installing rclone and WinFsp, configuring WebDAV remotes, and setting up Windows autostart. As the setup grew more complex and needed to work for non-technical household members, that script evolved into this full desktop application.

**Windows 11 (x64) only.** Rclone mounts as a Windows drive letter via [WinFsp](https://winfsp.dev), which is a Windows kernel driver — no macOS or Linux support.

---

## Table of Contents

- [Rclone Mount Hub](#rclone-mount-hub)
  - [Purpose](#purpose)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
    - [Mounting](#mounting)
    - [Smart Networking](#smart-networking)
    - [Performance Profiles](#performance-profiles)
    - [Protocol Support](#protocol-support)
    - [Diagnostics](#diagnostics)
    - [Management](#management)
    - [Windows Integration](#windows-integration)
  - [Platform \& Requirements](#platform--requirements)
  - [Getting Started](#getting-started)
    - [Install](#install)
    - [Updating](#updating)
  - [Tech Stack](#tech-stack)
    - [Desktop Shell](#desktop-shell)
    - [Frontend](#frontend)
    - [Tauri Plugins](#tauri-plugins)
  - [Building from Source](#building-from-source)
  - [Documentation](#documentation)
  - [The Story](#the-story)
    - [The Solution](#the-solution)
  - [Contributing](#contributing)
  - [License](#license)

---

## Features

### Mounting
- One-click mount / unmount any remote as a drive letter (D: – Z:)
- Manage multiple connections simultaneously
- Auto-mount on Windows startup
- Drive letter picker shows only available (free) letters
- System tray with live mount status and "Open in Explorer" shortcuts

### Smart Networking
- **Auto LAN / Tailscale switching** — uses local IP when home, falls back to Tailscale IP when away
- Per-connection manual override (force LAN-only or Tailscale-only)
- Ping-based connection testing before saving

### Performance Profiles
Three tuned rclone flag presets selectable per connection:

|           | Max Speed          | Balanced  | Low Resource        |
| --------- | ------------------ | --------- | ------------------- |
| VFS Cache | 50 GB              | 10 GB     | 2 GB                |
| Buffer    | 512 MB             | 256 MB    | 64 MB               |
| Transfers | 16                 | 8         | 4                   |
| Best for  | 10Gbps LAN / Fiber | Daily use | Battery / slow WiFi |

### Protocol Support
- **WebDAV** — Unraid (Copyparty), Nextcloud, ownCloud, SharePoint
- **SFTP** — any SSH server
- **SMB / Samba** — Windows shares, NAS devices
- **S3** — AWS, MinIO, Backblaze B2, Wasabi
- **FTP** — classic FTP servers

### Diagnostics
- Upload / download speed test to any mounted drive
- Bottleneck detection (network vs. client disk vs. rclone overhead)
- Network path analysis with latency breakdown
- Rclone Web UI launcher

### Management
- Export / import all connection configs as JSON
- Generate a standalone PowerShell script for any connection
- Install, update, or remove rclone and WinFsp from within the app
- Configurable rclone config file path
- Built-in update checker — downloads and applies app updates in one click (Velopack)

### Windows Integration
- Installs to `%LocalAppData%` — **no admin rights required**
- Start with Windows, start minimized, close to tray
- Windows toast notifications on mount / unmount (correct app name shown)
- Add to Start Menu / register AUMID for proper notification attribution

---

## Platform & Requirements

|                      |                                                                    |
| -------------------- | ------------------------------------------------------------------ |
| **OS**               | Windows 11 x64                                                     |
| **Required drivers** | rclone + WinFsp — the app installs both automatically on first run |
| **macOS / Linux**    | Not supported                                                      |

---

## Getting Started

### Install

Download the latest `Rclone Mount Hub_x.x.x_x64-setup.exe` from [Releases](https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases) and run it. No admin rights needed.

On first launch the app checks for rclone and WinFsp and offers to install them for you.

### Updating

Re-run the installer over your existing installation (updates in place), or use **Settings → About & Updates → Check for Updates** inside the app.

---

## Tech Stack

### Desktop Shell
|                                   |                                                                     |
| --------------------------------- | ------------------------------------------------------------------- |
| [Tauri 2](https://tauri.app)      | Desktop shell — Rust backend, web frontend, ~5 MB binary            |
| [Rust](https://www.rust-lang.org) | Backend: spawns rclone, network detection, tray, system integration |
| [Velopack](https://velopack.io)   | Installer and auto-update framework                                 |

### Frontend
|                                                 |                                                |
| ----------------------------------------------- | ---------------------------------------------- |
| [React 19](https://react.dev)                   | UI framework                                   |
| [TypeScript](https://www.typescriptlang.org)    | Type safety                                    |
| [Vite 7](https://vitejs.dev)                    | Build tooling                                  |
| [Tailwind CSS v4](https://tailwindcss.com)      | Utility styling with custom dark design tokens |
| [Zustand](https://zustand-demo.pmnd.rs)         | Persisted client state                         |
| [Radix UI](https://www.radix-ui.com)            | Accessible headless primitives                 |
| [Framer Motion](https://www.framer.com/motion/) | Animations                                     |
| [dnd-kit](https://dndkit.com)                   | Drag-and-drop reordering                       |
| [Phosphor Icons](https://phosphoricons.com)     | Icon library                                   |
| [sonner](https://sonner.emilkowal.ski)          | Toast notifications                            |

### Tauri Plugins
|                             |                               |
| --------------------------- | ----------------------------- |
| `tauri-plugin-shell`        | Spawn rclone processes        |
| `tauri-plugin-store`        | Persist configs as JSON       |
| `tauri-plugin-autostart`    | Windows startup registration  |
| `tauri-plugin-notification` | OS-native toast notifications |
| `tauri-plugin-dialog`       | File / folder picker          |

---

## Building from Source

See **[docs/Building-Src.md](docs/Building-Src.md)** for the full guide.

```bash
# Prerequisites: Rust (stable), Node.js 18+, pnpm
pnpm install
pnpm tauri dev          # development with hot reload
pnpm tauri build --bundles nsis   # production NSIS installer
```

---

## Documentation

|                                              |                                               |
| -------------------------------------------- | --------------------------------------------- |
| [docs/Building-Src.md](docs/Building-Src.md)         | Build, bundle, distribute, version bumping    |
| [docs/Architecture.md](docs/Architecture.md) | Full architecture, data models, design system |
| [docs/Updater-System.md](docs/Updater-System.md) | Velopack auto-update system (user + developer) |

---

## Project Updates

This section tracks notable updates applied to the project, in reverse-chronological order.

### v0.2.0 (current)

#### Global proxy setting
- New **Settings → Proxy** card: independent on/off toggle, protocol picker
  (`http` / `https` / `socks4` / `socks5`) and a bare `host:port` address field.
- The proxy is applied to: driver install/updates (Scoop via
  `scoop config --global proxy`), the Scoop bootstrap download and the WinFsp
  installer download (via `HTTP_PROXY`/`HTTPS_PROXY` env), and rclone mount
  (incl. the dual-mount archive drive) / direct upload operations (via
  `HTTP_PROXY`/`HTTPS_PROXY`/`ALL_PROXY`, with `NO_PROXY` protecting local
  loopback).

#### Internationalization (i18n)
- Added a lightweight i18n system (`i18n/` folder + `src/lib/i18n.ts`) that auto-discovers
  all locale packs via Vite's `import.meta.glob`.
- New locale packs: `i18n/en.json` (base), `i18n/zh-Hans.json`, `i18n/zh-Hant.json`,
  `i18n/ja.json`, `i18n/es.json`, `i18n/ru.json` — fully key-aligned with the English
  base (505 keys each).
- All UI strings across every page, toast, log, and modal are routed through
  `t("...")`. Missing keys fall back to English, then to the key path.
- Settings → Language lets the user pick **System / English / 简体中文 / 繁體中文 /
  日本語 / Español / Русский**, or follow the system display language. The choice is
  persisted in the settings store and applied instantly (no restart).

#### Driver installation (Scoop)
- Rclone installs via Scoop. Added a **Scoop bucket source** setting (Settings →
  "Scoop Bucket Source"): **GitHub** (official main bucket, default) or **Gitee**
  (a community-synced copy on the Gitee platform, for networks where GitHub is
  slow or unreachable). Gitee is **not** a mirror of GitHub — its bucket content
  is synced separately and may lag or be missing some packages.
- The bootstrap now **auto-repairs a broken Scoop `main` bucket** (the
  "Failed to remove local 'main' bucket" / "'main' bucket not found" failure
  seen with Scoop 0.6.0+) before installing, instead of failing silently.
- Fixed the driver status dot not refreshing after installing rclone: rclone
  detection now probes through `powershell` so a freshly-installed Scoop shim is
  found immediately, even though the app process's PATH was cached at startup.

#### Dependency alignment & build tooling
- Upgraded `@tauri-apps/api` to **2.12** and aligned `@tauri-apps/plugin-dialog` /
  `@tauri-apps/plugin-store` to matching versions so the Rust crates no longer report
  a version mismatch.
- Removed `tauri-plugin-mcp-bridge`: every published version (0.1.3–0.13.0) pins
  `webview2-com 0.38`, which is incompatible with Tauri 2.12's `webview2-com 0.39`.
  The plugin was only used under `#[cfg(debug_assertions)]` and is not needed in
  release builds.
- The Rust `tauri` crate and plugin crate versions are now resolved consistently
  against the npm packages (all 2.12.x).

#### Build & release
- The project builds on Windows 11 with the Rust + MSVC toolchain.
- `build-release.ps1` produces:
  - `Rclone Mount Hub_<ver>_x64-setup.exe` (Velopack installer, in-place updates)
  - `Rclone Mount Hub_<ver>_x64-Portable.exe` (single-file, runs anywhere)
- Update feed URL: `https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases/latest/download`

---

## The Story

This all started when I got my first NAS and I started learning about how cool SMB network shares are (Spoiler: they're the furthest thing possible from that). But little Bristopher began having weird credentials issues...

> **Warning:** Skip this next paragraph if you don't want to read a rant, or continue reading if Windows SMB is also the bane of your existence (if that's the case, open a discussion on this repo on how much you hate it and tell me about it!).

...where I was logged in but actually... I wasn't? And if I tried my username and password it would say "wrong," but then I force change it on my NAS to something new and it was still wrong. Cleared Windows credentials? Still doesn't work. Speeds capped at 15MB/s even though my network was WiFi 6E (AND my NAS was hard-wired) and speed testing to my NAS gave me the normal 150+MB/s that spinning rust delivers.

Let's not forget about opening a network share that temporarily loses connection and crashes your whole Windows Explorer process!! (Yippie, I love having all my VSCode instances and browser windows reorganized in random orders and all my file explorer windows zapped out of existence when I'm in the middle of transferring files!!! My favorite pastime!). Also, just stating these are long-standing bugs well known and I'm not an isolated case experiencing "skill issue." Long story short, not only was it a nightmare for me, using it was a nightmare for anyone in my household also using it who aren't tech demons like myself and just normal Joes.

### The Solution

Fast forward 3 years of hell with SMB and I add an x8 NVMe SSD PCIe card (recommend, tons of fun, spinning rust is for geeks :P) and still can't achieve speeds above 30MB/s... until I finally try out something I've been eyeing that integrates well with Windows: **WebDAV** (Copyparty specifically).

Wait, wait, wait, I know what you're thinking: *"But Bristopher, WebDAV adds tons of unnecessary overhead and is actually slow, wah wah."* Yes, you're right, but hey, this is easy and "actually works," so yeah... I really liked the idea of **RaiDrive** (have to pay for "physical drive" addon so it's not 30MB/s, but even then my speeds didn't change so I gave up on it) and **CloudMounter** (great program but a little unstable when working with the mount).

So, I created **Rclone Mount Hub** so I can easily manage my NAS mounts and even other PCs on local network mounts (like to my laptop). Currently struggling with syncing solutions, so I think this is the way for me now because Syncthing and Resilio Sync have only been slow, glitchy nightmares. If you have any better solutions that have worked for you please share in the discussions tab thanks!!

---

## Contributing

Issues, feature requests, and pull requests are welcome. If Windows SMB has also ruined your life, open a discussion — misery loves company.

### Developed with DeepSeek Harness

This project is actively maintained and upgraded with the help of **DeepSeek Harness**, an AI coding agent. Recent updates — including the i18n system, the Tauri 2.12 dependency alignment, and the Velopack packaging workflow — were produced with DeepSeek Harness and validated by `tsc` / `vite build` / the Tauri release build. Contributions are welcome whether written by hand or generated with DeepSeek Harness: open an issue or pull request describing what changed and why.

---

## License

Rclone Mount Hub is open source under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

**What this means:**
- You can use, modify, and distribute this software freely
- If you distribute a modified version or offer it as a hosted service, you must open source your changes under the same license
- You cannot take this code, close it up, and sell it as a proprietary product without releasing your changes

**Commercial licensing:** If your organization needs to use or build on Rclone Mount Hub without the AGPL obligations (e.g. in a proprietary product), a commercial license is available — open an issue or reach out directly.

Copyright © 2025 Bristopher. All rights reserved.
