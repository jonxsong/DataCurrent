import { ArrowRight, Check, Github, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ProductPreview } from "@/components/landing/product-preview";
import { Button } from "@/components/ui/button";

const steps = [
  [
    "01",
    "Detect",
    "Collect real cumulative statistics, observations, and regressions without manufacturing traces.",
  ],
  [
    "02",
    "Investigate",
    "Connect query history, structured plans, schema context, and lineage in one workspace.",
  ],
  [
    "03",
    "Recommend",
    "Generate bounded hypotheses with cited evidence, confidence, and explicit tradeoffs.",
  ],
  [
    "04",
    "Verify",
    "Benchmark in isolation and report median, p95, result agreement, and methodology.",
  ],
];

export default function LandingPage() {
  return (
    <main className="dc-noise overflow-hidden">
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between border-b border-border px-6">
        <Logo className="text-accent" />
        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#workflow" className="hover:text-foreground">
            Workflow
          </a>
          <a href="#architecture" className="hover:text-foreground">
            Architecture
          </a>
          <a
            href="https://github.com/jonxsong/DataCurrent"
            className="hover:text-foreground"
          >
            GitHub
          </a>
        </div>
        <Button asChild size="sm">
          <Link href="/login">
            Launch DataCurrent <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </nav>
      <section className="dc-grid relative border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_10%,rgba(66,229,194,.11),transparent_38%)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 lg:pb-28 lg:pt-36">
          <div className="mb-7 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.14em] text-muted-foreground">
            <i className="size-1.5 rounded-full bg-accent shadow-[0_0_12px_#42e5c2]" />{" "}
            PostgreSQL + Snowflake intelligence
          </div>
          <h1 className="max-w-5xl text-6xl font-semibold leading-[.91] tracking-[-.075em] sm:text-7xl lg:text-[106px]">
            Understand your data.
            <br />
            <span className="text-[#637277]">Optimize every query.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">
            DataCurrent turns workload signals, execution plans, lineage, and AI
            reasoning into one evidence-first investigation flow.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg">
              <Link href="/login">
                Open the application <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="https://github.com/jonxsong/DataCurrent">
                <Github className="size-4" /> View source
              </a>
            </Button>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-6 py-20 lg:py-28">
        <ProductPreview />
        <p className="mt-3 text-right font-mono text-[9px] text-muted-foreground">
          Product workflow · in-app metrics come from collected database
          evidence
        </p>
      </section>
      <section id="workflow" className="border-y border-border">
        <div className="mx-auto max-w-7xl px-6 py-28">
          <div className="grid gap-8 lg:grid-cols-[.6fr_1fr_1fr]">
            <span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
              01 / Workflow
            </span>
            <h2 className="text-4xl font-semibold tracking-[-.055em]">
              From signal to
              <br />
              measured outcome.
            </h2>
            <p className="leading-7 text-muted-foreground">
              Every recommendation keeps a visible evidence chain—from the event
              that opened an investigation to the benchmark that validates it.
            </p>
          </div>
          <div className="mt-16 grid border-t border-border sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([number, title, copy]) => (
              <article
                key={title}
                className="min-h-64 border-b border-border py-7 pr-7 sm:border-r lg:border-b-0 lg:pl-7 first:pl-0 last:border-r-0"
              >
                <span className="font-mono text-[9px] text-muted-foreground">
                  {number}
                </span>
                <Check className="mt-10 size-5 text-accent" />
                <h3 className="mt-6 font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section
        id="architecture"
        className="mx-auto grid max-w-7xl gap-16 px-6 py-28 lg:grid-cols-2"
      >
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">
            02 / Design
          </span>
          <h2 className="mt-8 text-5xl font-semibold tracking-[-.06em]">
            Evidence over
            <br />
            guesswork.
          </h2>
        </div>
        <div className="space-y-4">
          {[
            [
              "Read-only by construction",
              "Database privileges, timeouts, host policy, and explicit benchmark isolation—not a UI promise.",
            ],
            [
              "AI with boundaries",
              "Minimized redacted context, narrow evidence tools, structured output, and no autonomous changes.",
            ],
            [
              "Truthful measurement",
              "Cumulative and sampled metrics stay labeled; recommendations become claims only after verification.",
            ],
          ].map(([title, copy]) => (
            <div
              key={title}
              className="flex gap-4 rounded-lg border border-border bg-surface p-5"
            >
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {copy}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-8">
          <Logo className="text-accent" />
          <span className="font-mono text-[10px] text-muted-foreground">
            Evidence over guesswork · 2026
          </span>
        </div>
      </footer>
    </main>
  );
}
