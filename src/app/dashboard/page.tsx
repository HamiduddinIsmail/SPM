import { redirect } from "next/navigation";
import { requireAuth } from "@/server/auth/require-role";
import { DashboardClient } from "@/app/dashboard/dashboard-client";

export default async function DashboardPage() {
  const auth = await requireAuth();
  if (!auth.ok) {
    redirect("/login");
  }

  return <DashboardClient role={auth.context.role} userId={auth.context.userId} />;
}
