import type { ResolutionPreset } from "./types";

export type DeviceCategory = "phone" | "tablet" | "laptop" | "desktop";

export interface DevicePreset extends ResolutionPreset {
  category: DeviceCategory;
  brand: string;
  device: string;
}

/** Device presets grouped by category with real device names. */
export const DEVICE_PRESETS: DevicePreset[] = [
  // ── Phones ──
  { id: "iphone-14-pro-max",   label: "430 × 932",   width: 430,  height: 932,  category: "phone",  brand: "Apple",    device: "iPhone 14 Pro Max",   note: "" },
  { id: "iphone-15-pro",       label: "393 × 852",   width: 393,  height: 852,  category: "phone",  brand: "Apple",    device: "iPhone 15 Pro",       note: "" },
  { id: "iphone-se",           label: "375 × 667",   width: 375,  height: 667,  category: "phone",  brand: "Apple",    device: "iPhone SE",           note: "" },
  { id: "samsung-galaxy-s24",  label: "412 × 915",   width: 412,  height: 915,  category: "phone",  brand: "Samsung",  device: "Galaxy S24",          note: "" },
  { id: "samsung-galaxy-s24u", label: "480 × 1040",  width: 480,  height: 1040, category: "phone",  brand: "Samsung",  device: "Galaxy S24 Ultra",    note: "" },
  { id: "pixel-8",             label: "412 × 915",   width: 412,  height: 915,  category: "phone",  brand: "Google",   device: "Pixel 8",             note: "" },
  { id: "oneplus-12",          label: "412 × 914",   width: 412,  height: 914,  category: "phone",  brand: "OnePlus",  device: "OnePlus 12",          note: "" },
  { id: "xiaomi-14",           label: "393 × 873",   width: 393,  height: 873,  category: "phone",  brand: "Xiaomi",   device: "Xiaomi 14",           note: "" },

  // ── Tablets ──
  { id: "ipad-pro-12.9",       label: "1024 × 1366", width: 1024, height: 1366, category: "tablet", brand: "Apple",    device: "iPad Pro 12.9″",      note: "" },
  { id: "ipad-pro-11",         label: "834 × 1194",  width: 834,  height: 1194, category: "tablet", brand: "Apple",    device: "iPad Pro 11″",        note: "" },
  { id: "ipad-mini",           label: "744 × 1133",  width: 744,  height: 1133, category: "tablet", brand: "Apple",    device: "iPad mini",           note: "" },
  { id: "ipad-air",            label: "820 × 1180",  width: 820,  height: 1180, category: "tablet", brand: "Apple",    device: "iPad Air",            note: "" },
  { id: "samsung-tab-s9",      label: "820 × 1180",  width: 820,  height: 1180, category: "tablet", brand: "Samsung",  device: "Galaxy Tab S9",       note: "" },
  { id: "samsung-tab-s9-ultra", label: "960 × 1384", width: 960,  height: 1384, category: "tablet", brand: "Samsung",  device: "Galaxy Tab S9 Ultra", note: "" },

  // ── Laptops ──
  { id: "macbook-air-13",      label: "1440 × 900",  width: 1440, height: 900,  category: "laptop", brand: "Apple",    device: "MacBook Air 13″",     note: "" },
  { id: "macbook-pro-14",      label: "1512 × 982",  width: 1512, height: 982,  category: "laptop", brand: "Apple",    device: "MacBook Pro 14″",     note: "" },
  { id: "macbook-pro-16",      label: "1728 × 1117", width: 1728, height: 1117, category: "laptop", brand: "Apple",    device: "MacBook Pro 16″",     note: "" },
  { id: "surface-laptop",      label: "1536 × 1024", width: 1536, height: 1024, category: "laptop", brand: "Microsoft", device: "Surface Laptop",      note: "" },
  { id: "thinkpad-x1",         label: "1536 × 1024", width: 1536, height: 1024, category: "laptop", brand: "Lenovo",   device: "ThinkPad X1 Carbon",  note: "" },
  { id: "dell-xps-15",         label: "1920 × 1200", width: 1920, height: 1200, category: "laptop", brand: "Dell",     device: "XPS 15",              note: "" },
  { id: "pixelbook-go",        label: "1536 × 960",  width: 1536, height: 960,  category: "laptop", brand: "Google",   device: "Pixelbook Go",        note: "" },

  // ── Desktop monitors ──
  { id: "1366x768",            label: "1366 × 768",  width: 1366, height: 768,  category: "desktop", brand: "Generic",  device: "HD Monitor",          note: "" },
  { id: "1600x900",            label: "1600 × 900",  width: 1600, height: 900,  category: "desktop", brand: "Generic",  device: "HD+ Monitor",         note: "" },
  { id: "1920x1080",           label: "1920 × 1080", width: 1920, height: 1080, category: "desktop", brand: "Generic",  device: "Full HD Monitor",     note: "" },
  { id: "2560x1440",           label: "2560 × 1440", width: 2560, height: 1440, category: "desktop", brand: "Generic",  device: "QHD Monitor",         note: "" },
  { id: "3840x2160",           label: "3840 × 2160", width: 3840, height: 2160, category: "desktop", brand: "Generic",  device: "4K UHD Monitor",      note: "" },
];

/** Legacy flat list for backward compatibility. */
export const RESOLUTION_PRESETS: ResolutionPreset[] = DEVICE_PRESETS;

/** Group devices by category. */
export function getDevicesByCategory(): { category: DeviceCategory; label: string; devices: DevicePreset[] }[] {
  return [
    { category: "phone",   label: "Phone",   devices: DEVICE_PRESETS.filter((d) => d.category === "phone") },
    { category: "tablet",  label: "Tablet",  devices: DEVICE_PRESETS.filter((d) => d.category === "tablet") },
    { category: "laptop",  label: "Laptop",  devices: DEVICE_PRESETS.filter((d) => d.category === "laptop") },
    { category: "desktop", label: "Desktop", devices: DEVICE_PRESETS.filter((d) => d.category === "desktop") },
  ];
}

/** Tailwind-style breakpoints used by the responsive ruler overlay. */
export const BREAKPOINTS = [
  { name: "sm", px: 640 },
  { name: "md", px: 768 },
  { name: "lg", px: 1024 },
  { name: "xl", px: 1280 },
  { name: "2xl", px: 1536 },
];

/** Zoom bounds for the virtual canvas. */
export const MIN_SCALE = 0.12;
export const MAX_SCALE = 3;

/** Resolve the active display size from settings. */
export function resolveResolution(
  resolutionId: string,
  customWidth: number,
  customHeight: number,
): { width: number; height: number; device?: string; brand?: string } {
  if (resolutionId === "custom") {
    return { width: clampDimension(customWidth), height: clampDimension(customHeight) };
  }
  const preset = DEVICE_PRESETS.find((p) => p.id === resolutionId);
  if (preset) return { width: preset.width, height: preset.height, device: preset.device, brand: preset.brand };
  return { width: 1366, height: 768 };
}

/** Keep custom dimensions inside values a browser can realistically composite. */
export function clampDimension(value: number): number {
  if (!Number.isFinite(value)) return 1366;
  return Math.min(4096, Math.max(320, Math.round(value)));
}
