import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="font-mono text-[9px] uppercase tracking-[.14em] text-muted-foreground">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.05em]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{actions}</div>;
}
