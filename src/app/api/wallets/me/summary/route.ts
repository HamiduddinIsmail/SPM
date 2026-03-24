import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/server/auth/require-role";

export async function GET() {
  const auth = await requireAuth(["superadmin", "admin", "agent", "customer"]);
  if (!auth.ok) {
    return auth.errorResponse;
  }

  const supabase = createSupabaseAdminClient();
  const { data: walletAccount, error: walletError } = await supabase
    .from("wallet_accounts")
    .select("id, owner_user_id, token_symbol, created_at")
    .eq("owner_user_id", auth.context.userId)
    .single();

  if (walletError) {
    if (walletError.code === "PGRST116") {
      return NextResponse.json({
        ok: true,
        data: {
          wallet: null,
          balanceRm: 0,
        },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        message: walletError.message,
        code: walletError.code,
        details: walletError.details,
      },
      { status: 400 },
    );
  }

  const { data: entries, error: entriesError } = await supabase
    .from("wallet_ledger_entries")
    .select("direction, amount_rm")
    .eq("wallet_account_id", walletAccount.id);

  if (entriesError) {
    return NextResponse.json(
      {
        ok: false,
        message: entriesError.message,
        code: entriesError.code,
        details: entriesError.details,
      },
      { status: 400 },
    );
  }

  const balanceRm = (entries ?? []).reduce((sum, entry) => {
    return entry.direction === "credit"
      ? sum + Number(entry.amount_rm)
      : sum - Number(entry.amount_rm);
  }, 0);

  return NextResponse.json({
    ok: true,
    data: {
      wallet: walletAccount,
      balanceRm,
    },
  });
}
