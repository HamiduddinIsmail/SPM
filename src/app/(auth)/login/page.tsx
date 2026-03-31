"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { PasswordField } from "@/components/auth/password-field";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        router.replace("/dashboard");
      }
    }

    void checkSession();
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(null);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMessage("Login successful. Redirecting...");
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <AuthSplitShell
      title="Sign in"
      footer={
        <>
          By signing in you agree to SPM&apos;s{" "}
          <a href="#" className="font-medium text-lime-600 hover:text-lime-500 dark:text-lime-400 dark:hover:text-lime-300">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="font-medium text-lime-600 hover:text-lime-500 dark:text-lime-400 dark:hover:text-lime-300">
            Privacy Policy
          </a>
          .
        </>
      }
      bottomLink={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-semibold text-lime-600 hover:text-lime-500 dark:text-lime-400 dark:hover:text-lime-300"
          >
            Create account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="sr-only" htmlFor="login-email">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            required
            disabled={isLoading}
            className="w-full rounded-2xl border border-zinc-200 bg-white py-3 px-4 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-lime-500 focus:ring-2 focus:ring-lime-400/40 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-lime-400"
          />
        </div>

        <PasswordField
          value={password}
          onChange={setPassword}
          placeholder="Password"
          autoComplete="current-password"
          disabled={isLoading}
        />

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-full bg-lime-400 py-3.5 text-sm font-semibold text-zinc-900 shadow-sm transition hover:bg-lime-300 disabled:opacity-50 dark:bg-lime-400 dark:text-zinc-900 dark:hover:bg-lime-300"
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {message ? (
        <p className="mt-4 rounded-2xl bg-emerald-500/15 px-4 py-3 text-center text-sm text-emerald-800 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 text-center text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
    </AuthSplitShell>
  );
}
