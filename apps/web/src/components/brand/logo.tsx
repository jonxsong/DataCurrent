import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="DataCurrent"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" className="size-7 shrink-0">
        <path d="M3 25V16l6-3v11l-6 1Z" fill="currentColor" opacity=".5" />
        <path d="M12 23V9l6-3v16l-6 1Z" fill="currentColor" opacity=".75" />
        <path d="M21 21V3l6-3v20l-6 1Z" fill="currentColor" />
      </svg>
      {!compact && (
        <span className="font-semibold tracking-[-0.04em] text-foreground">
          DataCurrent
        </span>
      )}
    </span>
  );
}
