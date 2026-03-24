import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type VerifyBookingBody = {
  bookingId?: string;
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

    const body = (await request.json()) as VerifyBookingBody;
    const bookingId = assertRequiredString(body.bookingId, "bookingId");
    const actorUserId = auth.context.userId;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc(
      "verify_booking_and_confirm_commissions",
      {
        p_booking_id: bookingId,
        p_actor_user_id: actorUserId,
      },
    );

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
      result: data,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected request error.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
