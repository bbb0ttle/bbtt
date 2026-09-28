import { useEffect, useState } from "react";
import type { Item } from "@/api";
import * as api from "@/api";
import { PageHeader } from "@/components/layout/page-header";
import { Shelf } from "@/components/media/shelf";
import { MediaCard } from "@/components/media/card";
import { useAsync } from "@/hooks/use-async";

const latestShape = (ct?: string | null) => (ct === "music" ? "square" : ct === "homevideos" || ct === "musicvideos" ? "landscape" : "portrait");

export function HomeView({ libraries }: { libraries: Item[] }) {
  const resume = useAsync(() => api.resume("Video").then((r) => r.Items ?? []), []);
  const next = useAsync(() => api.nextUp().then((r) => r.Items ?? []), []);
  const [latest, setLatest] = useState<Record<string, Item[]>>({});

  useEffect(() => {
    for (const l of libraries) {
      if (!l.Id || ["playlists", "boxsets", "livetv"].includes(l.CollectionType ?? "")) continue;
      api
        .latest(l.Id)
        .then((items) => setLatest((m) => ({ ...m, [l.Id!]: items })))
        .catch(() => setLatest((m) => ({ ...m, [l.Id!]: [] })));
    }
  }, [libraries]);

  return (
    <>
      <PageHeader title="首页" />
      <div className="flex flex-col gap-9 py-6 md:gap-10 md:py-8">
        {libraries.length > 0 && (
          <section>
            <h2 className="mb-3 px-4 text-[15px] font-semibold tracking-tight md:px-8">我的媒体</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 px-4 md:gap-4 md:px-8">
              {libraries.map((l) => (
                <MediaCard key={l.Id} item={l} shape="landscape" subtitle="" />
              ))}
            </div>
          </section>
        )}
        <Shelf title="继续观看" items={resume.data} shape="landscape" />
        <Shelf title="接下来" items={next.data} shape="landscape" />
        {libraries
          .filter((l) => l.Id && l.Id in latest)
          .map((l) => (
            <Shelf key={l.Id} title={`最近添加 · ${l.Name}`} items={latest[l.Id!]} shape={latestShape(l.CollectionType)} />
          ))}
      </div>
    </>
  );
}
