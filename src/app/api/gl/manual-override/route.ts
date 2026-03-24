import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type ManualOverrideGlBody = {
  bookingId?: string;
  groupLeaderAgentId?: string;
  reason?: string;
};

function assertRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

export async function POST(request: Request) {
  const auth = await requireAuth(["superadmin", "admin"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  try {
    const body = (await request.json()) as ManualOverrideGlBody;
    const bookingId = assertRequiredString(body.bookingId, "bookingId");
    const groupLeaderAgentId = assertRequiredString(
      body.groupLeaderAgentId,
      "groupLeaderAgentId",
    );
    const reason = assertRequiredString(body.reason, "reason");

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc(
      "manual_override_group_leader_for_booking",
      {
        p_booking_id: bookingId,
        p_group_leader_agent_id: groupLeaderAgentId,
        p_actor_user_id: auth.context.userId,
        p_reason: reason,
      },
    );

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
