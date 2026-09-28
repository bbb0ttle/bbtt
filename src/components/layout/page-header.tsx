import { useEffect, useRef, useState, type ReactNode } from "react";
import { SearchIcon } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Kbd } from "@/components/ui/kbd";
import { navigate, useRoute } from "@/lib/router";
import { cn } from "@/lib/utils";

export function PageHeader({ children, title, transparent }: { children?: ReactNode; title?: ReactNode; transparent?: boolean }) {
  const route = useRoute();
  const inSearch = route.path[0] === "search";
  const [q, setQ] = useState(inSearch ? route.query.get("q") ?? "" : "");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !t.closest("input, textarea, [contenteditable]")) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 px-3 md:px-6",
        transparent ? "bg-gradient-to-b from-background/80 to-transparent" : "border-b bg-background/80 backdrop-blur-xl",
      )}
    >
      <SidebarTrigger className="size-9 [&_svg]:size-[18px]" />
      {title && (
        <>
          <div className="mx-1 h-5 w-px bg-border" />
          <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight">{title}</h1>
        </>
      )}
      {children}
      <form
        className="relative ml-auto w-full max-w-[18rem]"
        onSubmit={(e) => {
          e.preventDefault();
          navigate("search", { q: q.trim() }, inSearch);
        }}
      >
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (inSearch) navigate("search", { q: e.target.value }, true);
          }}
          placeholder="搜索电影、剧集、人物"
          className="h-9 w-full rounded-lg border border-input bg-input/30 pr-9 pl-8 text-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <Kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 max-md:hidden">/</Kbd>
      </form>
    </header>
  );
}
