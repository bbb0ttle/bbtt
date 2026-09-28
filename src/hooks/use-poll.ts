import { useCallback, useEffect, useRef, useState } from "react";

export function usePoll<T>(fetcher: () => Promise<T>, deps: unknown[], interval = 2000, enabled = true) {
  const [data, setData] = useState<T | undefined>(undefined);
  const ref = useRef(fetcher);
  ref.current = fetcher;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let timer: number | undefined;
    setData(undefined);
    const run = async () => {
      try {
        const d = await ref.current();
        if (alive) setData(d);
      } catch {
        /* surfaced by global handlers */
      }
      if (alive && interval > 0) timer = window.setTimeout(run, document.hidden ? interval * 3 : interval);
    };
    run();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, interval, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, reload };
}
