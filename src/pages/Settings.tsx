import { useEffect, useState } from "react";
import {
  Gear,
  Rocket,
  Lightning,
  Globe,
  Bell,
  ArrowsClockwise,
  HardDrives,
  Download,
  Trash,
  CloudArrowUp,
  FolderOpen,
  File,
  AppWindow,
  Info,
  CheckCircle,
  WarningCircle,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { DriverCardSkeleton } from "../components/ui/Skeleton";
import { useSettingsStore } from "../lib/store";
import { useLogStore } from "../lib/logStore";
import { useI18n, SUPPORTED_LOCALES } from "../lib/i18n";
import { Check } from "phosphor-react";
import type { SpeedProfile, NetworkMode, AppLanguage, ScoopBucketSource } from "../lib/types";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { open as openFilePicker } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

interface DriverVersions {
  rclone_installed: boolean;
  rclone_version: string | null;
  winfsp_installed: boolean;
  winfsp_version: string | null;
}

export function Settings() {
  const { settings, update, reset } = useSettingsStore();
  const { addLog } = useLogStore();
  const { t } = useI18n();
  const [driverVersions, setDriverVersions] = useState<DriverVersions | null>(null);
  const [driversLoading, setDriversLoading] = useState(true);
  const [installingDrivers, setInstallingDrivers] = useState(false);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [winfspInstallerLaunched, setWinfspInstallerLaunched] = useState(false);
  const [verifyingWinfsp, setVerifyingWinfsp] = useState(false);
  const [defaultConfigPath, setDefaultConfigPath] = useState("");
  const [appVersion, setAppVersion] = useState("");
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "up-to-date" | "updating">("idle");
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);

  useEffect(() => {
    loadDriverVersions();
    syncAutostart();
    invoke<string>("get_default_rclone_config_path").then(setDefaultConfigPath).catch(() => {});
    getVersion().then(setAppVersion).catch(() => setAppVersion("unknown"));
  }, []);

  const syncAutostart = async () => {
    try {
      const enabled = await invoke<boolean>("is_autostart_enabled");
      if (enabled !== settings.start_with_windows) {
        update({ start_with_windows: enabled });
      }
    } catch (err) {
      console.error("Failed to check autostart status:", err);
    }
  };

  const handleToggleAutostart = async (enabled: boolean) => {
    try {
      if (enabled) {
        await invoke("enable_autostart", { minimized: settings.start_minimized });
      } else {
        await invoke("disable_autostart");
      }
      update({ start_with_windows: enabled });
      toast.success(enabled ? t("toast.autostartEnabled") : t("toast.autostartDisabled"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.autostartToggleFailed"));
    }
  };

  const handleBrowseConfigPath = async () => {
    const selected = await openFilePicker({
      title: t("dialog.selectConfigFile"),
      filters: [{ name: t("dialog.configFilter"), extensions: ["conf"] }],
    });
    if (selected && typeof selected === "string") {
      update({ rclone_config_path: selected });
      await invoke("set_rclone_config_path", { path: selected });
      toast.success(t("toast.configPathUpdated"));
    }
  };

  const handleResetConfigPath = async () => {
    update({ rclone_config_path: "" });
    await invoke("set_rclone_config_path", { path: "" });
    toast.success(t("toast.configPathReset"));
  };

  const handleBrowseCacheDir = async () => {
    const selected = await openFilePicker({
      title: t("dialog.selectCacheDir"),
      directory: true,
    });
    if (selected && typeof selected === "string") {
      update({ cache_dir: selected });
      toast.success(t("toast.cacheDirUpdated"));
    }
  };

  const handleResetCacheDir = () => {
    update({ cache_dir: "" });
    toast.success(t("toast.cacheDirReset"));
  };

  const handleAddToStartMenu = async () => {
    try {
      await invoke("add_to_start_menu");
      toast.success(t("toast.startMenuAdded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.startMenuAddFailed"));
    }
  };

  const handleRemoveFromStartMenu = async () => {
    try {
      await invoke("remove_from_start_menu");
      toast.success(t("toast.startMenuRemoved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.startMenuRemoveFailed"));
    }
  };

  const loadDriverVersions = async () => {
    setDriversLoading(true);
    try {
      const versions = await invoke<DriverVersions>("get_driver_versions");
      setDriverVersions(versions);
    } catch (err) {
      console.error("Failed to get driver versions:", err);
    } finally {
      setDriversLoading(false);
    }
  };

  const handleInstallRclone = async () => {
    setInstallingDrivers(true);
    addLog("info", t("log.installingRclone"), "drivers");
    try {
      await invoke("install_rclone", {
        scoopBucketSource: settings.scoop_bucket_source,
      });
      addLog("success", t("log.rcloneInstalledOk"), "drivers");
      toast.success(t("toast.rcloneInstalled"));
      await loadDriverVersions();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t("toast.rcloneInstallFailed");
      addLog("error", t("log.rcloneInstallFailed", { msg: errorMsg }), "drivers");
      toast.error(errorMsg);
    } finally {
      setInstallingDrivers(false);
    }
  };

  const handleDownloadWinfsp = async () => {
    setInstallingDrivers(true);
    addLog("info", t("log.fetchingWinfsp"), "drivers");
    try {
      const version = await invoke<string>("download_and_launch_winfsp_installer");
      addLog("success", t("log.winfspDownloaded", { version }), "drivers");
      addLog("info", t("log.winfspWizard"), "drivers");
      toast.success(t("toast.winfspLaunched", { version }));
      setWinfspInstallerLaunched(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t("toast.winfspDownloadFailed");
      addLog("error", t("log.rcloneInstallFailed", { msg: errorMsg }), "drivers");
      toast.error(errorMsg);
    } finally {
      setInstallingDrivers(false);
    }
  };

  const handleVerifyWinfsp = async () => {
    setVerifyingWinfsp(true);
    addLog("info", t("log.verifyingWinfsp"), "drivers");
    try {
      await loadDriverVersions();
      const versions = await invoke<DriverVersions>("get_driver_versions");
      if (versions.winfsp_installed) {
        addLog("success", t("log.winfspDetected"), "drivers");
        toast.success(t("toast.winfspReady"));
        setWinfspInstallerLaunched(false);
      } else {
        addLog("warning", t("log.winfspNotDetectedLog"), "drivers");
        toast.error(t("toast.winfspNotDetected"));
      }
    } catch (err) {
      addLog("error", t("log.winfspVerifyFailed"), "drivers");
    } finally {
      setVerifyingWinfsp(false);
    }
  };

  const handleUninstallRclone = async () => {
    try {
      await invoke("uninstall_rclone");
      toast.success(t("toast.rcloneUninstalled"));
      await loadDriverVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.rcloneUninstallFailed"));
    }
  };

  const handleUninstallWinFsp = async () => {
    try {
      await invoke("uninstall_winfsp");
      toast.success(t("toast.winfspUninstalled"));
      await loadDriverVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.winfspUninstallFailed"));
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    addLog("info", t("log.checkingDriverUpdates"), "drivers");
    try {
      const result = await invoke<string>("check_driver_updates", {
        scoopBucketSource: settings.scoop_bucket_source,
      });
      addLog("success", `✓ ${result}`, "drivers");
      toast.info(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t("toast.checkUpdatesFailed");
      addLog("error", t("log.checkDriverUpdatesFailed", { msg: errorMsg }), "drivers");
      toast.error(errorMsg);
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleCheckAppUpdate = async () => {
    setUpdateStatus("checking");
    try {
      const result = await invoke<{ available: boolean; version: string | null; release_notes: string | null; download_size: number | null }>("check_app_update");
      if (result.available && result.version) {
        setAvailableVersion(result.version);
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch (err) {
      const errorMsg = typeof err === "string" ? err : err instanceof Error ? err.message : t("toast.checkUpdatesFailed");
      addLog("error", t("log.appUpdateCheckFailed", { msg: errorMsg }), "system");
      toast.error(errorMsg);
      setUpdateStatus("idle");
    }
  };

  const handleApplyAppUpdate = async () => {
    setUpdateStatus("updating");
    try {
      await invoke("apply_app_update");
      // apply_updates_and_restart restarts the app — this line won't be reached
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.applyUpdateFailed"));
      setUpdateStatus("available");
    }
  };

  const Toggle = ({
    enabled,
    onChange,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
  }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`
        relative w-11 h-6 rounded-full transition-all duration-200
        ${
          enabled
            ? "bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.3)]"
            : "bg-white/[0.15]"
        }
      `}
    >
      <div
        className={`
          absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200
          ${enabled ? "left-[22px]" : "left-0.5"}
        `}
      />
    </button>
  );

  return (
    <div className="h-full overflow-y-auto content-scroll">
      <div className="px-10 py-8 pb-12 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-2 flex items-center gap-3">
            <Gear size={28} weight="duotone" className="text-accent-blue" />
            {t("settings.title")}
          </h1>
          <p className="text-[13px] text-text-secondary">
            {t("settings.subtitle")}
          </p>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Section A - Startup */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <Rocket size={18} weight="duotone" className="text-accent-green" />
              {t("settings.startup.section")}
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-[13px] font-medium text-text-primary mb-0.5">
                    {t("settings.startup.startWithWindows")}
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    {t("settings.startup.startWithWindowsDesc")}
                  </div>
                </div>
                <Toggle
                  enabled={settings.start_with_windows}
                  onChange={handleToggleAutostart}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-[13px] font-medium text-text-primary mb-0.5">
                    {t("settings.startup.startMinimized")}
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    {t("settings.startup.startMinimizedDesc")}
                  </div>
                </div>
                <Toggle
                  enabled={settings.start_minimized}
                  onChange={async (val) => {
                    update({ start_minimized: val });
                    // Keep registry entry in sync if autostart is enabled
                    if (settings.start_with_windows) {
                      await invoke("enable_autostart", { minimized: val }).catch(() => {});
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-[13px] font-medium text-text-primary mb-0.5">
                    {t("settings.startup.closeToTray")}
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    {t("settings.startup.closeToTrayDesc")}
                  </div>
                </div>
                <Toggle
                  enabled={settings.close_to_tray}
                  onChange={(val) => update({ close_to_tray: val })}
                />
              </div>

              <div className="h-px bg-white/[0.06] my-1" />

              <div className="flex items-center justify-between py-1">
                <div>
                  <div className="text-[13px] font-medium text-text-primary mb-0.5">
                    {t("settings.startup.addToStartMenu")}
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    {t("settings.startup.addToStartMenuDesc")}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleAddToStartMenu}
                    className="gap-1.5"
                  >
                    <AppWindow size={14} weight="bold" />
                    {t("settings.startup.addToStartMenuBtn")}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleRemoveFromStartMenu}
                    className="gap-1.5"
                  >
                    <Trash size={14} weight="bold" />
                    {t("settings.startup.remove")}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {/* Section B - Performance Defaults */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Lightning
                size={18}
                weight="duotone"
                className="text-accent-amber"
              />
              {t("settings.perf.section")}
            </h2>
            <p className="text-[11px] text-text-tertiary mb-4">
              {t("settings.perf.sharedHint")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                {
                  value: "max" as SpeedProfile,
                  labelKey: "settings.perf.max",
                  descKey: "settings.perf.maxDesc",
                },
                {
                  value: "balanced" as SpeedProfile,
                  labelKey: "settings.perf.balanced",
                  descKey: "settings.perf.balancedDesc",
                },
                {
                  value: "low" as SpeedProfile,
                  labelKey: "settings.perf.low",
                  descKey: "settings.perf.lowDesc",
                },
              ]).map((profile) => (
                <button
                  key={profile.value}
                  onClick={() =>
                    update({ default_speed_profile: profile.value })
                  }
                  className={`
                    p-3 rounded-lg border transition-all duration-150 text-left
                    ${
                      settings.default_speed_profile === profile.value
                        ? "bg-accent-amber/10 border-accent-amber/40 shadow-[0_0_12px_rgba(251,191,36,0.15)]"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[13px] font-medium ${
                        settings.default_speed_profile === profile.value
                          ? "text-accent-amber"
                          : "text-text-primary"
                      }`}
                    >
                      {t(profile.labelKey)}
                    </span>
                    {settings.default_speed_profile === profile.value && (
                      <Check size={14} weight="bold" className="text-accent-amber" />
                    )}
                  </div>
                  <span className="text-[11px] text-text-tertiary">
                    {t(profile.descKey)}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Section C - Network Defaults */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Globe size={18} weight="duotone" className="text-accent-purple" />
              {t("settings.network.section")}
            </h2>
            <p className="text-[11px] text-text-tertiary mb-4">
              {t("settings.network.sharedHint")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                {
                  value: "auto" as NetworkMode,
                  labelKey: "settings.network.auto",
                  descKey: "settings.network.autoDesc",
                },
                {
                  value: "local" as NetworkMode,
                  labelKey: "settings.network.lan",
                  descKey: "settings.network.lanDesc",
                },
                {
                  value: "tailscale" as NetworkMode,
                  labelKey: "settings.network.tailscale",
                  descKey: "settings.network.tailscaleDesc",
                },
              ]).map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => update({ default_network_mode: mode.value })}
                  className={`
                    p-3 rounded-lg border transition-all duration-150 text-left
                    ${
                      settings.default_network_mode === mode.value
                        ? "bg-accent-purple/10 border-accent-purple/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                    }
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[13px] font-medium ${
                        settings.default_network_mode === mode.value
                          ? "text-accent-purple"
                          : "text-text-primary"
                      }`}
                    >
                      {t(mode.labelKey)}
                    </span>
                    {settings.default_network_mode === mode.value && (
                      <Check size={14} weight="bold" className="text-accent-purple" />
                    )}
                  </div>
                  <span className="text-[11px] text-text-tertiary">
                    {t(mode.descKey)}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {/* Section D - Notifications */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <Bell size={18} weight="duotone" className="text-accent-blue" />
              {t("settings.notifications.section")}
            </h2>
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  {t("settings.notifications.show")}
                </div>
                <div className="text-[11px] text-text-tertiary">
                  {t("settings.notifications.showDesc")}
                </div>
              </div>
              <Toggle
                enabled={settings.show_notifications}
                onChange={(val) => update({ show_notifications: val })}
              />
            </div>
          </Card>

          {/* Section D2 - Network Change Behavior */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Globe size={18} weight="duotone" className="text-accent-green" />
              {t("settings.networkChange.section")}
            </h2>
            <p className="text-[11px] text-text-tertiary mb-4">
              {t("settings.networkChange.intro")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                {
                  value: "notify" as const,
                  labelKey: "settings.networkChange.notify",
                  descKey: "settings.networkChange.notifyDesc",
                },
                {
                  value: "auto_reconnect" as const,
                  labelKey: "settings.networkChange.autoReconnect",
                  descKey: "settings.networkChange.autoReconnectDesc",
                },
              ]).map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => update({ network_change_mode: mode.value })}
                  className={`p-3 rounded-lg border transition-all duration-150 text-left ${
                    settings.network_change_mode === mode.value
                      ? "bg-accent-green/10 border-accent-green/40 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-[13px] font-medium ${
                        settings.network_change_mode === mode.value
                          ? "text-accent-green"
                          : "text-text-primary"
                      }`}
                    >
                      {t(mode.labelKey)}
                    </span>
                    {settings.network_change_mode === mode.value && (
                      <Check size={14} weight="bold" className="text-accent-green" />
                    )}
                  </div>
                  <span className="text-[11px] text-text-tertiary">{t(mode.descKey)}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Section E - Rclone Config Path */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <File size={18} weight="duotone" className="text-accent-purple" />
              {t("settings.config.section")}
            </h2>
            <p className="text-[11px] text-text-tertiary mb-4">
              {t("settings.config.intro")}
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings.rclone_config_path}
                  onChange={(e) => update({ rclone_config_path: e.target.value })}
                  onBlur={() => invoke("set_rclone_config_path", { path: settings.rclone_config_path }).catch(() => {})}
                  placeholder={defaultConfigPath || "%APPDATA%\\rclone\\rclone.conf"}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue/50 font-mono"
                />
                <Button variant="ghost" size="sm" onClick={handleBrowseConfigPath} className="gap-1.5 shrink-0">
                  <FolderOpen size={15} weight="bold" />
                  {t("settings.browse")}
                </Button>
              </div>
              {settings.rclone_config_path && (
                <Button variant="ghost" size="sm" onClick={handleResetConfigPath} className="gap-1.5 text-text-tertiary">
                  <ArrowsClockwise size={13} weight="bold" />
                  {t("settings.config.reset")}
                </Button>
              )}
              {!settings.rclone_config_path && defaultConfigPath && (
                <p className="text-[11px] text-text-tertiary">
                  {t("settings.config.usingDefault", { path: defaultConfigPath })}
                </p>
              )}
            </div>
          </Card>

          {/* Section E2 - VFS Cache Directory */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <FolderOpen size={18} weight="duotone" className="text-accent-amber" />
              {t("settings.cache.section")}
            </h2>
            <p className="text-[11px] text-text-tertiary mb-4">
              {t("settings.cache.intro")}
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings.cache_dir}
                  onChange={(e) => update({ cache_dir: e.target.value })}
                  placeholder="%LOCALAPPDATA%\\rclone (default)"
                  className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue/50 font-mono"
                />
                <Button variant="ghost" size="sm" onClick={handleBrowseCacheDir} className="gap-1.5 shrink-0">
                  <FolderOpen size={15} weight="bold" />
                  {t("settings.browse")}
                </Button>
              </div>
              {settings.cache_dir && (
                <Button variant="ghost" size="sm" onClick={handleResetCacheDir} className="gap-1.5 text-text-tertiary">
                  <ArrowsClockwise size={13} weight="bold" />
                  {t("settings.cache.reset")}
                </Button>
              )}
            </div>
          </Card>

          {/* Section F - Driver Management */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <HardDrives size={18} weight="duotone" className="text-accent-red" />
              {t("settings.drivers.section")}
            </h2>

            {driversLoading ? (
              <DriverCardSkeleton />
            ) : driverVersions ? (
              <div className="space-y-4">
                {/* Driver Status */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Rclone */}
                  <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium text-text-secondary">
                        {t("settings.drivers.rclone")}
                      </span>
                      {driverVersions.rclone_installed ? (
                        <Badge variant="connected">{t("settings.drivers.installed")}</Badge>
                      ) : (
                        <Badge variant="disconnected">{t("settings.drivers.notInstalled")}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-text-primary">
                      {driverVersions.rclone_version || "—"}
                    </div>
                    {driverVersions.rclone_installed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUninstallRclone}
                        className="gap-1.5 mt-2"
                      >
                        <Trash size={14} weight="bold" />
                        {t("settings.drivers.uninstall")}
                      </Button>
                    )}
                  </div>

                  {/* WinFsp */}
                  <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-medium text-text-secondary">
                        {t("settings.drivers.winfsp")}
                      </span>
                      {driverVersions.winfsp_installed ? (
                        <Badge variant="connected">{t("settings.drivers.installed")}</Badge>
                      ) : (
                        <Badge variant="disconnected">{t("settings.drivers.notInstalled")}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-text-primary">
                      {driverVersions.winfsp_version || "—"}
                    </div>
                    {driverVersions.winfsp_installed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUninstallWinFsp}
                        className="gap-1.5 mt-2"
                      >
                        <Trash size={14} weight="bold" />
                        {t("settings.drivers.uninstall")}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Rclone install/update */}
                  {!driverVersions.rclone_installed && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleInstallRclone}
                      disabled={installingDrivers}
                      className="gap-2"
                    >
                      {installingDrivers ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t("settings.drivers.installing")}
                        </>
                      ) : (
                        <>
                          <Download size={16} weight="bold" />
                          {t("settings.drivers.installRclone")}
                        </>
                      )}
                    </Button>
                  )}

                  {/* WinFsp install or verify */}
                  {!driverVersions.winfsp_installed && !winfspInstallerLaunched && (
                    <Button
                      variant="primary"
                      size="md"
                      onClick={handleDownloadWinfsp}
                      disabled={installingDrivers}
                      className="gap-2"
                    >
                      {installingDrivers ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t("settings.drivers.downloading")}
                        </>
                      ) : (
                        <>
                          <Download size={16} weight="bold" />
                          {t("settings.drivers.installWinfsp")}
                        </>
                      )}
                    </Button>
                  )}

                  {/* Continue button after installer is launched */}
                  {winfspInstallerLaunched && (
                    <Button
                      variant="success"
                      size="md"
                      onClick={handleVerifyWinfsp}
                      disabled={verifyingWinfsp}
                      className="gap-2"
                    >
                      {verifyingWinfsp ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {t("settings.drivers.verifying")}
                        </>
                      ) : (
                        <>
                          <Check size={16} weight="bold" />
                          {t("settings.drivers.verifiedWinfsp")}
                        </>
                      )}
                    </Button>
                  )}

                  {/* Check for updates (when both installed) */}
                  {driverVersions.rclone_installed && driverVersions.winfsp_installed && (
                    <Button
                      variant="default"
                      size="md"
                      onClick={handleCheckUpdates}
                      disabled={checkingUpdates}
                      className="gap-2"
                    >
                      {checkingUpdates ? (
                        <>
                          <div className="w-4 h-4 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                          {t("settings.drivers.checking")}
                        </>
                      ) : (
                        <>
                          <CloudArrowUp size={16} weight="bold" />
                          {t("settings.drivers.checkUpdates")}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[13px] text-text-tertiary">
                {t("settings.drivers.loadFailed")}
              </div>
            )}
          </Card>

          {/* Section G - About & Updates */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <Info size={18} weight="duotone" className="text-accent-blue" />
              {t("settings.about.section")}
            </h2>

            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  {t("settings.about.appName")}
                </div>
                <div className="text-[11px] text-text-tertiary font-mono">
                  {t("settings.about.version", { version: appVersion || "…" })}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Status badge */}
                {updateStatus === "up-to-date" && (
                  <div className="flex items-center gap-1.5 text-accent-green text-[12px]">
                    <CheckCircle size={14} weight="fill" />
                    {t("settings.about.upToDate")}
                  </div>
                )}
                {updateStatus === "available" && availableVersion && (
                  <div className="flex items-center gap-1.5 text-accent-amber text-[12px]">
                    <WarningCircle size={14} weight="fill" />
                    {t("settings.about.updateAvailable", { version: availableVersion })}
                  </div>
                )}

                {/* Update & Restart button — only shown when update is ready */}
                {updateStatus === "available" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApplyAppUpdate}
                    className="gap-1.5"
                  >
                    <Download size={14} weight="bold" />
                    {t("settings.about.updateRestart")}
                  </Button>
                )}

                {/* Check for Updates button */}
                {updateStatus !== "available" && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleCheckAppUpdate}
                    disabled={updateStatus === "checking" || updateStatus === "updating"}
                    className="gap-1.5"
                  >
                    {updateStatus === "checking" ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                        {t("settings.about.checking")}
                      </>
                    ) : updateStatus === "updating" ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                        {t("settings.about.updating")}
                      </>
                    ) : (
                      <>
                        <CloudArrowUp size={14} weight="bold" />
                        {t("settings.about.checkUpdates")}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Language */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <Globe size={18} weight="duotone" className="text-accent-blue" />
              {t("settings.language.section")}
            </h2>
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  {t("settings.language.label")}
                </div>
                <div className="text-[11px] text-text-tertiary">
                  {t("settings.language.hint")}
                </div>
              </div>
              <select
                value={settings.language ?? "auto"}
                onChange={(e) => update({ language: e.target.value as AppLanguage })}
                className="bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60 min-w-[140px]"
              >
                <option value="auto">{t("settings.language.auto")}</option>
                {SUPPORTED_LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>
          </Card>

          {/* Scoop bucket source (drives rclone install / update source) */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
              <Download size={18} weight="duotone" className="text-accent-green" />
              {t("settings.scoop.section")}
            </h2>
            <div className="flex items-center justify-between py-1">
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  {t("settings.scoop.label")}
                </div>
                <div className="text-[11px] text-text-tertiary">
                  {t("settings.scoop.hint")}
                </div>
              </div>
              <select
                value={settings.scoop_bucket_source ?? "github"}
                onChange={(e) =>
                  update({ scoop_bucket_source: e.target.value as ScoopBucketSource })
                }
                className="bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60 min-w-[140px]"
              >
                <option value="github">{t("settings.scoop.github")}</option>
                <option value="gitee">{t("settings.scoop.gitee")}</option>
              </select>
            </div>
          </Card>

          {/* Troubleshooting */}
          <Card className="p-5 space-y-2">
            <h3 className="text-[13px] font-semibold text-text-primary">{t("settings.troubleshoot.title")}</h3>
            <div className="text-[12px] text-text-secondary space-y-1.5">
              <p>
                <span className="text-text-primary font-medium">{t("settings.troubleshoot.installerTitle")}</span>{" "}
                {t("settings.troubleshoot.installerBody")}
              </p>
              <p>
                <span className="text-text-primary font-medium">{t("settings.troubleshoot.driveTitle")}</span>{" "}
                {t("settings.troubleshoot.driveBody")}
              </p>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="ghost"
              size="md"
              onClick={reset}
              className="gap-2"
            >
              <ArrowsClockwise size={16} weight="bold" />
              {t("settings.resetDefaults")}
            </Button>
            <div className="flex-1" />
            <div className="text-[11px] text-text-tertiary">
              {t("settings.savedNote")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
