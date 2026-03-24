import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/require-role";
import { DashboardClient } from "@/app/dashboard/dashboard-client";

export default async function DashboardPage() {
  const auth = await requireAuth();
  if (!auth.ok) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Signed in as <strong>{auth.context.role}</strong>.
        </p>
      </header>

      <DashboardClient role={auth.context.role} userId={auth.context.userId} />
    </main>
  );
}
