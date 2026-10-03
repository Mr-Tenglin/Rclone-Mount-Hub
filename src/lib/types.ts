// TypeScript types matching Rust backend models

export interface Connection {
  id: string;
  name: string;
  description: string;
  remote_type: string;
  local_ip: string;
  tailscale_ip: string;
  port: number;
  drive_letter: string;
  protocol: string;
  vendor: string; // server software: copyparty, sftpgo, openssh, etc.
  username: string;
  network_mode: NetworkMode;
  speed_profile: SpeedProfile;
  auto_mount: boolean;
  sort_order: number;
  created_at: string;
  cache_overrides?: CacheOverrides;
  custom_flags: string[]; // Extra rclone CLI flags appended to mount command
  dual_mount: boolean;
  archive_drive_letter?: string;
}

export type NetworkMode = "auto" | "local" | "tailscale";
export type SpeedProfile = "max" | "balanced" | "low";
export type NetworkChangeMode = "notify" | "auto_reconnect";

export interface MountStatus {
  connection_id: string;
  state: MountState;
  active_mode: "local" | "tailscale" | null;
  active_url: string | null;
  pid: number | null;
  archive_pid: number | null;
  error: string | null;
  log: string | null;
}

export type MountState = "mounted" | "mounting" | "unmounted" | "error";

export interface CacheOverrides {
  dir_cache_time?: string;
  poll_interval?: string;
  vfs_cache_mode?: string;
  vfs_cache_max_size?: string;
  vfs_read_ahead?: string;
  buffer_size?: string;
  transfers?: number;
  multi_thread_streams?: number;
}

export type AppLanguage = "auto" | "en" | "zh-Hans" | "zh-Hant" | "ja" | "es" | "ru";

/** Which bucket source the Scoop-based driver installer/updates use. */
export type ScoopBucketSource = "github" | "gitee";

/** Proxy protocol for the global proxy setting. */
export type ProxyScheme = "http" | "https" | "socks4" | "socks5";

/**
 * Build the effective proxy URL from the settings parts, or `null` when the
 * proxy is disabled / the address is empty. Used at every `invoke` site that
 * forwards the proxy to the backend.
 */
export function buildProxyUrl(settings: {
  proxy_enabled?: boolean;
  proxy_scheme?: ProxyScheme;
  proxy_url?: string;
}): string | null {
  if (!settings.proxy_enabled) return null;
  const host = (settings.proxy_url ?? "").trim();
  if (!host) return null;
  const scheme = settings.proxy_scheme ?? "http";
  return host.includes("://") ? host : `${scheme}://${host}`;
}

export interface AppSettings {
  start_with_windows: boolean;
  start_minimized: boolean;
  close_to_tray: boolean;
  theme: "dark";
  default_speed_profile: SpeedProfile;
  default_network_mode: NetworkMode;
  show_notifications: boolean;
  rclone_config_path: string;
  network_change_mode: NetworkChangeMode;
  cache_dir: string;
  language: AppLanguage;
  scoop_bucket_source: ScoopBucketSource;
  /** Proxy enabled flag — independent of the address so the toggle stays usable. */
  proxy_enabled: boolean;
  /** Proxy protocol (http / https / socks4 / socks5). */
  proxy_scheme: ProxyScheme;
  /**
   * Proxy host:port (no scheme). Empty = no proxy.
   * The effective proxy URL is `${proxy_scheme}://${proxy_url}`.
   */
  proxy_url: string;
}

export interface SpeedProfileInfo {
  id: SpeedProfile;
  label: string;
  description: string;
  icon: string;
  cache: string;
  buffer: string;
  transfers: number;
}

export const SPEED_PROFILES: Record<SpeedProfile, SpeedProfileInfo> = {
  max: {
    id: "max",
    label: "Max Speed",
    description: "10Gbps LAN, Fiber remote",
    icon: "⚡",
    cache: "500 GB",
    buffer: "512 MB",
    transfers: 16,
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "General daily use",
    icon: "⚖️",
    cache: "200 GB",
    buffer: "256 MB",
    transfers: 8,
  },
  low: {
    id: "low",
    label: "Low Resource",
    description: "Battery, slow WiFi",
    icon: "🔋",
    cache: "50 GB",
    buffer: "64 MB",
    transfers: 4,
  },
};
