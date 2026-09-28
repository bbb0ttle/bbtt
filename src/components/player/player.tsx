import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  ArrowLeftIcon,
  CaptionsIcon,
  GaugeIcon,
  MaximizeIcon,
  MinimizeIcon,
  PauseIcon,
  PictureInPicture2Icon,
  PlayIcon,
  RotateCcwIcon,
  RotateCwIcon,
  SkipForwardIcon,
  Volume1Icon,
  Volume2Icon,
  VolumeXIcon,
  AudioLinesIcon,
  LayersIcon,
} from "lucide-react";
import type { Item } from "@/api";
import * as api from "@/api";
import type { MediaSourceInfo, MediaStream } from "@jellyfin/sdk/lib/generated-client/models";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { buildProfile, detectCaps } from "@/lib/profile";
import { TICKS, episodeLabel, fmtClock, langName } from "@/lib/jf";
import { BITRATES, usePlayerPrefs } from "@/lib/prefs";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

type Method = "DirectPlay" | "DirectStream" | "Transcode";

interface Active {
  source: MediaSourceInfo;
  playSessionId: string | null;
  method: Method;
  url: string;
  audio: number | undefined;
  sub: number;
  subUrl: string | null;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const SUB_SIZE = { sm: "1.1rem", md: "1.45rem", lg: "1.8rem", xl: "2.3rem" } as const;

function streamLabel(s: MediaStream) {
  return s.DisplayTitle || langName(s.Language) || `#${s.Index}`;
}

export function Player({ id, query }: { id: string; query: URLSearchParams }) {
  const video = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const hls = useRef<Hls | null>(null);
  const [prefs, setPrefs] = usePlayerPrefs();
  const [item, setItem] = useState<Item | null>(null);
  const [next, setNext] = useState<Item | null>(null);
  const [active, setActive] = useState<Active | null>(null);
  const activeRef = useRef<Active | null>(null);
  activeRef.current = active;
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [full, setFull] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const started = useRef(false);
  const hideTimer = useRef<number | undefined>(undefined);

  const runtime = (item?.RunTimeTicks ?? 0) / TICKS;
  const total = duration && Number.isFinite(duration) ? duration : runtime;

  const body = useCallback((): api.ProgressBody | null => {
    const a = activeRef.current;
    const v = video.current;
    if (!a || !v) return null;
    return {
      ItemId: id,
      MediaSourceId: a.source.Id ?? undefined,
      PlaySessionId: a.playSessionId,
      PositionTicks: Math.floor(v.currentTime * TICKS),
      IsPaused: v.paused,
      IsMuted: v.muted,
      VolumeLevel: Math.round(v.volume * 100),
      AudioStreamIndex: a.audio,
      SubtitleStreamIndex: a.sub,
      PlayMethod: a.method,
      CanSeek: true,
    };
  }, [id]);

  const start = useCallback(
    async (o: { ms?: string; audio?: number; sub?: number; at: number; bitrate?: number }) => {
      const v = video.current;
      if (!v) return;
      const it = item;
      const srcMeta = it?.MediaSources?.find((m) => m.Id === o.ms) ?? it?.MediaSources?.[0];
      const streams = srcMeta?.MediaStreams ?? [];
      const subStream = streams.find((s) => s.Type === "Subtitle" && s.Index === o.sub);
      const burn = !!subStream && !subStream.IsTextSubtitleStream;
      const audios = streams.filter((s) => s.Type === "Audio");
      const nonDefaultAudio = o.audio !== undefined && audios.length > 1 && o.audio !== srcMeta?.DefaultAudioStreamIndex;
      const bitrate = o.bitrate ?? prefs.maxBitrate;

      const prev = activeRef.current;
      if (prev?.method === "Transcode" && prev.playSessionId) api.stopEncoding(prev.playSessionId).catch(() => {});

      setWaiting(true);
      let info: api.PlaybackInfoResponse;
      try {
        info = await api.playbackInfo(id, {
          profile: buildProfile(bitrate, burn),
          mediaSourceId: o.ms,
          audioStreamIndex: o.audio,
          subtitleStreamIndex: burn ? o.sub : undefined,
          maxBitrate: bitrate,
          enableDirectPlay: !burn && !nonDefaultAudio,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "无法获取播放信息");
        return;
      }
      if (info.ErrorCode) {
        toast.error(`服务器拒绝播放：${info.ErrorCode}`);
        return;
      }
      const source = info.MediaSources?.[0];
      if (!source?.Id) {
        toast.error("没有可用的媒体源");
        return;
      }

      let method: Method;
      let url: string;
      if (source.SupportsDirectPlay && !burn && !nonDefaultAudio) {
        method = "DirectPlay";
        url = api.directStreamUrl(id, source.Id, info.PlaySessionId, source.Container);
      } else if (source.TranscodingUrl) {
        method = /[?&]videocodec=copy|VideoCodec=copy/i.test(source.TranscodingUrl) || source.SupportsDirectStream ? "DirectStream" : "Transcode";
        if (!/static=true/i.test(source.TranscodingUrl) && /transcode|master\.m3u8|main\.m3u8/i.test(source.TranscodingUrl)) method = source.SupportsDirectStream ? "DirectStream" : "Transcode";
        url = /api_?key=/i.test(source.TranscodingUrl) ? source.TranscodingUrl : api.withToken(source.TranscodingUrl);
      } else {
        toast.error("该媒体无法在此浏览器播放");
        return;
      }

      const sub = o.sub ?? -1;
      const textSub = !burn && subStream ? api.subtitleUrl(id, source.Id, subStream.Index!) : null;
      const next: Active = { source, playSessionId: info.PlaySessionId ?? null, method, url, audio: o.audio ?? source.DefaultAudioStreamIndex ?? undefined, sub, subUrl: textSub };

      hls.current?.destroy();
      hls.current = null;
      const isHls = /\.m3u8/i.test(url);
      if (isHls && !detectCaps().hlsNative && Hls.isSupported()) {
        const h = new Hls({ startPosition: o.at, maxBufferLength: 30, backBufferLength: 60 });
        h.on(Hls.Events.ERROR, (_e, d) => {
          if (!d.fatal) return;
          if (d.type === Hls.ErrorTypes.MEDIA_ERROR) h.recoverMediaError();
          else toast.error(`播放失败：${d.details}`);
        });
        h.loadSource(url);
        h.attachMedia(v);
        hls.current = h;
      } else {
        v.src = url;
        const seek = () => {
          if (o.at > 0) v.currentTime = o.at;
          v.removeEventListener("loadedmetadata", seek);
        };
        v.addEventListener("loadedmetadata", seek);
      }
      setActive(next);
      v.play().catch(() => setPaused(true));
    },
    [id, item, prefs.maxBitrate],
  );

  useEffect(() => {
    let alive = true;
    api
      .item(id)
      .then((it) => {
        if (!alive) return;
        setItem(it);
        if (it.Type === "Episode" && it.SeriesId)
          api
            .episodes(it.SeriesId, undefined, it.Id!, 2)
            .then((r) => alive && setNext(r.Items?.find((e) => e.Id !== it.Id) ?? null))
            .catch(() => {});
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!item || activeRef.current) return;
    const src = item.MediaSources?.find((m) => m.Id === query.get("ms")) ?? item.MediaSources?.[0];
    const a = query.get("a");
    const s = query.get("s");
    start({
      ms: src?.Id ?? undefined,
      audio: a ? Number(a) : src?.DefaultAudioStreamIndex ?? undefined,
      sub: s !== null ? Number(s) : src?.DefaultSubtitleStreamIndex ?? -1,
      at: Number(query.get("t") ?? 0) / TICKS,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.volume = prefs.volume;
    v.muted = prefs.muted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => {
      const b = body();
      if (b && started.current) api.reportProgress({ ...b, EventName: "TimeUpdate" }).catch(() => {});
    }, 10_000);
    return () => window.clearInterval(t);
  }, [body]);

  useEffect(
    () => () => {
      const b = body();
      const a = activeRef.current;
      if (b && started.current) api.reportStopped(b).catch(() => {});
      if (a?.method === "Transcode" && a.playSessionId) api.stopEncoding(a.playSessionId).catch(() => {});
      hls.current?.destroy();
    },
    [body],
  );

  const exit = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (window.history.length > 1) window.history.back();
    else navigate(`item/${id}`, undefined, true);
  }, [id]);

  const playNext = useCallback(() => {
    if (next?.Id) navigate(`play/${next.Id}`, undefined, true);
  }, [next]);

  const poke = useCallback(() => {
    setChrome(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChrome(false), 2800);
  }, []);

  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekBy = useCallback((d: number) => {
    const v = video.current;
    if (v) v.currentTime = Math.max(0, Math.min((v.duration || Infinity) - 0.5, v.currentTime + d));
  }, []);

  const setVolume = useCallback(
    (vol: number, muted?: boolean) => {
      const v = video.current;
      if (!v) return;
      v.volume = Math.max(0, Math.min(1, vol));
      if (muted !== undefined) v.muted = muted;
      else if (vol > 0) v.muted = false;
      setPrefs((p) => ({ ...p, volume: v.volume, muted: v.muted }));
    },
    [setPrefs],
  );

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else root.current?.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, [role=menu]")) return;
      const v = video.current;
      if (!v) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          toggle();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          seekBy(e.key === "j" ? -30 : -10);
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          seekBy(e.key === "l" ? 30 : 10);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume(v.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume(v.volume - 0.1);
          break;
        case "m":
          setVolume(v.volume, !v.muted);
          break;
        case "f":
          toggleFull();
          break;
        case "n":
          playNext();
          break;
        case "Escape":
          if (!document.fullscreenElement) exit();
          break;
        default:
          return;
      }
      poke();
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [toggle, seekBy, setVolume, toggleFull, playNext, exit, poke]);

  useEffect(() => {
    poke();
    return () => window.clearTimeout(hideTimer.current);
  }, [poke]);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    for (const t of Array.from(v.textTracks)) t.mode = active?.subUrl ? "showing" : "disabled";
  }, [active?.subUrl]);

  const events = {
    onPlay: () => setPaused(false),
    onPlaying: () => {
      setWaiting(false);
      const b = body();
      if (!b) return;
      if (!started.current) {
        started.current = true;
        api.reportStart(b).catch(() => {});
      } else api.reportProgress({ ...b, EventName: "Unpause" }).catch(() => {});
    },
    onPause: () => {
      setPaused(true);
      setChrome(true);
      const b = body();
      if (b && started.current) api.reportProgress({ ...b, EventName: "Pause" }).catch(() => {});
    },
    onWaiting: () => setWaiting(true),
    onCanPlay: () => setWaiting(false),
    onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => setTime(e.currentTarget.currentTime),
    onDurationChange: (e: React.SyntheticEvent<HTMLVideoElement>) => setDuration(e.currentTarget.duration),
    onProgress: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      for (let i = 0; i < v.buffered.length; i++)
        if (v.buffered.start(i) <= v.currentTime && v.buffered.end(i) >= v.currentTime) setBuffered(v.buffered.end(i));
    },
    onVolumeChange: (e: React.SyntheticEvent<HTMLVideoElement>) => setPrefs((p) => ({ ...p, volume: e.currentTarget.volume, muted: e.currentTarget.muted })),
    onRateChange: (e: React.SyntheticEvent<HTMLVideoElement>) => setSpeed(e.currentTarget.playbackRate),
    onEnded: () => {
      const b = body();
      if (b && started.current) api.reportStopped(b).catch(() => {});
      started.current = false;
      if (next) playNext();
      else exit();
    },
    onError: () => {
      const a = activeRef.current;
      if (a?.method === "DirectPlay") {
        start({ ms: a.source.Id ?? undefined, audio: a.audio, sub: a.sub, at: video.current?.currentTime ?? 0, bitrate: Math.min(prefs.maxBitrate, 20_000_000) });
        return;
      }
      toast.error("视频解码失败");
    },
  };

  const restart = (patch: { ms?: string; audio?: number; sub?: number; bitrate?: number }) => {
    const a = activeRef.current;
    if (!a) return;
    const o = { ms: a.source.Id ?? undefined, audio: a.audio, sub: a.sub, at: video.current?.currentTime ?? 0, ...patch };
    const meta = item?.MediaSources?.find((m) => m.Id === o.ms) ?? item?.MediaSources?.[0];
    const subStream = meta?.MediaStreams?.find((s) => s.Type === "Subtitle" && s.Index === o.sub);
    const needsReload =
      patch.ms !== undefined ||
      patch.audio !== undefined ||
      patch.bitrate !== undefined ||
      (subStream && !subStream.IsTextSubtitleStream) ||
      (a.sub >= 0 && !meta?.MediaStreams?.find((s) => s.Index === a.sub)?.IsTextSubtitleStream);
    if (!needsReload && a.source.Id) {
      setActive({ ...a, sub: o.sub ?? -1, subUrl: subStream ? api.subtitleUrl(id, a.source.Id, subStream.Index!) : null });
      return;
    }
    if (patch.bitrate !== undefined) setPrefs((p) => ({ ...p, maxBitrate: patch.bitrate! }));
    start(o);
  };

  const streams = active?.source.MediaStreams ?? item?.MediaSources?.[0]?.MediaStreams ?? [];
  const audios = streams.filter((s) => s.Type === "Audio");
  const subs = streams.filter((s) => s.Type === "Subtitle");
  const sources = item?.MediaSources ?? [];
  const chapters = item?.Chapters ?? [];
  const pct = total ? (time / total) * 100 : 0;
  const bufPct = total ? (buffered / total) * 100 : 0;
  const shown = chrome || paused || menuOpen;
  const title = item?.Type === "Episode" ? item.SeriesName : item?.Name;
  const subtitle = item?.Type === "Episode" ? [episodeLabel(item), item.Name].filter(Boolean).join(" · ") : item?.ProductionYear ? String(item.ProductionYear) : "";
  const VolIcon = prefs.muted || prefs.volume === 0 ? VolumeXIcon : prefs.volume < 0.5 ? Volume1Icon : Volume2Icon;

  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    const t = (x / r.width) * total;
    setHover({ x, t });
    if (commit && video.current) video.current.currentTime = t;
  };

  return (
    <div
      ref={root}
      className={cn("fixed inset-0 z-50 bg-black text-white select-none", !shown && "cursor-none")}
      onPointerMove={poke}
      style={
        {
          "--sub-size": SUB_SIZE[prefs.subtitleSize],
          "--sub-bg": prefs.subtitleBackground ? "rgb(0 0 0 / 0.72)" : "transparent",
        } as React.CSSProperties
      }
    >
      <video
        ref={video}
        className="bbtt-video absolute inset-0 size-full"
        playsInline
        crossOrigin="anonymous"
        onClick={toggle}
        onDoubleClick={toggleFull}
        {...events}
      >
        {active?.subUrl && <track key={active.subUrl} kind="subtitles" src={active.subUrl} default />}
      </video>

      {waiting && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Spinner className="size-9 text-white/80" />
        </div>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-200 ease-out",
          shown ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="pointer-events-auto flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pt-4 pb-10 md:px-6">
          <IconBtn label="返回" onClick={exit}>
            <ArrowLeftIcon />
          </IconBtn>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-tight">{title}</div>
            {subtitle && <div className="truncate text-xs text-white/65">{subtitle}</div>}
          </div>
          {active && (
            <span className="ml-auto rounded-md border border-white/15 px-2 py-0.5 text-[11px] text-white/70">
              {active.method === "DirectPlay" ? "直接播放" : active.method === "DirectStream" ? "直接串流" : "转码"}
            </span>
          )}
        </div>

        <div className="pointer-events-auto bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pt-16 pb-4 md:px-6">
          <div
            className="group/seek relative flex h-5 cursor-pointer touch-none items-center"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              seekFromPointer(e, true);
            }}
            onPointerMove={(e) => seekFromPointer(e, e.buttons === 1)}
            onPointerLeave={() => setHover(null)}
          >
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-[height] duration-150 group-hover/seek:h-1.5">
              <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${bufPct}%` }} />
              <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${pct}%` }} />
              {total > 0 &&
                chapters.slice(1).map((c, i) => (
                  <div key={i} className="absolute inset-y-0 w-0.5 bg-black/60" style={{ left: `${((c.StartPositionTicks ?? 0) / TICKS / total) * 100}%` }} />
                ))}
            </div>
            <div
              className="pointer-events-none absolute size-3 -translate-x-1/2 rounded-full bg-white opacity-0 shadow transition-opacity duration-150 group-hover/seek:opacity-100"
              style={{ left: `${pct}%` }}
            />
            {hover && total > 0 && (
              <div
                className="pointer-events-none absolute bottom-6 -translate-x-1/2 rounded-md bg-black/85 px-2 py-1 text-xs whitespace-nowrap tnum"
                style={{ left: hover.x }}
              >
                {fmtClock(hover.t)}
                {chapterAt(chapters, hover.t) && <span className="ml-1.5 text-white/60">{chapterAt(chapters, hover.t)}</span>}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1">
            <IconBtn label={paused ? "播放" : "暂停"} onClick={toggle}>
              {paused ? <PlayIcon className="fill-current" /> : <PauseIcon className="fill-current" />}
            </IconBtn>
            <IconBtn label="后退 10 秒" onClick={() => seekBy(-10)}>
              <RotateCcwIcon />
            </IconBtn>
            <IconBtn label="前进 10 秒" onClick={() => seekBy(10)}>
              <RotateCwIcon />
            </IconBtn>
            {next && (
              <IconBtn label="下一集" onClick={playNext}>
                <SkipForwardIcon className="fill-current" />
              </IconBtn>
            )}
            <div className="group/vol flex items-center">
              <IconBtn label={prefs.muted ? "取消静音" : "静音"} onClick={() => setVolume(prefs.volume, !prefs.muted)}>
                <VolIcon />
              </IconBtn>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={prefs.muted ? 0 : prefs.volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="音量"
                className="bbtt-range w-0 opacity-0 transition-[width,opacity] duration-200 ease-out group-hover/vol:w-20 group-hover/vol:opacity-100 focus-visible:w-20 focus-visible:opacity-100 max-md:hidden"
              />
            </div>
            <span className="ml-2 text-[13px] text-white/80 tnum">
              {fmtClock(time)} <span className="text-white/45">/ {fmtClock(total)}</span>
            </span>

            <div className="ml-auto flex items-center gap-1">
              {subs.length > 0 && (
                <Menu icon={CaptionsIcon} label="字幕" onOpenChange={setMenuOpen}>
                  <DropdownMenuRadioGroup value={String(active?.sub ?? -1)} onValueChange={(v) => restart({ sub: Number(v) })}>
                    <DropdownMenuRadioItem value="-1">关闭</DropdownMenuRadioItem>
                    {subs.map((s) => (
                      <DropdownMenuRadioItem key={s.Index} value={String(s.Index)}>
                        <span className="truncate">{streamLabel(s)}</span>
                        {!s.IsTextSubtitleStream && <span className="ml-auto pl-2 text-xs text-muted-foreground">图形</span>}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </Menu>
              )}
              {audios.length > 1 && (
                <Menu icon={AudioLinesIcon} label="音轨" onOpenChange={setMenuOpen}>
                  <DropdownMenuRadioGroup value={String(active?.audio ?? "")} onValueChange={(v) => restart({ audio: Number(v) })}>
                    {audios.map((s) => (
                      <DropdownMenuRadioItem key={s.Index} value={String(s.Index)}>
                        <span className="truncate">{streamLabel(s)}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </Menu>
              )}
              {sources.length > 1 && (
                <Menu icon={LayersIcon} label="版本" onOpenChange={setMenuOpen}>
                  <DropdownMenuRadioGroup value={active?.source.Id ?? ""} onValueChange={(v) => restart({ ms: v, audio: undefined, sub: -1 })}>
                    {sources.map((s) => (
                      <DropdownMenuRadioItem key={s.Id} value={s.Id!}>
                        {s.Name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </Menu>
              )}
              <Menu icon={GaugeIcon} label="画质与速度" onOpenChange={setMenuOpen}>
                <DropdownMenuLabel>画质</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={String(prefs.maxBitrate)} onValueChange={(v) => restart({ bitrate: Number(v) })}>
                  {BITRATES.map((b) => (
                    <DropdownMenuRadioItem key={b.value} value={String(b.value)}>
                      {b.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuLabel>播放速度</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={String(speed)}
                  onValueChange={(v) => {
                    if (video.current) video.current.playbackRate = Number(v);
                  }}
                >
                  {SPEEDS.map((s) => (
                    <DropdownMenuRadioItem key={s} value={String(s)}>
                      {s === 1 ? "正常" : `${s}×`}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </Menu>
              {"pictureInPictureEnabled" in document && document.pictureInPictureEnabled && (
                <IconBtn
                  label="画中画"
                  onClick={() => {
                    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
                    else video.current?.requestPictureInPicture().catch(() => {});
                  }}
                >
                  <PictureInPicture2Icon />
                </IconBtn>
              )}
              <IconBtn label={full ? "退出全屏" : "全屏"} onClick={toggleFull}>
                {full ? <MinimizeIcon /> : <MaximizeIcon />}
              </IconBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function chapterAt(chapters: NonNullable<Item["Chapters"]>, t: number) {
  let name = "";
  for (const c of chapters) if ((c.StartPositionTicks ?? 0) / TICKS <= t) name = c.Name ?? "";
  return name;
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-[background-color,transform] duration-150 ease-out hover:bg-white/10 hover:text-white active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none [&_svg]:size-5"
    >
      {children}
    </button>
  );
}

function Menu({
  icon: Icon,
  label,
  children,
  onOpenChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <DropdownMenu modal={false} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-white/90 transition-[background-color,transform] duration-150 ease-out hover:bg-white/10 hover:text-white active:scale-[0.94] data-[state=open]:bg-white/15 [&_svg]:size-5"
        >
          <Icon />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={8} className="dark max-h-[60vh] w-64 overflow-y-auto">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
