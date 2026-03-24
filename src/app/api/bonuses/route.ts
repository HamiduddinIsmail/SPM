import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

export async function GET(request: Request) {
  const auth = await requireAuth(["superadmin", "admin"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get("year"));
  const month = Number(searchParams.get("month"));
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("bonus_records")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (Number.isInteger(year) && year >= 2000 && year <= 2100) {
    query = query.eq("period_year", year);
  }

  if (Number.isInteger(month) && month >= 1 && month <= 12) {
    query = query.eq("period_month", month);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message, code: error.code, details: error.details },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}
