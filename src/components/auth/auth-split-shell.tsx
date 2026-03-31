import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

type AuthSplitShellProps = {
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
  /** e.g. "Already have an account? " + link */
  bottomLink?: React.ReactNode;
};

export function AuthSplitShell({ title, children, footer, bottomLink }: AuthSplitShellProps) {
  return (
    <div className="relative flex min-h-dvh w-full flex-1 items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
      <div className="absolute inset-0">
        <Image
          src="/auth-hero.png"
          alt=""
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-950/35 via-zinc-900/45 to-emerald-950/55 dark:from-zinc-950/50 dark:via-zinc-950/65 dark:to-black/70"
          aria-hidden
        />
      </div>

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-[2rem] border border-white/20 bg-white/95 px-8 py-10 shadow-xl shadow-black/25 backdrop-blur-md dark:border-zinc-700/60 dark:bg-zinc-900/90 dark:shadow-black/50 sm:px-10">
          <AuthBrandMark />

          <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-[1.65rem]">
            {title}
          </h1>

          <div className="mt-8">{children}</div>

          <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{footer}</p>

          {bottomLink ? (
            <p className="mt-5 text-center text-sm text-zinc-600 dark:text-zinc-400">{bottomLink}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AuthBrandMark() {
  return (
    <Link
      href="/"
      className="flex items-center justify-center gap-2.5 no-underline outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-sm font-bold text-zinc-900 shadow-sm ring-1 ring-lime-500/30">
        SPM
      </span>
      <span className="text-lg font-semibold tracking-tight lowercase text-zinc-900 dark:text-zinc-100">
        travel agency
      </span>
    </Link>
  );
}
