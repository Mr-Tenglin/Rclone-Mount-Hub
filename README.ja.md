# Rclone Mount Hub

> 洗練された Windows 11 デスクトップアプリ — rclone マウントの管理用。PowerShell スクリプトから始まり、フル GUI に成長した。

[![Platform](https://img.shields.io/badge/platform-Windows%2011%20x64-0078d4?logo=windows11&logoColor=white)](https://www.microsoft.com/windows/windows-11)
[![Tauri](https://img.shields.io/badge/built%20with-Tauri%202-ffc131?logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/frontend-React%2019-61dafb?logo=react&logoColor=black)](https://react.dev)
[![Rust](https://img.shields.io/badge/backend-Rust-ce422b?logo=rust&logoColor=white)](https://www.rust-lang.org)
[![Version](https://img.shields.io/badge/version-0.1.9-22c55e)](https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases)
[![License](https://img.shields.io/badge/license-AGPL--3.0-a855f7)](LICENSE)

> このファイルは英語 README の日本語訳です。英語の原文：[README.md](README.md)。

---

## 目的

Rclone Mount Hub は、NAS・Unraid・Nextcloud・SFTP・SMB・S3・FTP といったリモートストレージを、ワンクリックで本物の Windows ドライブレターとしてマウントできるようにします。ターミナルもスクリプトも一切不要です。[rclone](https://rclone.org) をクリーンで現代的なインターフェースで包み込み、接続管理、スマートネットワーク切替（LAN ↔ Tailscale）、ドライバのインストール、チューニング、自動更新をひとつの場所から扱います。

> **もともとはシンプルな PowerShell スクリプトでした** — 著者は自分のマシンや家族のマシンに rclone マウントをデプロイするために使っていました。rclone と WinFsp の自動インストール、WebDAV リモートの設定、Windows 起動時の自動開始まで。設定が複雑さを増し、技術に疎い家族も使えるよう必要になったことで、このフル機能デスクトップアプリへと進化しました。

**Windows 11 (x64) のみ。** Rclone は [WinFsp](https://winfsp.dev) 経由で Windows のドライブレターとしてマウントされます。WinFsp は Windows カーネルドライバのため、macOS / Linux には対応していません。

---

## 目次

- [目的](#目的)
- [機能](#機能)
  - [マウント](#マウント)
  - [スマートネットワーク](#スマートネットワーク)
  - [パフォーマンスプロファイル](#パフォーマンスプロファイル)
  - [プロトコル対応](#プロトコル対応)
  - [診断](#診断)
  - [管理](#管理)
  - [Windows 統合](#windows-統合)
- [プラットフォームと要件](#プラットフォームと要件)
- [はじめる](#はじめる)
  - [インストール](#インストール)
  - [更新](#更新)
- [技術スタック](#技術スタック)
  - [デスクトップシェル](#デスクトップシェル)
  - [フロントエンド](#フロントエンド)
  - [Tauri プラグイン](#tauri-プラグイン)
- [ソースからビルド](#ソースからビルド)
- [ドキュメント](#ドキュメント)
- [プロジェクトのアップデート](#プロジェクトのアップデート)
- [ストーリー](#ストーリー)
  - [解決策](#解決策)
- [コントリビュート](#コントリビュート)
- [ライセンス](#ライセンス)

---

## 機能

### マウント
- リモートをワンクリックでドライブレター（D: – Z:）にマウント / アンマウント
- 複数の接続の同時管理
- Windows 起動時の自動マウント
- ドライブレター選択には利用可能な（空き）レターのみ表示
- システムトレイにライブのマウント状況と「エクスプローラーで開く」ショートカット

### スマートネットワーク
- **LAN / Tailscale 自動切替** — 自宅ではローカル IP、外出先では Tailscale IP にフォールバック
- 接続ごとのマニュアルオーバーライド（LAN のみ / Tailscale のみ）
- 保存前に ping ベースの接続テスト

### パフォーマンスプロファイル

接続ごとに選べる、調整済みの rclone フラグプリセットが 3 種：

|           | 最大速度           | バランス     | ローリソース |
| --------- | ------------------ | ------------ | ------------ |
| VFS キャッシュ | 50 GB           | 10 GB        | 2 GB         |
| バッファ    | 512 MB             | 256 MB       | 64 MB        |
| 転送数     | 16                 | 8            | 4            |
| 向いている  | 10Gbps LAN / 光回線 | 日常使用     | バッテリー / 低速 WiFi |

### プロトコル対応
- **WebDAV** — Unraid (Copyparty)、Nextcloud、ownCloud、SharePoint
- **SFTP** — 任意の SSH サーバー
- **SMB / Samba** — Windows シェア、NAS デバイス
- **S3** — AWS、MinIO、Backblaze B2、Wasabi
- **FTP** — 従来の FTP サーバー

### 診断
- マウント済みドライブへのアップロード / ダウンロード速度テスト
- ボトルネックの判定（ネットワーク vs. クライアントディスク vs. rclone  overhead）
- 遅延を分解したネットワーク経路分析
- Rclone Web UI の起動

### 管理
- 全接続設定の JSON へのエクスポート / インポート
- 任意の接続のための独立した PowerShell スクリプトを生成
- アプリ内で rclone と WinFsp のインストール、更新、削除
- rclone 設定ファイルパスの変更可能
- 内蔵のアップデートチェッカー — アプリ更新のダウンロードと適用をワンクリックで（Velopack）

### Windows 統合
- `%LocalAppData%` にインストール — **管理者権限不要**
- Windows 起動時開始、最小化で開始、トレイに閉じる
- マウント / アンマウント時に Windows トースト通知（正しいアプリ名が表示）
- 開始メニューに追加 / AUMID の登録で、通知の帰属が正しくなる

---

## プラットフォームと要件

|                      |                                                                    |
| -------------------- | ------------------------------------------------------------------ |
| **OS**               | Windows 11 x64                                                     |
| **必須ドライバ**     | rclone + WinFsp — 初回起動時にアプリが両方を自動インストール |
| **macOS / Linux**    | 非対応                                                             |

---

## はじめる

### インストール

[Releases](https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases) から最新の `Rclone Mount Hub_x.x.x_x64-setup.exe` をダウンロードして実行。管理者権限は不要です。

初回起動時にアプリが rclone と WinFsp をチェックし、インストールを提案します。

### 更新

既存のインストール上にインストーラを再実行（インプレース更新）、またはアプリ内の **設定 → 情報と更新 → 更新を確認** を使用してください。

---

## 技術スタック

### デスクトップシェル
|                                   |                                                                     |
| --------------------------------- | ------------------------------------------------------------------- |
| [Tauri 2](https://tauri.app)      | デスクトップシェル — Rust バックエンド、Web フロントエンド、約 5 MB のバイナリ |
| [Rust](https://www.rust-lang.org) | バックエンド：rclone の起動、ネットワーク検出、トレイ、システム統合 |
| [Velopack](https://velopack.io)   | インストーラと自動更新フレームワーク                                 |

### フロントエンド
|                                                 |                                                |
| ----------------------------------------------- | ---------------------------------------------- |
| [React 19](https://react.dev)                   | UI フレームワーク                                |
| [TypeScript](https://www.typescriptlang.org)    | 型安全性                                        |
| [Vite 7](https://vitejs.dev)                    | ビルドツール                                    |
| [Tailwind CSS v4](https://tailwindcss.com)      | 独自ダークデザイントークン付きユーティリティスタイル |
| [Zustand](https://zustand-demo.pmnd.rs)         | 永続化されるクライアント状態                    |
| [Radix UI](https://www.radix-ui.com)            | アクセシブルな headless プリミティブ            |
| [Framer Motion](https://www.framer.com/motion/) | アニメーション                                  |
| [dnd-kit](https://dndkit.com)                   | ドラッグ & ドロップによる並べ替え               |
| [Phosphor Icons](https://phosphoricons.com)     | アイコンライブラリ                              |
| [sonner](https://sonner.emilkowal.ski)          | トースト通知                                    |

### Tauri プラグイン
|                             |                               |
| --------------------------- | ----------------------------- |
| `tauri-plugin-shell`        | rclone プロセスの起動         |
| `tauri-plugin-store`        | 設定を JSON として永続化      |
| `tauri-plugin-autostart`    | Windows 起動時の登録          |
| `tauri-plugin-notification` | OS ネイティブのトースト通知   |
| `tauri-plugin-dialog`       | ファイル / フォルダピッカー   |

---

## ソースからビルド

完全なガイドは **[docs/Building-Src.md](docs/Building-Src.md)**。

```bash
# 前提：Rust (stable)、Node.js 18+、pnpm
pnpm install
pnpm tauri dev          # ホットリロード付き開発
pnpm tauri build --bundles nsis   # 本番 NSIS インストーラ
```

---

## ドキュメント

|                                              |                                               |
| -------------------------------------------- | --------------------------------------------- |
| [docs/Building-Src.md](docs/Building-Src.md)         | ビルド、パッケージング、配布、バージョン上げ    |
| [docs/Architecture.md](docs/Architecture.md) | 全体アーキテクチャ、データモデル、デザイシステム |
| [docs/Updater-System.md](docs/Updater-System.md) | Velopack 自動更新システム（ユーザー + 開発者） |

---

## プロジェクトのアップデート

このセクションではプロジェクトへ適用された主な更新を、新しい順に記録しています。

### v0.1.9（現在）

#### 国際化（i18n）
- 軽量な i18n システム（`i18n/` フォルダ + `src/lib/i18n.ts`）を追加しました。Vite の
  `import.meta.glob` を使って全ロケールパックを自動発見します。
- 新規ロケールパック：`i18n/en.json`（ベース）、`i18n/zh-Hans.json`、`i18n/zh-Hant.json`、
  `i18n/ja.json`、`i18n/es.json`、`i18n/ru.json` — 英語ベースパックと完全にキー一致
  （各 498 キー）。
- 全ページ、トースト、ログ、モーダルの UI 文字列はすべて `t("...")` 経由でルーティングされます。
  欠落キーは英語にフォールバックし、最終的にキーパス自体になります。
- 設定 → 言語で **システム / English / 简体中文 / 繁體中文 / 日本語 / Español / Русский** を選択
  でき、またはシステム表示言語に追従できます。選択は設定ストアに永続化され、即座に反映されます
  （再起動不要）。

#### ドライバのインストール（Scoop）
- Rclone は Scoop 経由でインストールされます。**Scoop バケットソース**（設定 →
  「Scoop バケットソース」）が追加されました：**GitHub**（公式 main バケット、既定）または
  **Gitee**（Gitee プラットフォーム上のコミュニティ同期コピー。GitHub にアクセスしにくい
  通信環境向け）。Gitee は GitHub のミラーではなく——そのバケットの内容は別途同期されるため、
  遅れていたり一部のソフトが欠けていたりする可能性があります。
- 起動処理が、インストール時に損壊した Scoop の `main` バケット（Scoop 0.6.0+ で見られる
  「Failed to remove local 'main' bucket」/「'main' bucket not found」の失敗）を
  **自動修復**するようになりました。
- rclone 直後のドライバ状態インジケータが更新されない問題を修正：rclone の検出は
  `powershell` 経由で行うため、起動時にキャッシュされたアプリのプロセス PATH とは関係なく、
  直ちにインストールされたばかりの Scoop シムが見つかります。

#### 依存関係の整合化とビルドツール
- `@tauri-apps/api` を **2.12** にアップグレードし、`@tauri-apps/plugin-dialog` /
  `@tauri-apps/plugin-store` を一致するバージョンに合わせて、Rust クレートがバージョン不一致を
  報告しなくなった。
- `tauri-plugin-mcp-bridge` を削除：公開された全バージョン（0.1.3–0.13.0）が
  `webview2-com 0.38` を固定しており、Tauri 2.12 の `webview2-com 0.39` と非互換。
  このプラグインは `#[cfg(debug_assertions)]` でのみ使用されており、本番ビルドには不要です。
- Rust の `tauri` クレートとプラグインクレートのバージョンは、npm パッケージ（すべて 2.12.x）と
  一貫して解決されるようになった。

#### ビルドとリリース
- プロジェクトは Windows 11 上で Rust + MSVC ツールチェーンによりビルドされます。
- `build-release.ps1` が以下を生成：
  - `Rclone Mount Hub_<ver>_x64-setup.exe`（Velopack インストーラ、インプレース更新）
  - `Rclone Mount Hub_<ver>_x64-Portable.exe`（単一ファイル、どこでも実行可能）
- 更新フィード URL：`https://github.com/Mr-Tenglin/Rclone-Mount-Hub/releases/latest/download`

---

## ストーリー

最初の NAS を手に入れて、SMB ネットワーク共有がどれだけ「クール」か（実際はクールさと正反対）を知り始めたときがすべてのはじまり。でも、小さな Bristopher は奇妙な認証情報トラブルに見舞われ始めた...

> **警告：** 言い訳っぽい長文が読みたくない方は次段落を飛ばしてください。Windows SMB が同じく苦痛という方は読み続けて、このリポジトリのディスカッションにその恨みつらみを教えてください。

...「ログイン済み」のはずなのに、実際には... できていない？ ユーザ名とパスワードで試すと「間違い」、NAS 上でパスワードを無理やり一新しても、それでも「間違い」。Windows の認証情報をクリア？ それでもダメ。ネットワークは WiFi 6E（しかも NAS は有線）なのに速度は 15MB/s に頭打ち、NAS への速度測定では回りで回る機械式ディスクらしい本来の 150+MB/s は出るのに。

接続が一瞬切れたネットワーク共有を開いただけで Windows エクスプローラー全体が落ちるのもお忘れなく！！（ええ、VSCode とブラウザのウィンドウがランダムに並べ替えられて、ファイルコピー中にエクスプローラーのウィンドウが全滅するのは、私の好物です！）。これは長年知られた bug であって、個人の「スキルの問題」ではありません。要するに、私には地獄だったし、私のような技術的な悪魔ではなく普通の Joe である家族のひとりにも地獄でした。

### 解決策

SMB の地獄に 3 年、x8 NVMe SSD の PCIe カードを追加（おすすめ、楽しい、機械式ディスクはオタク向け :P）したのに 30MB/s を超えられず... いよいよずっと狙っていた Windows と相性がいいもの、**WebDAV**（具体的には Copyparty）を試してみることに。

待て待て待て、何を考えているかわかっている：*「でも Bristopher、WebDAV は余計な overhead を大量に増やして実際は遅い、わあわあ。」* そう、あなたは正しい。でも、これは簡単で「実際に動く」ので... 正直 **RaiDrive**（「物理ドライブ」アドオンを払わないと 30MB/s 超えられない、でも払っても速度が変わらず諦めた）と **CloudMounter**（良いソフトだがマウント作業中に少し不安定）のアイデアは気に入りました。

そこで私は **Rclone Mount Hub** を作り、自分の NAS マウントと、ローカルネットワーク上の他の PC（私のノートPC など）へのマウントを簡単に管理できるようにしました。今、同期ソリューションとの格闘が続いているため、Syncthing と Resilio Sync がスローでバグだらけの地獄だった今、これが私の道だと考えます。もっと良いソリューションがあれば、ディスカッションで教えてください。ありがとうございます！！

---

## コントリビュート

Issue、機能リクエスト、pull request を歓迎します。Windows SMB に人生を台無しにされた方は、ディスカッションを開いてください — 苦しみを共感してくれる仲間は多いものです。

### DeepSeek Harness を使った開発

このプロジェクトは、AI コーディングエージェントである **DeepSeek Harness** の助けを借りて、積極的にメンテナンス・アップグレードされています。直近のアップデート — i18n システム、Tauri 2.12 の依存関係整合化、Velopack パッケージングのワークフローを含みます — は DeepSeek Harness を使って生成され、`tsc` / `vite build` / Tauri リリースビルドで検証されています。手作業でも DeepSeek Harness で生成しても、コントリビュートは歓迎です：何を変更し、なぜ変更したのかを述べた issue か pull request を開いてください。

---

## ライセンス

Rclone Mount Hub は **GNU Affero General Public License v3.0（AGPL-3.0）** のもとでオープンソースです。

**これは何を意味するか：**
- このソフトウェアを自由に使用、修正、配布できます
- 修正版を配布するか、ホストサービスとして提供する場合、同じライセンスのもとで変更を開示する必要があります
- このコードを閉じ、変更を開示せずにプロプライエタリ製品として販売することはできません

**商用ライセンス：** 組織が AGPL の義務なしで Rclone Mount Hub を利用・開発したい場合（プロプライエタリ製品内など）、商用ライセンスが利用可能です — issue を開くか、直接ご連絡ください。

Copyright © 2025 Bristopher. 全著作権所有。
