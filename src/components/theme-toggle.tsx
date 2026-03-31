"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="h-9 w-[8.5rem] rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
        aria-hidden
      />
    );
  }

  const base =
    "rounded-md px-2.5 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400";
  const active =
    "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900";
  const inactive =
    "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800";

  return (
    <div
      className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-900"
      role="group"
      aria-label="Color theme"
    >
      <button
        type="button"
        className={`${base} ${theme === "light" ? active : inactive}`}
        onClick={() => setTheme("light")}
      >
        Light
      </button>
      <button
        type="button"
        className={`${base} ${theme === "dark" ? active : inactive}`}
        onClick={() => setTheme("dark")}
      >
        Dark
      </button>
      <button
        type="button"
        className={`${base} ${theme === "system" ? active : inactive}`}
        onClick={() => setTheme("system")}
      >
        Auto
      </button>
    </div>
  );
}
