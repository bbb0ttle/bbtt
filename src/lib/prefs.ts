import { usePersistentState } from "@/hooks/use-persistent-state";

export interface PlayerPrefs {
  maxBitrate: number;
  subtitleSize: "sm" | "md" | "lg" | "xl";
  subtitleBackground: boolean;
  volume: number;
  muted: boolean;
}

export const defaultPlayerPrefs: PlayerPrefs = {
  maxBitrate: 120_000_000,
  subtitleSize: "md",
  subtitleBackground: false,
  volume: 1,
  muted: false,
};

export const usePlayerPrefs = () => usePersistentState<PlayerPrefs>("player", defaultPlayerPrefs);

export const BITRATES: { value: number; label: string }[] = [
  { value: 120_000_000, label: "原画（自动）" },
  { value: 60_000_000, label: "60 Mbps" },
  { value: 40_000_000, label: "40 Mbps" },
  { value: 20_000_000, label: "20 Mbps · 1080p" },
  { value: 10_000_000, label: "10 Mbps · 1080p" },
  { value: 8_000_000, label: "8 Mbps · 720p" },
  { value: 4_000_000, label: "4 Mbps · 720p" },
  { value: 2_000_000, label: "2 Mbps · 480p" },
  { value: 1_000_000, label: "1 Mbps · 360p" },
];
