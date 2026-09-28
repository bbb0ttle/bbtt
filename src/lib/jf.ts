import type { Item } from "@/api";

export const TICKS = 10_000_000;

export function fmtRuntime(ticks?: number | null) {
  if (!ticks) return "";
  const m = Math.round(ticks / TICKS / 60);
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

export function fmtClock(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function remaining(it: Item) {
  const total = it.RunTimeTicks ?? 0;
  const pos = it.UserData?.PlaybackPositionTicks ?? 0;
  if (!total || !pos) return "";
  const m = Math.max(1, Math.round((total - pos) / TICKS / 60));
  return `剩余 ${m} 分钟`;
}

export function progressPct(it: Item) {
  const p = it.UserData?.PlayedPercentage;
  if (p) return p;
  const total = it.RunTimeTicks ?? 0;
  const pos = it.UserData?.PlaybackPositionTicks ?? 0;
  return total && pos ? (pos / total) * 100 : 0;
}

export type ImgType = "Primary" | "Backdrop" | "Thumb" | "Logo" | "Banner";

interface ImgOpts {
  width?: number;
  height?: number;
  quality?: number;
}

function url(id: string, type: ImgType, tag?: string | null, o: ImgOpts = {}, index = 0) {
  const p = new URLSearchParams();
  if (tag) p.set("tag", tag);
  if (o.width) p.set("fillWidth", String(o.width));
  if (o.height) p.set("fillHeight", String(o.height));
  p.set("quality", String(o.quality ?? 90));
  return `/Items/${id}/Images/${type}${type === "Backdrop" ? `/${index}` : ""}?${p}`;
}

export function primaryImage(it: Item, o?: ImgOpts) {
  if (it.ImageTags?.Primary && it.Id) return url(it.Id, "Primary", it.ImageTags.Primary, o);
  if (it.Type === "Episode" && it.SeriesId && it.SeriesPrimaryImageTag)
    return url(it.SeriesId, "Primary", it.SeriesPrimaryImageTag, o);
  if (it.AlbumId && it.AlbumPrimaryImageTag) return url(it.AlbumId, "Primary", it.AlbumPrimaryImageTag, o);
  if (it.ParentPrimaryImageItemId && it.ParentPrimaryImageTag)
    return url(it.ParentPrimaryImageItemId, "Primary", it.ParentPrimaryImageTag, o);
  return null;
}

export function thumbImage(it: Item, o?: ImgOpts) {
  if (it.Type === "Episode" && it.ImageTags?.Primary && it.Id) return url(it.Id, "Primary", it.ImageTags.Primary, o);
  if (it.ImageTags?.Thumb && it.Id) return url(it.Id, "Thumb", it.ImageTags.Thumb, o);
  if (it.ParentThumbItemId && it.ParentThumbImageTag) return url(it.ParentThumbItemId, "Thumb", it.ParentThumbImageTag, o);
  if (it.SeriesThumbImageTag && it.SeriesId) return url(it.SeriesId, "Thumb", it.SeriesThumbImageTag, o);
  return backdropImage(it, o) ?? primaryImage(it, o);
}

export function backdropImage(it: Item, o?: ImgOpts) {
  if (it.BackdropImageTags?.length && it.Id) return url(it.Id, "Backdrop", it.BackdropImageTags[0], o);
  if (it.ParentBackdropItemId && it.ParentBackdropImageTags?.length)
    return url(it.ParentBackdropItemId, "Backdrop", it.ParentBackdropImageTags[0], o);
  return null;
}

export function logoImage(it: Item, o?: ImgOpts) {
  if (it.ImageTags?.Logo && it.Id) return url(it.Id, "Logo", it.ImageTags.Logo, o);
  if (it.ParentLogoItemId && it.ParentLogoImageTag) return url(it.ParentLogoItemId, "Logo", it.ParentLogoImageTag, o);
  return null;
}

export function personImage(id?: string | null, tag?: string | null, o?: ImgOpts) {
  return id && tag ? url(id, "Primary", tag, o) : null;
}

export function episodeLabel(it: Item) {
  const s = it.ParentIndexNumber;
  const e = it.IndexNumber;
  if (s == null && e == null) return "";
  return `S${s ?? "?"}:E${e ?? "?"}${it.IndexNumberEnd ? `-${it.IndexNumberEnd}` : ""}`;
}

export function subtitleOf(it: Item) {
  switch (it.Type) {
    case "Episode":
      return [it.SeriesName, episodeLabel(it)].filter(Boolean).join(" · ");
    case "Season":
      return it.SeriesName ?? "";
    case "Series": {
      const end = it.EndDate ? new Date(it.EndDate).getFullYear() : it.Status === "Continuing" ? "至今" : "";
      return it.ProductionYear ? `${it.ProductionYear}${end && end !== it.ProductionYear ? ` – ${end}` : ""}` : "";
    }
    case "MusicAlbum":
      return it.AlbumArtist ?? "";
    default:
      return it.ProductionYear ? String(it.ProductionYear) : "";
  }
}

export const isPortrait = (it: Item) =>
  !["Episode", "Video", "MusicVideo", "TvChannel", "Program", "Recording", "Audio", "MusicAlbum", "MusicArtist", "Playlist", "CollectionFolder", "UserView"].includes(
    it.Type ?? "",
  );

export const isPlayable = (it: Item) =>
  ["Movie", "Episode", "Video", "MusicVideo", "Audio", "Trailer", "Recording", "TvChannel"].includes(it.Type ?? "") ||
  (it.MediaType === "Video" && !it.IsFolder);

export const typeLabel: Record<string, string> = {
  Movie: "电影",
  Series: "剧集",
  Season: "季",
  Episode: "单集",
  BoxSet: "合集",
  Person: "人物",
  MusicAlbum: "专辑",
  MusicArtist: "艺术家",
  Audio: "歌曲",
  Playlist: "播放列表",
  Video: "视频",
  MusicVideo: "音乐视频",
  Folder: "文件夹",
  CollectionFolder: "媒体库",
  Trailer: "预告片",
};

export const personRole: Record<string, string> = {
  Actor: "演员",
  Director: "导演",
  Writer: "编剧",
  Producer: "制片",
  GuestStar: "客串",
  Composer: "作曲",
};

export function langName(code?: string | null) {
  if (!code) return "";
  try {
    const n = new Intl.DisplayNames(["zh-CN"], { type: "language" }).of(code.length === 3 ? iso639_2to1[code] ?? code : code);
    return n && n !== code ? n : code;
  } catch {
    return code;
  }
}

const iso639_2to1: Record<string, string> = {
  chi: "zh",
  zho: "zh",
  eng: "en",
  jpn: "ja",
  kor: "ko",
  fre: "fr",
  fra: "fr",
  ger: "de",
  deu: "de",
  spa: "es",
  ita: "it",
  rus: "ru",
  por: "pt",
  tha: "th",
  vie: "vi",
  yue: "yue",
  cmn: "zh",
  ara: "ar",
  hin: "hi",
  dut: "nl",
  nld: "nl",
  swe: "sv",
  nor: "no",
  dan: "da",
  fin: "fi",
  pol: "pl",
  tur: "tr",
  heb: "he",
  ind: "id",
  may: "ms",
  msa: "ms",
  gre: "el",
  ell: "el",
  hun: "hu",
  cze: "cs",
  ces: "cs",
  ukr: "uk",
};
