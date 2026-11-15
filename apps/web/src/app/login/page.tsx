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
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const session = await apiFetch<{ workspaces: Array<{ id: string }> }>(
        `/auth/login`,
        {
          method: "POST",
          body: JSON.stringify({
            email: form.get("email"),
            password: form.get("password"),
          }),
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
          <h1 className="text-2xl font-semibold tracking-[-.04em]">Sign in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Continue to your database intelligence workspace.
          </p>
          <div className="mt-7 space-y-4">
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
              autoComplete="current-password"
              required
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? (
                "Signing in…"
              ) : (
                <>
                  Sign in <ArrowRight className="size-4" />
                </>
              )}
            </Button>
            <Button
              asChild
              className="w-full"
              type="button"
              variant="secondary"
            >
              <Link href="/app/demo/overview">
                Explore demo without account
              </Link>
            </Button>
          </div>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          New workspace registration is available through the API during this
          preview.
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
