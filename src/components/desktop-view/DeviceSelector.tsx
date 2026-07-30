import { Monitor, Smartphone, Tablet, MonitorSmartphone } from "lucide-react";
import { getDevicesByCategory, type DeviceCategory } from "@/lib/desktop-view/presets";
import { cn } from "@/lib/utils";

const categoryIcons: Record<DeviceCategory, typeof Monitor> = {
  phone: Smartphone,
  tablet: Tablet,
  laptop: Monitor,
  desktop: MonitorSmartphone,
};

interface DeviceSelectorProps {
  resolutionId: string;
  onSelect: (id: string) => void;
}

export function DeviceSelector({ resolutionId, onSelect }: DeviceSelectorProps) {
  const groups = getDevicesByCategory();

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const Icon = categoryIcons[group.category];
        return (
          <section key={group.category}>
            <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              <Icon aria-hidden className="size-3.5" />
              {group.label}
            </h4>
            <div className="space-y-0.5">
              {group.devices.map((device) => {
                const active = device.id === resolutionId;
                return (
                  <button
                    key={device.id}
                    type="button"
                    onClick={() => onSelect(device.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/80 hover:bg-surface-raised",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="min-w-[4.5rem] text-xs font-medium text-muted-foreground">
                        {device.brand}
                      </span>
                      <span>{device.device}</span>
                    </div>
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      {device.width}×{device.height}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
