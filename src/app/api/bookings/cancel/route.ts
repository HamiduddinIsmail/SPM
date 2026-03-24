import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type CancelBookingBody = {
  bookingId?: string;
  idempotencyKey?: string;
};

function assertRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(["superadmin", "admin"]);
    if (!auth.ok) {
      return auth.errorResponse;
    }

    const body = (await request.json()) as CancelBookingBody;
    const bookingId = assertRequiredString(body.bookingId, "bookingId");
    const actorUserId = auth.context.userId;
    const idempotencyKey =
      body.idempotencyKey?.trim() || `booking-cancel:${bookingId}:${randomUUID()}`;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("cancel_booking_and_refund", {
      p_booking_id: bookingId,
      p_actor_user_id: actorUserId,
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
          code: error.code,
          details: error.details,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      idempotencyKey,
      result: data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected request error.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
