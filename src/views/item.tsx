import { useMemo, useState } from "react";
import {
  CheckIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FilmIcon,
  HeartIcon,
  MoreHorizontalIcon,
  PlayIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  StarIcon,
  UserIcon,
  VideoIcon,
} from "lucide-react";
import type { Item } from "@/api";
import * as api from "@/api";
import { PageHeader } from "@/components/layout/page-header";
import { Img } from "@/components/media/image";
import { Shelf, Grid } from "@/components/media/shelf";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAsync } from "@/hooks/use-async";
import { href, navigate } from "@/lib/router";
import { run } from "@/lib/run";
import { fmtBytes } from "@/lib/format";
import {
  TICKS,
  backdropImage,
  episodeLabel,
  fmtRuntime,
  isPlayable,
  langName,
  logoImage,
  personImage,
  personRole,
  primaryImage,
  progressPct,
  remaining,
  thumbImage,
  typeLabel,
} from "@/lib/jf";
import { cn } from "@/lib/utils";

export function ItemView({ id, query }: { id: string; query: URLSearchParams }) {
  const { data: it, setData, reload } = useAsync(() => api.item(id), [id]);

  return (
    <>
      <PageHeader transparent />
      {it && <Detail it={it} setIt={setData} reload={reload} query={query} />}
    </>
  );
}

function endsAt(it: Item) {
  const left = (it.RunTimeTicks ?? 0) - (it.UserData?.PlaybackPositionTicks ?? 0);
  if (left <= 0) return "";
  const d = new Date(Date.now() + left / 10_000);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")} 结束`;
}

