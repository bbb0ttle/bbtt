import type { Item } from "@/api";
import * as api from "@/api";
import { PageHeader } from "@/components/layout/page-header";
import { Shelf } from "@/components/media/shelf";
import { useAsync } from "@/hooks/use-async";
import { useDeferredValue } from "react";

const GROUPS: { types: string; title: string; shape: "portrait" | "landscape" | "square" }[] = [
  { types: "Movie", title: "电影", shape: "portrait" },
  { types: "Series", title: "剧集", shape: "portrait" },
  { types: "Episode", title: "单集", shape: "landscape" },
  { types: "BoxSet", title: "合集", shape: "portrait" },
  { types: "MusicAlbum", title: "专辑", shape: "square" },
  { types: "Audio", title: "歌曲", shape: "square" },
  { types: "Video,MusicVideo", title: "视频", shape: "landscape" },
];

export function SearchView({ q }: { q: string }) {
  const term = useDeferredValue(q.trim());
  return (
    <>
      <PageHeader title={term ? `“${term}”` : "搜索"} />
      <div className="flex flex-col gap-9 py-6 md:py-8">
        {term ? (
          <>
            {GROUPS.map((g) => (
              <Group key={g.types} term={term} {...g} />
            ))}
            <People term={term} />
          </>
        ) : (
          <Suggestions />
        )}
      </div>
    </>
  );
}

function Group({ term, types, title, shape }: { term: string; types: string; title: string; shape: "portrait" | "landscape" | "square" }) {
  const { data } = useAsync(
    () => api.items({ searchTerm: term, includeItemTypes: types, recursive: true, limit: 24 }).then((r) => r.Items ?? []),
    [term, types],
  );
  return <Shelf title={title} items={data} shape={shape} />;
}

function People({ term }: { term: string }) {
  const { data } = useAsync(() => api.persons(term).then((r) => r.Items ?? []), [term]);
  return <Shelf title="人物" items={data as Item[] | undefined} />;
}

function Suggestions() {
  const { data } = useAsync(
    () => api.items({ recursive: true, includeItemTypes: "Movie,Series", sortBy: "Random", limit: 24, filters: "IsUnplayed" }).then((r) => r.Items ?? []),
    [],
  );
  return <Shelf title="随便看看" items={data} />;
}
