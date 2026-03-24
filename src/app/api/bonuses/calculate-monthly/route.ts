import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type CalculateBonusesBody = {
  year?: number;
  month?: number;
};

function parseYear(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 2000 || value > 2100) {
    throw new Error("year must be an integer between 2000 and 2100.");
  }
  return value;
}

function parseMonth(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 12) {
    throw new Error("month must be an integer between 1 and 12.");
  }
  return value;
}

export async function POST(request: Request) {
  const auth = await requireAuth(["superadmin", "admin"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  try {
    const body = (await request.json()) as CalculateBonusesBody;
    const now = new Date();
    const year = parseYear(body.year ?? now.getUTCFullYear());
    const month = parseMonth(body.month ?? now.getUTCMonth() + 1);

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("calculate_monthly_bonuses", {
      p_year: year,
      p_month: month,
      p_actor_user_id: auth.context.userId,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message, code: error.code, details: error.details },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected request error.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
