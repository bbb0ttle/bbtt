import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Item } from "@/api";
import { MediaCard, type Shape } from "@/components/media/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const cardWidth: Record<Shape, string> = {
  portrait: "w-[clamp(120px,28vw,168px)]",
  landscape: "w-[clamp(220px,62vw,300px)]",
  square: "w-[clamp(130px,30vw,176px)]",
};

export function Shelf({
  title,
  items,
  shape = "portrait",
  action,
}: {
  title: string;
  items: Item[] | undefined;
  shape?: Shape;
  action?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };

  useEffect(update, [items]);

  if (items && items.length === 0) return null;

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-center gap-2 px-4 md:px-8">
        <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
        {action}
        <div className="ml-auto hidden gap-1 md:flex">
          <Button variant="ghost" size="icon-sm" aria-label="向左" disabled={edge.start} onClick={() => scroll(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="向右" disabled={edge.end} onClick={() => scroll(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <div
        ref={ref}
        onScroll={update}
        className="flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:scroll-px-8 md:gap-4 md:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {items
          ? items.map((it) => <MediaCard key={it.Id} item={it} shape={shape} className={cn("shrink-0 snap-start", cardWidth[shape])} />)
          : Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={cn("shrink-0", cardWidth[shape])}>
                <div className={cn("animate-pulse rounded-lg bg-muted/50", shape === "landscape" ? "aspect-video" : shape === "square" ? "aspect-square" : "aspect-[2/3]")} />
                <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-muted/50" />
              </div>
            ))}
      </div>
    </section>
  );
}

export function Grid({ items, shape = "portrait" }: { items: Item[]; shape?: Shape }) {
  return (
    <div
      className={cn(
        "grid gap-x-3 gap-y-5 md:gap-x-4 md:gap-y-6",
        shape === "landscape"
          ? "grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
          : "grid-cols-[repeat(auto-fill,minmax(118px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]",
      )}
    >
      {items.map((it) => (
        <MediaCard key={it.Id} item={it} shape={shape} />
      ))}
    </div>
  );
}
