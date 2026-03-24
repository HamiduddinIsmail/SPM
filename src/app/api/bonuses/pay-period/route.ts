import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type PayBonusesBody = {
  year?: number;
  month?: number;
  externalBatchId?: string;
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
    const body = (await request.json()) as PayBonusesBody;
    const year = parseYear(body.year);
    const month = parseMonth(body.month);
    const externalBatchId = body.externalBatchId?.trim() || null;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("pay_confirmed_bonuses_for_period", {
      p_year: year,
      p_month: month,
      p_actor_user_id: auth.context.userId,
      p_external_batch_id: externalBatchId,
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
