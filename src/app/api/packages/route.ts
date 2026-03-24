import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

type CreatePackageBody = {
  title?: string;
  priceRm?: number;
  isActive?: boolean;
};

function parsePrice(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new Error("priceRm must be a non-negative number.");
  }
  return value;
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

  return NextResponse.json({ ok: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAuth(["superadmin", "admin"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  try {
    const body = (await request.json()) as CreatePackageBody;
    const title = body.title?.trim();
    if (!title) {
      throw new Error("title is required.");
    }

    const priceRm = parsePrice(body.priceRm);
    const isActive = body.isActive ?? true;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("packages")
      .insert({
        title,
        price_rm: priceRm,
        is_active: isActive,
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
