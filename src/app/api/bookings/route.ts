import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";
import type { Role } from "@/server/core/types";

const BOOKING_STATUSES = [
  "draft",
  "deposit_pending",
  "deposit_paid",
  "verified",
  "cancelled",
] as const;

function canViewAll(role: Role): boolean {
  return role === "superadmin" || role === "admin";
}

export async function GET(request: Request) {
  const auth = await requireAuth(["superadmin", "admin", "agent", "customer"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Number(searchParams.get("limit") ?? "20");

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("bookings")
    .select("*, packages(title)")
    .order("created_at", { ascending: false })
    .limit(Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 20);

  if (status && BOOKING_STATUSES.includes(status as (typeof BOOKING_STATUSES)[number])) {
    query = query.eq("status", status);
  }

  if (!canViewAll(auth.context.role)) {
    query = query.eq("booked_by_user_id", auth.context.userId);
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
