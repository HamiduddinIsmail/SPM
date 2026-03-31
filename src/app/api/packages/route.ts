import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";
import { assertPackageCreateInput } from "@/server/modules/package/validate";

type CreatePackageBody = {
  title?: string;
  description?: string;
  priceRm?: unknown;
  seatLimit?: unknown;
  travelStartDate?: string;
  travelEndDate?: string;
  bookingCutoffDate?: string;
  isActive?: boolean;
};

function toNumber(value: unknown): number {
  if (typeof value === "string") return Number(value);
  return Number(value);
}

export async function GET() {
  const auth = await requireAuth(["superadmin", "admin", "agent", "customer"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message, code: error.code, details: error.details },
      { status: 400 },
    );
  }

  const packages = data ?? [];
  if (packages.length === 0) {
    return NextResponse.json({ ok: true, data: [] });
  }

  const ids = packages.map((p) => p.id as string);
  const { data: bookingRows, error: bookingError } = await supabase
    .from("bookings")
    .select("package_id")
    .in("package_id", ids)
    .in("status", ["deposit_paid", "verified"]);

  if (bookingError) {
    return NextResponse.json(
      {
        ok: false,
        message: bookingError.message,
        code: bookingError.code,
        details: bookingError.details,
      },
      { status: 400 },
    );
  }

  const counts = new Map<string, number>();
  for (const row of bookingRows ?? []) {
    const pid = row.package_id as string;
    counts.set(pid, (counts.get(pid) ?? 0) + 1);
  }

  const enriched = packages.map((p) => ({
    ...p,
    seats_booked: counts.get(p.id as string) ?? 0,
  }));

  return NextResponse.json({ ok: true, data: enriched });
}

export async function POST(request: Request) {
  const auth = await requireAuth(["superadmin", "admin"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  try {
    const body = (await request.json()) as CreatePackageBody;
    const parsed = assertPackageCreateInput({
      title: body.title ?? "",
      description: body.description ?? "",
      priceRm: toNumber(body.priceRm),
      seatLimit: toNumber(body.seatLimit),
      travelStartDate: body.travelStartDate ?? "",
      travelEndDate: body.travelEndDate ?? "",
      bookingCutoffDate: body.bookingCutoffDate ?? "",
      isActive: body.isActive ?? true,
    });

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("packages")
      .insert({
        title: parsed.title,
        description: parsed.description,
        price_rm: parsed.priceRm,
        seat_limit: parsed.seatLimit,
        travel_start_date: parsed.travelStartDate,
        travel_end_date: parsed.travelEndDate,
        booking_cutoff_date: parsed.bookingCutoffDate,
        is_active: parsed.isActive,
      })
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
