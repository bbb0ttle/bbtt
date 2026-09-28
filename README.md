# bbtt

Jellyfin 12 的自研 Web 客户端（React 19 + Vite 8 + Tailwind v4 + shadcn/ui，Geist 深色）。

- 功能：登录、首页（媒体库 / 继续观看 / 接下来 / 最近添加）、媒体库网格（排序、状态/类型/年份筛选、无限加载）、详情（电影 / 剧集季集 / 单集 / 合集 / 人物、演职人员、章节、相似、花絮、收藏、已看、下载、刷新元数据）、搜索、收藏、设置（服务端音轨/字幕偏好、密码、本机码率与字幕样式）、播放器（DirectPlay / DirectStream / 转码 HLS、音轨、字幕、版本、码率、倍速、画中画、章节、下一集、进度上报）。
- 管理能力：保留 Jellyfin 原生界面 `/web/`，侧栏「管理控制台」指向 `/web/#/dashboard`。

## 开发

```bash
pnpm install
JF_URL=http://<jellyfin>:8096 pnpm dev   # 除 /bbtt/ 与 Vite 内部路径外全部代理到 Jellyfin
pnpm build                               # 产物 dist/，base 为 /bbtt/
```

## 部署

`deploy/default.conf.template` 供 `nginx:alpine` 使用（`/etc/nginx/templates/`，环境变量 `JELLYFIN_UPSTREAM=host:port`）：

- `/` → `bbtt/index.html`；`/bbtt/` → `dist/`（挂载为 `/usr/share/nginx/html/bbtt`）
- 其余路径（API、`/web/`、`/socket` WebSocket、视频流）→ Jellyfin
- 访问日志不记录查询串（媒体 URL 含 `ApiKey`）
