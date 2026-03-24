import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        { ok: false, message: "Supabase reachable, session check failed." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Supabase client initialized successfully.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected health check error.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
