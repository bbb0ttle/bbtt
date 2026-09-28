import type {
  AuthenticationResult,
  BaseItemDto,
  BaseItemDtoQueryResult,
  DeviceProfile,
  PlaybackInfoResponse,
  UserDto,
  UserConfiguration,
  UserItemDataDto,
  PublicSystemInfo,
} from "@jellyfin/sdk/lib/generated-client/models";

export type Item = BaseItemDto;
export type User = UserDto;
export type { PlaybackInfoResponse, UserConfiguration, UserItemDataDto };

const CLIENT = "bbtt";
const VERSION = "1.0.0";
const AUTH_KEY = "bbjf:auth";
const DEVICE_KEY = "bbjf:device";

export interface Session {
  token: string;
  userId: string;
  userName: string;
  isAdmin: boolean;
}

export const deviceId = (() => {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
})();

let session: Session | null = (() => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
})();

export const getSession = () => session;

function setSession(s: Session | null) {
  session = s;
  if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s));
  else localStorage.removeItem(AUTH_KEY);
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "macOS";
  if (/Windows/.test(ua)) return "Windows";
  return "Web";
}

function authHeader() {
  const parts = [
    `Client="${CLIENT}"`,
    `Device="${deviceName()}"`,
    `DeviceId="${deviceId}"`,
    `Version="${VERSION}"`,
  ];
  if (session) parts.push(`Token="${session.token}"`);
  return `MediaBrowser ${parts.join(", ")}`;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null | string[]>;

export function qs(q?: Query) {
  if (!q) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

async function req<T>(method: string, path: string, q?: Query, body?: unknown): Promise<T> {
  const r = await fetch(path + qs(q), {
    method,
    headers: {
      Authorization: authHeader(),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (r.status === 401 && session) {
    setSession(null);
    window.dispatchEvent(new Event("jf:unauthorized"));
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new HttpError(r.status, text || `HTTP ${r.status}`);
  }
  if (r.status === 204) return undefined as T;
  const ct = r.headers.get("content-type") ?? "";
  return (ct.includes("json") ? r.json() : r.text()) as Promise<T>;
}

const get = <T>(path: string, q?: Query) => req<T>("GET", path, q);
const post = <T>(path: string, body?: unknown, q?: Query) => req<T>("POST", path, q, body ?? {});
const del = <T>(path: string, q?: Query) => req<T>("DELETE", path, q);

const uid = () => session?.userId ?? "";

export const FIELDS = [
  "PrimaryImageAspectRatio",
  "Overview",
  "Genres",
  "ProductionYear",
  "OfficialRating",
  "CommunityRating",
  "CriticRating",
  "RunTimeTicks",
  "ChildCount",
  "RecursiveItemCount",
  "DateCreated",
  "MediaSourceCount",
].join(",");

export const DETAIL_FIELDS = [
  FIELDS,
  "Taglines",
  "People",
  "Studios",
  "GenreItems",
  "MediaSources",
  "MediaStreams",
  "ExternalUrls",
  "ProviderIds",
  "RemoteTrailers",
  "Chapters",
  "Path",
  "Tags",
  "CanDownload",
  "CanDelete",
  "Trickplay",
].join(",");

/* ─── auth ─── */

export const publicInfo = () => get<PublicSystemInfo>("/System/Info/Public");

export async function login(username: string, password: string) {
  const r = await post<AuthenticationResult>("/Users/AuthenticateByName", { Username: username, Pw: password });
  if (!r.AccessToken || !r.User?.Id) throw new Error("认证响应缺少令牌");
  setSession({
    token: r.AccessToken,
    userId: r.User.Id,
    userName: r.User.Name ?? username,
    isAdmin: !!r.User.Policy?.IsAdministrator,
  });
}

export async function logout() {
  await post("/Sessions/Logout").catch(() => {});
  setSession(null);
}

export const me = () => get<UserDto>("/Users/Me");

export const updateUserConfig = (cfg: UserConfiguration) => post<void>("/Users/Configuration", cfg, { userId: uid() });

export const changePassword = (current: string, next: string) =>
  post<void>("/Users/Password", { CurrentPw: current, NewPw: next }, { userId: uid() });

/* ─── browse ─── */

export const views = () => get<BaseItemDtoQueryResult>("/UserViews", { userId: uid() });

export const resume = (mediaTypes = "Video", limit = 16) =>
  get<BaseItemDtoQueryResult>("/UserItems/Resume", {
    userId: uid(),
    limit,
    mediaTypes,
    fields: FIELDS,
    enableImageTypes: "Primary,Backdrop,Thumb",
    imageTypeLimit: 1,
  });

export const nextUp = (limit = 16, seriesId?: string) =>
  get<BaseItemDtoQueryResult>("/Shows/NextUp", {
    userId: uid(),
    limit,
    seriesId,
    fields: FIELDS,
    enableImageTypes: "Primary,Backdrop,Thumb",
    imageTypeLimit: 1,
    enableResumable: false,
  });

export const latest = (parentId: string, limit = 16) =>
  get<Item[]>("/Items/Latest", { userId: uid(), parentId, limit, fields: FIELDS, groupItems: true });

export interface ItemQuery {
  parentId?: string;
  includeItemTypes?: string;
  recursive?: boolean;
  sortBy?: string;
  sortOrder?: "Ascending" | "Descending";
  filters?: string;
  genreIds?: string;
  personIds?: string;
  years?: string;
  searchTerm?: string;
  isFavorite?: boolean;
  startIndex?: number;
  limit?: number;
  fields?: string;
  ids?: string;
  mediaTypes?: string;
}

export const items = (q: ItemQuery) =>
  get<BaseItemDtoQueryResult>("/Items", {
    userId: uid(),
    fields: FIELDS,
    enableTotalRecordCount: true,
    imageTypeLimit: 1,
    enableImageTypes: "Primary,Backdrop,Thumb,Logo",
    ...q,
  });

export const item = (id: string) => get<Item>(`/Items/${id}`, { userId: uid(), fields: DETAIL_FIELDS });

export const seasons = (seriesId: string) =>
  get<BaseItemDtoQueryResult>(`/Shows/${seriesId}/Seasons`, { userId: uid(), fields: FIELDS });

export const episodes = (seriesId: string, seasonId?: string, startItemId?: string, limit?: number) =>
  get<BaseItemDtoQueryResult>(`/Shows/${seriesId}/Episodes`, {
    userId: uid(),
    seasonId,
    startItemId,
    limit,
    fields: `${FIELDS},MediaSources,MediaStreams`,
    enableImageTypes: "Primary,Thumb",
  });

export const similar = (id: string, limit = 12) =>
  get<BaseItemDtoQueryResult>(`/Items/${id}/Similar`, { userId: uid(), limit, fields: FIELDS });

export const specialFeatures = (id: string) => get<Item[]>(`/Items/${id}/SpecialFeatures`, { userId: uid() });

export const localTrailers = (id: string) => get<Item[]>(`/Items/${id}/LocalTrailers`, { userId: uid() });

export const genres = (parentId?: string, includeItemTypes?: string) =>
  get<BaseItemDtoQueryResult>("/Genres", { userId: uid(), parentId, includeItemTypes, sortBy: "SortName" });

export const years = (parentId?: string, includeItemTypes?: string) =>
  get<BaseItemDtoQueryResult>("/Years", { userId: uid(), parentId, includeItemTypes, recursive: true, sortBy: "SortName", sortOrder: "Descending" });

export const persons = (searchTerm: string, limit = 24) =>
  get<BaseItemDtoQueryResult>("/Persons", { userId: uid(), searchTerm, limit, fields: "PrimaryImageAspectRatio" });

/* ─── user data ─── */

export const setFavorite = (id: string, on: boolean) =>
  (on ? post<UserItemDataDto>(`/UserFavoriteItems/${id}`, undefined, { userId: uid() }) : del<UserItemDataDto>(`/UserFavoriteItems/${id}`, { userId: uid() }));

export const setPlayed = (id: string, on: boolean) =>
  (on ? post<UserItemDataDto>(`/UserPlayedItems/${id}`, undefined, { userId: uid() }) : del<UserItemDataDto>(`/UserPlayedItems/${id}`, { userId: uid() }));

export const refreshItem = (id: string) =>
  post<void>(`/Items/${id}/Refresh`, undefined, {
    metadataRefreshMode: "FullRefresh",
    imageRefreshMode: "FullRefresh",
    replaceAllMetadata: false,
    replaceAllImages: false,
  });

/* ─── playback ─── */

export interface PlaybackOpts {
  mediaSourceId?: string;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  maxBitrate?: number;
  startTimeTicks?: number;
  enableDirectPlay?: boolean;
  profile: DeviceProfile;
}

export const playbackInfo = (id: string, o: PlaybackOpts) =>
  post<PlaybackInfoResponse>(
    `/Items/${id}/PlaybackInfo`,
    {
      UserId: uid(),
      DeviceProfile: o.profile,
      MediaSourceId: o.mediaSourceId,
      AudioStreamIndex: o.audioStreamIndex,
      SubtitleStreamIndex: o.subtitleStreamIndex,
      MaxStreamingBitrate: o.maxBitrate,
      StartTimeTicks: o.startTimeTicks,
      EnableDirectPlay: o.enableDirectPlay ?? true,
      EnableDirectStream: true,
      EnableTranscoding: true,
      AllowVideoStreamCopy: true,
      AllowAudioStreamCopy: true,
      AutoOpenLiveStream: true,
    },
    { userId: uid() },
  );

export interface ProgressBody {
  ItemId: string;
  MediaSourceId?: string;
  PlaySessionId?: string | null;
  PositionTicks: number;
  IsPaused?: boolean;
  IsMuted?: boolean;
  VolumeLevel?: number;
  AudioStreamIndex?: number;
  SubtitleStreamIndex?: number;
  PlayMethod: "DirectPlay" | "DirectStream" | "Transcode";
  CanSeek: boolean;
}

export const reportStart = (b: ProgressBody) => post<void>("/Sessions/Playing", b);
export const reportProgress = (b: ProgressBody & { EventName?: string }) => post<void>("/Sessions/Playing/Progress", b);
export const reportStopped = (b: ProgressBody) => post<void>("/Sessions/Playing/Stopped", b);
export const stopEncoding = (playSessionId: string) =>
  del<void>("/Videos/ActiveEncodings", { deviceId, playSessionId });

export function withToken(url: string) {
  if (!session) return url;
  return url + (url.includes("?") ? "&" : "?") + `ApiKey=${encodeURIComponent(session.token)}`;
}

export const directStreamUrl = (id: string, mediaSourceId: string, playSessionId?: string | null, container?: string | null) =>
  withToken(
    `/Videos/${id}/stream${container ? `.${container}` : ""}` +
      qs({ static: true, mediaSourceId, deviceId, playSessionId: playSessionId ?? undefined }),
  );

export const subtitleUrl = (id: string, mediaSourceId: string, index: number) =>
  withToken(`/Videos/${id}/${mediaSourceId}/Subtitles/${index}/0/Stream.vtt`);

export const downloadUrl = (id: string) => withToken(`/Items/${id}/Download`);
