import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ExternalLinkIcon } from "lucide-react";
import type { UserConfiguration } from "@/api";
import * as api from "@/api";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAsync } from "@/hooks/use-async";
import { run } from "@/lib/run";
import { BITRATES, usePlayerPrefs } from "@/lib/prefs";

const LANGS = [
  { value: "", label: "任意" },
  { value: "chi", label: "中文" },
  { value: "yue", label: "粤语" },
  { value: "eng", label: "英语" },
  { value: "jpn", label: "日语" },
  { value: "kor", label: "韩语" },
  { value: "fre", label: "法语" },
  { value: "ger", label: "德语" },
  { value: "spa", label: "西班牙语" },
];

const SUB_MODES = [
  { value: "Default", label: "默认：音轨与字幕语言不同时显示" },
  { value: "Smart", label: "智能：音轨为外语时显示" },
  { value: "OnlyForced", label: "仅强制字幕" },
  { value: "Always", label: "始终显示" },
  { value: "None", label: "不显示" },
];

export function SettingsView() {
  const user = useAsync(() => api.me(), []);
  const [cfg, setCfg] = useState<UserConfiguration | null>(null);
  const [prefs, setPrefs] = usePlayerPrefs();

  useEffect(() => {
    if (user.data?.Configuration) setCfg(user.data.Configuration);
  }, [user.data]);

  const save = async (patch: Partial<UserConfiguration>) => {
    if (!cfg) return;
    const next = { ...cfg, ...patch };
    const prev = cfg;
    setCfg(next);
    const ok = await run(() => api.updateUserConfig(next).then(() => true));
    if (!ok) setCfg(prev);
  };

  return (
    <>
      <PageHeader title="设置" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 md:px-8 md:py-8">
        <Section title="播放" desc="音轨与字幕偏好保存在服务器，所有客户端共享。">
          <SelectRow
            label="首选音轨语言"
            value={cfg?.AudioLanguagePreference ?? ""}
            options={LANGS}
            onChange={(v) => save({ AudioLanguagePreference: v || null })}
            disabled={!cfg}
          />
          <SwitchRow label="播放默认音轨（忽略语言偏好）" checked={!!cfg?.PlayDefaultAudioTrack} onChange={(v) => save({ PlayDefaultAudioTrack: v })} disabled={!cfg} />
          <SelectRow
            label="首选字幕语言"
            value={cfg?.SubtitleLanguagePreference ?? ""}
            options={LANGS}
            onChange={(v) => save({ SubtitleLanguagePreference: v || null })}
            disabled={!cfg}
          />
          <SelectRow
            label="字幕模式"
            value={cfg?.SubtitleMode ?? "Default"}
            options={SUB_MODES}
            onChange={(v) => save({ SubtitleMode: v as UserConfiguration["SubtitleMode"] })}
            disabled={!cfg}
          />
          <SwitchRow label="记住音轨选择" checked={!!cfg?.RememberAudioSelections} onChange={(v) => save({ RememberAudioSelections: v })} disabled={!cfg} />
          <SwitchRow label="记住字幕选择" checked={!!cfg?.RememberSubtitleSelections} onChange={(v) => save({ RememberSubtitleSelections: v })} disabled={!cfg} />
          <SwitchRow label="自动播放下一集" checked={!!cfg?.EnableNextEpisodeAutoPlay} onChange={(v) => save({ EnableNextEpisodeAutoPlay: v })} disabled={!cfg} />
        </Section>

        <Section title="首页" desc="控制首页「最近添加」的内容。">
          <SwitchRow label="最近添加中隐藏已观看内容" checked={!!cfg?.HidePlayedInLatest} onChange={(v) => save({ HidePlayedInLatest: v })} disabled={!cfg} />
          <SwitchRow label="显示缺失的剧集" checked={!!cfg?.DisplayMissingEpisodes} onChange={(v) => save({ DisplayMissingEpisodes: v })} disabled={!cfg} />
        </Section>

        <Section title="本设备" desc="仅保存在当前浏览器。">
          <SelectRow
            label="最大码率"
            value={String(prefs.maxBitrate)}
            options={BITRATES.map((b) => ({ value: String(b.value), label: b.label }))}
            onChange={(v) => setPrefs((p) => ({ ...p, maxBitrate: Number(v) }))}
          />
          <SelectRow
            label="字幕字号"
            value={prefs.subtitleSize}
            options={[
              { value: "sm", label: "小" },
              { value: "md", label: "中" },
              { value: "lg", label: "大" },
              { value: "xl", label: "特大" },
            ]}
            onChange={(v) => setPrefs((p) => ({ ...p, subtitleSize: v as typeof p.subtitleSize }))}
          />
          <SwitchRow label="字幕背景" checked={prefs.subtitleBackground} onChange={(v) => setPrefs((p) => ({ ...p, subtitleBackground: v }))} />
        </Section>

        <PasswordSection hasPassword={!!user.data?.HasPassword} />

        <Section title="高级" desc="服务器管理、用户、转码与插件在 Jellyfin 原生控制台中配置。">
          <div className="flex flex-wrap gap-2 p-4">
            <Button variant="outline" asChild>
              <a href="/web/#/mypreferencesmenu" target="_blank" rel="noreferrer">
                经典界面偏好设置 <ExternalLinkIcon />
              </a>
            </Button>
            {api.getSession()?.isAdmin && (
              <Button variant="outline" asChild>
                <a href="/web/#/dashboard" target="_blank" rel="noreferrer">
                  管理控制台 <ExternalLinkIcon />
                </a>
              </Button>
            )}
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      <div className="mt-3 divide-y divide-border/60 rounded-xl border bg-card">{children}</div>
    </section>
  );
}

function SwitchRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const v = value === "" ? "__any" : value;
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span>{label}</span>
      <Select value={v} onValueChange={(x) => onChange(x === "__any" ? "" : x)} disabled={disabled}>
        <SelectTrigger className="w-[min(16rem,50vw)]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {options.map((o) => (
            <SelectItem key={o.value || "__any"} value={o.value || "__any"}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && next !== confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    const ok = await run(() => api.changePassword(cur, next).then(() => true), "密码已更新");
    setBusy(false);
    if (ok) {
      setCur("");
      setNext("");
      setConfirm("");
    }
  };

  return (
    <Section title="密码">
      <form onSubmit={submit} className="grid gap-3 p-4 sm:grid-cols-3">
        {hasPassword && (
          <Input type="password" autoComplete="current-password" placeholder="当前密码" value={cur} onChange={(e) => setCur(e.target.value)} />
        )}
        <Input type="password" autoComplete="new-password" placeholder="新密码" value={next} onChange={(e) => setNext(e.target.value)} />
        <Input
          type="password"
          autoComplete="new-password"
          placeholder="确认新密码"
          aria-invalid={mismatch}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <div className="flex items-center gap-3 sm:col-span-3">
          <Button type="submit" disabled={busy || !next || mismatch}>
            {busy && <Spinner />}
            更新密码
          </Button>
          {mismatch && <span className="text-sm text-destructive">两次输入不一致</span>}
        </div>
      </form>
    </Section>
  );
}
