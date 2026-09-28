export function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${u[i]}`;
}

export function fmtSpeed(n: number): string {
  return `${fmtBytes(n)}/s`;
}

export function fmtEta(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0 || sec >= 8640000) return "∞";
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

export function fmtRatio(r: number): string {
  return r < 0 ? "—" : r.toFixed(2);
}

export function fmtLimit(bytesPerSec: number): string {
  return bytesPerSec > 0 ? fmtSpeed(bytesPerSec) : "不限";
}

export function fmtDuration(sec?: number): string {
  if (sec === undefined || !Number.isFinite(sec) || sec < 0) return "—";
  if (sec < 60) return `${sec} 秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时 ${Math.floor((sec % 3600) / 60)} 分钟`;
  return `${Math.floor(sec / 86400)} 天 ${Math.floor((sec % 86400) / 3600)} 小时`;
}

export function fmtDate(unix?: number): string {
  if (!unix || unix <= 0) return "—";
  return new Date(unix * 1000).toLocaleString("zh-CN", { hour12: false });
}

export function fmtPct(p: number): string {
  const v = Math.floor(p * 1000) / 10;
  return `${v >= 100 ? 100 : v.toFixed(1)}%`;
}

export function trackerHost(url?: string): string {
  if (!url) return "";
  const m = url.match(/^[a-z]+:\/\/([^:/?#]+)/i);
  return m?.[1] ?? url;
}
