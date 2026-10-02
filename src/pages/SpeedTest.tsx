import { useState } from "react";
import {
  Gauge,
  Play,
  ArrowUp,
  ArrowDown,
  Timer,
  Warning,
  HardDrive,
  GitBranch,
  CloudArrowUp,
  Check,
} from "phosphor-react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { useI18n } from "../lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

interface SpeedTestResult {
  upload_mbps: number;
  download_mbps: number;
  latency_ms: number;
  bottleneck: "network" | "disk" | "rclone";
  network_type: "local" | "tailscale";
}

interface NetworkPathResult {
  is_local: boolean;
  is_vpn: boolean;
  hops: Array<{ ip: string; latency_ms: number }>;
}

export function SpeedTest() {
  const { t } = useI18n();
  const [selectedDrive, setSelectedDrive] = useState("Z");
  const [fileSize, setFileSize] = useState<10 | 100 | 1000>(100);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpeedTestResult | null>(null);

  const [targetIp, setTargetIp] = useState("");
  const [analyzingPath, setAnalyzingPath] = useState(false);
  const [pathResult, setPathResult] = useState<NetworkPathResult | null>(null);

  const [benchmarkingDisk, setBenchmarkingDisk] = useState(false);
  const [diskSpeed, setDiskSpeed] = useState<number | null>(null);

  // Run speed test
  const handleRunSpeedTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await invoke<SpeedTestResult>("run_speed_test", {
        driveLetter: selectedDrive,
        fileSizeMb: fileSize,
      });
      setResult(res);
      toast.success(t("toast.speedTestDone"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.speedTestFailed"));
    } finally {
      setLoading(false);
    }
  };

  // Analyze network path
  const handleAnalyzePath = async () => {
    if (!targetIp.trim()) {
      toast.error(t("toast.targetIpRequired"));
      return;
    }
    setAnalyzingPath(true);
    setPathResult(null);
    try {
      const res = await invoke<NetworkPathResult>("analyze_network_path", {
        targetIp,
      });
      setPathResult(res);
      toast.success(t("toast.pathAnalyzed"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.pathAnalysisFailed"));
    } finally {
      setAnalyzingPath(false);
    }
  };

  // Benchmark local disk
  const handleBenchmarkDisk = async () => {
    setBenchmarkingDisk(true);
    setDiskSpeed(null);
    try {
      const speed = await invoke<number>("test_local_disk_speed");
      setDiskSpeed(speed);
      toast.success(t("toast.diskBenchmarkDone"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.diskBenchmarkFailed"));
    } finally {
      setBenchmarkingDisk(false);
    }
  };

  const getBottleneckColor = (bottleneck: string) => {
    switch (bottleneck) {
      case "network":
        return "text-accent-blue";
      case "disk":
        return "text-accent-amber";
      case "rclone":
        return "text-accent-purple";
      default:
        return "text-text-secondary";
    }
  };

  return (
    <div className="h-full overflow-y-auto content-scroll">
      <div className="px-10 py-8 pb-12 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary tracking-tight mb-2 flex items-center gap-3">
            <Gauge size={28} weight="duotone" className="text-accent-blue" />
            {t("speed.title")}
          </h1>
          <p className="text-[13px] text-text-secondary">
            {t("speed.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          {/* Section A - Test Controls */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Play size={18} weight="duotone" className="text-accent-green" />
              {t("speed.section.run")}
            </h2>
            <div className="space-y-4">
              {/* Drive Letter */}
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-2">
                  {t("speed.label.driveLetter")}
                </label>
                <Input
                  placeholder="Z"
                  maxLength={1}
                  value={selectedDrive}
                  onChange={(e) => setSelectedDrive(e.target.value.toUpperCase())}
                />
              </div>

              {/* File Size */}
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-2">
                  {t("speed.label.fileSize")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 10, labelKey: "speed.size.quickLabel", descKey: "speed.size.quickDesc" },
                    { value: 100, labelKey: "speed.size.recLabel", descKey: "speed.size.recDesc" },
                    { value: 1000, labelKey: "speed.size.thoroughLabel", descKey: "speed.size.thoroughDesc" },
                  ] as const).map((size) => (
                    <button
                      key={size.value}
                      onClick={() => setFileSize(size.value as 10 | 100 | 1000)}
                      className={`
                        p-3 rounded-lg border transition-all duration-150 text-left
                        ${
                          fileSize === size.value
                            ? "bg-accent-green/10 border-accent-green/40 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
                            : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05]"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[13px] font-medium ${
                            fileSize === size.value
                              ? "text-accent-green"
                              : "text-text-primary"
                          }`}
                        >
                          {t(size.labelKey)}
                        </span>
                        {fileSize === size.value && (
                          <Check size={14} weight="bold" className="text-accent-green" />
                        )}
                      </div>
                      <span className="text-[11px] text-text-tertiary">
                        {t(size.descKey)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Run Button */}
              <Button
                variant="primary"
                size="md"
                onClick={handleRunSpeedTest}
                disabled={loading || !selectedDrive}
                className="gap-2 w-full"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t("speed.btn.running")}
                  </>
                ) : (
                  <>
                    <Play size={16} weight="bold" />
                    {t("speed.section.run")}
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Section B - Results */}
          {result && (
            <Card className="p-6">
              <h2 className="text-base font-semibold text-text-primary mb-5 flex items-center gap-2">
                <Gauge size={18} weight="duotone" className="text-accent-blue" />
                {t("speed.results.title")}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {/* Upload Speed */}
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUp size={16} className="text-accent-green" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      {t("speed.results.upload")}
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {result.upload_mbps.toFixed(1)}
                    <span className="text-base text-text-tertiary ml-1">{t("speed.results.unitMbs")}</span>
                  </div>
                </div>

                {/* Download Speed */}
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDown size={16} className="text-accent-blue" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      {t("speed.results.download")}
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {result.download_mbps.toFixed(1)}
                    <span className="text-base text-text-tertiary ml-1">{t("speed.results.unitMbs")}</span>
                  </div>
                </div>

                {/* Latency */}
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <Timer size={16} className="text-accent-amber" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      {t("speed.results.latency")}
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {result.latency_ms}
                    <span className="text-base text-text-tertiary ml-1">{t("speed.results.unitMs")}</span>
                  </div>
                </div>

                {/* Bottleneck */}
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <Warning size={16} className="text-accent-red" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      {t("speed.results.bottleneck")}
                    </span>
                  </div>
                  <div className={`text-lg font-semibold capitalize ${getBottleneckColor(result.bottleneck)}`}>
                    {result.bottleneck}
                  </div>
                </div>
              </div>

              {/* Network Type Badge */}
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <Badge variant={result.network_type === "local" ? "local" : "tailscale"}>
                  {result.network_type === "local"
                    ? t("speed.badge.local")
                    : t("speed.badge.tailscale")}
                </Badge>
              </div>
            </Card>
          )}

          {/* Section C - Network Path Analysis */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <GitBranch size={18} weight="duotone" className="text-accent-purple" />
              {t("speed.path.title")}
            </h2>
            <div className="space-y-4">
              <Input
                label={t("speed.path.label")}
                placeholder="192.168.x.x"
                value={targetIp}
                onChange={(e) => setTargetIp(e.target.value)}
              />
              <Button
                variant="default"
                size="md"
                onClick={handleAnalyzePath}
                disabled={analyzingPath || !targetIp.trim()}
                className="gap-2"
              >
                {analyzingPath ? (
                  <>
                    <div className="w-4 h-4 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                    {t("speed.path.analyzing")}
                  </>
                ) : (
                  <>
                    <GitBranch size={16} weight="bold" />
                    {t("speed.path.btn")}
                  </>
                )}
              </Button>

              {pathResult && (
                <div className="pt-2">
                  <div className="flex items-center gap-2 mb-3">
                    {pathResult.is_local && <Badge variant="local">{t("speed.path.badgeLocal")}</Badge>}
                    {pathResult.is_vpn && <Badge variant="tailscale">{t("speed.path.badgeVpn")}</Badge>}
                  </div>
                  {pathResult.hops.length > 0 && (
                    <div>
                      <div className="text-[13px] font-medium text-text-secondary mb-2">
                        {t("speed.path.hops")}
                      </div>
                      <div className="space-y-2">
                        {pathResult.hops.map((hop, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                          >
                            <span className="text-[13px] text-text-primary font-mono">
                              {hop.ip}
                            </span>
                            <span className="text-[13px] text-text-tertiary">
                              {hop.latency_ms}
                              {t("speed.results.unitMs")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Section D - Local Disk Benchmark */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
              <HardDrive size={18} weight="duotone" className="text-accent-amber" />
              {t("speed.disk.title")}
            </h2>
            <div className="space-y-4">
              <p className="text-[13px] text-text-secondary">
                {t("speed.disk.intro")}
              </p>
              <Button
                variant="default"
                size="md"
                onClick={handleBenchmarkDisk}
                disabled={benchmarkingDisk}
                className="gap-2"
              >
                {benchmarkingDisk ? (
                  <>
                    <div className="w-4 h-4 border-2 border-text-primary/30 border-t-text-primary rounded-full animate-spin" />
                    {t("speed.disk.benchmarking")}
                  </>
                ) : (
                  <>
                    <CloudArrowUp size={16} weight="bold" />
                    {t("speed.disk.btn")}
                  </>
                )}
              </Button>

              {diskSpeed !== null && (
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive size={16} className="text-accent-amber" weight="bold" />
                    <span className="text-[13px] font-medium text-text-secondary">
                      {t("speed.disk.speed")}
                    </span>
                  </div>
                  <div className="text-2xl font-semibold text-text-primary">
                    {diskSpeed.toFixed(1)}
                    <span className="text-base text-text-tertiary ml-1">{t("speed.results.unitMbs")}</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
