import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

export async function GET(request: Request) {
  const auth = await requireAuth(["superadmin", "admin"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("group_leader_assignments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message, code: error.code, details: error.details },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}
