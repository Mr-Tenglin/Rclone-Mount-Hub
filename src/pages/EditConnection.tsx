import { useState, useEffect } from "react";
import {
  HardDrive,
  Globe,
  Lock,
  User,
  Lightning,
  Check,
  ArrowLeft,
  CircleNotch,
  Cloud,
  Desktop,
  Database,
  FloppyDisk,
  CaretLeft,
  CaretRight,
  CaretDown,
  Gear,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useConnectionStore } from "../lib/store";
import { useLogStore } from "../lib/logStore";
import { useI18n } from "../lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import type { Connection, CacheOverrides } from "../lib/types";

interface EditConnectionProps {
  connection: Connection;
  onNavigate?: (page: string) => void;
}

const WEBDAV_VENDORS = [
  { value: "copyparty", labelKey: "shared.vendor.webdav.copyparty" },
  { value: "nextcloud", labelKey: "shared.vendor.webdav.nextcloud" },
  { value: "owncloud", labelKey: "shared.vendor.webdav.owncloud" },
  { value: "sharepoint", labelKey: "shared.vendor.webdav.sharepoint" },
  { value: "other", labelKey: "shared.vendor.webdav.other" },
];

const SFTP_VENDORS = [
  { value: "sftpgo", labelKey: "shared.vendor.sftp.sftpgo" },
  { value: "openssh", labelKey: "shared.vendor.sftp.openssh" },
  { value: "other", labelKey: "shared.vendor.sftp.other" },
];

