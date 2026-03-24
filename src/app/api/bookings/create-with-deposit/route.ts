import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type CreateBookingBody = {
  packageId?: string;
  bookedByUserId?: string;
  beneficiaryAgentId?: string | null;
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
    const auth = await requireAuth(["superadmin", "admin", "agent", "customer"]);
    if (!auth.ok) {
      return auth.errorResponse;
    }

    const body = (await request.json()) as CreateBookingBody;

    const packageId = assertRequiredString(body.packageId, "packageId");
    const bookedByUserId = assertRequiredString(
      body.bookedByUserId,
      "bookedByUserId",
    );
    const idempotencyKey =
      body.idempotencyKey?.trim() || `booking:${packageId}:${randomUUID()}`;
    const beneficiaryAgentId = body.beneficiaryAgentId ?? null;
    const actorUserId = auth.context.userId;

    if (auth.context.role === "customer" && bookedByUserId !== actorUserId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Customers can only create bookings for themselves.",
        },
        { status: 403 },
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.rpc("create_booking_with_deposit", {
      p_package_id: packageId,
      p_booked_by_user_id: bookedByUserId,
      p_actor_user_id: actorUserId,
      p_beneficiary_agent_id: beneficiaryAgentId,
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
      bookingId: data,
      idempotencyKey,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected request error.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
