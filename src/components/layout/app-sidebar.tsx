import type { ComponentType } from "react";
import {
  BookOpenIcon,
  ClapperboardIcon,
  ExternalLinkIcon,
  FilmIcon,
  FolderIcon,
  HeartIcon,
  HouseIcon,
  LayoutDashboardIcon,
  ListMusicIcon,
  LogOutIcon,
  MusicIcon,
  RadioIcon,
  SearchIcon,
  SettingsIcon,
  TvIcon,
  VideoIcon,
  LibraryIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Item } from "@/api";
import { getSession } from "@/api";
import { href, useRoute } from "@/lib/router";

type Icon = ComponentType<{ className?: string }>;

export function libraryIcon(collectionType?: string | null): Icon {
  switch (collectionType) {
    case "movies":
      return FilmIcon;
    case "tvshows":
      return TvIcon;
    case "music":
      return MusicIcon;
    case "musicvideos":
    case "homevideos":
      return VideoIcon;
    case "boxsets":
      return LibraryIcon;
    case "playlists":
      return ListMusicIcon;
    case "livetv":
      return RadioIcon;
    case "books":
      return BookOpenIcon;
    default:
      return FolderIcon;
  }
}

const btn = "h-9 gap-2.5 text-[13px] [&_svg]:size-4";

export function AppSidebar({ libraries, onLogout, version }: { libraries: Item[]; onLogout: () => void; version: string }) {
  const route = useRoute();
  const { setOpenMobile, isMobile } = useSidebar();
  const s = getSession();
  const close = () => isMobile && setOpenMobile(false);
  const at = (p: string, id?: string) => route.path[0] === p && (id === undefined || route.path[1] === id);

  const nav: { label: string; icon: Icon; to: string; active: boolean }[] = [
    { label: "首页", icon: HouseIcon, to: href(""), active: route.path.length === 0 },
    { label: "搜索", icon: SearchIcon, to: href("search"), active: at("search") },
    { label: "收藏", icon: HeartIcon, to: href("favorites"), active: at("favorites") },
  ];

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-14 flex-row items-center gap-2.5 border-b px-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background">
          <ClapperboardIcon className="size-4" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-sm font-semibold tracking-tight">Jellyfin</div>
          {version && <div className="text-[11px] text-muted-foreground">{version}</div>}
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((n) => (
                <SidebarMenuItem key={n.label}>
                  <SidebarMenuButton asChild className={btn} isActive={n.active}>
                    <a href={n.to} onClick={close}>
                      <n.icon />
                      <span>{n.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>媒体库</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {libraries.map((l) => {
                const I = libraryIcon(l.CollectionType);
                return (
                  <SidebarMenuItem key={l.Id}>
                    <SidebarMenuButton asChild className={btn} isActive={at("library", l.Id)}>
                      <a href={href(`library/${l.Id}`)} onClick={close}>
                        <I />
                        <span>{l.Name}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className={btn} isActive={at("settings")}>
              <a href={href("settings")} onClick={close}>
                <SettingsIcon />
                <span>设置</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {s?.isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild className={btn}>
                <a href="/web/#/dashboard" target="_blank" rel="noreferrer">
                  <LayoutDashboardIcon />
                  <span>管理控制台</span>
                  <ExternalLinkIcon className="ml-auto size-3.5! text-muted-foreground" />
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton className={btn} onClick={onLogout}>
              <LogOutIcon />
              <span className="truncate">退出登录</span>
              <span className="ml-auto truncate text-xs text-muted-foreground">{s?.userName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
