import { useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";

export function Img({
  src,
  alt = "",
  className,
  fallback: Fallback,
  eager,
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  fallback?: ComponentType<{ className?: string }>;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div className={cn("flex items-center justify-center bg-muted/60 text-muted-foreground/60", className)}>
        {Fallback && <Fallback className="size-8" />}
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={cn("bg-muted/60 object-cover transition-opacity duration-300 ease-out", loaded ? "opacity-100" : "opacity-0", className)}
    />
  );
}
