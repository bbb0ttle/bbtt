import { toast } from "sonner";

export async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> {
  try {
    const r = await fn();
    if (ok) toast.success(ok);
    return r;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : String(e));
    return undefined;
  }
}
