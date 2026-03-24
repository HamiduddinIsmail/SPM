import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type TopupBody = {
  amountRm?: number;
  idempotencyKey?: string;
};

function parseAmount(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new Error("amountRm must be a number greater than zero.");
  }
  return value;
}

export async function POST(request: Request) {
  const auth = await requireAuth(["superadmin", "admin", "agent", "customer"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  try {
    const body = (await request.json()) as TopupBody;
    const amountRm = parseAmount(body.amountRm);
    const idempotencyKey =
      body.idempotencyKey?.trim() || `wallet-topup:${auth.context.userId}:${randomUUID()}`;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("topup_wallet_for_user", {
      p_owner_user_id: auth.context.userId,
      p_actor_user_id: auth.context.userId,
      p_amount_rm: amountRm,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      return NextResponse.json(
        { ok: false, message: error.message, code: error.code, details: error.details },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, idempotencyKey, result: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected request error.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
