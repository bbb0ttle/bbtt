import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Login } from "@/components/layout/login";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { HomeView } from "@/views/home";
import { LibraryView } from "@/views/library";
import { ItemView } from "@/views/item";
import { SearchView } from "@/views/search";
import { FavoritesView } from "@/views/favorites";
import { SettingsView } from "@/views/settings";
import * as api from "@/api";
import type { Item } from "@/api";
import { useRoute } from "@/lib/router";

const Player = lazy(() => import("@/components/player/player").then((m) => ({ default: m.Player })));

export default function App() {
  const [authed, setAuthed] = useState(() => !!api.getSession());

  useEffect(() => {
    const on = () => setAuthed(false);
    window.addEventListener("jf:unauthorized", on);
    return () => window.removeEventListener("jf:unauthorized", on);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setAuthed(false);
  }, []);

  return (
    <TooltipProvider delayDuration={400}>
      {authed ? <Shell onLogout={logout} /> : <Login onOk={() => setAuthed(true)} />}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}

function Shell({ onLogout }: { onLogout: () => void }) {
  const route = useRoute();
  const [libraries, setLibraries] = useState<Item[]>([]);
  const [version, setVersion] = useState("");

  useEffect(() => {
    api.views().then((r) => setLibraries(r.Items ?? [])).catch(() => {});
    api.publicInfo().then((i) => setVersion(`${i.ServerName ?? ""} · ${i.Version ?? ""}`)).catch(() => {});
  }, []);

  const [head, id] = route.path;

  useEffect(() => {
    document.querySelector("[data-slot=sidebar-inset]")?.scrollTo({ top: 0 });
  }, [head, id]);

  if (head === "play" && id)
    return (
      <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
        <Player key={`${id}:${route.query.toString()}`} id={id} query={route.query} />
      </Suspense>
    );

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar libraries={libraries} onLogout={onLogout} version={version} />
      <SidebarInset className="min-w-0 overflow-y-auto overflow-x-hidden">
        {head === undefined && <HomeView libraries={libraries} />}
        {head === "library" && id && <LibraryView key={id} id={id} query={route.query} />}
        {head === "item" && id && <ItemView key={id} id={id} query={route.query} />}
        {head === "search" && <SearchView q={route.query.get("q") ?? ""} />}
        {head === "favorites" && <FavoritesView />}
        {head === "settings" && <SettingsView />}
      </SidebarInset>
    </SidebarProvider>
  );
}
