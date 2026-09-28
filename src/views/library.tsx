import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownWideNarrowIcon, ArrowUpNarrowWideIcon, FilterIcon, ShuffleIcon } from "lucide-react";
import type { Item } from "@/api";
import * as api from "@/api";
import { PageHeader } from "@/components/layout/page-header";
import { Grid } from "@/components/media/shelf";
import type { Shape } from "@/components/media/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAsync } from "@/hooks/use-async";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { navigate } from "@/lib/router";

interface Tab {
  id: string;
  label: string;
  types?: string;
  recursive: boolean;
  shape: Shape;
}

function tabsFor(ct?: string | null): Tab[] {
  switch (ct) {
    case "movies":
      return [
        { id: "movies", label: "电影", types: "Movie", recursive: true, shape: "portrait" },
        { id: "collections", label: "合集", types: "BoxSet", recursive: true, shape: "portrait" },
        { id: "folders", label: "文件夹", recursive: false, shape: "portrait" },
      ];
    case "tvshows":
      return [
        { id: "series", label: "剧集", types: "Series", recursive: true, shape: "portrait" },
        { id: "episodes", label: "单集", types: "Episode", recursive: true, shape: "landscape" },
        { id: "folders", label: "文件夹", recursive: false, shape: "portrait" },
      ];
    case "music":
      return [
        { id: "albums", label: "专辑", types: "MusicAlbum", recursive: true, shape: "square" },
        { id: "artists", label: "艺术家", types: "MusicArtist", recursive: true, shape: "square" },
        { id: "songs", label: "歌曲", types: "Audio", recursive: true, shape: "square" },
      ];
    case "boxsets":
      return [{ id: "collections", label: "合集", types: "BoxSet", recursive: false, shape: "portrait" }];
    case "playlists":
      return [{ id: "playlists", label: "播放列表", recursive: false, shape: "square" }];
    case "musicvideos":
    case "homevideos":
      return [{ id: "videos", label: "全部", recursive: false, shape: "landscape" }];
    default:
      return [{ id: "all", label: "全部", recursive: false, shape: "portrait" }];
  }
}

const SORTS = [
  { id: "SortName", label: "名称" },
  { id: "DateCreated", label: "加入日期" },
  { id: "PremiereDate", label: "首映日期" },
  { id: "ProductionYear", label: "年份" },
  { id: "CommunityRating", label: "社区评分" },
  { id: "CriticRating", label: "影评评分" },
  { id: "OfficialRating", label: "分级" },
  { id: "DatePlayed", label: "播放日期" },
  { id: "PlayCount", label: "播放次数" },
  { id: "Runtime", label: "时长" },
  { id: "Random", label: "随机" },
];

const FILTERS = [
  { id: "IsUnplayed", label: "未观看" },
  { id: "IsPlayed", label: "已观看" },
  { id: "IsResumable", label: "可继续" },
  { id: "IsFavorite", label: "收藏" },
];

const PAGE = 60;

