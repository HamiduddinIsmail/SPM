import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type UpdateRuleBody = {
  ruleKey?: string;
  intValue?: number | null;
  numericValue?: number | null;
  isActive?: boolean;
};

export async function GET() {
  const auth = await requireAuth(["superadmin", "admin"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bonus_rule_configs")
    .select("*")
    .order("rule_key", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message, code: error.code, details: error.details },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(["superadmin", "admin"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  try {
    const body = (await request.json()) as UpdateRuleBody;
    const ruleKey = body.ruleKey?.trim();
    if (!ruleKey) {
      throw new Error("ruleKey is required.");
    }

    const updates: Record<string, unknown> = {};
    if (body.intValue !== undefined) {
      if (body.intValue !== null && (!Number.isInteger(body.intValue) || body.intValue < 0)) {
        throw new Error("intValue must be null or a non-negative integer.");
      }
      updates.int_value = body.intValue;
    }

    if (body.numericValue !== undefined) {
      if (
        body.numericValue !== null &&
        (typeof body.numericValue !== "number" || Number.isNaN(body.numericValue) || body.numericValue < 0)
      ) {
        throw new Error("numericValue must be null or a non-negative number.");
      }
      updates.numeric_value = body.numericValue;
    }

    if (body.isActive !== undefined) {
      updates.is_active = body.isActive;
    }

    if (Object.keys(updates).length === 0) {
      throw new Error("No update fields provided.");
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("bonus_rule_configs")
      .update(updates)
      .eq("rule_key", ruleKey)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message, code: error.code, details: error.details },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected request error.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
