import { useEffect, useState, type FormEvent } from "react";
import { ClapperboardIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { HttpError, login, publicInfo } from "@/api";

export function Login({ onOk }: { onOk: () => void }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [server, setServer] = useState("");

  useEffect(() => {
    publicInfo()
      .then((i) => setServer(`${i.ServerName ?? ""} · Jellyfin ${i.Version ?? ""}`))
      .catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await login(user, pass);
      onOk();
    } catch (e) {
      setErr(e instanceof HttpError && e.status === 401 ? "用户名或密码错误" : e instanceof Error ? e.message : "无法建立连接");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm animate-in duration-300 fade-in-0 slide-in-from-bottom-2">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl border bg-card shadow-sm">
            <ClapperboardIcon className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Jellyfin</h1>
            <p className="mt-1 text-sm text-muted-foreground">{server || "登录以浏览媒体库"}</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <FieldGroup className="gap-5">
            <Field>
              <FieldLabel htmlFor="user">用户名</FieldLabel>
              <Input id="user" autoFocus autoComplete="username" className="h-10" value={user} onChange={(e) => setUser(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="pass">密码</FieldLabel>
              <Input id="pass" type="password" autoComplete="current-password" className="h-10" value={pass} onChange={(e) => setPass(e.target.value)} />
            </Field>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" size="lg" className="h-10 w-full" disabled={busy || !user}>
              {busy && <Spinner />}
              登录
            </Button>
          </FieldGroup>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a className="underline-offset-4 hover:text-foreground hover:underline" href="/web/#/forgotpassword">
            忘记密码
          </a>
          <span className="mx-2">·</span>
          <a className="underline-offset-4 hover:text-foreground hover:underline" href="/web/">
            经典界面
          </a>
        </p>
      </form>
    </div>
  );
}
