"use client";

import { FormEvent, useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const session = await apiFetch<{ workspaces: Array<{ id: string }> }>(
        `/auth/${mode === "login" ? "login" : "register"}`,
        {
          method: "POST",
          body: JSON.stringify(
            mode === "login"
              ? {
                  email: form.get("email"),
                  password: form.get("password"),
                }
              : {
                  email: form.get("email"),
                  password: form.get("password"),
                  display_name: form.get("display_name"),
                  workspace_name: form.get("workspace_name"),
                },
          ),
        },
      );
      router.push(`/app/${session.workspaces[0]?.id}/overview`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="dc-grid grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-9 flex justify-center">
          <Logo className="text-accent" />
        </Link>
        <form
          onSubmit={submit}
          className="rounded-xl border border-border bg-surface p-6 shadow-2xl"
        >
          <h1 className="text-2xl font-semibold tracking-[-.04em]">
            {mode === "login" ? "Sign in" : "Create your workspace"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login"
              ? "Continue to your database intelligence workspace."
              : "Start securely, then connect PostgreSQL or Snowflake."}
          </p>
          <div className="mt-7 space-y-4">
            {mode === "register" && (
              <>
                <AuthField
                  label="Your name"
                  name="display_name"
                  autoComplete="name"
                  required
                />
                <AuthField
                  label="Workspace name"
                  name="workspace_name"
                  required
                />
              </>
            )}
            <AuthField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <AuthField
              label="Password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "register" ? 12 : undefined}
              required
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? (
                mode === "login" ? "Signing in…" : "Creating workspace…"
              ) : (
                <>
                  {mode === "login" ? "Sign in" : "Create workspace"}{" "}
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
            <Button
              className="w-full"
              type="button"
              variant="secondary"
              onClick={() => {
                setError(null);
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login"
                ? "Create an account"
                : "I already have an account"}
            </Button>
          </div>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          Sessions are HTTP-only; database secrets are never returned to the
          browser.
        </p>
      </div>
    </main>
  );
}

function AuthField(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const { label, ...input } = props;
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium">{label}</span>
      <input
        {...input}
        className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent"
      />
    </label>
  );
}
