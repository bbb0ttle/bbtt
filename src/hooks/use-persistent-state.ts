import { useEffect, useState } from "react";

export function usePersistentState<T extends object>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`bbjf:${key}`);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return initial;
      return { ...initial, ...parsed };
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    if (!value || typeof value !== "object") return;
    localStorage.setItem(`bbjf:${key}`, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
}
