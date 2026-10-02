import { useEffect, useState } from "react";
import {
  HardDrives,
  Plus,
  Gauge,
  GearSix,
  Export,
  CirclesFour,
  Terminal,
} from "phosphor-react";
import { clsx } from "clsx";
import { invoke } from "@tauri-apps/api/core";
import { useMountSummaryStore } from "../../lib/store";
import { useI18n } from "../../lib/i18n";
import { toast } from "sonner";

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: { id: string; label: string; icon: React.ElementType };
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] font-medium transition-all duration-150 cursor-pointer",
        "outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50",
        isActive
          ? "bg-white/[0.09] text-text-primary shadow-[inset_0_0.5px_0_rgba(255,255,255,0.06)]"
          : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] active:bg-white/[0.07]"
      )}
    >
      <Icon
        size={18}
        weight={isActive ? "fill" : "regular"}
        className={clsx(
          "flex-shrink-0 transition-colors duration-150",
          isActive ? "text-text-primary" : "text-text-tertiary"
        )}
      />
      {item.label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 mb-1.5 mt-4 first:mt-0">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary/70">
        {children}
      </span>
    </div>
  );
}

interface DriverVersions {
  rclone_installed: boolean;
  rclone_version: string | null;
  winfsp_installed: boolean;
  winfsp_version: string | null;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [driverVersions, setDriverVersions] = useState<DriverVersions | null>(null);
  const { mountedCount } = useMountSummaryStore();
  const { t } = useI18n();

  const mainNav = [
    { id: "dashboard", label: t("sidebar.nav.overview"), icon: CirclesFour },
    { id: "add", label: t("sidebar.nav.addConnection"), icon: Plus },
  ];

  const toolsNav = [
    { id: "speedtest", label: t("sidebar.nav.speedTest"), icon: Gauge },
    { id: "export", label: t("sidebar.nav.export"), icon: Export },
    { id: "settings", label: t("sidebar.nav.settings"), icon: GearSix },
  ];

  useEffect(() => {
    loadDriverVersions();
  }, []);

  const loadDriverVersions = async () => {
    try {
      const versions = await invoke<DriverVersions>("get_driver_versions");
      setDriverVersions(versions);
    } catch (err) {
      console.error("Failed to get driver versions:", err);
    }
  };

  const handleOpenWebUI = async () => {
    try {
      await invoke("open_rclone_web_ui");
      toast.success(t("toast.webUiLaunched"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(t("toast.webUiLaunchFailed", { msg }));
    }
  };

  return (
    <div className="w-[220px] h-full bg-bg-base/50 backdrop-blur-2xl border-r border-white/[0.06] flex flex-col select-none">
      {/* App identity */}
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-[8px] bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center shadow-lg shadow-accent-blue/20">
            <HardDrives size={16} weight="bold" className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold text-text-primary leading-tight truncate">
              {t("app.sidebarTitle")}
            </h2>
            <p className="text-[11px] text-text-tertiary leading-tight">
              {t("sidebar.activeCount", { count: mountedCount })}
            </p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-white/[0.06]" />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-2.5 pt-2 pb-3 sidebar-scroll">
        <SectionLabel>{t("sidebar.section.drives")}</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          {mainNav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </nav>

        <SectionLabel>{t("sidebar.section.tools")}</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          {toolsNav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              isActive={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </nav>

        <SectionLabel>{t("sidebar.section.rclone")}</SectionLabel>
        <nav className="flex flex-col gap-0.5">
          <button
            onClick={handleOpenWebUI}
            className={clsx(
              "flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-md text-[13px] font-medium transition-all duration-150 cursor-pointer",
              "outline-none focus-visible:ring-2 focus-visible:ring-accent-blue/50",
              "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] active:bg-white/[0.07]"
            )}
          >
            <Terminal
              size={18}
              weight="regular"
              className="flex-shrink-0 text-text-tertiary transition-colors duration-150"
            />
            {t("sidebar.rcloneWebUi")}
          </button>
        </nav>
      </div>

      {/* Bottom info - Driver Status */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        {driverVersions ? (
          <>
            <div className="flex items-center gap-2">
              <div
                className={clsx(
                  "w-1.5 h-1.5 rounded-full",
                  driverVersions.rclone_installed
                    ? "bg-accent-green shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                    : "bg-accent-red shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                )}
              />
              <span className="text-[11px] text-text-tertiary">
                {driverVersions.rclone_installed
                  ? t("sidebar.drivers.rclone", { version: driverVersions.rclone_version || "installed" })
                  : t("sidebar.drivers.rcloneMissing")}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={clsx(
                  "w-1.5 h-1.5 rounded-full",
                  driverVersions.winfsp_installed
                    ? "bg-accent-green shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                    : "bg-accent-red shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                )}
              />
              <span className="text-[11px] text-text-tertiary">
                {driverVersions.winfsp_installed
                  ? t("sidebar.drivers.winfsp", { version: driverVersions.winfsp_version || "ready" })
                  : t("sidebar.drivers.winfspMissing")}
              </span>
            </div>
          </>
        ) : (
          <span className="text-[11px] text-text-tertiary">{t("sidebar.drivers.checking")}</span>
        )}
      </div>
    </div>
  );
}
