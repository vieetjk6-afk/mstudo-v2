import {
  Award,
  BadgeCheck,
  Bot,
  BrainCircuit,
  Building2,
  CloudCog,
  Factory,
  FileLock,
  GraduationCap,
  Handshake,
  HeartPulse,
  MonitorSmartphone,
  Plane,
  ScanSearch,
  Smartphone,
  Store,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { IconKey, IndustryKey } from "@/lib/vieetjk-ai/content";

export const SERVICE_ICONS: Record<IconKey, LucideIcon> = {
  app: Smartphone,
  web: MonitorSmartphone,
  ai: BrainCircuit,
  agent: Bot,
  seo: TrendingUp,
  cloud: CloudCog,
};

export const INDUSTRY_ICONS: Record<IndustryKey, LucideIcon> = {
  retail: Store,
  edu: GraduationCap,
  health: HeartPulse,
  realestate: Building2,
  travel: Plane,
  industry: Factory,
};

/** Biểu tượng cho 6 cam kết (theo đúng thứ tự COMMITMENTS). */
export const COMMIT_ICONS: LucideIcon[] = [ScanSearch, BadgeCheck, Award, FileLock, Wrench, Handshake];

/** Logo Vieetjk Tech — chữ V nối các nút mạng, nền gradient. */
export function VaMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="vaMarkG" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset=".52" stopColor="#6366f1" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#vaMarkG)" />
      <path d="M11 12.5 20 28.5l9-16" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="11" cy="12.5" r="3" fill="#fff" />
      <circle cx="29" cy="12.5" r="3" fill="#fff" />
      <circle cx="20" cy="28.5" r="2.2" fill="#0b1022" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
