import * as api from "@/api";
import { PageHeader } from "@/components/layout/page-header";
import { Shelf } from "@/components/media/shelf";
import { useAsync } from "@/hooks/use-async";

const GROUPS: { types: string; title: string; shape: "portrait" | "landscape" | "square" }[] = [
  { types: "Movie", title: "电影", shape: "portrait" },
  { types: "Series", title: "剧集", shape: "portrait" },
  { types: "Episode", title: "单集", shape: "landscape" },
  { types: "BoxSet", title: "合集", shape: "portrait" },
  { types: "Person", title: "人物", shape: "portrait" },
  { types: "MusicAlbum", title: "专辑", shape: "square" },
  { types: "Audio", title: "歌曲", shape: "square" },
  { types: "Video,MusicVideo", title: "视频", shape: "landscape" },
];

export function FavoritesView() {
  return (
    <>
      <PageHeader title="收藏" />
      <div className="flex flex-col gap-9 py-6 md:py-8">
        {GROUPS.map((g) => (
          <Fav key={g.types} {...g} />
        ))}
      </div>
    </>
  );
}

function Fav({ types, title, shape }: { types: string; title: string; shape: "portrait" | "landscape" | "square" }) {
  const { data } = useAsync(
    () => api.items({ isFavorite: true, includeItemTypes: types, recursive: true, sortBy: "SortName", limit: 100 }).then((r) => r.Items ?? []),
    [types],
  );
  return <Shelf title={title} items={data} shape={shape} />;
}
