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

interface AddConnectionProps {
  onNavigate?: (page: string) => void;
}

type RemoteTypeId = "webdav" | "sftp" | "smb" | "s3" | "ftp";

// Supported remote types with display info (labels resolved via i18n keys)
const REMOTE_TYPES: {
  id: RemoteTypeId;
  icon: React.ElementType;
  color: string;
  labelKey: string;
  descKey: string;
}[] = [
  {
    id: "webdav",
    icon: Globe,
    color: "accent-blue",
    labelKey: "shared.remote.webdav",
    descKey: "shared.remote.webdavDesc",
  },
  {
    id: "sftp",
    icon: Desktop,
    color: "accent-purple",
    labelKey: "shared.remote.sftp",
    descKey: "shared.remote.sftpDesc",
  },
  {
    id: "smb",
    icon: Desktop,
    color: "accent-amber",
    labelKey: "shared.remote.smb",
    descKey: "shared.remote.smbDesc",
  },
  {
    id: "s3",
    icon: Cloud,
    color: "accent-green",
    labelKey: "shared.remote.s3",
    descKey: "shared.remote.s3Desc",
  },
  {
    id: "ftp",
    icon: Database,
    color: "text-text-tertiary",
    labelKey: "shared.remote.ftp",
    descKey: "shared.remote.ftpDesc",
  },
];

// WebDAV vendor options
const WEBDAV_VENDORS = [
  { value: "copyparty", labelKey: "shared.vendor.webdav.copyparty" },
  { value: "nextcloud", labelKey: "shared.vendor.webdav.nextcloud" },
  { value: "owncloud", labelKey: "shared.vendor.webdav.owncloud" },
  { value: "sharepoint", labelKey: "shared.vendor.webdav.sharepoint" },
  { value: "other", labelKey: "shared.vendor.webdav.other" },
];

// SFTP server software options
const SFTP_VENDORS = [
  { value: "sftpgo", labelKey: "shared.vendor.sftp.sftpgo" },
  { value: "openssh", labelKey: "shared.vendor.sftp.openssh" },
  { value: "other", labelKey: "shared.vendor.sftp.other" },
];

const S3_PROVIDERS = [
  { value: "AWS", labelKey: "shared.vendor.s3.aws" },
  { value: "MinIO", labelKey: "shared.vendor.s3.minio" },
  { value: "Backblaze", labelKey: "shared.vendor.s3.backblaze" },
  { value: "Wasabi", labelKey: "shared.vendor.s3.wasabi" },
  { value: "Other", labelKey: "shared.vendor.s3.other" },
];

