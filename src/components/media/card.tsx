import { CheckIcon, FilmIcon, FolderIcon, HeartIcon, MusicIcon, PlayIcon, TvIcon, UserIcon } from "lucide-react";
import type { Item } from "@/api";
import { Img } from "@/components/media/image";
import { href, navigate } from "@/lib/router";
import { episodeLabel, isPlayable, primaryImage, progressPct, subtitleOf, thumbImage } from "@/lib/jf";
import { cn } from "@/lib/utils";

export type Shape = "portrait" | "landscape" | "square";

const aspect: Record<Shape, string> = {
  portrait: "aspect-[2/3]",
  landscape: "aspect-video",
  square: "aspect-square",
};

const width: Record<Shape, number> = { portrait: 300, landscape: 480, square: 300 };

function fallbackIcon(it: Item) {
  switch (it.Type) {
    case "Series":
    case "Season":
    case "Episode":
      return TvIcon;
    case "Person":
      return UserIcon;
    case "MusicAlbum":
    case "Audio":
    case "MusicArtist":
      return MusicIcon;
    case "Folder":
    case "CollectionFolder":
    case "UserView":
      return FolderIcon;
    default:
      return FilmIcon;
  }
}

export function itemHref(it: Item) {
  if (it.Type === "CollectionFolder" || it.Type === "UserView") return href(`library/${it.Id}`);
  if (it.Type === "Folder") return href(`library/${it.Id}`);
  return href(`item/${it.Id}`);
}

export function MediaCard({
  item: it,
  shape = "portrait",
  title,
  subtitle,
  className,
}: {
  item: Item;
  shape?: Shape;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  const img = shape === "landscape" ? thumbImage(it, { width: width[shape] }) : primaryImage(it, { width: width[shape] });
  const pct = progressPct(it);
  const played = it.UserData?.Played;
  const unplayed = it.UserData?.UnplayedItemCount;
  const t = title ?? (shape === "landscape" && it.Type === "Episode" ? it.SeriesName ?? it.Name : it.Name) ?? "";
  const sub =
    subtitle ??
    (shape === "landscape" && it.Type === "Episode" ? [episodeLabel(it), it.Name].filter(Boolean).join(" · ") : subtitleOf(it));
  const playable = isPlayable(it);

  return (
    <a href={itemHref(it)} className={cn("group/card block min-w-0 outline-none", className)} draggable={false}>
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border/60 bg-muted/40 shadow-sm transition-[border-color,box-shadow] duration-200 ease-out group-hover/card:border-foreground/25 group-focus-visible/card:ring-2 group-focus-visible/card:ring-ring",
          aspect[shape],
        )}
      >
        <Img src={img} alt={t} className="absolute inset-0 size-full" fallback={fallbackIcon(it)} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity duration-200 ease-out group-hover/card:opacity-100" />
        {playable && (
          <button
            type="button"
            aria-label="播放"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`play/${it.Id}`);
            }}
            className="absolute bottom-2.5 left-2.5 flex size-9 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-md transition-[opacity,transform] duration-200 ease-out group-hover/card:opacity-100 active:scale-[0.94] [@media(hover:none)]:hidden"
          >
            <PlayIcon className="size-4 translate-x-px fill-current" />
          </button>
        )}
        <div className="absolute top-2 right-2 flex gap-1">
          {it.UserData?.IsFavorite && (
            <span className="flex size-6 items-center justify-center rounded-full bg-black/60 backdrop-blur">
              <HeartIcon className="size-3 fill-white text-white" />
            </span>
          )}
          {played ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-white text-black">
              <CheckIcon className="size-3.5" strokeWidth={3} />
            </span>
          ) : unplayed ? (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-semibold text-black tnum">
              {unplayed}
            </span>
          ) : null}
        </div>
        {pct > 0 && pct < 100 && !played && (
          <div className="absolute inset-x-2.5 bottom-2 h-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      <div className="mt-2 min-w-0 px-0.5">
        <div className="truncate text-[13px] font-medium leading-5">{t}</div>
        {sub && <div className="truncate text-xs leading-4 text-muted-foreground">{sub}</div>}
      </div>
    </a>
  );
}