export function LibraryView({ id, query }: { id: string; query: URLSearchParams }) {
  const lib = useAsync(() => api.item(id), [id]);
  const tabs = useMemo(() => tabsFor(lib.data?.CollectionType), [lib.data?.CollectionType]);
  const tab = tabs.find((t) => t.id === query.get("tab")) ?? tabs[0];
  const [prefs, setPrefs] = usePersistentState(`lib:${id}:${tab.id}`, {
    sortBy: "SortName",
    sortOrder: "Ascending" as "Ascending" | "Descending",
    filters: [] as string[],
    genre: "",
    year: "",
  });

  const genres = useAsync(() => api.genres(id, tab.types).then((r) => r.Items ?? []), [id, tab.types], !!lib.data && tab.recursive);
  const yearsList = useAsync(() => api.years(id, tab.types).then((r) => r.Items ?? []), [id, tab.types], !!lib.data && tab.recursive);

  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const loadingRef = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const key = JSON.stringify([id, tab.id, prefs]);

  const load = async (start: number, reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const r = await api.items({
        parentId: id,
        includeItemTypes: tab.types,
        recursive: tab.recursive,
        sortBy: prefs.sortBy === "SortName" ? "SortName" : `${prefs.sortBy},SortName`,
        sortOrder: prefs.sortOrder,
        filters: prefs.filters.join(",") || undefined,
        genreIds: prefs.genre || undefined,
        years: prefs.year || undefined,
        startIndex: start,
        limit: PAGE,
      });
      setItems((prev) => (reset ? r.Items ?? [] : [...prev, ...(r.Items ?? [])]));
      setTotal(r.TotalRecordCount ?? 0);
    } catch {
      /* toast via useAsync paths; grid keeps prior content */
    } finally {
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (!lib.data) return;
    setItems([]);
    setTotal(null);
    load(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, !!lib.data]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting && total !== null && items.length < total) load(items.length, false);
      },
      { rootMargin: "800px" },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, total, key]);

  const toggleFilter = (f: string) =>
    setPrefs((p) => ({ ...p, filters: p.filters.includes(f) ? p.filters.filter((x) => x !== f) : [...p.filters, f] }));

  const activeFilters = prefs.filters.length + (prefs.genre ? 1 : 0) + (prefs.year ? 1 : 0);

  return (
    <>
      <PageHeader title={lib.data?.Name ?? ""} />
      <div className="px-4 py-5 md:px-8 md:py-6">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {tabs.length > 1 && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={tab.id}
              onValueChange={(v) => v && navigate(`library/${id}`, { tab: v }, true)}
            >
              {tabs.map((t) => (
                <ToggleGroupItem key={t.id} value={t.id} className="px-3">
                  {t.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <span className="text-sm text-muted-foreground tnum">{total !== null ? `${total} 项` : ""}</span>
          <div className="ml-auto flex items-center gap-2">
            <Select value={prefs.sortBy} onValueChange={(v) => setPrefs((p) => ({ ...p, sortBy: v }))}>
              <SelectTrigger size="sm" className="w-[7.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="排序方向"
              onClick={() =>
                prefs.sortBy === "Random"
                  ? load(0, true)
                  : setPrefs((p) => ({ ...p, sortOrder: p.sortOrder === "Ascending" ? "Descending" : "Ascending" }))
              }
            >
              {prefs.sortBy === "Random" ? <ShuffleIcon /> : prefs.sortOrder === "Ascending" ? <ArrowUpNarrowWideIcon /> : <ArrowDownWideNarrowIcon />}
            </Button>
            {tab.recursive && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FilterIcon />
                    筛选
                    {activeFilters > 0 && <span className="rounded bg-foreground px-1 text-[11px] text-background tnum">{activeFilters}</span>}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
                  <DropdownMenuLabel>状态</DropdownMenuLabel>
                  {FILTERS.map((f) => (
                    <DropdownMenuCheckboxItem
                      key={f.id}
                      checked={prefs.filters.includes(f.id)}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={() => toggleFilter(f.id)}
                    >
                      {f.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {(genres.data?.length ?? 0) > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>类型</DropdownMenuLabel>
                      {genres.data!.map((g) => (
                        <DropdownMenuCheckboxItem
                          key={g.Id}
                          checked={prefs.genre === g.Id}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={(c) => setPrefs((p) => ({ ...p, genre: c ? g.Id! : "" }))}
                        >
                          {g.Name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </>
                  )}
                  {(yearsList.data?.length ?? 0) > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>年份</DropdownMenuLabel>
                      {yearsList.data!.map((y) => (
                        <DropdownMenuCheckboxItem
                          key={y.Name}
                          checked={prefs.year === y.Name}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={(c) => setPrefs((p) => ({ ...p, year: c ? y.Name ?? "" : "" }))}
                        >
                          {y.Name}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </>
                  )}
                  {activeFilters > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="p-1">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => setPrefs((p) => ({ ...p, filters: [], genre: "", year: "" }))}>
                          清除筛选
                        </Button>
                      </div>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <Grid items={items} shape={tab.shape} />
        <div ref={sentinel} className="h-px" />
      </div>
    </>
  );
}