export function EditConnection({ connection, onNavigate }: EditConnectionProps) {
  const { update } = useConnectionStore();
  const { addLog } = useLogStore();
  const { t } = useI18n();

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const [name, setName] = useState(connection.name);
  const [description, setDescription] = useState(connection.description || "");
  const [driveLetter, setDriveLetter] = useState(connection.drive_letter);
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [host, setHost] = useState(connection.local_ip);
  const [tailscaleIp, setTailscaleIp] = useState(connection.tailscale_ip || "");
  const [port, setPort] = useState(String(connection.port));
  const [username, setUsername] = useState(connection.username || "");
  const [password, setPassword] = useState(""); // never pre-fill password
  const [networkMode, setNetworkMode] = useState(connection.network_mode);
  const [speedProfile, setSpeedProfile] = useState(connection.speed_profile);
  const [autoMount, setAutoMount] = useState(connection.auto_mount);
  const [dualMount, setDualMount] = useState(connection.dual_mount ?? false);
  const [archiveDriveLetter, setArchiveDriveLetter] = useState(connection.archive_drive_letter || "");
  const [webdavVendor, setWebdavVendor] = useState(connection.vendor || "copyparty");
  const [sftpVendor, setSftpVendor] = useState(connection.vendor || "sftpgo");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cacheOverrides, setCacheOverrides] = useState<Partial<CacheOverrides>>(
    connection.cache_overrides || {}
  );
  const [customFlags, setCustomFlags] = useState(
    (connection.custom_flags || []).join("\n")
  );

  useEffect(() => {
    invoke<string[]>("get_available_drives").then((letters) => {
      // Include the currently assigned letter even if "in use" by this connection
      const withCurrent = letters.includes(connection.drive_letter)
        ? letters
        : [...letters, connection.drive_letter].sort();
      setAvailableLetters(withCurrent);
    }).catch(() => {});
  }, []);

  const navigateLetter = (dir: 1 | -1) => {
    if (availableLetters.length === 0) return;
    const idx = availableLetters.indexOf(driveLetter);
    if (idx === -1) {
      setDriveLetter(dir === 1 ? availableLetters[0] : availableLetters[availableLetters.length - 1]);
    } else {
      setDriveLetter(availableLetters[(idx + dir + availableLetters.length) % availableLetters.length]);
    }
  };

  const navigateArchiveLetter = (dir: 1 | -1) => {
    const free = availableLetters.filter(l => l !== driveLetter);
    if (free.length === 0) return;
    const idx = free.indexOf(archiveDriveLetter);
    if (idx === -1) {
      setArchiveDriveLetter(dir === 1 ? free[0] : free[free.length - 1]);
    } else {
      setArchiveDriveLetter(free[(idx + dir + free.length) % free.length]);
    }
  };

  const remoteType = connection.remote_type || "webdav";

  const remoteTypeLabelKey: Record<string, string> = {
    webdav: "shared.remote.webdav",
    sftp: "shared.remote.sftp",
    smb: "shared.remote.smb",
    s3: "shared.remote.s3",
    ftp: "shared.remote.ftp",
  };

  const remoteTypeIcon: Record<string, React.ElementType> = {
    webdav: Globe,
    sftp: Desktop,
    smb: Desktop,
    s3: Cloud,
    ftp: Database,
  };

  const TypeIcon = remoteTypeIcon[remoteType] || HardDrive;

  const validateForm = () => {
    if (!name.trim()) { toast.error(t("toast.nameRequired")); return false; }
    if (!driveLetter.trim()) { toast.error(t("toast.driveLetterRequired")); return false; }
    if (remoteType !== "s3" && !host.trim()) { toast.error(t("toast.hostRequired")); return false; }
    return true;
  };

  const handleTest = async () => {
    if (!validateForm()) return;
    setTesting(true);
    setTestResult(null);

    try {
      let anySuccess = false;
      const testPort = parseInt(port) || 0;

      // Test local IP
      addLog("info", t("log.testingLocal", { host, port: testPort }), "network");
      const localReachable = await invoke<boolean>("ping_port", {
        ip: host,
        port: testPort,
        timeoutMs: 3000,
      });
      if (localReachable) {
        addLog("success", t("log.localReachable", { ip: host, port: testPort, err: "" }), "network");
        anySuccess = true;
      } else {
        addLog("error", t("log.localUnreachable", { ip: host, port: testPort, err: "" }), "network");
      }

      // Test tailscale IP if provided
      let tailscaleReachable = false;
      if (tailscaleIp.trim()) {
        addLog("info", t("log.testingTailscale", { host: tailscaleIp, port: testPort }), "network");
        tailscaleReachable = await invoke<boolean>("ping_port", {
          ip: tailscaleIp,
          port: testPort,
          timeoutMs: 3000,
        });
        if (tailscaleReachable) {
          addLog("success", t("log.tailscaleReachable", { ip: tailscaleIp, port: testPort, err: "" }), "network");
          anySuccess = true;
        } else {
          addLog("error", t("log.tailscaleUnreachable", { ip: tailscaleIp, port: testPort, err: "" }), "network");
        }
      }

      const localLabel = localReachable ? t("test.localOk") : t("test.localFailed");
      const tsLabel = tailscaleIp.trim() ? (tailscaleReachable ? t("test.tailscaleOk") : t("test.tailscaleFailed")) : "";
      const summary = [localLabel, tsLabel].filter(Boolean).join(", ");

      if (anySuccess) {
        setTestResult("success");
        toast.success(summary);
      } else {
        setTestResult("error");
        toast.error(summary);
      }
    } catch (err) {
      setTestResult("error");
      const msg = err instanceof Error ? err.message : (typeof err === "string" ? err : t("toast.testFailed", { msg: "" }));
      addLog("error", t("log.testFailed", { msg }), "network");
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);

    try {
      // If password was changed, update rclone config
      if (password) {
        const params: Record<string, string> = {};
        if (remoteType === "webdav") {
          params.url = `http://${host}:${port}`;
          params.vendor = webdavVendor;
          params.user = username;
          params.pass = password;
        } else if (remoteType === "sftp" || remoteType === "ftp") {
          params.host = host;
          params.port = port;
          params.user = username;
          params.pass = password;
        } else if (remoteType === "smb") {
          params.host = host;
          params.user = username;
          params.pass = password;
        }

        // Delete and recreate remote to update credentials
        await invoke("delete_remote", { name: connection.name });
        await invoke("create_remote", { name, remoteType, params });
      } else if (name !== connection.name) {
        // Name changed but no password — recreate with empty pass for now
        // (rclone stores the encrypted pass; we can't read it back to re-use)
        toast(t("edit.nameChangedNote"));
      }

      // Update local store
      const updatedVendor = remoteType === "webdav" ? webdavVendor
        : remoteType === "sftp" ? sftpVendor
        : connection.vendor || "";

      const updates: Partial<Connection> = {
        name,
        description,
        drive_letter: driveLetter,
        local_ip: host,
        tailscale_ip: tailscaleIp,
        port: parseInt(port) || connection.port,
        username,
        vendor: updatedVendor,
        network_mode: networkMode,
        speed_profile: speedProfile,
        auto_mount: autoMount,
        cache_overrides: Object.values(cacheOverrides).some(v => v !== undefined) ? cacheOverrides as CacheOverrides : undefined,
        custom_flags: customFlags.split("\n").map(s => s.trim()).filter(Boolean),
        dual_mount: dualMount,
        archive_drive_letter: dualMount && archiveDriveLetter ? archiveDriveLetter : undefined,
      };

      update(connection.id, updates);
      addLog("success", t("log.connectionUpdated", { name }), "mounts");
      toast.success(t("toast.saved", { name }));
      onNavigate?.("dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : (typeof err === "string" ? err : t("toast.saveFailed", { msg: "" }));
      addLog("error", t("log.saveFailed", { msg }), "mounts");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto content-scroll">
      <div className="px-10 py-8 pb-12 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => onNavigate?.("dashboard")}
            className="flex items-center gap-1.5 text-[13px] text-text-tertiary hover:text-text-secondary mb-4 transition-colors"
          >
            <ArrowLeft size={14} weight="bold" />
            {t("add.back")}
          </button>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
              <TypeIcon size={18} weight="duotone" className="text-accent-blue" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              {t("edit.title")}
            </h1>
          </div>
          <p className="text-[13px] text-text-secondary">
            {t("edit.subtitle", {
              remoteType: t(remoteTypeLabelKey[remoteType] ?? "shared.remote.webdav"),
              date: new Date(connection.created_at).toLocaleDateString(),
            })}
          </p>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <HardDrive size={18} weight="duotone" className="text-accent-blue" />
              {t("add.section.basic")}
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label={t("shared.label.connectionName")}
                  value={name}
                  onChange={(e) => { setName(e.target.value); setTestResult(null); }}
                />
                {/* Drive letter picker */}
                <div>
                  <label className="block text-[13px] font-medium text-text-secondary mb-2">
                    {t("shared.label.driveLetter")}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => navigateLetter(-1)}
                      disabled={availableLetters.length === 0}
                      className="w-8 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-tertiary hover:text-text-primary hover:bg-white/[0.08] transition-colors disabled:opacity-30"
                    >
                      <CaretLeft size={13} weight="bold" />
                    </button>
                    <input
                      maxLength={1}
                      value={driveLetter}
                      onChange={(e) => setDriveLetter(e.target.value.toUpperCase())}
                      className="w-12 h-9 text-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-[15px] font-semibold text-text-primary focus:outline-none focus:border-accent-blue/50 uppercase"
                    />
                    <button
                      type="button"
                      onClick={() => navigateLetter(1)}
                      disabled={availableLetters.length === 0}
                      className="w-8 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-tertiary hover:text-text-primary hover:bg-white/[0.08] transition-colors disabled:opacity-30"
                    >
                      <CaretRight size={13} weight="bold" />
                    </button>
                    {availableLetters.length > 0 && (
                      <span className="text-[11px] text-text-tertiary ml-1">
                        {t("shared.drivesFree", { count: availableLetters.length })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Input
                label={t("shared.label.description")}
                placeholder={t("shared.placeholder.description")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </Card>

          {/* Host settings (not S3) */}
          {remoteType !== "s3" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <TypeIcon size={18} weight="duotone" className="text-accent-purple" />
                {t("edit.remoteSettings", {
                  type: t(remoteTypeLabelKey[remoteType] ?? "shared.remote.webdav"),
                })}
              </h2>
              <div className="space-y-4">
                {remoteType === "webdav" && (
                  <div>
                    <label className="block text-[13px] font-medium text-text-secondary mb-2">
                      {t("shared.label.serverSoftware")}
                    </label>
                    <select
                      value={webdavVendor}
                      onChange={(e) => setWebdavVendor(e.target.value)}
                      className="w-full bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60"
                    >
                      {WEBDAV_VENDORS.map((v) => (
                        <option key={v.value} value={v.value}>{t(v.labelKey)}</option>
                      ))}
                    </select>
                  </div>
                )}
                {remoteType === "sftp" && (
                  <div>
                    <label className="block text-[13px] font-medium text-text-secondary mb-2">
                      {t("shared.label.serverSoftware")}
                    </label>
                    <select
                      value={sftpVendor}
                      onChange={(e) => setSftpVendor(e.target.value)}
                      className="w-full bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60"
                    >
                      {SFTP_VENDORS.map((v) => (
                        <option key={v.value} value={v.value}>{t(v.labelKey)}</option>
                      ))}
                    </select>
                    {sftpVendor === "sftpgo" && (
                      <p className="text-[11px] text-text-tertiary mt-1.5">
                        {t("add.sftpgoHint")}
                      </p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Input
                      label={t("shared.label.host")}
                      value={host}
                      onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                    />
                  </div>
                  <Input
                    label={t("shared.label.port")}
                    type="number"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
                <Input
                  label={t("shared.label.tailscaleIp")}
                  placeholder="100.x.x.x"
                  value={tailscaleIp}
                  onChange={(e) => setTailscaleIp(e.target.value)}
                  hint={t("shared.hint.tailscaleIp")}
                />
              </div>
            </Card>
          )}

          {/* Authentication */}
          {remoteType !== "s3" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Lock size={18} weight="duotone" className="text-accent-amber" />
                {t("add.section.auth")}
              </h2>
              <div className="space-y-4">
                <Input
                  label={t("shared.label.username")}
                  icon={User}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                  label={t("edit.newPassword")}
                  type="password"
                  placeholder="••••••••"
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  hint={t("edit.passwordStoredHint")}
                />
              </div>
            </Card>
          )}

          {/* Network Mode */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Globe size={18} weight="duotone" className="text-accent-purple" />
              {t("add.section.networkMode")}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "auto" as const, labelKey: "shared.mode.auto", descKey: "shared.mode.autoDesc" },
                { value: "local" as const, labelKey: "shared.mode.lan", descKey: "shared.mode.lanDesc" },
                { value: "tailscale" as const, labelKey: "shared.mode.tailscale", descKey: "shared.mode.tailscaleDesc" },
              ]).map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setNetworkMode(mode.value)}
                  className={`p-3 rounded-lg border transition-all duration-150 text-left ${
                    networkMode === mode.value
                      ? "bg-accent-blue/10 border-accent-blue/40"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[13px] font-medium ${networkMode === mode.value ? "text-accent-blue" : "text-text-primary"}`}>
                      {t(mode.labelKey)}
                    </span>
                    {networkMode === mode.value && <Check size={14} weight="bold" className="text-accent-blue" />}
                  </div>
                  <span className="text-[11px] text-text-tertiary">{t(mode.descKey)}</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Speed Profile */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Lightning size={18} weight="duotone" className="text-accent-green" />
              {t("add.section.performanceProfile")}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {([
                {
                  value: "max" as const,
                  labelKey: "shared.profile.max",
                  cache: "500 GB",
                  descKey: "shared.profile.maxDesc",
                },
                {
                  value: "balanced" as const,
                  labelKey: "shared.profile.balanced",
                  cache: "200 GB",
                  descKey: "shared.profile.balancedDesc",
                },
                {
                  value: "low" as const,
                  labelKey: "shared.profile.low",
                  cache: "50 GB",
                  descKey: "shared.profile.lowDesc",
                },
              ]).map((profile) => (
                <button
                  key={profile.value}
                  onClick={() => setSpeedProfile(profile.value)}
                  className={`p-4 rounded-lg border transition-all duration-150 text-left ${
                    speedProfile === profile.value
                      ? "bg-accent-green/10 border-accent-green/40"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[13px] font-semibold ${speedProfile === profile.value ? "text-accent-green" : "text-text-primary"}`}>
                      {t(profile.labelKey)}
                    </span>
                    {speedProfile === profile.value && <Check size={14} weight="bold" className="text-accent-green" />}
                  </div>
                  <div className="text-[11px] text-text-tertiary mb-1">
                    {t("add.cachePrefix", { cache: profile.cache })}
                  </div>
                  <div className="text-[11px] text-text-tertiary">{t(profile.descKey)}</div>
                </button>
              ))}
            </div>
          </Card>

          {/* Advanced Cache Settings */}
          <Card className="p-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between"
            >
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Gear size={18} weight="duotone" className="text-text-tertiary" />
                {t("add.section.advancedCache")}
              </h2>
              <div className="flex items-center gap-2">
                {!showAdvanced && (
                  <span className="text-[11px] text-text-tertiary">
                    {t("add.usingProfileDefaults", { profile: speedProfile })}
                  </span>
                )}
                <CaretDown
                  size={14}
                  weight="bold"
                  className={`text-text-tertiary transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                />
              </div>
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <p className="text-[11px] text-text-tertiary">
                  {t("add.advancedHint")}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t("shared.label.dirCacheTime")}
                    placeholder={speedProfile === "low" ? "30s" : "0"}
                    value={cacheOverrides.dir_cache_time || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, dir_cache_time: e.target.value || undefined })}
                    hint={t("shared.hint.dirCacheTime")}
                  />
                  <Input
                    label={t("shared.label.pollInterval")}
                    placeholder={speedProfile === "low" ? "10m" : "5m"}
                    value={cacheOverrides.poll_interval || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, poll_interval: e.target.value || undefined })}
                    hint={t("shared.hint.pollInterval")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] font-medium text-text-secondary mb-2">
                      {t("shared.label.vfsCacheMode")}
                    </label>
                    <select
                      value={cacheOverrides.vfs_cache_mode || ""}
                      onChange={(e) => setCacheOverrides({ ...cacheOverrides, vfs_cache_mode: e.target.value || undefined })}
                      className="w-full bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60"
                    >
                      <option value="">{t("shared.vfsCacheMode.default")}</option>
                      <option value="full">{t("shared.vfsCacheMode.full")}</option>
                      <option value="writes">{t("shared.vfsCacheMode.writes")}</option>
                      <option value="minimal">{t("shared.vfsCacheMode.minimal")}</option>
                      <option value="off">{t("shared.vfsCacheMode.off")}</option>
                    </select>
                  </div>
                  <Input
                    label={t("shared.label.vfsCacheSize")}
                    placeholder={speedProfile === "max" ? "500G" : speedProfile === "balanced" ? "200G" : "50G"}
                    value={cacheOverrides.vfs_cache_max_size || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, vfs_cache_max_size: e.target.value || undefined })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t("shared.label.readAhead")}
                    placeholder={speedProfile === "max" ? "512M" : speedProfile === "balanced" ? "128M" : "32M"}
                    value={cacheOverrides.vfs_read_ahead || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, vfs_read_ahead: e.target.value || undefined })}
                  />
                  <Input
                    label={t("shared.label.bufferSize")}
                    placeholder={speedProfile === "max" ? "512M" : speedProfile === "balanced" ? "256M" : "64M"}
                    value={cacheOverrides.buffer_size || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, buffer_size: e.target.value || undefined })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t("shared.label.transfers")}
                    type="number"
                    placeholder={speedProfile === "max" ? "16" : speedProfile === "balanced" ? "8" : "4"}
                    value={cacheOverrides.transfers?.toString() || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, transfers: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                  <Input
                    label={t("shared.label.multiThreadStreams")}
                    type="number"
                    placeholder={speedProfile === "max" ? "16" : speedProfile === "balanced" ? "8" : "4"}
                    value={cacheOverrides.multi_thread_streams?.toString() || ""}
                    onChange={(e) => setCacheOverrides({ ...cacheOverrides, multi_thread_streams: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setCacheOverrides({}); setCustomFlags(""); }}
                  className="text-text-tertiary"
                >
                  {t("shared.resetDefaults")}
                </Button>

                {/* Custom rclone flags */}
                <div className="pt-3 border-t border-white/[0.06]">
                  <label className="block text-[13px] font-medium text-text-secondary mb-2">
                    {t("shared.label.extraFlags")}
                  </label>
                  <textarea
                    value={customFlags}
                    onChange={(e) => setCustomFlags(e.target.value)}
                    placeholder={t("shared.extraFlagsPlaceholder")}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-blue/50 font-mono resize-y"
                  />
                  <p className="text-[11px] text-text-tertiary mt-1">
                    {t("shared.extraFlagsHint")}
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Auto-mount */}
          <Card className="p-5 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-text-primary mb-0.5">
                {t("add.autoMountTitle")}
              </div>
              <div className="text-[11px] text-text-tertiary">
                {t("add.autoMountDesc")}
              </div>
            </div>
            <button
              onClick={() => setAutoMount(!autoMount)}
              className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                autoMount ? "bg-accent-blue shadow-[0_0_8px_rgba(59,130,246,0.3)]" : "bg-white/[0.15]"
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                  autoMount ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </Card>

          {/* Dual Mount */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-0">
              <div>
                <div className="text-[13px] font-medium text-text-primary mb-0.5">
                  {t("add.dualMountTitle")}
                </div>
                <div className="text-[11px] text-text-tertiary">
                  {t("add.dualMountDesc")}
                </div>
              </div>
              <button
                onClick={() => setDualMount(!dualMount)}
                className={`relative w-11 h-6 rounded-full transition-all duration-200 flex-shrink-0 ml-4 ${
                  dualMount ? "bg-accent-purple shadow-[0_0_8px_rgba(139,92,246,0.3)]" : "bg-white/[0.15]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-200 ${
                    dualMount ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {dualMount && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <div className="grid grid-cols-2 gap-4 items-start">
                  <div>
                    <div className="text-[11px] font-medium text-text-secondary mb-2 uppercase tracking-wide">{t("add.liveMountLabel")}</div>
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-9 flex items-center justify-center rounded-lg bg-accent-blue/10 border border-accent-blue/20 text-[15px] font-semibold text-accent-blue">
                        {driveLetter}
                      </div>
                      <div className="text-[11px] text-text-tertiary leading-tight">
                        {t("add.liveMountLine1")}<br />{t("add.liveMountLine2")}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-text-secondary mb-2 uppercase tracking-wide">{t("add.archiveMountLabel")}</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigateArchiveLetter(-1)}
                        className="w-8 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-tertiary hover:text-text-primary hover:bg-white/[0.08] transition-colors"
                      >
                        <CaretLeft size={13} weight="bold" />
                      </button>
                      <input
                        maxLength={1}
                        value={archiveDriveLetter}
                        onChange={(e) => setArchiveDriveLetter(e.target.value.toUpperCase())}
                        className="w-12 h-9 text-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-[15px] font-semibold text-accent-purple focus:outline-none focus:border-accent-purple/50 uppercase"
                      />
                      <button
                        type="button"
                        onClick={() => navigateArchiveLetter(1)}
                        className="w-8 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.08] text-text-tertiary hover:text-text-primary hover:bg-white/[0.08] transition-colors"
                      >
                        <CaretRight size={13} weight="bold" />
                      </button>
                      <div className="text-[11px] text-text-tertiary leading-tight">
                        {t("add.archiveMountLine1")}<br />{t("add.archiveMountLine2")}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-text-tertiary mt-3">
                  {t("add.dualMountNote")}
                </p>
              </div>
            )}
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="ghost"
              size="md"
              className="flex-1"
              onClick={() => onNavigate?.("dashboard")}
              disabled={saving}
            >
              {t("shared.action.cancel")}
            </Button>
            <Button
              variant="default"
              size="md"
              className={`gap-2 ${
                testResult === "success" ? "border-accent-green/40 text-accent-green" :
                testResult === "error" ? "border-accent-red/40 text-accent-red" : ""
              }`}
              onClick={handleTest}
              disabled={testing || saving}
            >
              {testing ? (
                <CircleNotch size={16} weight="bold" className="animate-spin" />
              ) : testResult === "success" ? (
                <Check size={16} weight="bold" />
              ) : (
                <Globe size={16} weight="bold" />
              )}
              {testing
                ? t("shared.action.testing")
                : testResult === "success"
                ? t("shared.action.testReached")
                : t("shared.action.testConnection")}
            </Button>
            <Button
              variant="primary"
              size="md"
              className="gap-2"
              onClick={handleSave}
              disabled={saving || testing}
            >
              {saving ? (
                <CircleNotch size={16} weight="bold" className="animate-spin" />
              ) : (
                <FloppyDisk size={16} weight="bold" />
              )}
              {saving ? t("edit.saving") : t("edit.saveChanges")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