function Detail({ it, setIt, reload, query }: { it: Item; setIt: (i: Item) => void; reload: () => void; query: URLSearchParams }) {
  const s = api.getSession();
  const playable = isPlayable(it);
  const isFolderish = ["Series", "Season", "BoxSet", "Playlist", "MusicAlbum", "MusicArtist", "Folder", "Person", "Genre", "Studio"].includes(it.Type ?? "");
  const backdrop = backdropImage(it, { width: 1920, quality: 80 });
  const logo = logoImage(it, { width: 800 });
  const poster = primaryImage(it, { width: 400 });
  const landscapePoster = it.Type === "Episode";
  const pos = it.UserData?.PlaybackPositionTicks ?? 0;
  const pct = progressPct(it);

  const sources = it.MediaSources ?? [];
  const [ms, setMs] = useState(sources[0]?.Id ?? "");
  const source = sources.find((x) => x.Id === ms) ?? sources[0];
  const streams = source?.MediaStreams ?? it.MediaStreams ?? [];
  const audios = streams.filter((x) => x.Type === "Audio");
  const subs = streams.filter((x) => x.Type === "Subtitle");
  const video = streams.find((x) => x.Type === "Video");
  const [audio, setAudio] = useState(String(source?.DefaultAudioStreamIndex ?? audios[0]?.Index ?? ""));
  const [sub, setSub] = useState(String(source?.DefaultSubtitleStreamIndex ?? -1));

  const play = (fromStart: boolean) =>
    navigate(`play/${it.Id}`, {
      t: fromStart ? 0 : pos || undefined,
      ms: sources.length > 1 ? ms : undefined,
      a: audio || undefined,
      s: sub,
    });

  const toggleFav = async () => {
    const on = !it.UserData?.IsFavorite;
    setIt({ ...it, UserData: { ...it.UserData!, IsFavorite: on } });
    const r = await run(() => api.setFavorite(it.Id!, on));
    if (!r) setIt({ ...it });
  };

  const togglePlayed = async () => {
    const on = !it.UserData?.Played;
    setIt({ ...it, UserData: { ...it.UserData!, Played: on } });
    const r = await run(() => api.setPlayed(it.Id!, on));
    if (r) setIt({ ...it, UserData: r });
    else setIt({ ...it });
  };

  const meta = [
    it.Type === "Episode" ? episodeLabel(it) : null,
    it.ProductionYear,
    it.OfficialRating,
    fmtRuntime(it.RunTimeTicks),
    playable && pos ? remaining(it) : null,
    playable && it.RunTimeTicks ? endsAt(it) : null,
  ].filter(Boolean);

  const directors = it.People?.filter((p) => p.Type === "Director") ?? [];
  const writers = it.People?.filter((p) => p.Type === "Writer") ?? [];
  const cast = it.People?.filter((p) => p.Type !== "Director" && p.Type !== "Writer") ?? [];

  return (
    <div className="-mt-14">
      <div className="relative isolate overflow-hidden">
        {backdrop && (
          <div className="absolute inset-0 -z-10">
            <Img src={backdrop} className="size-full" eager />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/75 to-background/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
          </div>
        )}
        <div className={cn("flex flex-col gap-6 px-4 pb-8 md:flex-row md:items-end md:gap-8 md:px-8", backdrop ? "pt-[min(38vh,320px)]" : "pt-24")}>
          {poster && (
            <div
              className={cn(
                "shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl max-md:hidden",
                landscapePoster ? "aspect-video w-[340px]" : it.Type === "MusicAlbum" || it.Type === "Person" && false ? "aspect-square w-[240px]" : "aspect-[2/3] w-[220px]",
              )}
            >
              <Img src={landscapePoster ? thumbImage(it, { width: 680 }) : poster} className="size-full" eager fallback={it.Type === "Person" ? UserIcon : FilmIcon} />
            </div>
          )}
          <div className="min-w-0 flex-1 animate-in duration-300 fade-in-0 slide-in-from-bottom-1">
            {it.Type === "Episode" && it.SeriesId && (
              <a href={href(`item/${it.SeriesId}`)} className="mb-1 inline-block text-sm font-medium text-muted-foreground hover:text-foreground">
                {it.SeriesName}
                {it.SeasonName ? ` · ${it.SeasonName}` : ""}
              </a>
            )}
            {it.Type === "Season" && it.SeriesId && (
              <a href={href(`item/${it.SeriesId}`)} className="mb-1 inline-block text-sm font-medium text-muted-foreground hover:text-foreground">
                {it.SeriesName}
              </a>
            )}
            {logo && it.Type !== "Episode" ? (
              <img src={logo} alt={it.Name ?? ""} className="mb-4 max-h-28 max-w-[min(420px,80%)] object-contain object-left" />
            ) : (
              <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">{it.Name}</h1>
            )}
            {it.OriginalTitle && it.OriginalTitle !== it.Name && <p className="mt-1 text-sm text-muted-foreground">{it.OriginalTitle}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground tnum">
              {typeLabel[it.Type ?? ""] && !playable && <span>{typeLabel[it.Type ?? ""]}</span>}
              {meta.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
              {it.CommunityRating ? (
                <span className="flex items-center gap-1">
                  <StarIcon className="size-3.5 fill-warning text-warning" />
                  {it.CommunityRating.toFixed(1)}
                </span>
              ) : null}
              {it.CriticRating ? <span>🍅 {it.CriticRating}%</span> : null}
            </div>
            {(it.Genres?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {it.GenreItems?.map((g) => (
                  <Badge key={g.Id} variant="secondary" className="font-normal">
                    {g.Name}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {(playable || it.Type === "Series" || it.Type === "Season" || it.Type === "BoxSet" || it.Type === "MusicAlbum" || it.Type === "Playlist") && (
                <Button size="lg" className="h-10 gap-2 px-5 active:scale-[0.97]" onClick={() => (playable ? play(false) : playFolder(it))}>
                  <PlayIcon className="fill-current" />
                  {playable && pos ? "继续播放" : "播放"}
                </Button>
              )}
              {playable && pos > 0 && (
                <Button variant="secondary" size="lg" className="h-10 gap-2 active:scale-[0.97]" onClick={() => play(true)}>
                  <RotateCcwIcon />
                  从头播放
                </Button>
              )}
              {(it.LocalTrailerCount ?? 0) > 0 && <TrailerButton id={it.Id!} />}
              {(it.LocalTrailerCount ?? 0) === 0 && it.RemoteTrailers?.[0]?.Url && (
                <Button variant="secondary" size="lg" className="h-10 gap-2" asChild>
                  <a href={it.RemoteTrailers[0].Url} target="_blank" rel="noreferrer">
                    <VideoIcon />
                    预告片
                  </a>
                </Button>
              )}
              {it.Type !== "Person" && (
                <IconAction label={it.UserData?.Played ? "标记为未看" : "标记为已看"} active={!!it.UserData?.Played} onClick={togglePlayed}>
                  <CheckIcon />
                </IconAction>
              )}
              <IconAction label={it.UserData?.IsFavorite ? "取消收藏" : "收藏"} active={!!it.UserData?.IsFavorite} onClick={toggleFav}>
                <HeartIcon className={cn(it.UserData?.IsFavorite && "fill-current")} />
              </IconAction>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="icon-lg" className="size-10 rounded-full" aria-label="更多">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  {it.CanDownload && (
                    <DropdownMenuItem asChild>
                      <a href={api.downloadUrl(it.Id!)} download>
                        <DownloadIcon /> 下载
                      </a>
                    </DropdownMenuItem>
                  )}
                  {s?.isAdmin && (
                    <DropdownMenuItem onSelect={() => run(() => api.refreshItem(it.Id!), "已提交元数据刷新任务").then(() => setTimeout(reload, 3000))}>
                      <RefreshCwIcon /> 刷新元数据
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href={`/web/#/details?id=${it.Id}`} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon /> 在经典界面中打开
                    </a>
                  </DropdownMenuItem>
                  {s?.isAdmin && (
                    <DropdownMenuItem asChild>
                      <a href={`/web/#/details?id=${it.Id}&edit=1`} target="_blank" rel="noreferrer">
                        <ExternalLinkIcon /> 编辑元数据、图像与字幕
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {playable && pos > 0 && pct > 0 && (
              <div className="mt-3 h-1 w-full max-w-sm overflow-hidden rounded-full bg-foreground/15">
                <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-9 pb-12">
        <div className="grid gap-8 px-4 md:px-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {it.Taglines?.[0] && <p className="mb-2 text-[15px] font-medium">{it.Taglines[0]}</p>}
            {it.Overview && <Overview text={it.Overview} />}
            {playable && streams.length > 0 && (
              <div className="mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
                {sources.length > 1 && (
                  <Picker label="版本" value={ms} onChange={setMs} options={sources.map((x) => ({ value: x.Id!, label: x.Name ?? x.Id! }))} />
                )}
                {audios.length > 0 && (
                  <Picker
                    label="音轨"
                    value={audio}
                    onChange={setAudio}
                    options={audios.map((a) => ({ value: String(a.Index), label: a.DisplayTitle ?? langName(a.Language) ?? `音轨 ${a.Index}` }))}
                  />
                )}
                <Picker
                  label="字幕"
                  value={sub}
                  onChange={setSub}
                  options={[
                    { value: "-1", label: "关闭" },
                    ...subs.map((x) => ({ value: String(x.Index), label: `${x.DisplayTitle ?? langName(x.Language) ?? `字幕 ${x.Index}`}${x.IsExternal ? " · 外挂" : ""}` })),
                  ]}
                />
              </div>
            )}
          </div>
          <dl className="grid content-start gap-3 text-sm">
            <Fact label="导演" people={directors} />
            <Fact label="编剧" people={writers} />
            {(it.Studios?.length ?? 0) > 0 && <Row label="出品">{it.Studios!.map((x) => x.Name).join("、")}</Row>}
            {it.PremiereDate && <Row label="首映">{new Date(it.PremiereDate).toLocaleDateString("zh-CN")}</Row>}
            {video && (
              <Row label="视频">
                {[video.DisplayTitle, video.Codec?.toUpperCase(), video.Width && `${video.Width}×${video.Height}`, video.VideoRange].filter(Boolean).join(" · ")}
              </Row>
            )}
            {source?.Container && (
              <Row label="文件">
                {[source.Container.toUpperCase(), source.Size ? fmtBytes(source.Size) : null, source.Bitrate ? `${(source.Bitrate / 1e6).toFixed(1)} Mbps` : null].filter(Boolean).join(" · ")}
              </Row>
            )}
            {s?.isAdmin && it.Path && (
              <Row label="路径">
                <span className="break-all font-mono text-xs">{it.Path}</span>
              </Row>
            )}
            {(it.ExternalUrls?.length ?? 0) > 0 && (
              <Row label="链接">
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {it.ExternalUrls!.map((u) => (
                    <a key={u.Url} href={u.Url ?? "#"} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                      {u.Name}
                    </a>
                  ))}
                </span>
              </Row>
            )}
          </dl>
        </div>

        {it.Type === "Series" && <SeriesBody it={it} initialSeason={query.get("season")} />}
        {it.Type === "Season" && it.SeriesId && <EpisodeList seriesId={it.SeriesId} seasonId={it.Id!} />}
        {it.Type === "Person" && <PersonBody it={it} />}
        {isFolderish && !["Series", "Season", "Person"].includes(it.Type ?? "") && <Children it={it} />}

        {it.Type === "Episode" && it.SeriesId && it.SeasonId && (
          <section className="px-4 md:px-8">
            <h2 className="mb-3 text-[15px] font-semibold tracking-tight">{it.SeasonName ?? "本季"}</h2>
            <EpisodeList seriesId={it.SeriesId} seasonId={it.SeasonId} currentId={it.Id} bare />
          </section>
        )}

        {(it.Chapters?.length ?? 0) > 1 && playable && <Chapters it={it} />}

        {cast.length > 0 && <Cast people={cast} />}
        {playable && it.Type !== "Episode" && <Extras id={it.Id!} />}
        {!["Person", "Episode", "Season"].includes(it.Type ?? "") && <Similar id={it.Id!} />}
      </div>
    </div>
  );
}

async function playFolder(it: Item) {
  let target: Item | undefined;
  if (it.Type === "Series") {
    target = (await api.nextUp(1, it.Id!).catch(() => undefined))?.Items?.[0];
    if (!target) target = (await api.episodes(it.Id!, undefined, undefined, 1).catch(() => undefined))?.Items?.[0];
  } else if (it.Type === "Season" && it.SeriesId) {
    const eps = (await api.episodes(it.SeriesId, it.Id!).catch(() => undefined))?.Items ?? [];
    target = eps.find((e) => !e.UserData?.Played) ?? eps[0];
  } else {
    target = (await api.items({ parentId: it.Id!, limit: 1, recursive: true, mediaTypes: "Video,Audio", sortBy: "SortName" }).catch(() => undefined))?.Items?.[0];
  }
  if (target?.Id) navigate(`play/${target.Id}`, { t: target.UserData?.PlaybackPositionTicks || undefined });
}

function IconAction({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="icon-lg"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn("size-10 rounded-full transition-[background-color,color,transform] duration-150 active:scale-[0.94]", active && "bg-foreground text-background hover:bg-foreground/90")}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function TrailerButton({ id }: { id: string }) {
  const { data } = useAsync(() => api.localTrailers(id), [id]);
  if (!data?.[0]?.Id) return null;
  return (
    <Button variant="secondary" size="lg" className="h-10 gap-2" onClick={() => navigate(`play/${data[0].Id}`)}>
      <VideoIcon />
      预告片
    </Button>
  );
}

function Overview({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 280;
  return (
    <div className="max-w-3xl">
      <p className={cn("text-[15px] leading-7 text-foreground/85", !open && long && "line-clamp-4")}>{text}</p>
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          {open ? "收起" : "展开"}
        </button>
      )}
    </div>
  );
}

function Picker({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Fact({ label, people }: { label: string; people: NonNullable<Item["People"]> }) {
  if (!people.length) return null;
  return (
    <Row label={label}>
      {people.map((p, i) => (
        <span key={p.Id}>
          {i > 0 && "、"}
          <a href={href(`item/${p.Id}`)} className="underline-offset-4 hover:underline">
            {p.Name}
          </a>
        </span>
      ))}
    </Row>
  );
}

function Cast({ people }: { people: NonNullable<Item["People"]> }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 px-4 text-[15px] font-semibold tracking-tight md:px-8">演职人员</h2>
      <div className="flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden">
        {people.slice(0, 40).map((p) => (
          <a key={`${p.Id}:${p.Role}`} href={href(`item/${p.Id}`)} className="group/p w-24 shrink-0 text-center">
            <div className="mx-auto size-24 overflow-hidden rounded-full border border-border/60 transition-[border-color] duration-200 group-hover/p:border-foreground/30">
              <Img src={personImage(p.Id, p.PrimaryImageTag, { width: 200 })} className="size-full" fallback={UserIcon} />
            </div>
            <div className="mt-2 truncate text-[13px] font-medium">{p.Name}</div>
            <div className="truncate text-xs text-muted-foreground">{p.Role || personRole[p.Type ?? ""] || ""}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Chapters({ it }: { it: Item }) {
  return (
    <section className="min-w-0">
      <h2 className="mb-3 px-4 text-[15px] font-semibold tracking-tight md:px-8">章节</h2>
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:px-8 [&::-webkit-scrollbar]:hidden">
        {it.Chapters!.map((c, i) => (
          <a key={i} href={href(`play/${it.Id}`, { t: c.StartPositionTicks ?? 0 })} className="group/c w-52 shrink-0">
            <div className="aspect-video overflow-hidden rounded-lg border border-border/60 transition-[border-color] duration-200 group-hover/c:border-foreground/30">
              <Img src={c.ImageTag ? `/Items/${it.Id}/Images/Chapter/${i}?tag=${c.ImageTag}&fillWidth=416&quality=80` : null} className="size-full" fallback={FilmIcon} />
            </div>
            <div className="mt-2 truncate text-[13px] font-medium">{c.Name || `章节 ${i + 1}`}</div>
            <div className="text-xs text-muted-foreground tnum">{fmtTicks(c.StartPositionTicks ?? 0)}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

function fmtTicks(t: number) {
  const s = Math.floor(t / TICKS);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

function SeriesBody({ it, initialSeason }: { it: Item; initialSeason: string | null }) {
  const seasons = useAsync(() => api.seasons(it.Id!).then((r) => r.Items ?? []), [it.Id]);
  const next = useAsync(() => api.nextUp(1, it.Id!).then((r) => r.Items ?? []), [it.Id]);
  const [picked, setPicked] = useState<string | null>(initialSeason);
  const list = seasons.data ?? [];
  const current = list.find((x) => x.Id === picked) ?? list.find((x) => !x.UserData?.Played && (x.IndexNumber ?? 0) > 0) ?? list[0];

  return (
    <>
      {(next.data?.length ?? 0) > 0 && <Shelf title="接下来" items={next.data} shape="landscape" />}
      {list.length > 0 && current && (
        <section className="px-4 md:px-8">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight">季</h2>
            <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {list.map((x) => (
                <button
                  key={x.Id}
                  type="button"
                  onClick={() => {
                    setPicked(x.Id!);
                    navigate(`item/${it.Id}`, { season: x.Id }, true);
                  }}
                  className={cn(
                    "h-8 shrink-0 rounded-md px-3 text-sm whitespace-nowrap transition-colors duration-150",
                    x.Id === current.Id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {x.Name}
                </button>
              ))}
            </div>
            <a href={href(`item/${current.Id}`)} className="ml-auto shrink-0 text-sm text-muted-foreground hover:text-foreground">
              季详情
            </a>
          </div>
          <EpisodeList key={current.Id} seriesId={it.Id!} seasonId={current.Id!} bare />
        </section>
      )}
    </>
  );
}

function EpisodeList({ seriesId, seasonId, currentId, bare }: { seriesId: string; seasonId: string; currentId?: string; bare?: boolean }) {
  const { data, setData } = useAsync(() => api.episodes(seriesId, seasonId).then((r) => r.Items ?? []), [seriesId, seasonId]);
  const eps = data ?? [];
  const markPlayed = async (e: Item) => {
    const on = !e.UserData?.Played;
    const r = await run(() => api.setPlayed(e.Id!, on));
    if (r) setData(eps.map((x) => (x.Id === e.Id ? { ...x, UserData: r } : x)));
  };
  const body = (
    <ol className="flex flex-col divide-y divide-border/60 overflow-hidden rounded-xl border">
      {eps.map((e) => {
        const pct = progressPct(e);
        return (
          <li key={e.Id} className={cn("group/e flex gap-4 p-3 transition-colors duration-150 hover:bg-muted/40", e.Id === currentId && "bg-muted/50")}>
            <a href={href(`play/${e.Id}`, { t: e.UserData?.PlaybackPositionTicks || undefined })} className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-md sm:w-48">
              <Img src={thumbImage(e, { width: 400 })} className="size-full" fallback={FilmIcon} />
              <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity duration-150 group-hover/e:opacity-100">
                <PlayIcon className="size-7 fill-white text-white" />
              </div>
              {pct > 0 && pct < 100 && (
                <div className="absolute inset-x-2 bottom-1.5 h-1 overflow-hidden rounded-full bg-white/25">
                  <div className="h-full bg-white" style={{ width: `${pct}%` }} />
                </div>
              )}
            </a>
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-start gap-2">
                <a href={href(`item/${e.Id}`)} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    <span className="mr-2 text-muted-foreground tnum">{e.IndexNumber}</span>
                    {e.Name}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground tnum">
                    {[fmtRuntime(e.RunTimeTicks), e.PremiereDate && new Date(e.PremiereDate).toLocaleDateString("zh-CN")].filter(Boolean).join(" · ")}
                  </div>
                </a>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={e.UserData?.Played ? "标记为未看" : "标记为已看"}
                  onClick={() => markPlayed(e)}
                  className={cn("shrink-0", e.UserData?.Played ? "text-foreground" : "text-muted-foreground/50")}
                >
                  <CheckIcon />
                </Button>
              </div>
              {e.Overview && <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground max-sm:hidden">{e.Overview}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
  return bare ? body : <section className="px-4 md:px-8">{body}</section>;
}

function PersonBody({ it }: { it: Item }) {
  const movies = useAsync(
    () => api.items({ personIds: it.Id!, recursive: true, includeItemTypes: "Movie", sortBy: "ProductionYear,SortName", sortOrder: "Descending" }).then((r) => r.Items ?? []),
    [it.Id],
  );
  const series = useAsync(
    () => api.items({ personIds: it.Id!, recursive: true, includeItemTypes: "Series", sortBy: "ProductionYear,SortName", sortOrder: "Descending" }).then((r) => r.Items ?? []),
    [it.Id],
  );
  return (
    <>
      <Shelf title="电影" items={movies.data} />
      <Shelf title="剧集" items={series.data} />
    </>
  );
}

function Children({ it }: { it: Item }) {
  const { data } = useAsync(
    () =>
      api
        .items({ parentId: it.Id!, sortBy: it.Type === "BoxSet" ? "ProductionYear,SortName" : it.Type === "Playlist" ? undefined : "SortName" })
        .then((r) => r.Items ?? []),
    [it.Id],
  );
  const shape = useMemo(() => (it.Type === "MusicAlbum" || it.Type === "Playlist" ? "square" : "portrait") as "square" | "portrait", [it.Type]);
  if (!data?.length) return null;
  return (
    <section className="px-4 md:px-8">
      <h2 className="mb-3 text-[15px] font-semibold tracking-tight">{it.Type === "BoxSet" ? "合集内容" : "内容"}</h2>
      <Grid items={data} shape={shape} />
    </section>
  );
}

function Extras({ id }: { id: string }) {
  const { data } = useAsync(() => api.specialFeatures(id), [id]);
  return <Shelf title="花絮与附加内容" items={data} shape="landscape" />;
}

function Similar({ id }: { id: string }) {
  const { data } = useAsync(() => api.similar(id).then((r) => r.Items ?? []), [id]);
  return <Shelf title="相似推荐" items={data} />;
}