export function AddConnection({ onNavigate }: AddConnectionProps = {}) {
  const { add } = useConnectionStore();
  const { addLog } = useLogStore();
  const { t } = useI18n();

  const [remoteType, setRemoteType] = useState<RemoteTypeId>("webdav");
  const [testing, setTesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  // Common fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [driveLetter, setDriveLetter] = useState("Z");
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);
  const [networkMode, setNetworkMode] = useState<"auto" | "local" | "tailscale">("auto");
  const [speedProfile, setSpeedProfile] = useState<"max" | "balanced" | "low">("balanced");
  const [autoMount, setAutoMount] = useState(true);
  const [dualMount, setDualMount] = useState(false);
  const [archiveDriveLetter, setArchiveDriveLetter] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [cacheOverrides, setCacheOverrides] = useState<Partial<CacheOverrides>>({});
  const [customFlags, setCustomFlags] = useState("");

  // WebDAV / SFTP / FTP / SMB fields
  const [host, setHost] = useState("");
  const [tailscaleIp, setTailscaleIp] = useState("");
  const [port, setPort] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [webdavVendor, setWebdavVendor] = useState("copyparty");
  const [sftpVendor, setSftpVendor] = useState("sftpgo");

  // S3 fields
  const [s3Provider, setS3Provider] = useState("AWS");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Region, setS3Region] = useState("us-east-1");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");

  // Default ports per type
  const defaultPorts: Record<RemoteTypeId, string> = {
    webdav: "80",
    sftp: "22",
    smb: "445",
    s3: "",
    ftp: "21",
  };

  useEffect(() => {
    invoke<string[]>("get_available_drives").then((letters) => {
      setAvailableLetters(letters);
      // If default "Z" isn't available, pick the last available letter
      if (letters.length > 0 && !letters.includes("Z")) {
        setDriveLetter(letters[letters.length - 1]);
      }
    }).catch(() => {});
    // Set initial port based on default remote type
    setPort(defaultPorts["webdav"]);
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

  const handleTypeChange = (type: RemoteTypeId) => {
    setRemoteType(type);
    setPort(defaultPorts[type]);
    setTestResult(null);
  };

  const getTestHost = () => host;
  const getTestPort = () => parseInt(port) || 0;

  const buildRcloneParams = (): Record<string, string> => {
    switch (remoteType) {
      case "webdav":
        return {
          url: `http://${host}:${port}`,
          vendor: webdavVendor,
          user: username,
          pass: password,
        };
      case "sftp":
        return {
          host,
          port,
          user: username,
          pass: password,
        };
      case "smb":
        return {
          host,
          user: username,
          pass: password,
        };
      case "s3":
        return {
          provider: s3Provider,
          access_key_id: s3AccessKey,
          secret_access_key: s3SecretKey,
          region: s3Region,
          ...(s3Endpoint ? { endpoint: s3Endpoint } : {}),
        };
      case "ftp":
        return {
          host,
          port,
          user: username,
          pass: password,
        };
    }
  };

  const validateForm = () => {
    if (!name.trim()) {
      toast.error(t("toast.nameRequired"));
      return false;
    }
    if (!driveLetter.trim()) {
      toast.error(t("toast.driveLetterRequired"));
      return false;
    }
    if (remoteType !== "s3" && !host.trim()) {
      toast.error(t("toast.hostRequired"));
      return false;
    }
    if (remoteType === "s3" && (!s3AccessKey || !s3SecretKey)) {
      toast.error(t("toast.s3KeysRequired"));
      return false;
    }
    return true;
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setTesting(true);
    setTestResult(null);

    try {
      if (remoteType === "s3") {
        toast.success(t("toast.s3LooksValid"));
        setTestResult("success");
        setTesting(false);
        return;
      }

      const testHost = getTestHost();
      const testPort = getTestPort();
      let anySuccess = false;

      // Test local IP
      addLog("info", t("log.testingLocal", { host: testHost, port: testPort }), "network");
      const localReachable = await invoke<boolean>("ping_port", {
        ip: testHost,
        port: testPort,
        timeoutMs: 3000,
      });
      if (localReachable) {
        addLog("success", t("log.localReachable", { ip: testHost, port: testPort, err: "" }), "network");
        anySuccess = true;
      } else {
        addLog("error", t("log.localUnreachable", { ip: testHost, port: testPort, err: "" }), "network");
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
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", t("log.testFailed", { msg }), "network");
      toast.error(t("toast.testFailed", { msg }));
    } finally {
      setTesting(false);
    }
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setCreating(true);
    addLog("info", t("log.creatingRemote", { name, type: remoteType }), "mounts");

    try {
      await invoke("create_remote", {
        name,
        remoteType,
        params: buildRcloneParams(),
      });

      const vendor = remoteType === "webdav" ? webdavVendor
        : remoteType === "sftp" ? sftpVendor
        : "";

      const connection: Connection = {
        id: crypto.randomUUID(),
        name,
        description,
        remote_type: remoteType,
        local_ip: remoteType === "s3" ? "" : host,
        tailscale_ip: tailscaleIp,
        port: parseInt(port) || 0,
        drive_letter: driveLetter,
        protocol: remoteType,
        vendor,
        username,
        network_mode: networkMode,
        speed_profile: speedProfile,
        auto_mount: autoMount,
        sort_order: Date.now(),
        created_at: new Date().toISOString(),
        cache_overrides: Object.values(cacheOverrides).some(v => v !== undefined) ? cacheOverrides as CacheOverrides : undefined,
        custom_flags: customFlags.split("\n").map(s => s.trim()).filter(Boolean),
        dual_mount: dualMount,
        archive_drive_letter: dualMount && archiveDriveLetter ? archiveDriveLetter : undefined,
      };

      add(connection);
      addLog("success", t("log.remoteCreated", { name }), "mounts");
      toast.success(t("toast.created", { name }));
      onNavigate?.("dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog("error", t("log.createRemoteFailed", { msg }), "mounts");
      toast.error(t("toast.createFailed", { msg }));
    } finally {
      setCreating(false);
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
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-2">
            {t("add.title")}
          </h1>
          <p className="text-[13px] text-text-secondary">
            {t("add.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          {/* Connection Type */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Cloud size={18} weight="duotone" className="text-accent-blue" />
              {t("add.section.type")}
            </h2>
            <div className="grid grid-cols-5 gap-2">
              {REMOTE_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = remoteType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleTypeChange(type.id)}
                    className={`p-3 rounded-lg border transition-all duration-150 text-left ${
                      isSelected
                        ? "bg-accent-blue/10 border-accent-blue/40"
                        : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon
                      size={20}
                      weight="duotone"
                      className={`mb-1.5 ${isSelected ? "text-accent-blue" : "text-text-tertiary"}`}
                    />
                    <div
                      className={`text-[13px] font-medium mb-0.5 ${
                        isSelected ? "text-accent-blue" : "text-text-primary"
                      }`}
                    >
                      {t(type.labelKey)}
                    </div>
                    <div className="text-[10px] text-text-tertiary leading-tight">
                      {t(type.descKey)}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

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
                  placeholder={t("shared.placeholder.connectionName")}
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

          {/* Type-specific fields */}
          {remoteType === "webdav" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Globe size={18} weight="duotone" className="text-accent-purple" />
                {t("add.section.webdav")}
              </h2>
              <div className="space-y-4">
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
                      <option key={v.value} value={v.value}>
                        {t(v.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <Input
                      label={t("shared.label.host")}
                      placeholder="192.168.x.x"
                      value={host}
                      onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                      hint={t("shared.hint.host")}
                    />
                  </div>
                  <Input
                    label={t("shared.label.port")}
                    type="number"
                    placeholder="80"
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

          {(remoteType === "sftp" || remoteType === "ftp") && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Desktop size={18} weight="duotone" className="text-accent-purple" />
                {t(remoteType === "sftp" ? "add.section.sftp" : "add.section.ftp")}
              </h2>
              <div className="space-y-4">
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
                        <option key={v.value} value={v.value}>
                          {t(v.labelKey)}
                        </option>
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
                      placeholder="192.168.x.x"
                      value={host}
                      onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                      hint={t("shared.hint.host")}
                    />
                  </div>
                  <Input
                    label={t("shared.label.port")}
                    type="number"
                    placeholder={remoteType === "sftp" ? "22" : "21"}
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

          {remoteType === "smb" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Desktop size={18} weight="duotone" className="text-accent-amber" />
                {t("add.section.smb")}
              </h2>
              <div className="space-y-4">
                <Input
                  label={t("shared.label.hostIp")}
                  placeholder={t("shared.placeholder.host")}
                  value={host}
                  onChange={(e) => { setHost(e.target.value); setTestResult(null); }}
                />
                <Input
                  label={t("shared.label.tailscaleIp")}
                  placeholder="100.x.x.x"
                  value={tailscaleIp}
                  onChange={(e) => setTailscaleIp(e.target.value)}
                />
              </div>
            </Card>
          )}

          {remoteType === "s3" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Cloud size={18} weight="duotone" className="text-accent-green" />
                {t("add.section.s3")}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-text-secondary mb-2">
                    {t("shared.label.provider")}
                  </label>
                  <select
                    value={s3Provider}
                    onChange={(e) => setS3Provider(e.target.value)}
                    className="w-full bg-bg-overlay border border-border-default rounded-lg px-3 py-2 text-[13px] text-text-primary focus:outline-none focus:border-accent-blue/60"
                  >
                    {S3_PROVIDERS.map((p) => (
                      <option key={p.value} value={p.value}>{t(p.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t("shared.label.accessKeyId")}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    value={s3AccessKey}
                    onChange={(e) => setS3AccessKey(e.target.value)}
                  />
                  <Input
                    label={t("shared.label.secretAccessKey")}
                    type="password"
                    placeholder="••••••••"
                    value={s3SecretKey}
                    onChange={(e) => setS3SecretKey(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label={t("shared.label.region")}
                    placeholder="us-east-1"
                    value={s3Region}
                    onChange={(e) => setS3Region(e.target.value)}
                  />
                  <Input
                    label={t("shared.label.bucket")}
                    placeholder="my-bucket"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                  />
                </div>
                <Input
                  label={t("shared.label.customEndpoint")}
                  placeholder="https://s3.example.com"
                  value={s3Endpoint}
                  onChange={(e) => setS3Endpoint(e.target.value)}
                  hint={t("shared.hint.customEndpoint")}
                />
              </div>
            </Card>
          )}

          {/* Authentication (not S3 — it uses keys above) */}
          {remoteType !== "s3" && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                <Lock size={18} weight="duotone" className="text-accent-amber" />
                {t("add.section.auth")}
              </h2>
              <div className="space-y-4">
                <Input
                  label={t("shared.label.username")}
                  placeholder="admin"
                  icon={User}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <Input
                  label={t("shared.label.password")}
                  type="password"
                  placeholder="••••••••"
                  icon={Lock}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                    <span
                      className={`text-[13px] font-medium ${
                        networkMode === mode.value ? "text-accent-blue" : "text-text-primary"
                      }`}
                    >
                      {t(mode.labelKey)}
                    </span>
                    {networkMode === mode.value && (
                      <Check size={14} weight="bold" className="text-accent-blue" />
                    )}
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
                    <span
                      className={`text-[13px] font-semibold ${
                        speedProfile === profile.value ? "text-accent-green" : "text-text-primary"
                      }`}
                    >
                      {t(profile.labelKey)}
                    </span>
                    {speedProfile === profile.value && (
                      <Check size={14} weight="bold" className="text-accent-green" />
                    )}
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
              disabled={creating}
            >
              {t("shared.action.cancel")}
            </Button>
            <Button
              variant="default"
              size="md"
              className={`gap-2 ${
                testResult === "success"
                  ? "border-accent-green/40 text-accent-green"
                  : testResult === "error"
                  ? "border-accent-red/40 text-accent-red"
                  : ""
              }`}
              onClick={handleTestConnection}
              disabled={testing || creating}
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
              onClick={handleCreate}
              disabled={creating || testing}
            >
              {creating ? (
                <CircleNotch size={16} weight="bold" className="animate-spin" />
              ) : (
                <Check size={16} weight="bold" />
              )}
              {creating ? t("add.creating") : t("add.createMount")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
