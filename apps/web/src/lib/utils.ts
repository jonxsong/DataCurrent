import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDuration(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const milliseconds = Number(value);
  if (milliseconds < 1) return `${Math.round(milliseconds * 1000)}µs`;
  if (milliseconds < 1000) return `${milliseconds.toFixed(milliseconds < 10 ? 1 : 0)}ms`;
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

export function formatCompact(value: number | string | null | undefined): string {
  if (value == null) return "—";
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value));
}
